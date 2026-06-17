import React, { useState, useRef } from "react";

/**
 * RecruiterApp — Sofia Business CV Engine (Engine 2)
 *
 *  - Upload 2–20 CVs for ONE role (PDF / Word / paste)
 *  - Each CV extracted to text via /extract-text (no AI cost)
 *  - /rank-cvs ranks every candidate and flags likely AI-written CVs
 *  - AI detection is shown as a neutral FLAG, never a score or percentage
 *  - On-screen only — no document export (per spec)
 *
 * Props:
 *   backendUrl   Flask base URL (default http://localhost:5000)
 *
 * Palette and helpers are kept identical to CVApp.jsx so the two engines
 * read as one product.
 */

/* ----------------------------------------------------------------- *
 *  Shared palette (must match CVApp.jsx)                             *
 * ----------------------------------------------------------------- */
const C = {
  bg: "#0A0A0F",
  surface: "#111118",
  border: "#1E1E2E",
  gold: "#B89A68",
  action: "#6C63FF",
  text: "#F1F0FF",
  muted: "#6B6B8A",
};

/* ----------------------------------------------------------------- *
 *  Backend helpers (mirror CVApp.jsx)                                *
 * ----------------------------------------------------------------- */
function normBase(url) {
  return (url || "").replace(/\/+$/, "");
}

async function api(backendUrl, path, body) {
  const res = await fetch(`${normBase(backendUrl)}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON error */ }
  if (!res.ok || data.status === "error") {
    throw new Error(data.message || `Request failed (HTTP ${res.status}).`);
  }
  return data;
}

async function uploadFile(backendUrl, file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${normBase(backendUrl)}/extract-text`, { method: "POST", body: form });
  let data = {};
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok || data.status === "error") {
    throw new Error(data.message || `Upload failed (HTTP ${res.status}).`);
  }
  return data;
}

const MAX_UPLOAD_MB = 8;
const MAX_CVS = 20;
const MIN_CVS = 2;
const MIN_CV_CHARS = 120;

/* ----------------------------------------------------------------- *
 *  Small atoms                                                       *
 * ----------------------------------------------------------------- */
function Ellipsis() {
  const [n, setN] = React.useState(1);
  React.useEffect(() => {
    const id = setInterval(() => setN(v => (v % 3) + 1), 450);
    return () => clearInterval(id);
  }, []);
  return <span>{".".repeat(n)}</span>;
}

const card = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 14,
  padding: 20,
};

const label = {
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: C.gold,
  fontWeight: 600,
};

function ErrorCard({ message, onRetry }) {
  return (
    <div style={{ ...card, borderColor: "#EF4444", marginTop: 16 }}>
      <div style={{ color: "#EF4444", fontWeight: 600, marginBottom: 6 }}>Something went wrong</div>
      <div style={{ color: C.text, fontSize: 14, marginBottom: onRetry ? 14 : 0 }}>{message}</div>
      {onRetry && (
        <button onClick={onRetry} style={btn(C.action)}>Try again</button>
      )}
    </div>
  );
}

function btn(bg, disabled) {
  return {
    background: disabled ? C.border : bg,
    color: disabled ? C.muted : "#fff",
    border: "none",
    borderRadius: 10,
    padding: "11px 18px",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
  };
}

