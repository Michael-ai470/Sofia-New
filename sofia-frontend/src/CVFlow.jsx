/**
 * CVFlow — progressive, one-screen-at-a-time CV engine.
 *
 * Screens (in order):
 *   subchoice → upload (CV + JD on same screen for apply flow) → processing
 *   → score → improvements → approval → (cover, apply flow only) → downloads
 *
 * All API keys stay server-side. No auth, no tracking.
 */
import React, { useState, useRef } from "react";

/* ─── Palette ──────────────────────────────────────────────────────── */
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

/* ─── Backend helpers (same contract as CVApp.jsx) ─────────────────── */
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

function compressStage1(s1) {
  const sc = s1.scorecard || {};
  const ci = s1.competitiveIntelligence || {};
  const all = [
    ...(sc.contentQuality || []),
    ...(sc.strategicFit || []),
    ...(sc.presentationTrust || []),
  ];
  return {
    overallScore: sc.overallScore,
    grade: sc.grade,
    killList: (s1.killList || []).slice(0, 5),
    interviewWeaknesses: ci.interviewWeaknesses || [],
    priorityFixes: all.filter(c => (c.score || 10) < 7).slice(0, 8),
  };
}

function downloadB64(name, b64, mime) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([arr], { type: mime }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

const MAX_MB = 8;
const MIN_CHARS = 120;
const GRADE_COLOR = { A: "#22C55E", B: "#84CC16", C: "#F59E0B", D: "#EF4444" };

/* ─── Small atoms ──────────────────────────────────────────────────── */
function Dots() {
  const [n, setN] = useState(1);
  React.useEffect(() => {
    const id = setInterval(() => setN(v => (v % 3) + 1), 450);
    return () => clearInterval(id);
  }, []);
  return <span>{".".repeat(n)}</span>;
}

function PrimaryBtn({ children, onClick, disabled, wide, style: xtra }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        width: wide ? "100%" : undefined,
        padding: "14px 28px",
        borderRadius: 12,
        border: "none",
        background: disabled ? C.border : C.gold,
        color: disabled ? C.muted : "#fff",
        fontSize: 15,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.15s, opacity 0.15s",
        lineHeight: 1,
        ...xtra,
      }}
    >
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        color: C.muted,
        fontSize: 13,
        cursor: "pointer",
        padding: "4px 0",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {children}
    </button>
  );
}

