import React, { useState, useRef } from "react";
import { AlertTriangle, FileText, Sparkle, ArrowRight, ChevronRight } from "./Icons.jsx";

const C = {
  indigo: "#3D2F8F",
  indigoDark: "#2A1F6B",
  indigoTint: "#F0EEFF",
  amber: "#F5A623",
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

function compressStage1(s1) {
  const sc = s1.scorecard || {};
  const ci = s1.competitiveIntelligence || {};
  const all = [...(sc.contentQuality || []), ...(sc.strategicFit || []), ...(sc.presentationTrust || [])];
  return {
    overallScore: sc.overallScore, grade: sc.grade,
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
const GRADE_COLOR = { A: "#27AE60", B: "#84CC16", C: "#F59E0B", D: "#DC2626" };

/* ─── CV flow steps (for progress dots) ───────────────────────────── */
const STEPS = ["Choose", "Upload", "Analyse", "Review", "Download"];
const SCREEN_STEP = {
  subchoice: 0, upload: 1,
  processing: 2, score: 2, improvements: 2,
  approval: 3, cover: 3,
  downloads: 4,
};

/* ─── Atoms ─────────────────────────────────────────────────────────── */
function Dots() {
  const [n, setN] = useState(1);
  React.useEffect(() => {
    const id = setInterval(() => setN(v => (v % 3) + 1), 450);
    return () => clearInterval(id);
  }, []);
  return <span>{".".repeat(n)}</span>;
}

function PrimaryBtn({ children, onClick, disabled, wide, style: xtra }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: wide ? "100%" : undefined,
        padding: "13px 28px", borderRadius: 10, border: "none",
        background: disabled ? C.border : hov ? C.indigoDark : C.indigo,
        color: disabled ? C.muted : "#fff",
        fontSize: 14, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.15s",
        fontFamily: "inherit", lineHeight: 1,
        ...xtra,
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
  const color = GRADE_COLOR[grade] || C.indigo;
  return (
    <div style={{ position: "relative", width: 180, height: 180 }}>
      <svg width="180" height="180" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="90" cy="90" r={r} fill="none" stroke={C.border} strokeWidth="14" />
        <circle cx="90" cy="90" r={r} fill="none" stroke={color} strokeWidth="14"
          strokeLinecap="round" strokeDasharray={circ}
          strokeDashoffset={circ * (1 - Math.max(0, Math.min(1, val / max)))} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
          fontSize: 46, fontWeight: 800, color: C.text, lineHeight: 1,
        }}>
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
          <span style={{ color: C.red }}>{before}</span>{" → "}
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

/* ─── Engine loading screen ─────────────────────────────────────────── */
const LOADING_MSGS = [
  "Analysing your CV…",
  "Identifying what's holding you back…",
  "Benchmarking against the role…",
  "Rewriting your CV…",
  "Polishing the final draft…",
];

function LoadingScreen({ messages = LOADING_MSGS, error, onRetry }) {
  const [idx, setIdx] = useState(0);
  React.useEffect(() => {
    if (error) return;
    const id = setInterval(() => setIdx(i => (i + 1) % messages.length), 2800);
    return () => clearInterval(id);
  }, [messages.length, error]);

  return (
    <div style={{ minHeight: "100svh", background: C.bg, fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Thin indigo progress bar */}
      {!error && (
        <div style={{ height: 3, background: C.indigoTint, overflow: "hidden", position: "relative" }}>
          <div style={{
            position: "absolute", top: 0, left: 0, bottom: 0, width: "30%",
            background: C.indigo, borderRadius: 99,
            animation: "progressBar 1.6s ease-in-out infinite",
          }} />
        </div>
      )}
      <header style={{
        height: 60, background: C.surface, borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", padding: "0 24px",
      }}>
        <span style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontSize: 20, fontWeight: 700, color: C.indigo }}>
          Sofia
        </span>
      </header>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 24 }}>
        {error ? (
          <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
            <div style={{ marginBottom: 16, color: C.amberWarn }}><AlertTriangle size={36} /></div>
            <h2 style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontWeight: 700, color: C.text, margin: "0 0 10px" }}>
              Something went wrong
            </h2>
            <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>{error}</p>
            {onRetry && <PrimaryBtn onClick={onRetry}>Try again</PrimaryBtn>}
          </div>
        ) : (
          <>
            <div style={{
              fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
              fontSize: 44, fontWeight: 800, color: C.indigo,
              letterSpacing: "-1px",
              animation: "pulseSofia 2.4s ease-in-out infinite",
            }}>
              Sofia
            </div>
            <p style={{ fontSize: 16, color: C.muted, margin: 0, textAlign: "center", minHeight: 26 }}>
              {messages[idx]}
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              {messages.map((_, i) => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: i === idx ? C.indigo : C.border,
                  transition: "background 0.4s",
                }} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Page shell ────────────────────────────────────────────────────── */
function Shell({ children, back, screen }) {
  const step = SCREEN_STEP[screen] ?? undefined;
  return (
    <div style={{ minHeight: "100svh", background: C.bg, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <header style={{
        position: "sticky", top: 0, zIndex: 10,
        height: 60, background: C.surface, borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", padding: "0 24px",
      }}>
        <span style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontSize: 20, fontWeight: 700, color: C.indigo }}>
          Sofia
        </span>
        {back && (
          <div style={{ marginLeft: "auto" }}>
            <BackBtn onClick={back} />
          </div>
        )}
      </header>

      {/* Progress dots */}
      {step !== undefined && (
        <div style={{ display: "flex", gap: 6, justifyContent: "center", padding: "14px 0 2px" }}>
          {STEPS.map((label, i) => (
            <div key={i} title={label} style={{
              width: i === step ? 22 : 7, height: 7, borderRadius: 99,
              background: i <= step ? C.indigo : C.border,
              opacity: i < step ? 0.35 : 1,
              transition: "width 0.3s ease, opacity 0.3s",
            }} />
          ))}
        </div>
      )}

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "28px 24px 80px" }}>
        {children}
      </div>
    </div>
  );
}

