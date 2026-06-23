import React, { useState, useRef } from "react";

/**
 * RecruiterApp — Sofia CV Ranking Engine (Engine 2)
 * White theme — matches the landing page palette.
 *
 *  - Upload 2–20 CVs for ONE role (PDF / Word / paste)
 *  - /rank-cvs ranks every candidate and flags likely AI-written CVs
 *  - AI detection shown as a neutral FLAG, never a score or percentage
 *  - On-screen only — no document export (per spec)
 */

/* ─── Palette (matches LandingPage / CVFlow) ───────────────────────── */
const C = {
  bg: "#FFFFFF",
  surface: "#F8F7F5",
  border: "#E8E8E8",
  gold: "#B89A68",
  goldLight: "#F5EFE6",
  text: "#1A1A1A",
  muted: "#6B6B6B",
  green: "#22C55E",
  red: "#EF4444",
  amber: "#F59E0B",
};

/* ─── Backend helpers ───────────────────────────────────────────────── */
function normBase(url) { return (url || "").replace(/\/+$/, ""); }

async function api(backendUrl, path, body) {
  const res = await fetch(`${normBase(backendUrl)}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON */ }
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

const MAX_MB = 8;
const MAX_CVS = 20;
const MIN_CVS = 2;
const MIN_CHARS = 120;

/* ─── Atoms ─────────────────────────────────────────────────────────── */
function Dots() {
  const [n, setN] = React.useState(1);
  React.useEffect(() => {
    const id = setInterval(() => setN(v => (v % 3) + 1), 450);
    return () => clearInterval(id);
  }, []);
  return <span>{".".repeat(n)}</span>;
}

const cardStyle = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 14,
  padding: 20,
};

const sectionLabel = {
  fontSize: 11,
  letterSpacing: "0.13em",
  textTransform: "uppercase",
  color: C.muted,
  fontWeight: 700,
};

function PrimaryBtn({ children, onClick, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        background: disabled ? C.border : C.gold,
        color: disabled ? C.muted : "#fff",
        border: "none",
        borderRadius: 10,
        padding: "12px 22px",
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

function SecondaryBtn({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        color: C.muted,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "11px 20px",
        fontSize: 14,
        fontWeight: 500,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

function ErrorCard({ message, onRetry }) {
  return (
    <div style={{ background: "#FEF2F2", border: `1px solid ${C.red}33`, borderRadius: 12, padding: "16px 18px", marginTop: 16 }}>
      <div style={{ color: C.red, fontWeight: 600, marginBottom: 6 }}>Something went wrong</div>
      <div style={{ color: C.text, fontSize: 14, marginBottom: onRetry ? 14 : 0 }}>{message}</div>
      {onRetry && <PrimaryBtn onClick={onRetry}>Try again</PrimaryBtn>}
    </div>
  );
}

/* Gold medal for top-3; numbered ring for the rest */
function RankBadge({ rank }) {
  if (!rank) {
    return (
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        border: `1.5px dashed ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: C.muted, fontSize: 14, flexShrink: 0,
      }}>—</div>
    );
  }
  const top = rank <= 3;
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%",
      background: top ? C.gold : "transparent",
      border: top ? "none" : `1.5px solid ${C.border}`,
      color: top ? "#fff" : C.text,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: 15, flexShrink: 0,
    }}>{rank}</div>
  );
}

/* Neutral AI-written flag */
function AIFlag() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: "rgba(245,158,11,0.1)",
      color: C.amber,
      border: "1px solid rgba(245,158,11,0.35)",
      borderRadius: 999,
      padding: "3px 10px",
      fontSize: 12,
      fontWeight: 600,
    }}>⚠ Possible AI-written CV</span>
  );
}

function Pill({ children, tone = "gold" }) {
  const colors = tone === "gap"
    ? { fg: C.red, bg: "#FEE2E2", bd: "#FECACA" }
    : { fg: "#92400E", bg: "#FEF3C7", bd: "#FDE68A" };
  return (
    <span style={{
      display: "inline-block",
      background: colors.bg,
      border: `1px solid ${colors.bd}`,
      color: colors.fg,
      borderRadius: 8,
      padding: "3px 9px",
      fontSize: 12,
      marginRight: 6,
      marginBottom: 6,
    }}>{children}</span>
  );
}