/* Animated score ring */
function ScoreGauge({ score = 0, max = 160, grade = "C" }) {
  const [val, setVal] = useState(0);
  React.useEffect(() => {
    let raf;
    const start = performance.now();
    const dur = 1400;
    const tick = t => {
      const p = Math.min(1, (t - start) / dur);
      setVal(score * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);
  const r = 72, circ = 2 * Math.PI * r;
  const color = GRADE_COLOR[grade] || C.gold;
  return (
    <div style={{ position: "relative", width: 180, height: 180 }}>
      <svg width="180" height="180" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="90" cy="90" r={r} fill="none" stroke={C.border} strokeWidth="14" />
        <circle cx="90" cy="90" r={r} fill="none" stroke={color} strokeWidth="14"
          strokeLinecap="round" strokeDasharray={circ}
          strokeDashoffset={circ * (1 - Math.max(0, Math.min(1, val / max)))} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 46, color: C.text, lineHeight: 1 }}>
          {Math.round(val)}
        </div>
        <div style={{ fontSize: 12, color: C.muted, letterSpacing: "0.08em" }}>/ {max}</div>
      </div>
    </div>
  );
}

function BeforeAfterBar({ category, before, after }) {
  const [wb, setWb] = useState(0), [wa, setWa] = useState(0);
  React.useEffect(() => {
    const id = setTimeout(() => { setWb((before / 10) * 100); setWa((after / 10) * 100); }, 80);
    return () => clearTimeout(id);
  }, [before, after]);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
        <span style={{ color: C.text }}>{category}</span>
        <span>
          <span style={{ color: C.red }}>{before}</span>
          {" → "}
          <span style={{ color: C.green, fontWeight: 600 }}>{after}</span>
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {[{ w: wb, c: C.red }, { w: wa, c: C.green }].map((bar, i) => (
          <div key={i} style={{ height: 5, background: C.border, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${bar.w}%`, background: bar.c, borderRadius: 3, transition: `width ${0.9 + i * 0.2}s cubic-bezier(.2,.7,.2,1)` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Page shell ────────────────────────────────────────────────────── */
function Shell({ children, back, backLabel = "Back" }) {
  return (
    <div style={{ minHeight: "100svh", background: C.bg, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Brand header */}
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
        <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: C.gold }}>Sofia</span>
        {back && (
          <div style={{ marginLeft: "auto" }}>
            <GhostBtn onClick={back}>← {backLabel}</GhostBtn>
          </div>
        )}
      </header>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "36px 24px 80px" }}>
        {children}
      </div>
    </div>
  );
}

function PageTitle({ title, sub }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h1 style={{
        fontFamily: "'DM Serif Display', serif",
        fontSize: "clamp(26px, 4vw, 34px)",
        fontWeight: 400,
        color: C.text,
        margin: "0 0 8px",
        lineHeight: 1.2,
        letterSpacing: "-0.3px",
      }}>{title}</h1>
      {sub && <p style={{ margin: 0, color: C.muted, fontSize: 15, lineHeight: 1.6 }}>{sub}</p>}
    </div>
  );
}

function Card({ children, style: xtra }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: "20px 22px",
      ...xtra,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.13em",
      textTransform: "uppercase",
      color: C.muted,
      marginBottom: 14,
    }}>{children}</div>
  );
}

function ErrorBox({ message, onRetry }) {
  return (
    <div style={{
      background: "#FEF2F2",
      border: `1px solid ${C.red}33`,
      borderRadius: 12,
      padding: "16px 18px",
    }}>
      <div style={{ color: C.red, fontWeight: 600, marginBottom: 6 }}>Something went wrong</div>
      <div style={{ color: C.text, fontSize: 14, lineHeight: 1.6, marginBottom: onRetry ? 14 : 0 }}>{message}</div>
      {onRetry && <PrimaryBtn onClick={onRetry}>Try again</PrimaryBtn>}
    </div>
  );
}

/* ─── Screen: Sub-choice ────────────────────────────────────────────── */
function SubChoiceScreen({ onSelect, onBack }) {
  return (
    <Shell back={onBack} backLabel="Home">
      <PageTitle
        title="What would you like to do?"
        sub="Both paths give you a rewritten CV. Pick based on whether you have a job in mind."
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {[
          {
            id: "review",
            label: "Review & Improve My CV",
            desc: "Get a score breakdown, see what's costing you interviews, and download a professionally rewritten version.",
            icon: "✦",
          },
          {
            id: "apply",
            label: "Apply for a Specific Role",
            desc: "Paste a job description. Sofia rewrites your CV to match it and writes a tailored cover letter.",
            icon: "⟶",
          },
        ].map(opt => <ChoiceCard key={opt.id} opt={opt} onSelect={onSelect} />)}
      </div>
    </Shell>
  );
}

function ChoiceCard({ opt, onSelect }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => onSelect(opt.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        gap: 16,
        padding: "22px 24px",
        borderRadius: 16,
        border: `1.5px solid ${hovered ? C.gold : C.border}`,
        background: hovered ? C.goldLight : C.surface,
        textAlign: "left",
        cursor: "pointer",
        width: "100%",
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <div style={{ fontSize: 22, color: C.gold, flexShrink: 0, width: 32, paddingTop: 2 }}>{opt.icon}</div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 6 }}>{opt.label}</div>
        <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.55 }}>{opt.desc}</div>
      </div>
      <div style={{ marginLeft: "auto", alignSelf: "center", color: hovered ? C.gold : C.border, fontSize: 18, flexShrink: 0 }}>→</div>
    </button>
  );
}

/* ─── Screen: Upload ────────────────────────────────────────────────── */
function UploadScreen({ mode, cvText, setCvText, jdText, setJdText, onFileSelect, onContinue, onBack, loading, error }) {
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const cvReady = cvText.trim().length >= MIN_CHARS && !loading;
  const jdReady = mode !== "apply" || jdText.trim().length > 20;
  const canContinue = cvReady && jdReady;

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  }

  return (
    <Shell back={onBack}>
      {/* Mode badge */}
      {mode === "apply" && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: C.goldLight, border: `1px solid ${C.gold}55`,
          borderRadius: 20, padding: "5px 14px", fontSize: 12,
          fontWeight: 600, color: C.gold, marginBottom: 20,
        }}>
          ⟶ Apply for a Specific Role
        </div>
      )}

      <PageTitle
        title="Upload your CV"
        sub={`Drop a file or paste the text below. PDF and Word (.docx) files are supported — up to ${MAX_MB} MB.`}
      />

      {/* Drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragging ? C.gold : error ? C.red : C.border}`,
          borderRadius: 16,
          padding: "32px 24px",
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? C.goldLight : C.surface,
          transition: "border-color 0.15s, background 0.15s",
          marginBottom: 16,
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx"
          style={{ display: "none" }}
          onChange={e => { if (e.target.files[0]) onFileSelect(e.target.files[0]); }}
        />
        {loading ? (
          <div style={{ color: C.muted, fontSize: 14 }}>Reading file<Dots /></div>
        ) : (
          <>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              {dragging ? "Drop to upload" : "Drop your CV here"}
            </div>
            <div style={{ fontSize: 13, color: C.muted }}>
              or click to browse · PDF or .docx · max {MAX_MB} MB
            </div>
          </>
        )}
      </div>

      {error && (
        <div style={{
          background: "#FEF2F2", border: `1px solid ${C.red}33`, borderRadius: 10,
          padding: "10px 14px", fontSize: 13, color: C.red, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Paste CV text */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: 8 }}>
          Or paste your CV text
        </div>
        <textarea
          value={cvText}
          onChange={e => setCvText(e.target.value)}
          placeholder="Paste your CV content here…"
          rows={9}
          style={{
            width: "100%",
            border: `1.5px solid ${C.border}`,
            borderRadius: 12,
            padding: "12px 14px",
            fontSize: 14,
            lineHeight: 1.6,
            color: C.text,
            background: C.bg,
            resize: "vertical",
            transition: "border-color 0.2s",
          }}
          onFocus={e => (e.target.style.borderColor = C.gold)}
          onBlur={e => (e.target.style.borderColor = C.border)}
        />
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4, textAlign: "right" }}>
          {cvText.length.toLocaleString()} chars
          {cvText.length >= MIN_CHARS ? " ✓" : ` — need at least ${MIN_CHARS}`}
        </div>
      </div>

      {/* Job description section — apply flow only */}
      {mode === "apply" && (
        <div style={{
          marginTop: 28,
          paddingTop: 24,
          borderTop: `1.5px solid ${C.border}`,
        }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>
              Paste the job description
            </div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              Sofia will rewrite your CV to match this role and write a personalised cover letter. The more complete the JD, the better the result.
            </div>
          </div>
          <textarea
            value={jdText}
            onChange={e => setJdText(e.target.value)}
            placeholder="Paste the full job description here — including responsibilities, requirements, and any skills listed…"
            rows={11}
            style={{
              width: "100%",
              border: `1.5px solid ${jdText.trim().length > 20 ? C.gold : C.border}`,
              borderRadius: 12,
              padding: "14px 16px",
              fontSize: 14,
              lineHeight: 1.7,
              color: C.text,
              background: C.surface,
              resize: "vertical",
              transition: "border-color 0.2s",
            }}
            onFocus={e => (e.target.style.borderColor = C.gold)}
            onBlur={e => (e.target.style.borderColor = jdText.trim().length > 20 ? C.gold : C.border)}
          />
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4, textAlign: "right" }}>
            {jdText.length.toLocaleString()} chars
            {jdText.trim().length > 20 ? " ✓" : " — paste the job description above"}
          </div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <PrimaryBtn onClick={onContinue} disabled={!canContinue} wide>
          {loading
            ? <>Reading<Dots /></>
            : mode === "apply"
              ? "Analyse for this Role →"
              : "Continue →"}
        </PrimaryBtn>
        {mode === "apply" && !canContinue && cvReady && (
          <p style={{ textAlign: "center", fontSize: 12, color: C.muted, marginTop: 8 }}>
            Add the job description above to continue
          </p>
        )}
      </div>
    </Shell>
  );
}

/* ─── Screen: Processing (loading) ──────────────────────────────────── */
const PROCESS_STEPS = [
  "Analysing your CV…",
  "Building an improvement plan…",
  "Rewriting your CV…",
];

function ProcessingScreen({ stepIndex, error, onRetry }) {
  return (
    <div style={{ minHeight: "100svh", background: C.bg, fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <header style={{ borderBottom: `1px solid ${C.border}`, padding: "18px 24px" }}>
        <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: C.gold }}>Sofia</span>
      </header>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        {error ? (
          <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400, color: C.text, margin: "0 0 10px" }}>Something went wrong</h2>
            <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>{error}</p>
            <PrimaryBtn onClick={onRetry}>Try again</PrimaryBtn>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            {/* Spinner */}
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              border: `5px solid ${C.border}`, borderTopColor: C.gold,
              margin: "0 auto 36px",
              animation: "spin 1s linear infinite",
            }} />
            <div style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: 26,
              color: C.text,
              marginBottom: 24,
              minHeight: 36,
            }}>
              {PROCESS_STEPS[stepIndex] || "Working…"}
            </div>
            {/* Step dots */}
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              {PROCESS_STEPS.map((_, i) => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: i < stepIndex ? C.green : i === stepIndex ? C.gold : C.border,
                  transition: "background 0.3s",
                }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Screen: Score reveal ──────────────────────────────────────────── */
function ScoreScreen({ s1, s2, mode, onContinue }) {
  const sc = s1.scorecard || {};
  const fi = s1.firstImpression || {};
  const rs = s2?.rescore || {};
  const verdictColor = fi.verdict === "Shortlist" ? C.green : fi.verdict === "Maybe" ? C.amber : C.red;

  return (
    <Shell>
      <div className="fade-up">
        <PageTitle title="Your CV score" sub="Here's where you stand right now — and how much better we can make it." />

        {/* Score ring */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28, gap: 14 }}>
          <ScoreGauge score={sc.overallScore || 0} grade={sc.grade} />
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: 20,
              color: C.text,
              marginBottom: 6,
            }}>{sc.gradeLabel}</div>
            {fi.verdict && (
              <span style={{
                display: "inline-block",
                padding: "4px 14px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                background: `${verdictColor}18`,
                color: verdictColor,
                border: `1px solid ${verdictColor}44`,
              }}>{fi.verdict}</span>
            )}
          </div>
        </div>

        {/* First impression */}
        {(fi.verdictReason || fi.strongestSignal || fi.biggestRedFlag) && (
          <Card style={{ marginBottom: 16 }}>
            <SectionLabel>First impression</SectionLabel>
            {fi.verdictReason && (
              <p style={{ margin: "0 0 14px", color: C.text, fontSize: 14, lineHeight: 1.65 }}>{fi.verdictReason}</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {fi.strongestSignal && (
                <div style={{ fontSize: 13, color: C.green }}>✓ {fi.strongestSignal}</div>
              )}
              {fi.biggestRedFlag && (
                <div style={{ fontSize: 13, color: C.red }}>✗ {fi.biggestRedFlag}</div>
              )}
            </div>
          </Card>
        )}

        {/* After-rewrite preview */}
        {rs.scoreBefore != null && rs.scoreAfter != null && (
          <div style={{
            background: C.goldLight,
            border: `1px solid rgba(184,154,104,0.3)`,
            borderRadius: 14,
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 20,
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 34, color: C.red, lineHeight: 1 }}>{rs.scoreBefore}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Now</div>
            </div>
            <div style={{ fontSize: 22, color: C.gold }}>→</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 34, color: C.green, lineHeight: 1 }}>{rs.scoreAfter}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>After rewrite</div>
            </div>
            <div style={{ flex: 1, fontSize: 13, color: C.muted, marginLeft: 4, lineHeight: 1.5 }}>
              Sofia has already rewritten your CV. See the improvements next.
            </div>
          </div>
        )}

        <PrimaryBtn onClick={onContinue} wide>See improvements →</PrimaryBtn>
      </div>
    </Shell>
  );
}

/* ─── Screen: Improvements ──────────────────────────────────────────── */
function ImprovementsScreen({ s2, mode, onContinue, onBack }) {
  const ip = s2.improvementPlan || {};
  const rs = s2.rescore || {};
  const fixes = (ip.priorityFixes || []).slice(0, 6);

  return (
    <Shell back={onBack}>
      <div className="fade-up">
        <PageTitle
          title="Here's how to fix it"
          sub="Sofia has already applied these changes in the rewritten version. Review below, then approve."
        />

        {/* Before/after scores */}
        {(rs.categories || []).length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <SectionLabel>Score improvements</SectionLabel>
            {(rs.categories || []).map((cat, i) => (
              <BeforeAfterBar key={i} category={cat.category} before={cat.before} after={cat.after} />
            ))}
          </Card>
        )}

        {/* Priority fixes */}
        {fixes.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <SectionLabel>Priority fixes</SectionLabel>
            {fixes.map((fix, i) => {
              const ic = fix.impact === "High" ? C.red : fix.impact === "Medium" ? C.amber : C.muted;
              return (
                <div key={i} style={{
                  paddingBottom: i < fixes.length - 1 ? 14 : 0,
                  marginBottom: i < fixes.length - 1 ? 14 : 0,
                  borderBottom: i < fixes.length - 1 ? `1px solid ${C.border}` : "none",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{fix.section}</span>
                    <span style={{ color: ic, fontSize: 12, fontWeight: 600 }}>{fix.impact}</span>
                  </div>
                  <div style={{ fontSize: 13, color: C.red, marginBottom: 3 }}>{fix.problem}</div>
                  <div style={{ fontSize: 13, color: C.green }}>→ {fix.fix}</div>
                </div>
              );
            })}
          </Card>
        )}

        {/* Keywords */}
        {((ip.keywordsToAdd || []).length > 0 || (ip.keywordsToRemove || []).length > 0) && (
          <Card style={{ marginBottom: 24 }}>
            <SectionLabel>Keywords</SectionLabel>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {(ip.keywordsToAdd || []).length > 0 && (
                <div style={{ flex: 1, minWidth: 130 }}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Add these</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(ip.keywordsToAdd || []).map((k, i) => (
                      <span key={i} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: "#DCFCE7", color: "#15803D", border: "1px solid #BBF7D0" }}>{k}</span>
                    ))}
                  </div>
                </div>
              )}
              {(ip.keywordsToRemove || []).length > 0 && (
                <div style={{ flex: 1, minWidth: 130 }}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Remove these</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(ip.keywordsToRemove || []).map((k, i) => (
                      <span key={i} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: "#FEE2E2", color: "#B91C1C", border: "1px solid #FECACA" }}>{k}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        <PrimaryBtn onClick={onContinue} wide>Review & Approve Rewritten CV →</PrimaryBtn>
      </div>
    </Shell>
  );
}

/* ─── Screen: Approval gate ─────────────────────────────────────────── */
function ApprovalScreen({ s2, editedCV, setEditedCV, approved, onApprove, busy, onBack }) {
  const prep = s2?.interviewPrep || {};
  return (
    <Shell back={approved ? undefined : onBack}>
      <div className="fade-up">
        <PageTitle
          title="Review your rewritten CV"
          sub={approved ? "Approved — generating your documents now." : "Edit anything you like. Nothing moves forward until you approve."}
        />

        <textarea
          value={editedCV}
          onChange={e => setEditedCV(e.target.value)}
          disabled={approved}
          rows={18}
          style={{
            width: "100%",
            border: `1.5px solid ${approved ? C.green : C.border}`,
            borderRadius: 12,
            padding: "14px 16px",
            fontSize: 13,
            fontFamily: "ui-monospace, 'Cascadia Code', Consolas, monospace",
            lineHeight: 1.75,
            color: C.text,
            background: approved ? "#F0FDF4" : C.bg,
            resize: "vertical",
            marginBottom: 16,
            transition: "border-color 0.3s, background 0.3s",
          }}
          onFocus={e => { if (!approved) e.target.style.borderColor = C.gold; }}
          onBlur={e => { if (!approved) e.target.style.borderColor = C.border; }}
        />

        <button
          onClick={approved || busy ? undefined : onApprove}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: 12,
            border: "none",
            background: approved ? C.green : C.gold,
            color: "#fff",
            fontSize: 16,
            fontWeight: 700,
            cursor: approved || busy ? "default" : "pointer",
            opacity: busy && !approved ? 0.7 : 1,
            marginBottom: 28,
            transition: "background 0.3s",
          }}
        >
          {approved ? "✓ Approved" : busy ? <><span>Working</span><Dots /></> : "Approve & Generate Documents"}
        </button>

        {/* Interview prep */}
        {(prep.questions || []).length > 0 && (
          <Card>
            <SectionLabel>Interview prep</SectionLabel>
            {(prep.questions || []).map((q, i) => (
              <div key={i} style={{
                marginBottom: i < prep.questions.length - 1 ? 20 : 0,
                paddingBottom: i < prep.questions.length - 1 ? 20 : 0,
                borderBottom: i < prep.questions.length - 1 ? `1px solid ${C.border}` : "none",
              }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: C.text, marginBottom: 4 }}>
                  {i + 1}. {q.question}
                </div>
                <div style={{ color: C.gold, fontSize: 12, fontStyle: "italic", marginBottom: 10 }}>
                  Targets: {q.weakness}
                </div>
                {["situation", "task", "action", "result"].map(k =>
                  q.starAnswer?.[k] ? (
                    <div key={k} style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: C.gold }}>{k} </span>
                      <span style={{ fontSize: 12, color: C.muted }}>{q.starAnswer[k]}</span>
                    </div>
                  ) : null
                )}
                {q.needsRealExample && (
                  <div style={{
                    marginTop: 8, padding: "6px 10px", borderRadius: 8,
                    border: `1px solid ${C.amber}44`, background: "#FFFBEB",
                    color: C.amber, fontSize: 12,
                  }}>
                    Add a concrete achievement before your interview.
                  </div>
                )}
              </div>
            ))}
          </Card>
        )}
      </div>
    </Shell>
  );
}