function PageTitle({ title, sub }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h1 style={{
        fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
        fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 700,
        color: C.text, margin: "0 0 8px", lineHeight: 1.2, letterSpacing: "-0.02em",
      }}>{title}</h1>
      {sub && <p style={{ margin: 0, color: C.muted, fontSize: 15, lineHeight: 1.6 }}>{sub}</p>}
    </div>
  );
}

function Card({ children, style: xtra }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", ...xtra }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: C.muted, marginBottom: 14 }}>
      {children}
    </div>
  );
}

function ErrorBox({ message, onRetry }) {
  return (
    <div style={{ background: C.redBg, border: `1px solid ${C.red}33`, borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ color: C.red, fontWeight: 600, marginBottom: 6 }}>Something went wrong</div>
      <div style={{ color: C.text, fontSize: 14, lineHeight: 1.6, marginBottom: onRetry ? 14 : 0 }}>{message}</div>
      {onRetry && <PrimaryBtn onClick={onRetry}>Try again</PrimaryBtn>}
    </div>
  );
}

/* ─── Screen: Sub-choice ────────────────────────────────────────────── */
function SubChoiceScreen({ onSelect, onBack }) {
  return (
    <Shell back={onBack} screen="subchoice">
      <PageTitle
        title="What would you like to do?"
        sub="Both paths give you a rewritten CV. Pick based on whether you have a job in mind."
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          { id: "review", label: "Review & Improve My CV", desc: "Get a score breakdown, see what's costing you interviews, and download a professionally rewritten version.", icon: <Sparkle size={22} /> },
          { id: "apply", label: "Apply for a Specific Role", desc: "Paste a job description. Sofia rewrites your CV to match it and writes a tailored cover letter.", icon: <ArrowRight size={22} /> },
        ].map(opt => <ChoiceCard key={opt.id} opt={opt} onSelect={onSelect} />)}
      </div>
    </Shell>
  );
}