/* ─── Candidate intake row ──────────────────────────────────────────── */
function CandidateRow({ index, cv, onChange, onRemove, onUpload }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    if (file.size > MAX_MB * 1024 * 1024) {
      setErr(`File is over ${MAX_MB} MB. Upload a smaller file or paste the text.`);
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
    <div style={{ ...cardStyle, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ ...sectionLabel, color: C.muted }}>Candidate {index + 1}</span>
        <input
          value={cv.name}
          onChange={e => onChange(index, { ...cv, name: e.target.value })}
          placeholder="Name or reference (optional)"
          style={{
            flex: 1,
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            color: C.text,
            padding: "7px 10px",
            fontSize: 13,
            fontFamily: "inherit",
            outline: "none",
          }}
          onFocus={e => (e.target.style.borderColor = C.gold)}
          onBlur={e => (e.target.style.borderColor = C.border)}
        />
        <button
          onClick={() => onRemove(index)}
          style={{
            background: "transparent", border: "none",
            color: C.muted, cursor: "pointer",
            fontSize: 20, lineHeight: 1, padding: 4,
          }}
          aria-label={`Remove candidate ${index + 1}`}
        >×</button>
      </div>

      <textarea
        value={cv.text}
        onChange={e => onChange(index, { ...cv, text: e.target.value })}
        placeholder="Paste this candidate's CV text, or upload a file below."
        rows={4}
        style={{
          width: "100%", boxSizing: "border-box",
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          color: C.text,
          padding: "10px 12px",
          fontSize: 13,
          fontFamily: "inherit",
          resize: "vertical",
          outline: "none",
        }}
        onFocus={e => (e.target.style.borderColor = C.gold)}
        onBlur={e => (e.target.style.borderColor = C.border)}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt"
          onChange={handleFile} style={{ display: "none" }} id={`file-${index}`} />
        <label htmlFor={`file-${index}`} style={{
          background: "transparent",
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          color: C.text,
          padding: "8px 14px",
          fontSize: 13,
          cursor: "pointer",
          fontFamily: "inherit",
          fontWeight: 500,
        }}>
          {busy ? <>Reading<Dots /></> : "Upload file"}
        </label>
        <span style={{ fontSize: 12, color: C.muted }}>
          {cv.text ? `${cv.text.length.toLocaleString()} characters` : "PDF, Word, or text"}
        </span>
      </div>

      {err && <div style={{ color: C.red, fontSize: 12, marginTop: 8 }}>{err}</div>}
    </div>
  );
}