/* Rank medal — the structural device that encodes real order (top 3). */
function RankBadge({ rank }) {
  if (!rank) {
    return (
      <div style={{
        width: 34, height: 34, borderRadius: "50%", border: `1px dashed ${C.muted}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: C.muted, fontSize: 13, flexShrink: 0,
      }}>—</div>
    );
  }
  const top = rank <= 3;
  return (
    <div style={{
      width: 34, height: 34, borderRadius: "50%",
      background: top ? C.gold : "transparent",
      border: top ? "none" : `1px solid ${C.border}`,
      color: top ? C.bg : C.text,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: 15, flexShrink: 0,
    }}>{rank}</div>
  );
}

/* AI-written flag — neutral notice, deliberately no score. */
function AIFlag() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: "rgba(245,158,11,0.12)", color: "#F59E0B",
      border: "1px solid rgba(245,158,11,0.4)", borderRadius: 999,
      padding: "3px 10px", fontSize: 12, fontWeight: 600,
    }}>⚠ Possible AI-written CV</span>
  );
}

function Pill({ children, tone = "muted" }) {
  const colors = tone === "gap"
    ? { fg: "#EF4444", bd: "rgba(239,68,68,0.35)" }
    : { fg: C.gold, bd: "rgba(184,154,104,0.4)" };
  return (
    <span style={{
      display: "inline-block", border: `1px solid ${colors.bd}`, color: colors.fg,
      borderRadius: 8, padding: "3px 9px", fontSize: 12, marginRight: 6, marginBottom: 6,
    }}>{children}</span>
  );
}

/* ----------------------------------------------------------------- *
 *  Candidate intake row                                              *
 * ----------------------------------------------------------------- */
function CandidateRow({ index, cv, onChange, onRemove, onUpload }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setErr(`File is over ${MAX_UPLOAD_MB} MB. Upload a smaller file or paste the text.`);
      return;
    }
    if (!/\.(pdf|docx|txt)$/i.test(file.name)) {
      setErr(file.name.toLowerCase().endsWith(".doc")
        ? "Old .doc format is not supported. Re-save as .docx in Word and try again."
        : "Use a PDF, .docx, or .txt file — or paste the CV text.");
      return;
    }
    setBusy(true);
    try {
      const text = await onUpload(file);
      onChange(index, { ...cv, text, name: cv.name || file.name.replace(/\.[^.]+$/, "") });
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div style={{ ...card, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ ...label, color: C.muted }}>Candidate {index + 1}</span>
        <input
          value={cv.name}
          onChange={e => onChange(index, { ...cv, name: e.target.value })}
          placeholder="Name or reference (optional)"
          style={{
            flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
            color: C.text, padding: "7px 10px", fontSize: 13, fontFamily: "inherit",
          }}
        />
        <button onClick={() => onRemove(index)} style={{
          background: "transparent", border: "none", color: C.muted,
          cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 4,
        }} aria-label={`Remove candidate ${index + 1}`}>×</button>
      </div>
      <textarea
        value={cv.text}
        onChange={e => onChange(index, { ...cv, text: e.target.value })}
        placeholder="Paste this candidate's CV text, or upload a file below."
        rows={4}
        style={{
          width: "100%", boxSizing: "border-box", background: C.bg,
          border: `1px solid ${C.border}`, borderRadius: 8, color: C.text,
          padding: 10, fontSize: 13, fontFamily: "inherit", resize: "vertical",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt"
          onChange={handleFile} style={{ display: "none" }} id={`file-${index}`} />
        <label htmlFor={`file-${index}`} style={{
          ...btn(C.border), color: C.text, cursor: "pointer", fontSize: 13, padding: "8px 14px",
        }}>{busy ? <>Reading<Ellipsis /></> : "Upload file"}</label>
        <span style={{ fontSize: 12, color: C.muted }}>
          {cv.text ? `${cv.text.length.toLocaleString()} characters` : "PDF, Word, or text"}
        </span>
      </div>
      {err && <div style={{ color: "#EF4444", fontSize: 12, marginTop: 8 }}>{err}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------- *
 *  Result card per candidate                                         *
 * ----------------------------------------------------------------- */
function ResultCard({ row, meta }) {
  const aiFlagged = row.rulesEngine?.ai_flag;
  const ats = row.rulesEngine?.ats_score;
  return (
    <div style={{
      ...card,
      borderColor: row.rank && row.rank <= 3 ? "rgba(184,154,104,0.5)" : C.border,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <RankBadge rank={row.rank} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: 16, color: C.text }}>
              {meta?.name || `Candidate ${row.candidateIndex}`}
            </span>
            {typeof row.score === "number" && (
              <span style={{ color: C.gold, fontWeight: 700 }}>{row.score}/100</span>
            )}
            {typeof ats === "number" && (
              <span style={{ color: C.muted, fontSize: 12 }}>ATS {ats}/100</span>
            )}
            {aiFlagged && <AIFlag />}
          </div>

          {row.hiringRecommendation && (
            <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
              Recommendation: <span style={{ color: C.text }}>{row.hiringRecommendation}</span>
            </div>
          )}

          {row.topStrengths?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ ...label, marginBottom: 6 }}>Strengths</div>
              {row.topStrengths.map((s, i) => <Pill key={i}>{s}</Pill>)}
            </div>
          )}

          {row.keyGaps?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ ...label, marginBottom: 6, color: "#EF4444" }}>Gaps</div>
              {row.keyGaps.map((g, i) => <Pill key={i} tone="gap">{g}</Pill>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- *
 *  Main component                                                    *
 * ----------------------------------------------------------------- */
export default function RecruiterApp({ backendUrl = "http://localhost:5000" }) {
  const blank = () => ({ name: "", text: "" });
  const [role, setRole] = useState("");
  const [cvs, setCvs] = useState([blank(), blank()]);
  const [phase, setPhase] = useState("intake"); // intake | ranking | results
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const filled = cvs.filter(c => c.text.trim().length >= MIN_CV_CHARS);
  const canRank = filled.length >= MIN_CVS;

  function updateCv(i, next) {
    setCvs(cs => cs.map((c, idx) => (idx === i ? next : c)));
  }
  function addCv() {
    setCvs(cs => (cs.length >= MAX_CVS ? cs : [...cs, blank()]));
  }
  function removeCv(i) {
    setCvs(cs => (cs.length <= MIN_CVS ? cs : cs.filter((_, idx) => idx !== i)));
  }
  async function handleUpload(file) {
    const data = await uploadFile(backendUrl, file);
    return (data.text || data.data?.text || "").trim();
  }

  async function runRanking() {
    setError("");
    setPhase("ranking");
    const active = cvs.filter(c => c.text.trim().length >= MIN_CV_CHARS);
    try {
      const payload = {
        cvTexts: active.map(c => c.text.trim()),
        jdText: role.trim(),
      };
      const res = await api(backendUrl, "/rank-cvs", payload);
      // attach intake names by candidate index for display
      const metaByIndex = {};
      active.forEach((c, i) => { metaByIndex[i + 1] = { name: c.name.trim() }; });
      setResult({ ...res.data, _meta: metaByIndex });
      setPhase("results");
    } catch (ex) {
      setError(ex.message);
      setPhase("intake");
    }
  }

  function resetAll() {
    setRole("");
    setCvs([blank(), blank()]);
    setResult(null);
    setError("");
    setPhase("intake");
  }

  const sorted = result?.rankings
    ? [...result.rankings].sort((a, b) => {
        if (a.rank == null) return 1;
        if (b.rank == null) return -1;
        return a.rank - b.rank;
      })
    : [];

  return (
    <div style={{
      background: C.bg, color: C.text, minHeight: "100%",
      fontFamily: "'DM Sans', system-ui, sans-serif", padding: "28px 20px",
    }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 8 }}>
          <span style={label}>Sofia · Engine 2</span>
        </div>
        <h1 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 30, fontWeight: 400, margin: "2px 0 6px",
        }}>Recruiter shortlist</h1>
        <p style={{ color: C.muted, fontSize: 14, margin: "0 0 24px", lineHeight: 1.5 }}>
          Add the CVs you received for one role. Sofia ranks every candidate, explains the
          top three, and flags CVs that look AI-written. Nothing leaves your screen.
        </p>

        {phase !== "results" && (
          <>
            {/* Role */}
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ ...label, marginBottom: 8 }}>The role</div>
              <textarea
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder="Paste the job description or a short summary of what this role needs. Optional, but it sharpens the ranking."
                rows={3}
                style={{
                  width: "100%", boxSizing: "border-box", background: C.bg,
                  border: `1px solid ${C.border}`, borderRadius: 8, color: C.text,
                  padding: 10, fontSize: 14, fontFamily: "inherit", resize: "vertical",
                }}
              />
            </div>

            {/* Candidates */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {cvs.map((cv, i) => (
                <CandidateRow
                  key={i} index={i} cv={cv}
                  onChange={updateCv} onRemove={removeCv} onUpload={handleUpload}
                />
              ))}
            </div>

            <button
              onClick={addCv}
              disabled={cvs.length >= MAX_CVS}
              style={{ ...btn(C.border, cvs.length >= MAX_CVS), color: C.text, marginTop: 12 }}
            >
              + Add candidate {cvs.length >= MAX_CVS ? `(max ${MAX_CVS})` : ""}
            </button>

            {error && <ErrorCard message={error} onRetry={canRank ? runRanking : null} />}

            <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 14 }}>
              <button
                onClick={runRanking}
                disabled={!canRank || phase === "ranking"}
                style={btn(C.action, !canRank || phase === "ranking")}
              >
                {phase === "ranking" ? <>Ranking candidates<Ellipsis /></> : `Rank ${filled.length || ""} candidates`}
              </button>
              <span style={{ fontSize: 12, color: C.muted }}>
                {canRank
                  ? `${filled.length} ready · 1 credit each`
                  : `Add at least ${MIN_CVS} CVs (${MIN_CV_CHARS}+ characters each)`}
              </span>
            </div>
          </>
        )}

        {/* Results */}
        {phase === "results" && result && (
          <>
            {result.top3Summary && (
              <div style={{ ...card, marginBottom: 16, borderColor: "rgba(184,154,104,0.5)" }}>
                <div style={{ ...label, marginBottom: 8 }}>Top of the list</div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: C.text }}>
                  {result.top3Summary}
                </p>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sorted.map((row, i) => (
                <ResultCard key={i} row={row} meta={result._meta?.[row.candidateIndex]} />
              ))}
            </div>

            {result.commonWeaknesses?.length > 0 && (
              <div style={{ ...card, marginTop: 16 }}>
                <div style={{ ...label, marginBottom: 8 }}>Common across the field</div>
                <ul style={{ margin: 0, paddingLeft: 18, color: C.text, fontSize: 14, lineHeight: 1.6 }}>
                  {result.commonWeaknesses.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            <button onClick={resetAll} style={{ ...btn(C.border), color: C.text, marginTop: 20 }}>
              Start a new shortlist
            </button>
          </>
        )}
      </div>
    </div>
  );
}