function ChoiceCard({ opt, onSelect }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={() => onSelect(opt.id)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", gap: 16, padding: "22px 24px", borderRadius: 14,
        border: `${hov ? "2px" : "1.5px"} solid ${hov ? C.indigo : C.border}`,
        background: hov ? C.indigoTint : C.surface,
        textAlign: "left", cursor: "pointer", width: "100%",
        transform: hov ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hov ? "0 6px 20px rgba(26,26,46,.10)" : "none",
        transition: "all 0.15s", fontFamily: "inherit",
      }}
    >
      <div style={{ fontSize: 22, color: hov ? C.indigo : C.muted, flexShrink: 0, width: 32, paddingTop: 2 }}>{opt.icon}</div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 6 }}>{opt.label}</div>
        <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.55 }}>{opt.desc}</div>
      </div>
      <div style={{ marginLeft: "auto", alignSelf: "center", flexShrink: 0 }}><ChevronRight size={18} color={hov ? C.indigo : C.border} /></div>
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
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  }

  return (
    <Shell back={onBack} screen="upload">
      {mode === "apply" && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: C.indigoTint, border: `1px solid ${C.indigo}44`,
          borderRadius: 20, padding: "5px 14px", fontSize: 12,
          fontWeight: 600, color: C.indigo, marginBottom: 20,
        }}>
          <ArrowRight size={14} /> Apply for a Specific Role
        </div>
      )}

      <PageTitle
        title="Upload your CV"
        sub={`Drop a file or paste the text below. PDF and Word (.docx) supported — up to ${MAX_MB} MB.`}
      />

      {/* Drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragging ? C.indigo : error ? C.red : C.border}`,
          borderRadius: 14, padding: "32px 24px", textAlign: "center", cursor: "pointer",
          background: dragging ? C.indigoTint : C.surface,
          transition: "border-color 0.15s, background 0.15s", marginBottom: 16,
        }}
      >
        <input ref={fileRef} type="file" accept=".pdf,.docx" style={{ display: "none" }}
          onChange={e => { if (e.target.files[0]) onFileSelect(e.target.files[0]); }} />
        {loading ? (
          <div style={{ color: C.muted, fontSize: 14 }}>Reading file<Dots /></div>
        ) : (
          <>
            <div style={{ marginBottom: 10, color: C.indigo }}><FileText size={36} /></div>
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
        <div style={{ background: C.redBg, border: `1px solid ${C.red}33`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: C.red, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: 8 }}>Or Tell Us About Your Experience</div>
        <textarea
          value={cvText} onChange={e => setCvText(e.target.value)}
          placeholder="Tell us about your experience…" rows={9}
          style={{
            width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 12,
            padding: "12px 14px", fontSize: 14, lineHeight: 1.6, color: C.text,
            background: C.bg, resize: "vertical", transition: "border-color 0.2s", outline: "none",
            fontFamily: "inherit",
          }}
          onFocus={e => (e.target.style.borderColor = C.indigo)}
          onBlur={e => (e.target.style.borderColor = C.border)}
        />
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4, textAlign: "right" }}>
          {cvText.length.toLocaleString()} chars
          {cvText.length >= MIN_CHARS ? " ✓" : ` — need at least ${MIN_CHARS}`}
        </div>
      </div>

      {mode === "apply" && (
        <div style={{ marginTop: 28, paddingTop: 24, borderTop: `1.5px solid ${C.border}` }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>Paste the job description</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              Sofia will rewrite your CV to match this role and write a personalised cover letter.
            </div>
          </div>
          <textarea
            value={jdText} onChange={e => setJdText(e.target.value)}
            placeholder="Paste the full job description here — responsibilities, requirements, and listed skills…"
            rows={11}
            style={{
              width: "100%", border: `1.5px solid ${jdText.trim().length > 20 ? C.indigo : C.border}`,
              borderRadius: 12, padding: "14px 16px", fontSize: 14, lineHeight: 1.7,
              color: C.text, background: C.surface, resize: "vertical", outline: "none",
              transition: "border-color 0.2s", fontFamily: "inherit",
            }}
            onFocus={e => (e.target.style.borderColor = C.indigo)}
            onBlur={e => (e.target.style.borderColor = jdText.trim().length > 20 ? C.indigo : C.border)}
          />
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4, textAlign: "right" }}>
            {jdText.length.toLocaleString()} chars
            {jdText.trim().length > 20 ? " ✓" : " — paste the job description above"}
          </div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <PrimaryBtn onClick={onContinue} disabled={!canContinue} wide>
          {loading ? <>Reading<Dots /></> : mode === "apply" ? "Analyse for this Role →" : "Continue →"}
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

/* ─── Screen: Score reveal ──────────────────────────────────────────── */
function ScoreScreen({ s1, s2, onContinue }) {
  const sc = s1.scorecard || {};
  const fi = s1.firstImpression || {};
  const rs = s2?.rescore || {};
  const verdictColor = fi.verdict === "Shortlist" ? C.green : fi.verdict === "Maybe" ? C.amberWarn : C.red;

  return (
    <Shell screen="score">
      <PageTitle title="Your CV score" sub="Here's where you stand right now — and how much better we can make it." />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28, gap: 14 }}>
        <ScoreGauge score={sc.overallScore || 0} grade={sc.grade} />
        <div style={{ textAlign: "center" }}>
          <div style={{
            fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
            fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 6,
          }}>{sc.gradeLabel}</div>
          {fi.verdict && (
            <span style={{
              display: "inline-block", padding: "4px 14px", borderRadius: 20,
              fontSize: 13, fontWeight: 600,
              background: `${verdictColor}18`, color: verdictColor, border: `1px solid ${verdictColor}44`,
            }}>{fi.verdict}</span>
          )}
        </div>
      </div>

      {(fi.verdictReason || fi.strongestSignal || fi.biggestRedFlag) && (
        <Card style={{ marginBottom: 16 }}>
          <SectionLabel>First impression</SectionLabel>
          {fi.verdictReason && <p style={{ margin: "0 0 14px", color: C.text, fontSize: 14, lineHeight: 1.65 }}>{fi.verdictReason}</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {fi.strongestSignal && <div style={{ fontSize: 13, color: C.green }}>✓ {fi.strongestSignal}</div>}
            {fi.biggestRedFlag && <div style={{ fontSize: 13, color: C.red }}>✗ {fi.biggestRedFlag}</div>}
          </div>
        </Card>
      )}

      {rs.scoreBefore != null && rs.scoreAfter != null && (
        <div style={{
          background: C.indigoTint, border: `1px solid ${C.indigo}33`,
          borderRadius: 14, padding: "16px 20px",
          display: "flex", alignItems: "center", gap: 20, marginBottom: 20,
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontSize: 34, fontWeight: 800, color: C.red, lineHeight: 1 }}>{rs.scoreBefore}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Now</div>
          </div>
          <div style={{ fontSize: 22, color: C.indigo }}>→</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontSize: 34, fontWeight: 800, color: C.green, lineHeight: 1 }}>{rs.scoreAfter}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>After rewrite</div>
          </div>
          <div style={{ flex: 1, fontSize: 13, color: C.muted, marginLeft: 4, lineHeight: 1.5 }}>
            Sofia has already rewritten your CV. See the improvements next.
          </div>
        </div>
      )}

      <PrimaryBtn onClick={onContinue} wide>See improvements →</PrimaryBtn>
    </Shell>
  );
}