/* ─── Result card ───────────────────────────────────────────────────── */
function ResultCard({ row, meta }) {
  const aiFlagged = row.rulesEngine?.ai_flag;
  const ats = row.rulesEngine?.ats_score;
  return (
    <div style={{
      ...cardStyle,
      borderColor: row.rank && row.rank <= 3 ? "rgba(184,154,104,0.5)" : C.border,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <RankBadge rank={row.rank} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 16, color: C.text }}>
              {meta?.name || `Candidate ${row.candidateIndex}`}
            </span>
            {typeof row.score === "number" && (
              <span style={{ color: C.gold, fontWeight: 700, fontSize: 14 }}>{row.score}/100</span>
            )}
            {typeof ats === "number" && (
              <span style={{ color: C.muted, fontSize: 12 }}>ATS {ats}/100</span>
            )}
            {aiFlagged && <AIFlag />}
          </div>

          {row.hiringRecommendation && (
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>
              {row.hiringRecommendation}
            </div>
          )}

          {(row.topStrengths || []).length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ ...sectionLabel, color: C.gold, marginBottom: 6 }}>Strengths</div>
              {row.topStrengths.map((s, i) => <Pill key={i}>{s}</Pill>)}
            </div>
          )}

          {(row.keyGaps || []).length > 0 && (
            <div>
              <div style={{ ...sectionLabel, color: C.red, marginBottom: 6 }}>Gaps</div>
              {row.keyGaps.map((g, i) => <Pill key={i} tone="gap">{g}</Pill>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────────── */
export default function RecruiterApp({ backendUrl = "http://localhost:5000", onBack }) {
  const blank = () => ({ name: "", text: "" });
  const [role, setRole] = useState("");
  const [cvs, setCvs] = useState([blank(), blank()]);
  const [phase, setPhase] = useState("intake"); // intake | ranking | results
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const filled = cvs.filter(c => c.text.trim().length >= MIN_CHARS);
  const canRank = filled.length >= MIN_CVS;

  function updateCv(i, next) { setCvs(cs => cs.map((c, idx) => (idx === i ? next : c))); }
  function addCv() { setCvs(cs => cs.length >= MAX_CVS ? cs : [...cs, blank()]); }
  function removeCv(i) { setCvs(cs => cs.length <= MIN_CVS ? cs : cs.filter((_, idx) => idx !== i)); }

  async function handleUpload(file) {
    const data = await uploadFile(backendUrl, file);
    return (data.text || data.data?.text || "").trim();
  }

  async function runRanking() {
    setError("");
    setPhase("ranking");
    const active = cvs.filter(c => c.text.trim().length >= MIN_CHARS);
    try {
      const res = await api(backendUrl, "/rank-cvs", {
        cvTexts: active.map(c => c.text.trim()),
        jdText: role.trim(),
      });
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
    setRole(""); setCvs([blank(), blank()]);
    setResult(null); setError(""); setPhase("intake");
  }

  const sorted = result?.rankings
    ? [...result.rankings].sort((a, b) => {
        if (a.rank == null) return 1;
        if (b.rank == null) return -1;
        return a.rank - b.rank;
      })
    : [];

  return (
    <div style={{ minHeight: "100svh", background: C.bg, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{
        borderBottom: `1px solid ${C.border}`,
        padding: "18px 24px",
        display: "flex",
        alignItems: "center",
        position: "sticky",
        top: 0,
        background: C.bg,
        zIndex: 10,
      }}>
        <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, color: C.gold }}>Sofia</span>
        {onBack && (
          <button onClick={onBack} style={{
            marginLeft: "auto",
            background: "transparent", border: "none",
            color: C.muted, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          }}>
            ← Home
          </button>
        )}
      </header>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "36px 24px 80px" }}>
        {/* Page title */}
        <h1 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: "clamp(26px, 4vw, 34px)",
          fontWeight: 400,
          color: C.text,
          margin: "0 0 8px",
          letterSpacing: "-0.3px",
        }}>Recruiter shortlist</h1>
        <p style={{ color: C.muted, fontSize: 15, margin: "0 0 28px", lineHeight: 1.6 }}>
          Add the CVs you received for one role. Sofia ranks every candidate, explains the top three,
          and flags CVs that look AI-written.
        </p>

        {phase !== "results" && (
          <>
            {/* Role */}
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <div style={{ ...sectionLabel, marginBottom: 10 }}>The role</div>
              <textarea
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder="Paste the job description or a brief summary of what this role needs. Optional, but sharpens the ranking."
                rows={3}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  color: C.text,
                  padding: "10px 12px",
                  fontSize: 14,
                  fontFamily: "inherit",
                  resize: "vertical",
                  outline: "none",
                }}
                onFocus={e => (e.target.style.borderColor = C.gold)}
                onBlur={e => (e.target.style.borderColor = C.border)}
              />
            </div>

            {/* Candidate rows */}
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
              style={{
                marginTop: 12,
                background: "transparent",
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                color: cvs.length >= MAX_CVS ? C.muted : C.text,
                padding: "10px 18px",
                fontSize: 14,
                cursor: cvs.length >= MAX_CVS ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              + Add candidate {cvs.length >= MAX_CVS ? `(max ${MAX_CVS})` : ""}
            </button>

            {error && <ErrorCard message={error} onRetry={canRank ? runRanking : null} />}

            <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 16 }}>
              <PrimaryBtn onClick={runRanking} disabled={!canRank || phase === "ranking"}>
                {phase === "ranking"
                  ? <>Ranking candidates<Dots /></>
                  : `Rank ${filled.length || ""} candidate${filled.length !== 1 ? "s" : ""}`}
              </PrimaryBtn>
              <span style={{ fontSize: 13, color: C.muted }}>
                {canRank
                  ? `${filled.length} ready`
                  : `Add at least ${MIN_CVS} CVs (${MIN_CHARS}+ characters each)`}
              </span>
            </div>
          </>
        )}

        {/* Results */}
        {phase === "results" && result && (
          <>
            {result.top3Summary && (
              <div style={{
                ...cardStyle,
                borderColor: "rgba(184,154,104,0.5)",
                background: C.goldLight,
                marginBottom: 16,
              }}>
                <div style={{ ...sectionLabel, color: C.gold, marginBottom: 8 }}>Top of the list</div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: C.text }}>
                  {result.top3Summary}
                </p>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sorted.map((row, i) => (
                <ResultCard key={i} row={row} meta={result._meta?.[row.candidateIndex]} />
              ))}
            </div>

            {(result.commonWeaknesses || []).length > 0 && (
              <div style={{ ...cardStyle, marginTop: 16 }}>
                <div style={{ ...sectionLabel, marginBottom: 10 }}>Common across the field</div>
                <ul style={{ margin: 0, paddingLeft: 18, color: C.text, fontSize: 14, lineHeight: 1.7 }}>
                  {result.commonWeaknesses.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            <div style={{ marginTop: 24 }}>
              <SecondaryBtn onClick={resetAll}>Start a new shortlist</SecondaryBtn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