/* ─── Screen: Cover letter ──────────────────────────────────────────── */
function CoverScreen({ letter, loading, error, onRetry, onContinue }) {
  if (loading) {
    return (
      <div style={{ minHeight: "100svh", background: C.bg, fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
        <header style={{ borderBottom: `1px solid ${C.border}`, padding: "18px 24px" }}>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: C.gold }}>Sofia</span>
        </header>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 24 }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            border: `5px solid ${C.border}`, borderTopColor: C.gold,
            animation: "spin 1s linear infinite",
          }} />
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: C.text }}>
            Writing your cover letter<Dots />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Shell>
        <PageTitle title="Cover letter" />
        <ErrorBox message={error} onRetry={onRetry} />
        <div style={{ marginTop: 14 }}>
          <GhostBtn onClick={onContinue}>Skip to downloads →</GhostBtn>
        </div>
      </Shell>
    );
  }

  if (!letter) {
    return (
      <div style={{ minHeight: "100svh", background: C.bg, fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
        <header style={{ borderBottom: `1px solid ${C.border}`, padding: "18px 24px" }}>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: C.gold }}>Sofia</span>
        </header>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 24 }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            border: `5px solid ${C.border}`, borderTopColor: C.gold,
            animation: "spin 1s linear infinite",
          }} />
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: C.text }}>
            Writing your cover letter<Dots />
          </div>
        </div>
      </div>
    );
  }

  const paras = [letter.opening, letter.body1, letter.body2, letter.body3Remote, letter.closing].filter(Boolean);

  return (
    <Shell>
      <div className="fade-up">
        <PageTitle title="Your cover letter" sub="Tailored to the role. Download it alongside your CV on the next screen." />
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: "28px 28px 24px",
          marginBottom: 24,
          lineHeight: 1.8,
        }}>
          {paras.map((p, i) => (
            <p key={i} style={{ margin: "0 0 18px", color: C.text, fontSize: 14, lineHeight: 1.8 }}>{p}</p>
          ))}
          <p style={{ margin: "24px 0 4px", color: C.muted, fontSize: 13 }}>Warm regards,</p>
          <p style={{ margin: "0 0 6px", fontFamily: "'DM Serif Display', serif", fontSize: 22, color: C.text }}>
            {letter.signoffName}
          </p>
          <div style={{ width: 100, height: 1.5, background: C.gold, marginBottom: 6 }} />
          <p style={{ margin: 0, color: C.muted, fontSize: 12 }}>{letter.tagline}</p>
        </div>
        <PrimaryBtn onClick={onContinue} wide>Download all documents →</PrimaryBtn>
      </div>
    </Shell>
  );
}