/* ─── Screen: Improvements ──────────────────────────────────────────── */
function ImprovementsScreen({ s2, onContinue, onBack }) {
  const ip = s2.improvementPlan || {};
  const rs = s2.rescore || {};
  const fixes = (ip.priorityFixes || []).slice(0, 6);

  return (
    <Shell back={onBack} screen="improvements">
      <PageTitle
        title="Here's how to fix it"
        sub="Sofia has already applied these changes in the rewritten version. Review below, then approve."
      />

      {(rs.categories || []).length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <SectionLabel>Score improvements</SectionLabel>
          {(rs.categories || []).map((cat, i) => (
            <BeforeAfterBar key={i} category={cat.category} before={cat.before} after={cat.after} />
          ))}
        </Card>
      )}

      {fixes.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <SectionLabel>Priority fixes</SectionLabel>
          {fixes.map((fix, i) => {
            const ic = fix.impact === "High" ? C.red : fix.impact === "Medium" ? C.amberWarn : C.muted;
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
                    <span key={i} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: C.redBg, color: "#B91C1C", border: "1px solid #FECACA" }}>{k}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <PrimaryBtn onClick={onContinue} wide>Review & Approve Rewritten CV →</PrimaryBtn>
    </Shell>
  );
}

/* ─── Screen: Approval gate ─────────────────────────────────────────── */
function ApprovalScreen({ s2, editedCV, setEditedCV, approved, onApprove, busy, onBack }) {
  const prep = s2?.interviewPrep || {};
  return (
    <Shell back={approved ? undefined : onBack} screen="approval">
      <PageTitle
        title="Review your rewritten CV"
        sub={approved ? "Approved — generating your documents now." : "Edit anything you like. Nothing moves forward until you approve."}
      />

      <textarea
        value={editedCV} onChange={e => setEditedCV(e.target.value)} disabled={approved} rows={18}
        style={{
          width: "100%",
          border: `1.5px solid ${approved ? C.green : C.border}`,
          borderRadius: 12, padding: "14px 16px", fontSize: 13,
          fontFamily: "ui-monospace, 'Cascadia Code', Consolas, monospace",
          lineHeight: 1.75, color: C.text,
          background: approved ? C.greenBg : C.bg,
          resize: "vertical", marginBottom: 16, outline: "none",
          transition: "border-color 0.3s, background 0.3s",
        }}
        onFocus={e => { if (!approved) e.target.style.borderColor = C.indigo; }}
        onBlur={e => { if (!approved) e.target.style.borderColor = C.border; }}
      />

      <button
        onClick={approved || busy ? undefined : onApprove}
        style={{
          width: "100%", padding: "16px", borderRadius: 12, border: "none",
          background: approved ? C.green : C.indigo,
          color: "#fff", fontSize: 16, fontWeight: 700,
          cursor: approved || busy ? "default" : "pointer",
          opacity: busy && !approved ? 0.75 : 1, marginBottom: 28,
          transition: "background 0.3s", fontFamily: "inherit",
        }}
      >
        {approved ? "✓ Approved" : busy ? <><span>Working</span><Dots /></> : "Approve & Generate Documents"}
      </button>

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
              <div style={{ color: C.indigo, fontSize: 12, fontStyle: "italic", marginBottom: 10 }}>
                Targets: {q.weakness}
              </div>
              {["situation", "task", "action", "result"].map(k =>
                q.starAnswer?.[k] ? (
                  <div key={k} style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: C.indigo }}>{k} </span>
                    <span style={{ fontSize: 12, color: C.muted }}>{q.starAnswer[k]}</span>
                  </div>
                ) : null
              )}
              {q.needsRealExample && (
                <div style={{
                  marginTop: 8, padding: "6px 10px", borderRadius: 8,
                  border: `1px solid ${C.amberWarn}44`, background: "#FFFBEB",
                  color: C.amberWarn, fontSize: 12,
                }}>
                  Add a concrete achievement before your interview.
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </Shell>
  );
}

/* ─── Screen: Cover letter ──────────────────────────────────────────── */
function CoverScreen({ letter, loading, error, onRetry, onContinue }) {
  if (loading || !letter) {
    return <LoadingScreen messages={["Writing your cover letter…", "Tailoring it to the role…", "Polishing the tone…"]} />;
  }
  if (error) {
    return (
      <Shell screen="cover">
        <PageTitle title="Cover letter" />
        <ErrorBox message={error} onRetry={onRetry} />
        <div style={{ marginTop: 14 }}>
          <button onClick={onContinue} style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer" }}>
            Skip to downloads →
          </button>
        </div>
      </Shell>
    );
  }

  const paras = [letter.opening, letter.body1, letter.body2, letter.body3Remote, letter.closing].filter(Boolean);

  return (
    <Shell screen="cover">
      <PageTitle title="Your cover letter" sub="Tailored to the role. Download it alongside your CV on the next screen." />
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: "28px 28px 24px", marginBottom: 24, lineHeight: 1.8,
      }}>
        {paras.map((p, i) => (
          <p key={i} style={{ margin: "0 0 18px", color: C.text, fontSize: 14, lineHeight: 1.8 }}>{p}</p>
        ))}
        <p style={{ margin: "24px 0 4px", color: C.muted, fontSize: 13 }}>Warm regards,</p>
        <p style={{ margin: "0 0 6px", fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontSize: 22, fontWeight: 700, color: C.text }}>
          {letter.signoffName}
        </p>
        <div style={{ width: 80, height: 2, background: C.indigo, marginBottom: 6 }} />
        <p style={{ margin: 0, color: C.muted, fontSize: 12 }}>{letter.tagline}</p>
      </div>
      <PrimaryBtn onClick={onContinue} wide>Download all documents →</PrimaryBtn>
    </Shell>
  );
}

