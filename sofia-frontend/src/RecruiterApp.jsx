import React, { useState, useRef } from "react";
import { AlertTriangle } from "./Icons.jsx";

const C = {
  indigo: "#3D2F8F",
  indigoDark: "#2A1F6B",
  indigoTint: "#F0EEFF",
  amber: "#F5A623",
  amberLight: "rgba(245,166,35,0.12)",
  bg: "#FAFAFA",
  surface: "#FFFFFF",
  text: "#1A1A2E",
  muted: "rgba(26,26,46,0.6)",
  border: "#E8EAF0",
  green: "#27AE60",
  greenBg: "#F0FDF4",
  red: "#DC2626",
  redBg: "#FEF2F2",
  amberWarn: "#D97706",
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
  try { data = await res.json(); } catch {}
  if (!res.ok || data.status === "error")
    throw new Error(data.message || `Request failed (HTTP ${res.status}).`);
  return data;
}

async function uploadFile(backendUrl, file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${normBase(backendUrl)}/extract-text`, { method: "POST", body: form });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok || data.status === "error")
    throw new Error(data.message || `Upload failed (HTTP ${res.status}).`);
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

function PrimaryBtn({ children, onClick, disabled }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: disabled ? C.border : hov ? C.indigoDark : C.indigo,
        color: disabled ? C.muted : "#fff",
        border: "none", borderRadius: 10,
        padding: "12px 22px", fontSize: 14, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit", transition: "background 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function SecondaryBtn({ children, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "transparent",
        color: hov ? C.indigo : C.muted,
        border: `1.5px solid ${hov ? C.indigo : C.border}`,
        borderRadius: 10, padding: "11px 20px", fontSize: 14,
        fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
        transition: "color 0.15s, border-color 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function BackBtn({ onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        fontSize: 13, fontWeight: 600, color: C.indigo,
        background: "none",
        border: `1.5px solid ${hov ? C.indigo : C.border}`,
        borderRadius: 8, padding: "6px 14px", cursor: "pointer",
        fontFamily: "inherit", transition: "border-color 0.15s",
      }}
    >
      ← Back to Sofia
    </button>
  );
}

function ErrorCard({ message, onRetry }) {
  return (
    <div style={{ background: C.redBg, border: `1px solid ${C.red}33`, borderRadius: 12, padding: "16px 18px", marginTop: 16 }}>
      <div style={{ color: C.red, fontWeight: 600, marginBottom: 6 }}>Something went wrong</div>
      <div style={{ color: C.text, fontSize: 14, marginBottom: onRetry ? 14 : 0 }}>{message}</div>
      {onRetry && <PrimaryBtn onClick={onRetry}>Try again</PrimaryBtn>}
    </div>
  );
}

/* Rank badge: top 3 → indigo fill, rank 1 → amber "Top Pick" label */
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
  const isTop = rank <= 3;
  const isFirst = rank === 1;
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%",
      background: isFirst ? C.amber : isTop ? C.indigo : "transparent",
      border: isTop ? "none" : `1.5px solid ${C.border}`,
      color: isTop ? "#fff" : C.text,
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
      background: "rgba(245,158,11,0.1)", color: C.amberWarn,
      border: "1px solid rgba(245,158,11,0.35)",
      borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600,
    }}><AlertTriangle size={12} /> Possible AI-written CV</span>
  );
}

function Pill({ children, tone = "indigo" }) {
  const colors = tone === "gap"
    ? { fg: C.red, bg: C.redBg, bd: "#FECACA" }
    : { fg: C.indigo, bg: C.indigoTint, bd: `${C.indigo}44` };
  return (
    <span style={{
      display: "inline-block",
      background: colors.bg, border: `1px solid ${colors.bd}`,
      color: colors.fg, borderRadius: 8,
      padding: "3px 9px", fontSize: 12, marginRight: 6, marginBottom: 6,
    }}>{children}</span>
  );
}

/* ─── Loading screen (same pattern as CVFlow) ───────────────────────── */
const RANKING_MSGS = [
  "Reading each candidate's CV…",
  "Scoring against the role…",
  "Ranking by fit and experience…",
  "Identifying the top picks…",
  "Writing hiring recommendations…",
];

function LoadingScreen({ error, onRetry }) {
  const [idx, setIdx] = useState(0);
  React.useEffect(() => {
    if (error) return;
    const id = setInterval(() => setIdx(i => (i + 1) % RANKING_MSGS.length), 2600);
    return () => clearInterval(id);
  }, [error]);

  return (
    <div style={{ minHeight: "100svh", background: C.bg, fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      {!error && (
        <div style={{ height: 3, background: C.indigoTint, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "30%", background: C.indigo, borderRadius: 99, animation: "progressBar 1.6s ease-in-out infinite" }} />
        </div>
      )}
      <header style={{ height: 60, background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", padding: "0 24px" }}>
        <span style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontSize: 20, fontWeight: 700, color: C.indigo }}>Sofia</span>
      </header>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 24 }}>
        {error ? (
          <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
            <div style={{ marginBottom: 16, color: C.amberWarn }}><AlertTriangle size={36} /></div>
            <h2 style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontWeight: 700, color: C.text, margin: "0 0 10px" }}>Something went wrong</h2>
            <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>{error}</p>
            {onRetry && <PrimaryBtn onClick={onRetry}>Try again</PrimaryBtn>}
          </div>
        ) : (
          <>
            <div style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontSize: 44, fontWeight: 800, color: C.indigo, letterSpacing: "-1px", animation: "pulseSofia 2.4s ease-in-out infinite" }}>
              Sofia
            </div>
            <p style={{ fontSize: 16, color: C.muted, margin: 0, textAlign: "center", minHeight: 26 }}>
              {RANKING_MSGS[idx]}
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              {RANKING_MSGS.map((_, i) => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === idx ? C.indigo : C.border, transition: "background 0.4s" }} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
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
    if (file.size > MAX_MB * 1024 * 1024) { setErr(`File is over ${MAX_MB} MB.`); return; }
    if (!/\.(pdf|docx|txt)$/i.test(file.name)) {
      setErr(file.name.toLowerCase().endsWith(".doc")
        ? "Old .doc format not supported. Re-save as .docx."
        : "Use a PDF, .docx, or .txt file — or paste the CV text.");
      return;
    }
    setBusy(true);
    try {
      const text = await onUpload(file);
      onChange(index, { ...cv, text, name: cv.name || file.name.replace(/\.[^.]+$/, "") });
    } catch (ex) { setErr(ex.message); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  const hasText = cv.text.trim().length >= MIN_CHARS;

  return (
    <div style={{
      background: C.surface, border: `1.5px solid ${hasText ? C.indigo + "44" : C.border}`,
      borderRadius: 12, padding: 16, transition: "border-color 0.15s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 26, height: 26, borderRadius: "50%",
          background: hasText ? C.indigo : C.border,
          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, flexShrink: 0, transition: "background 0.15s",
        }}>
          {index + 1}
        </div>
        <input
          value={cv.name}
          onChange={e => onChange(index, { ...cv, name: e.target.value })}
          placeholder="Candidate name or reference (optional)"
          style={{
            flex: 1, background: C.bg, border: `1px solid ${C.border}`,
            borderRadius: 8, color: C.text, padding: "7px 10px",
            fontSize: 13, fontFamily: "inherit", outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={e => (e.target.style.borderColor = C.indigo)}
          onBlur={e => (e.target.style.borderColor = C.border)}
        />
        <button
          onClick={() => onRemove(index)}
          style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 4 }}
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
          background: C.bg, border: `1px solid ${C.border}`,
          borderRadius: 8, color: C.text, padding: "10px 12px",
          fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none",
          transition: "border-color 0.15s",
        }}
        onFocus={e => (e.target.style.borderColor = C.indigo)}
        onBlur={e => (e.target.style.borderColor = C.border)}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" onChange={handleFile} style={{ display: "none" }} id={`file-${index}`} />
        <label htmlFor={`file-${index}`} style={{
          background: "transparent", border: `1px solid ${C.border}`,
          borderRadius: 8, color: C.text, padding: "7px 14px",
          fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
        }}>
          {busy ? <>Reading<Dots /></> : "Upload file"}
        </label>
        <span style={{ fontSize: 12, color: hasText ? C.indigo : C.muted }}>
          {cv.text ? `${cv.text.length.toLocaleString()} chars${hasText ? " ✓" : ""}` : "PDF, Word, or text"}
        </span>
      </div>

      {err && <div style={{ color: C.red, fontSize: 12, marginTop: 8 }}>{err}</div>}
    </div>
  );
}

/* ─── Result card ───────────────────────────────────────────────────── */
function ResultCard({ row, meta, delay }) {
  const aiFlagged = row.rulesEngine?.ai_flag;
  const ats = row.rulesEngine?.ats_score;
  const isTop = row.rank && row.rank <= 3;
  const isFirst = row.rank === 1;

  return (
    <div style={{
      background: isFirst ? C.amberLight : isTop ? C.indigoTint : C.surface,
      border: `${isTop ? "2px" : "1.5px"} solid ${isFirst ? `${C.amber}66` : isTop ? `${C.indigo}44` : C.border}`,
      borderRadius: 14, padding: 20,
      animation: `fadeIn 0.3s ease both`,
      animationDelay: `${delay || 0}ms`,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{ position: "relative" }}>
          <RankBadge rank={row.rank} />
          {isFirst && (
            <div style={{
              position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)",
              background: C.amber, color: "#fff",
              fontSize: 8, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
              padding: "2px 7px", borderRadius: 99, whiteSpace: "nowrap",
            }}>
              Top Pick
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: C.text, fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
              {meta?.name || `Candidate ${row.candidateIndex}`}
            </span>
            {typeof row.score === "number" && (
              <span style={{ color: C.indigo, fontWeight: 700, fontSize: 14 }}>{row.score}/100</span>
            )}
            {typeof ats === "number" && (
              <span style={{ color: C.muted, fontSize: 12 }}>ATS {ats}/100</span>
            )}
            {aiFlagged && <AIFlag />}
          </div>

          {row.hiringRecommendation && (
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
              {row.hiringRecommendation}
            </div>
          )}

          {(row.topStrengths || []).length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.indigo, opacity: 0.7, marginBottom: 6 }}>Strengths</div>
              {row.topStrengths.map((s, i) => <Pill key={i} tone="indigo">{s}</Pill>)}
            </div>
          )}

          {(row.keyGaps || []).length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.red, opacity: 0.7, marginBottom: 6 }}>Gaps</div>
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
  const [phase, setPhase] = useState("intake");
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
    setError(""); setPhase("ranking");
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
    } catch (ex) { setError(ex.message); setPhase("intake"); }
  }

  function resetAll() { setRole(""); setCvs([blank(), blank()]); setResult(null); setError(""); setPhase("intake"); }

  const sorted = result?.rankings
    ? [...result.rankings].sort((a, b) => {
        if (a.rank == null) return 1;
        if (b.rank == null) return -1;
        return a.rank - b.rank;
      })
    : [];

  /* Loading phase */
  if (phase === "ranking") {
    return <LoadingScreen error="" />;
  }

  return (
    <div style={{ minHeight: "100svh", background: C.bg, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 10,
        height: 60, background: C.surface, borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", padding: "0 24px",
      }}>
        <span style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontSize: 20, fontWeight: 700, color: C.indigo }}>
          Sofia
        </span>
        {onBack && <div style={{ marginLeft: "auto" }}><BackBtn onClick={onBack} /></div>}
      </header>

      {/* Step dots */}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", padding: "14px 0 2px" }}>
        {["Setup", "Rank", "Results"].map((label, i) => {
          const cur = phase === "intake" ? 0 : phase === "ranking" ? 1 : 2;
          return (
            <div key={i} title={label} style={{
              width: i === cur ? 22 : 7, height: 7, borderRadius: 99,
              background: i <= cur ? C.indigo : C.border,
              opacity: i < cur ? 0.35 : 1,
              transition: "width 0.3s ease, opacity 0.3s",
            }} />
          );
        })}
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 24px 80px" }}>
        <h1 style={{
          fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
          fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 700,
          color: C.text, margin: "0 0 8px", letterSpacing: "-0.02em",
        }}>Recruiter shortlist</h1>
        <p style={{ color: C.muted, fontSize: 15, margin: "0 0 28px", lineHeight: 1.6 }}>
          Add the CVs you received for one role. Sofia ranks every candidate, explains the top three,
          and flags CVs that look AI-written.
        </p>

        {phase !== "results" && (
          <>
            {/* Role / JD */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>The role</div>
              <textarea
                value={role} onChange={e => setRole(e.target.value)}
                placeholder="Paste the job description or a brief summary of what this role needs. Optional, but sharpens the ranking."
                rows={3}
                style={{
                  width: "100%", boxSizing: "border-box", background: C.bg,
                  border: `1px solid ${C.border}`, borderRadius: 8, color: C.text,
                  padding: "10px 12px", fontSize: 14, fontFamily: "inherit", resize: "vertical", outline: "none",
                  transition: "border-color 0.15s",
                }}
                onFocus={e => (e.target.style.borderColor = C.indigo)}
                onBlur={e => (e.target.style.borderColor = C.border)}
              />
            </div>

            {/* Candidate rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {cvs.map((cv, i) => (
                <CandidateRow key={i} index={i} cv={cv} onChange={updateCv} onRemove={removeCv} onUpload={handleUpload} />
              ))}
            </div>

            <button
              onClick={addCv} disabled={cvs.length >= MAX_CVS}
              style={{
                marginTop: 12, background: "transparent",
                border: `1.5px dashed ${cvs.length >= MAX_CVS ? C.border : C.indigo + "66"}`,
                borderRadius: 10, color: cvs.length >= MAX_CVS ? C.muted : C.indigo,
                padding: "10px 18px", fontSize: 14,
                cursor: cvs.length >= MAX_CVS ? "not-allowed" : "pointer", fontFamily: "inherit",
              }}
            >
              + Add candidate {cvs.length >= MAX_CVS ? `(max ${MAX_CVS})` : ""}
            </button>

            {error && <ErrorCard message={error} onRetry={canRank ? runRanking : null} />}

            <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
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
                background: C.indigoTint, border: `1.5px solid ${C.indigo}44`,
                borderRadius: 14, padding: "20px 22px", marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: C.indigo, opacity: 0.7, marginBottom: 8 }}>
                  Top of the list
                </div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: C.text }}>
                  {result.top3Summary}
                </p>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sorted.map((row, i) => (
                <ResultCard key={i} row={row} meta={result._meta?.[row.candidateIndex]} delay={i * 60} />
              ))}
            </div>

            {(result.commonWeaknesses || []).length > 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>
                  Common across the field
                </div>
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