/* ─── Screen: Downloads ─────────────────────────────────────────────── */
function DownloadsScreen({ files, loading, error, onRestart }) {
  const mimeFor = fmt =>
    fmt === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  const KIND_LABEL = {
    cv: "Your rewritten CV",
    cover: "Cover letter",
    prep: "Interview prep",
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100svh", background: C.bg, fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
        <header style={{ borderBottom: `1px solid ${C.border}`, padding: "18px 24px" }}>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: C.gold }}>Sofia</span>
        </header>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 24 }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            border: `5px solid ${C.border}`, borderTopColor: C.gold,
            animation: "spin 1s linear infinite",
          }} />
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: C.text }}>
            Generating your documents<Dots />
          </div>
        </div>
      </div>
    );
  }

  const grouped = (files || []).reduce((acc, f) => {
    (acc[f.kind] = acc[f.kind] || []).push(f);
    return acc;
  }, {});

  return (
    <Shell>
      <div className="fade-up">
        <PageTitle
          title="Your documents are ready"
          sub="Download in PDF for sending, or Word to keep editing."
        />

        {error && <ErrorBox message={error} style={{ marginBottom: 20 }} />}

        {Object.keys(grouped).length === 0 && !error && (
          <Card style={{ marginBottom: 20 }}>
            <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
              No files were generated. Please try again.
            </p>
          </Card>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 }}>
          {Object.entries(grouped).map(([kind, group]) => (
            <div key={kind} style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              padding: "20px 22px",
            }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 4 }}>
                {KIND_LABEL[kind] || kind}
              </div>
              {group[0].description && (
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
                  {group[0].description}
                </div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                {group.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => downloadB64(f.name, f.data, mimeFor(f.format))}
                    style={{
                      padding: "10px 22px",
                      borderRadius: 8,
                      border: "none",
                      background: f.format === "pdf" ? C.gold : C.text,
                      color: "#fff",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    ↓ {f.format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onRestart}
          style={{
            width: "100%",
            padding: "13px",
            borderRadius: 12,
            border: `1.5px solid ${C.border}`,
            background: "transparent",
            color: C.muted,
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Start over with a new CV
        </button>
      </div>
    </Shell>
  );
}

/* ─── Main CVFlow controller ─────────────────────────────────────────── */
export default function CVFlow({ backendUrl = "http://localhost:5000", onBack }) {
  const [mode, setMode] = useState(null);          // "review" | "apply"
  const [screen, setScreen] = useState("subchoice");

  // Data
  const [cvText, setCvText] = useState("");
  const [jdText, setJdText] = useState("");
  const [s1, setS1] = useState(null);
  const [s2, setS2] = useState(null);
  const [editedCV, setEditedCV] = useState("");
  const [approved, setApproved] = useState(false);
  const [letter, setLetter] = useState(null);
  const [files, setFiles] = useState(null);

  // UI state
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [processStep, setProcessStep] = useState(0);
  const [processError, setProcessError] = useState(null);
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverError, setCoverError] = useState(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState(null);
  const [approvalBusy, setApprovalBusy] = useState(false);

  function resetAll() {
    setMode(null); setScreen("subchoice");
    setCvText(""); setJdText("");
    setS1(null); setS2(null);
    setEditedCV(""); setApproved(false);
    setLetter(null); setFiles(null);
    setUploadLoading(false); setUploadError(null);
    setProcessError(null);
    setCoverLoading(false); setCoverError(null);
    setDocsLoading(false); setDocsError(null);
    setApprovalBusy(false);
  }

  /* ── File upload (populates cvText) ── */
  async function handleFileSelect(file) {
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      setUploadError(`File is larger than ${MAX_MB} MB. Upload a smaller file.`);
      return;
    }
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setUploadError(
        file.name.toLowerCase().endsWith(".doc")
          ? "Old .doc format is not supported. Re-save as .docx in Word first."
          : "Unsupported file type. Upload a PDF or .docx file."
      );
      return;
    }
    setUploadLoading(true);
    setUploadError(null);
    try {
      const res = await uploadFile(backendUrl, file);
      setCvText(res.text || "");
    } catch (e) {
      setUploadError(e.message);
    } finally {
      setUploadLoading(false);
    }
  }

  /* ── Continue from Upload screen ── */
  function handleUploadContinue() {
    setScreen("processing");
    runAnalysis(cvText, mode === "apply" ? jdText : "");
  }

  /* ── Analysis pipeline (stage 1 + 2) ── */
  async function runAnalysis(cv, jd) {
    setProcessError(null);
    setProcessStep(0);
    try {
      const res1 = await api(backendUrl, "/analyse-cv", { cvText: cv, jdText: jd || "" });
      setS1(res1.data);
      setProcessStep(1);

      const summary = compressStage1(res1.data);
      const res2 = await api(backendUrl, "/rewrite-cv", { cvText: cv, jdText: jd || "", stage1Summary: summary });
      setS2(res2.data);
      setEditedCV(res2.data?.rewrittenCV?.fullText || "");
      setProcessStep(2);

      setScreen("score");
    } catch (e) {
      setProcessError(e.message);
    }
  }

  /* ── Approval → cover letter + document generation ── */
  async function handleApprove() {
    setApproved(true);
    setApprovalBusy(true);
    setDocsLoading(true);
    setDocsError(null);

    const cv = { ...s2.rewrittenCV, fullText: editedCV };
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    // Navigate immediately: apply → cover screen first; review → downloads directly
    if (mode === "apply" && jdText.trim()) {
      setScreen("cover");
      setCoverLoading(true);
      setCoverError(null);
    } else {
      setScreen("downloads");
    }

    let coverLetter = null;

    // Cover letter (apply flow)
    if (mode === "apply" && jdText.trim()) {
      try {
        const res = await api(backendUrl, "/cover-letter", {
          approvedCV: editedCV,
          jdText,
          candidateMeta: {
            name: cv.candidateName,
            title: cv.titleLine,
            company: cv.companyName,
            location: cv.candidateLocation,
          },
        });
        coverLetter = res.data.coverLetter;
        setLetter(coverLetter);
      } catch (e) {
        setCoverError(e.message);
      } finally {
        setCoverLoading(false);
      }
    }

    // Document generation
    try {
      const payload = {
        rewrittenCV: cv,
        pdfData: s2.pdfData,
        coverLetter: coverLetter || null,
        interviewPrep: s2.interviewPrep,
        companyName: cv.companyName,
        dateStr: today,
        salutation: "Dear Hiring Manager,",
        template: "A",
      };
      const [pdfRes, docxRes] = await Promise.all([
        api(backendUrl, "/generate-pdfs", payload),
        api(backendUrl, "/generate-docx", payload),
      ]);
      setFiles([...(pdfRes.files || []), ...(docxRes.files || [])]);
    } catch (e) {
      setDocsError(e.message);
    } finally {
      setDocsLoading(false);
      setApprovalBusy(false);
    }
  }

  /* ── Screen router ── */
  if (screen === "subchoice") {
    return (
      <SubChoiceScreen
        onSelect={m => { setMode(m); setScreen("upload"); }}
        onBack={onBack}
      />
    );
  }

  if (screen === "upload") {
    return (
      <UploadScreen
        mode={mode}
        cvText={cvText}
        setCvText={v => { setCvText(v); setUploadError(null); }}
        jdText={jdText}
        setJdText={setJdText}
        onFileSelect={handleFileSelect}
        onContinue={handleUploadContinue}
        onBack={() => { setMode(null); setScreen("subchoice"); }}
        loading={uploadLoading}
        error={uploadError}
      />
    );
  }

  if (screen === "processing") {
    return (
      <ProcessingScreen
        stepIndex={processStep}
        error={processError}
        onRetry={() => {
          setProcessError(null);
          setProcessStep(0);
          runAnalysis(cvText, jdText);
        }}
      />
    );
  }

  if (screen === "score") {
    return (
      <ScoreScreen
        s1={s1}
        s2={s2}
        mode={mode}
        onContinue={() => setScreen("improvements")}
      />
    );
  }

  if (screen === "improvements") {
    return (
      <ImprovementsScreen
        s2={s2}
        mode={mode}
        onContinue={() => setScreen("approval")}
        onBack={() => setScreen("score")}
      />
    );
  }

  if (screen === "approval") {
    return (
      <ApprovalScreen
        s2={s2}
        editedCV={editedCV}
        setEditedCV={setEditedCV}
        approved={approved}
        onApprove={handleApprove}
        busy={approvalBusy}
        onBack={() => setScreen("improvements")}
      />
    );
  }

  if (screen === "cover") {
    return (
      <CoverScreen
        letter={letter}
        loading={coverLoading}
        error={coverError}
        onRetry={async () => {
          setCoverError(null);
          setCoverLoading(true);
          const cv = { ...s2.rewrittenCV, fullText: editedCV };
          try {
            const res = await api(backendUrl, "/cover-letter", {
              approvedCV: editedCV,
              jdText,
              candidateMeta: {
                name: cv.candidateName, title: cv.titleLine,
                company: cv.companyName, location: cv.candidateLocation,
              },
            });
            setLetter(res.data.coverLetter);
          } catch (e) {
            setCoverError(e.message);
          } finally {
            setCoverLoading(false);
          }
        }}
        onContinue={() => setScreen("downloads")}
      />
    );
  }

  if (screen === "downloads") {
    return (
      <DownloadsScreen
        files={files}
        loading={docsLoading}
        error={docsError}
        onRestart={resetAll}
      />
    );
  }

  return null;
}