/* ─── Screen: Downloads ─────────────────────────────────────────────── */
function DownloadsScreen({ files, loading, error, onRestart }) {
  if (loading) {
    return <LoadingScreen messages={["Generating your PDF…", "Formatting the Word file…", "Packaging your documents…"]} />;
  }

  const mimeFor = fmt => fmt === "pdf"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  const KIND_LABEL = { cv: "Your rewritten CV", cover: "Cover letter", prep: "Interview prep" };

  const grouped = (files || []).reduce((acc, f) => {
    (acc[f.kind] = acc[f.kind] || []).push(f); return acc;
  }, {});

  return (
    <Shell screen="downloads">
      <PageTitle title="Your documents are ready" sub="Download in PDF for sending, or Word to keep editing." />

      {error && <ErrorBox message={error} />}

      {Object.keys(grouped).length === 0 && !error && (
        <Card style={{ marginBottom: 20 }}>
          <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>No files were generated. Please try again.</p>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 }}>
        {Object.entries(grouped).map(([kind, group]) => (
          <div key={kind} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 4, fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
              {KIND_LABEL[kind] || kind}
            </div>
            {group[0].description && (
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>{group[0].description}</div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              {group.map((f, i) => (
                <button key={i}
                  onClick={() => downloadB64(f.name, f.data, mimeFor(f.format))}
                  style={{
                    padding: "10px 22px", borderRadius: 8, border: "none",
                    background: f.format === "pdf" ? C.indigo : C.text,
                    color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14, fontFamily: "inherit",
                  }}
                >
                  ↓ {f.format.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button onClick={onRestart} style={{
        width: "100%", padding: "13px", borderRadius: 12,
        border: `1.5px solid ${C.border}`, background: "transparent",
        color: C.muted, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
      }}>
        Start over with a new CV
      </button>
    </Shell>
  );
}

/* ─── Main CVFlow controller ─────────────────────────────────────────── */
export default function CVFlow({ backendUrl = "http://localhost:5000", onBack }) {
  const [mode,    setMode]    = useState(null);
  const [screen,  setScreen]  = useState("subchoice");
  const [cvText,  setCvText]  = useState("");
  const [jdText,  setJdText]  = useState("");
  const [s1,      setS1]      = useState(null);
  const [s2,      setS2]      = useState(null);
  const [editedCV, setEditedCV] = useState("");
  const [approved, setApproved] = useState(false);
  const [letter,  setLetter]  = useState(null);
  const [files,   setFiles]   = useState(null);

  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError,   setUploadError]   = useState(null);
  const [processError,  setProcessError]  = useState(null);
  const [coverLoading,  setCoverLoading]  = useState(false);
  const [coverError,    setCoverError]    = useState(null);
  const [docsLoading,   setDocsLoading]   = useState(false);
  const [docsError,     setDocsError]     = useState(null);
  const [approvalBusy,  setApprovalBusy]  = useState(false);

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

  async function handleFileSelect(file) {
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) { setUploadError(`File is larger than ${MAX_MB} MB.`); return; }
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setUploadError(file.name.toLowerCase().endsWith(".doc")
        ? "Old .doc format is not supported. Re-save as .docx in Word first."
        : "Unsupported file type. Upload a PDF or .docx file.");
      return;
    }
    setUploadLoading(true); setUploadError(null);
    try { const res = await uploadFile(backendUrl, file); setCvText(res.text || ""); }
    catch (e) { setUploadError(e.message); }
    finally { setUploadLoading(false); }
  }

  function handleUploadContinue() {
    setScreen("processing");
    runAnalysis(cvText, mode === "apply" ? jdText : "");
  }

  async function runAnalysis(cv, jd) {
    setProcessError(null);
    try {
      const res1 = await api(backendUrl, "/analyse-cv", { cvText: cv, jdText: jd || "" });
      setS1(res1.data);
      const summary = compressStage1(res1.data);
      const res2 = await api(backendUrl, "/rewrite-cv", { cvText: cv, jdText: jd || "", stage1Summary: summary });
      setS2(res2.data);
      setEditedCV(res2.data?.rewrittenCV?.fullText || "");
      setScreen("score");
    } catch (e) {
      setProcessError(e.message);
    }
  }

  async function handleApprove() {
    setApproved(true); setApprovalBusy(true);
    setDocsLoading(true); setDocsError(null);
    const cv = { ...s2.rewrittenCV, fullText: editedCV };
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    if (mode === "apply" && jdText.trim()) {
      setScreen("cover"); setCoverLoading(true); setCoverError(null);
    } else {
      setScreen("downloads");
    }

    let coverLetter = null;
    if (mode === "apply" && jdText.trim()) {
      try {
        const res = await api(backendUrl, "/cover-letter", {
          approvedCV: editedCV, jdText,
          candidateMeta: { name: cv.candidateName, title: cv.titleLine, company: cv.companyName, location: cv.candidateLocation },
        });
        coverLetter = res.data.coverLetter; setLetter(coverLetter);
      } catch (e) { setCoverError(e.message); }
      finally { setCoverLoading(false); }
    }

    try {
      const payload = {
        rewrittenCV: cv, pdfData: s2.pdfData,
        coverLetter: coverLetter || null,
        interviewPrep: s2.interviewPrep,
        companyName: cv.companyName, dateStr: today,
        salutation: "Dear Hiring Manager,", template: "A",
      };
      const [pdfRes, docxRes] = await Promise.all([
        api(backendUrl, "/generate-pdfs", payload),
        api(backendUrl, "/generate-docx", payload),
      ]);
      setFiles([...(pdfRes.files || []), ...(docxRes.files || [])]);
    } catch (e) { setDocsError(e.message); }
    finally { setDocsLoading(false); setApprovalBusy(false); }
  }

  /* ── Screen router ── */
  if (screen === "subchoice") return <SubChoiceScreen onSelect={m => { setMode(m); setScreen("upload"); }} onBack={onBack} />;
  if (screen === "upload")
    return (
      <UploadScreen mode={mode} cvText={cvText}
        setCvText={v => { setCvText(v); setUploadError(null); }}
        jdText={jdText} setJdText={setJdText}
        onFileSelect={handleFileSelect} onContinue={handleUploadContinue}
        onBack={() => { setMode(null); setScreen("subchoice"); }}
        loading={uploadLoading} error={uploadError}
      />
    );
  if (screen === "processing")
    return <LoadingScreen error={processError} onRetry={() => { setProcessError(null); runAnalysis(cvText, jdText); }} />;
  if (screen === "score")
    return <ScoreScreen s1={s1} s2={s2} mode={mode} onContinue={() => setScreen("improvements")} />;
  if (screen === "improvements")
    return <ImprovementsScreen s2={s2} mode={mode} onContinue={() => setScreen("approval")} onBack={() => setScreen("score")} />;
  if (screen === "approval")
    return <ApprovalScreen s2={s2} editedCV={editedCV} setEditedCV={setEditedCV} approved={approved} onApprove={handleApprove} busy={approvalBusy} onBack={() => setScreen("improvements")} />;
  if (screen === "cover")
    return (
      <CoverScreen letter={letter} loading={coverLoading} error={coverError}
        onRetry={async () => {
          setCoverError(null); setCoverLoading(true);
          const cv = { ...s2.rewrittenCV, fullText: editedCV };
          try {
            const res = await api(backendUrl, "/cover-letter", {
              approvedCV: editedCV, jdText,
              candidateMeta: { name: cv.candidateName, title: cv.titleLine, company: cv.companyName, location: cv.candidateLocation },
            });
            setLetter(res.data.coverLetter);
          } catch (e) { setCoverError(e.message); }
          finally { setCoverLoading(false); }
        }}
        onContinue={() => setScreen("downloads")}
      />
    );
  if (screen === "downloads") return <DownloadsScreen files={files} loading={docsLoading} error={docsError} onRestart={resetAll} />;
  return null;
}
