import React, { useState, useRef } from "react";

/**
 * CVApp — Sofia Personal CV Engine (Engine 1)
 *
 *  - All AI calls go through the Flask backend (API key never in browser)
 *  - File upload (PDF / Word) via /extract-text before any AI call
 *  - JD is optional throughout — cover letter skipped if no JD
 *  - Template picker (A = sidebar, B = clean single column)
 *  - Downloads include PDF + Word for each document
 *  - Stage 1 output compressed before Stage 2 (saves ~60% tokens)
 *
 * Props:
 *   backendUrl   Flask base URL (default http://localhost:5000)
 */

/* ----------------------------------------------------------------- *
 *  Backend helpers                                                   *
 * ----------------------------------------------------------------- */
function normBase(url) {
  return (url || "").replace(/\/+$/, ""); // strip trailing slashes (B7)
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
  const blob = new Blob([arr], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

const MAX_UPLOAD_MB = 8;
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

const GRADE_COLORS = { A: "#22C55E", B: "#84CC16", C: "#F59E0B", D: "#EF4444" };

function ScoreGauge({ score = 0, max = 160, grade = "C" }) {
  const [val, setVal] = React.useState(0);
  React.useEffect(() => {
    let raf;
    const start = performance.now();
    const dur = 1100;
    const tick = t => {
      const p = Math.min(1, (t - start) / dur);
      setVal(score * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);
  const r = 64, circ = 2 * Math.PI * r;
  const color = GRADE_COLORS[grade] || "#6C63FF";
  return (
    <div style={{ position: "relative", width: 160, height: 160 }}>
      <svg width="160" height="160" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="80" cy="80" r={r} fill="none" stroke="#1E1E2E" strokeWidth="12" />
        <circle cx="80" cy="80" r={r} fill="none" stroke={color} strokeWidth="12"
          strokeLinecap="round" strokeDasharray={circ}
          strokeDashoffset={circ * (1 - Math.max(0, Math.min(1, val / max)))}
          style={{ transition: "stroke 0.4s" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 38, color: "#F1F0FF", lineHeight: 1 }}>{Math.round(val)}</div>
        <div style={{ fontSize: 11, color: "#6B6B8A", letterSpacing: 1 }}>/ {max}</div>
      </div>
    </div>
  );
}

function GradeBadge({ grade, label }) {
  const c = GRADE_COLORS[grade] || "#6C63FF";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 54, height: 54, borderRadius: 12, background: `${c}22`, border: `1.5px solid ${c}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Serif Display', serif", fontSize: 30, color: c }}>{grade}</div>
      <div style={{ color: "#F1F0FF", fontSize: 13, maxWidth: 160 }}>{label}</div>
    </div>
  );
}

function Bar({ category, score, issue, quote }) {
  const [w, setW] = React.useState(0);
  React.useEffect(() => { const id = setTimeout(() => setW((score / 10) * 100), 60); return () => clearTimeout(id); }, [score]);
  const color = score >= 7 ? "#22C55E" : score >= 5 ? "#F59E0B" : "#EF4444";
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
        <span style={{ color: "#F1F0FF" }}>{category}</span>
        <span style={{ color, fontWeight: 600 }}>{score}/10</span>
      </div>
      <div style={{ height: 6, background: "#1E1E2E", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: 4, transition: "width 0.9s cubic-bezier(.2,.7,.2,1)" }} />
      </div>
      {issue && <div style={{ fontSize: 11, color: "#6B6B8A", marginTop: 5 }}>{issue}</div>}
      {quote && <div style={{ fontSize: 11, color: "#B89A68", marginTop: 3, fontStyle: "italic" }}>"{quote}"</div>}
    </div>
  );
}

function BeforeAfterBar({ category, before, after }) {
  const [wb, setWb] = React.useState(0), [wa, setWa] = React.useState(0);
  React.useEffect(() => { const id = setTimeout(() => { setWb((before / 10) * 100); setWa((after / 10) * 100); }, 60); return () => clearTimeout(id); }, [before, after]);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
        <span style={{ color: "#F1F0FF" }}>{category}</span>
        <span><span style={{ color: "#EF4444" }}>{before}</span> &rarr; <span style={{ color: "#22C55E" }}>{after}</span></span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ height: 5, background: "#1E1E2E", borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${wb}%`, background: "#EF4444", transition: "width 0.8s" }} /></div>
        <div style={{ height: 5, background: "#1E1E2E", borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${wa}%`, background: "#22C55E", transition: "width 1s" }} /></div>
      </div>
    </div>
  );
}

function Skeleton({ label }) {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ color: "#B89A68", fontSize: 14, marginBottom: 18 }}>{label}<Ellipsis /></div>
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{ height: 14, marginBottom: 12, borderRadius: 6, width: `${90 - i * 9}%`, background: "linear-gradient(90deg,#15151f,#1E1E2E,#15151f)", backgroundSize: "200% 100%", animation: "shimmer 1.3s infinite" }} />
      ))}
    </div>
  );
}

function ErrorCard({ message, onRetry }) {
  return (
    <div style={{ margin: 18, padding: 18, border: "1px solid #EF4444", borderRadius: 12, background: "#EF444411" }}>
      <div style={{ color: "#EF4444", fontWeight: 600, marginBottom: 8 }}>Something went wrong</div>
      <div style={{ color: "#F1F0FF", fontSize: 13, lineHeight: 1.5 }}>{message}</div>
      {onRetry && <button onClick={onRetry} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, border: "none", background: "#EF4444", color: "#fff", cursor: "pointer", fontSize: 13 }}>Retry</button>}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ color: "#B89A68", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>{title}</div>
      <div style={{ background: "#111118", border: "1px solid #1E1E2E", borderRadius: 12, padding: 16 }}>{children}</div>
    </div>
  );
}

function Row({ k, v, c = "#F1F0FF" }) {
  return <div style={{ marginBottom: 8 }}><span style={{ color: "#6B6B8A", fontSize: 11 }}>{k}: </span><span style={{ color: c, fontSize: 13 }}>{v}</span></div>;
}

function SubList({ title, items, c }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: "#6B6B8A", fontSize: 11, marginBottom: 4 }}>{title}</div>
      {(items || []).map((x, i) => <div key={i} style={{ color: c, fontSize: 12, marginBottom: 3 }}>&bull; {x}</div>)}
    </div>
  );
}

function ScoreGroup({ title, items }) {
  return <Card title={title}>{(items || []).map((it, i) => <Bar key={i} category={it.category} score={it.score} issue={it.issue} quote={it.quote} />)}</Card>;
}

function KeywordPills({ title, items, c }) {
  return (
    <div style={{ flex: 1, minWidth: 160 }}>
      <div style={{ color: "#6B6B8A", fontSize: 11, marginBottom: 6 }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {(items || []).map((k, i) => <span key={i} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 14, background: `${c}18`, color: c, border: `1px solid ${c}55` }}>{k}</span>)}
      </div>
    </div>
  );
}

function RulesPanel({ rules }) {
  if (!rules) return null;
  const items = [
    { label: "ATS Score", value: `${rules.ats_score}/100`, ok: rules.ats_score >= 70 },
    { label: "Metric Density", value: `${rules.metric_density}%`, ok: rules.metric_density >= 30 },
    { label: "Verb Strength", value: `${rules.verb_strength}/100`, ok: rules.verb_strength >= 50 },
    { label: "Word Count", value: rules.word_count, ok: rules.word_count >= 300 && rules.word_count <= 700 },
  ];
  return (
    <Card title="Quick Scan (rules engine)">
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
          <span style={{ color: "#6B6B8A" }}>{it.label}</span>
          <span style={{ color: it.ok ? "#22C55E" : "#F59E0B", fontWeight: 600 }}>{it.value}</span>
        </div>
      ))}
      {rules.ai_flag && (
        <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, background: "#F59E0B18", border: "1px solid #F59E0B55", color: "#F59E0B", fontSize: 11 }}>
          &#9888; Possible AI-written CV detected
        </div>
      )}
    </Card>
  );
}

/* ----------------------------------------------------------------- *
 *  View components                                                   *
 * ----------------------------------------------------------------- */
function Placeholder({ text }) {
  return <div style={{ padding: 60, textAlign: "center", color: "#6B6B8A", fontSize: 14 }}>{text}</div>;
}

function AnalysisView({ s1 }) {
  const sc = s1.scorecard || {}, fi = s1.firstImpression || {}, ci = s1.competitiveIntelligence || {};
  const verdictColor = fi.verdict === "Shortlist" ? "#22C55E" : fi.verdict === "Maybe" ? "#F59E0B" : "#EF4444";
  return (
    <div className="fade-up" style={{ padding: 24 }}>
      <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap", marginBottom: 28 }}>
        <ScoreGauge score={sc.overallScore || 0} grade={sc.grade} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <GradeBadge grade={sc.grade} label={sc.gradeLabel} />
          <div style={{ marginTop: 16 }}>
            <span style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: `${verdictColor}22`, color: verdictColor, border: `1px solid ${verdictColor}` }}>{fi.verdict}</span>
            <div style={{ color: "#6B6B8A", fontSize: 12, marginTop: 8 }}>{fi.verdictReason}</div>
          </div>
        </div>
      </div>
      <Card title="First Impression">
        <Row k="Perceived role" v={fi.perceivedRole} />
        <Row k="Seniority" v={fi.perceivedSeniority} />
        <Row k="Strongest signal" v={fi.strongestSignal} c="#22C55E" />
        <Row k="Biggest red flag" v={fi.biggestRedFlag} c="#EF4444" />
      </Card>
      <ScoreGroup title="Content Quality" items={sc.contentQuality} />
      <ScoreGroup title="Strategic Fit" items={sc.strategicFit} />
      <ScoreGroup title="Presentation & Trust" items={sc.presentationTrust} />
      {(s1.killList || []).length > 0 && (
        <Card title="Kill List">
          {s1.killList.map((k, i) => (
            <div key={i} style={{ border: "1px solid #EF444455", borderLeft: "3px solid #EF4444", borderRadius: 8, padding: 12, marginBottom: 10, background: "#EF444408" }}>
              <div style={{ color: "#EF4444", fontSize: 12, fontStyle: "italic" }}>"{k.weakLine}"</div>
              <div style={{ color: "#6B6B8A", fontSize: 11, margin: "6px 0" }}>{k.whyItFails}</div>
              <div style={{ color: "#22C55E", fontSize: 12 }}>&rarr; {k.replacement}</div>
            </div>
          ))}
        </Card>
      )}
      <Card title="Competitive Intelligence">
        <SubList title="Top shortlist reasons" items={ci.topShortlistReasons} c="#22C55E" />
        <SubList title="Interview weaknesses" items={ci.interviewWeaknesses} c="#F59E0B" />
        <Row k="Competition" v={ci.competitionAssessment} />
        <Row k="Honest limitation" v={ci.honestLimitation} c="#EF4444" />
        {(ci.quickWins || []).map((q, i) => (
          <div key={i} style={{ fontSize: 12, color: "#F1F0FF", marginTop: 8 }}>
            <span style={{ color: "#B89A68" }}>&#9889; {q.action}</span>
            <span style={{ color: "#6B6B8A" }}> &mdash; {q.timeEstimate} &middot; {q.whereToShow}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function ImprovementsView({ s2 }) {
  const ip = s2.improvementPlan || {}, rs = s2.rescore || {}, rn = s2.recruiterNote || {};
  return (
    <div className="fade-up" style={{ padding: 24 }}>
      <Card title="Before &rarr; After">
        <div style={{ display: "flex", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
          <div><div style={{ color: "#6B6B8A", fontSize: 11 }}>Before</div><div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, color: "#EF4444" }}>{rs.scoreBefore} <span style={{ fontSize: 14 }}>{rs.gradeBefore}</span></div></div>
          <div><div style={{ color: "#6B6B8A", fontSize: 11 }}>After</div><div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, color: "#22C55E" }}>{rs.scoreAfter} <span style={{ fontSize: 14 }}>{rs.gradeAfter}</span></div></div>
        </div>
        {(rs.categories || []).map((c, i) => <BeforeAfterBar key={i} category={c.category} before={c.before} after={c.after} />)}
      </Card>
      <Card title="Priority Fixes">
        {(ip.priorityFixes || []).map((p, i) => {
          const ic = p.impact === "High" ? "#EF4444" : p.impact === "Medium" ? "#F59E0B" : "#6B6B8A";
          return (
            <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #1E1E2E" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#F1F0FF", fontWeight: 600, fontSize: 13 }}>{p.section}</span>
                <span style={{ color: ic, fontSize: 11, fontWeight: 600 }}>{p.impact}</span>
              </div>
              <div style={{ color: "#EF4444", fontSize: 12, marginTop: 4 }}>{p.problem}</div>
              <div style={{ color: "#22C55E", fontSize: 12, marginTop: 2 }}>{p.fix}</div>
            </div>
          );
        })}
      </Card>
      <Card title="Keywords">
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <KeywordPills title="Add" items={ip.keywordsToAdd} c="#22C55E" />
          <KeywordPills title="Remove" items={ip.keywordsToRemove} c="#EF4444" />
        </div>
      </Card>
      <Card title="Bullet Transformations">
        {(ip.bulletTransformations || []).map((b, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={{ color: "#EF4444", fontSize: 12, fontStyle: "italic" }}>"{b.original}"</div>
            <div style={{ color: "#22C55E", fontSize: 12, marginTop: 3 }}>&rarr; {b.rewritten}</div>
            <div style={{ color: "#6B6B8A", fontSize: 11, marginTop: 2 }}>{b.reason}</div>
          </div>
        ))}
      </Card>
      <Card title="Recruiter Note">
        <SubList title="Shortlist reasons" items={rn.shortlistReasons} c="#22C55E" />
        <SubList title="Interview weaknesses" items={rn.interviewWeaknesses} c="#F59E0B" />
        {(rn.quickWins || []).map((q, i) => (
          <div key={i} style={{ fontSize: 12, color: "#F1F0FF", marginTop: 6 }}>
            <span style={{ color: "#B89A68" }}>&#9889; {q.action}</span>
            <span style={{ color: "#6B6B8A" }}> &mdash; {q.timeEstimate} &middot; {q.whereToShow}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function ApprovalGate({ s2, editedCV, setEditedCV, approved, onApprove, busy }) {
  const prep = s2.interviewPrep || {};
  return (
    <div className="fade-up" style={{ padding: 24 }}>
      <div style={{ border: "1.5px solid #B89A68", borderRadius: 14, padding: 20, background: "linear-gradient(180deg,#B89A6810,transparent)", marginBottom: 24 }}>
        <div style={{ color: "#B89A68", fontSize: 13, fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>APPROVAL GATE</div>
        <div style={{ color: "#6B6B8A", fontSize: 12, marginBottom: 14 }}>Review and edit the rewritten CV. Nothing proceeds until you approve.</div>
        <textarea value={editedCV} onChange={e => setEditedCV(e.target.value)} disabled={approved}
          style={{ ...S.textarea, minHeight: 320, fontFamily: "ui-monospace, monospace", fontSize: 12 }} />
        <button onClick={onApprove} disabled={approved || busy}
          style={{ ...S.cta, marginTop: 14, background: approved ? "#22C55E" : "#B89A68", color: "#0A0A0F", opacity: busy ? 0.6 : 1, cursor: approved || busy ? "default" : "pointer" }}>
          {approved ? "\u2713 Approved" : busy ? <><span>Working</span><Ellipsis /></> : "APPROVE & GENERATE DOCUMENTS"}
        </button>
      </div>
      <Card title="Interview Prep">
        {(prep.questions || []).map((q, i) => (
          <div key={i} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #1E1E2E" }}>
            <div style={{ color: "#F1F0FF", fontWeight: 600, fontSize: 13 }}>{i + 1}. {q.question}</div>
            <div style={{ color: "#B89A68", fontSize: 11, fontStyle: "italic", margin: "4px 0 8px" }}>Targets: {q.weakness}</div>
            {["situation", "task", "action", "result"].map(k => q.starAnswer?.[k] ? (
              <div key={k} style={{ marginBottom: 5 }}>
                <span style={{ color: "#B89A68", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{k}</span>
                <div style={{ color: "#6B6B8A", fontSize: 12 }}>{q.starAnswer[k]}</div>
              </div>
            ) : null)}
            {q.needsRealExample && (
              <div style={{ border: "1px solid #B89A68", borderRadius: 6, padding: "6px 10px", color: "#B89A68", fontSize: 11, marginTop: 6 }}>
                [NEEDS REAL EXAMPLE] &mdash; add a concrete achievement before the interview.
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

function CoverLetterView({ letter }) {
  const paras = [letter.opening, letter.body1, letter.body2, letter.body3Remote, letter.closing].filter(Boolean);
  return (
    <div className="fade-up" style={{ padding: 24 }}>
      <Card title="Cover Letter">
        {paras.map((p, i) => <p key={i} style={{ color: "#F1F0FF", fontSize: 13, lineHeight: 1.7, marginBottom: 14 }}>{p}</p>)}
        <div style={{ marginTop: 18, color: "#F1F0FF", fontSize: 13 }}>Warm regards,</div>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: "#F1F0FF", marginTop: 6 }}>{letter.signoffName}</div>
        <div style={{ width: 160, height: 1, background: "#B89A68", margin: "6px 0" }} />
        <div style={{ color: "#6B6B8A", fontSize: 11 }}>{letter.tagline}</div>
      </Card>
    </div>
  );
}

function DownloadsView({ files }) {
  const mimeFor = fmt => fmt === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const grouped = files.reduce((acc, f) => { (acc[f.kind] = acc[f.kind] || []).push(f); return acc; }, {});
  return (
    <div className="fade-up" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {Object.entries(grouped).map(([kind, group]) => (
        <div key={kind} style={{ border: "1px solid #1E1E2E", borderRadius: 14, padding: 20, background: "#111118" }}>
          <div style={{ color: "#B89A68", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
            {kind === "cv" ? "CV" : kind === "cover" ? "Cover Letter" : "Interview Prep"}
          </div>
          <div style={{ color: "#6B6B8A", fontSize: 12, marginBottom: 14 }}>{group[0].description}</div>
          <div style={{ display: "flex", gap: 10 }}>
            {group.map((f, i) => (
              <button key={i} onClick={() => downloadB64(f.name, f.data, mimeFor(f.format))}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: f.format === "pdf" ? "#B89A68" : "#1E1E2E", color: f.format === "pdf" ? "#0A0A0F" : "#F1F0FF", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                &darr; {f.format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- *
 *  Styles                                                            *
 * ----------------------------------------------------------------- */
const S = {
  root: { background: "#0A0A0F", minHeight: "100vh", color: "#F1F0FF", fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", flexDirection: "column" },
  progressWrap: { padding: "16px 24px", borderBottom: "1px solid #1E1E2E", background: "#0A0A0F" },
  body: { display: "flex", flex: 1, minHeight: 0 },
  left: { width: "40%", padding: 24, borderRight: "1px solid #1E1E2E", overflowY: "auto" },
  right: { width: "60%", display: "flex", flexDirection: "column", minWidth: 0 },
  tabBar: { display: "flex", borderBottom: "1px solid #1E1E2E", padding: "0 12px", overflowX: "auto" },
  tab: { background: "none", border: "none", padding: "14px 14px", fontSize: 13, whiteSpace: "nowrap", fontFamily: "inherit" },
  tabContent: { flex: 1, overflowY: "auto" },
  textarea: { width: "100%", minHeight: 180, background: "#111118", color: "#F1F0FF", border: "1px solid #1E1E2E", borderRadius: 10, padding: 12, fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.5 },
  cta: { width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "#6C63FF", color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: "inherit", letterSpacing: 0.3 },
  uploadBox: { border: "1.5px dashed #1E1E2E", borderRadius: 10, padding: "16px 12px", textAlign: "center", cursor: "pointer", color: "#6B6B8A", fontSize: 12 },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap');
@keyframes shimmer { 0%{background-position:200% 0}100%{background-position:-200% 0} }
@keyframes fadeUp { from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none} }
.fade-up{animation:fadeUp .5s both}
*{scrollbar-width:thin;scrollbar-color:#1E1E2E transparent}
*::-webkit-scrollbar{width:8px;height:8px}
*::-webkit-scrollbar-thumb{background:#1E1E2E;border-radius:4px}
textarea:focus{border-color:#6C63FF!important}
button:hover:not(:disabled){filter:brightness(1.08)}
`;

const TABS = ["Analysis", "Improvements", "Final CV", "Cover Letter", "Downloads"];

/* ----------------------------------------------------------------- *
 *  Main component                                                    *
 * ----------------------------------------------------------------- */
export default function CVApp({ backendUrl = "http://localhost:5000" }) {
  const [cvText, setCvText] = useState("");
  const [jdText, setJdText] = useState("");
  const [template, setTemplate] = useState("A");
  const [rulesResult, setRulesResult] = useState(null);

  const [stage, setStage] = useState(0);
  const [tab, setTab] = useState("Analysis");

  const [s1, setS1] = useState(null);
  const [s2, setS2] = useState(null);
  const [editedCV, setEditedCV] = useState("");
  const [approved, setApproved] = useState(false);
  const [letter, setLetter] = useState(null);
  const [files, setFiles] = useState(null);

  // Saved Stage-4 context so the Downloads Retry button works (B2).
  const [docCtx, setDocCtx] = useState(null);

  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});

  const fileRef = useRef();

  const setErr = (k, v) => setErrors(e => ({ ...e, [k]: v }));
  const setLoad = (k, v) => setLoading(l => ({ ...l, [k]: v }));

  function resetAll() {
    setS1(null); setS2(null); setLetter(null); setFiles(null);
    setApproved(false); setEditedCV(""); setDocCtx(null);
    setStage(0); setTab("Analysis"); setErrors({}); setLoading({});
  }

  /* --- File upload --- */
  async function handleFileUpload(file) {
    if (!file) return;
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setErr("extract", `That file is larger than ${MAX_UPLOAD_MB} MB. Please upload a smaller PDF or .docx.`);
      return;
    }
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setErr("extract", file.name.toLowerCase().endsWith(".doc")
        ? "Old .doc format is not supported. Re-save your CV as .docx in Word and try again."
        : "Unsupported file type. Upload a PDF or Word (.docx) file.");
      return;
    }
    setLoad("extract", true);
    setErr("extract", null);
    try {
      const res = await uploadFile(backendUrl, file);
      setCvText(res.text || "");
      setRulesResult(res.rulesEngine || null);
    } catch (e) {
      setErr("extract", e.message);
    } finally {
      setLoad("extract", false);
    }
  }

  /* --- Stage 1 --- */
  async function runStage1() {
    setErr("analysis", null); setLoad("analysis", true); setStage(1);
    setS1(null); setS2(null); setLetter(null); setFiles(null); setApproved(false); setDocCtx(null);
    try {
      const res = await api(backendUrl, "/analyse-cv", { cvText, jdText });
      const data = res.data;
      setS1(data); setTab("Analysis");
      await runStage2(data);
    } catch (e) {
      setErr("analysis", e.message);
    } finally {
      setLoad("analysis", false);
    }
  }

  /* --- Stage 2 --- */
  async function runStage2(stage1) {
    setErr("improve", null); setLoad("improve", true); setStage(2);
    try {
      const stage1Summary = compressStage1(stage1);
      const res = await api(backendUrl, "/rewrite-cv", { cvText, jdText, stage1Summary });
      const data = res.data;
      setS2(data);
      setEditedCV(data?.rewrittenCV?.fullText || "");
      setTab("Improvements");
    } catch (e) {
      setErr("improve", e.message);
    } finally {
      setLoad("improve", false);
    }
  }

  /* --- Approval -> Stage 3 --- */
  async function approveAndContinue() {
    setApproved(true);
    setStage(3);
    const cv = { ...s2.rewrittenCV, fullText: editedCV };
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    let coverLetter = null;
    if (jdText.trim()) {
      setErr("cover", null); setLoad("cover", true); setTab("Cover Letter");
      try {
        const res = await api(backendUrl, "/cover-letter", {
          approvedCV: editedCV,
          jdText,
          candidateMeta: {
            name: cv.candidateName, title: cv.titleLine,
            company: cv.companyName, location: cv.candidateLocation,
          },
        });
        coverLetter = res.data.coverLetter;
        setLetter(coverLetter);
      } catch (e) {
        setErr("cover", e.message);
      } finally {
        setLoad("cover", false);
      }
    }

    await runStage4(cv, coverLetter, today);
  }

  /* --- Stage 4 PDFs + Docx --- */
  async function runStage4(cvObj, coverLetter, today) {
    // Support a zero-arg retry by falling back to saved context (B2).
    if (!cvObj && docCtx) {
      cvObj = docCtx.cvObj; coverLetter = docCtx.coverLetter; today = docCtx.today;
    }
    if (!cvObj) {
      setErr("pdf", "Approve the CV first, then documents can be generated.");
      return;
    }
    setDocCtx({ cvObj, coverLetter, today });
    setErr("pdf", null); setLoad("pdf", true); setStage(4);
    try {
      const payload = {
        rewrittenCV: cvObj,
        pdfData: s2.pdfData,
        coverLetter: coverLetter || null,
        interviewPrep: s2.interviewPrep,
        companyName: cvObj.companyName,
        dateStr: today || new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
        salutation: "Dear Hiring Manager,",
        template,
      };
      const [pdfRes, docxRes] = await Promise.all([
        api(backendUrl, "/generate-pdfs", payload),
        api(backendUrl, "/generate-docx", payload),
      ]);
      setFiles([...(pdfRes.files || []), ...(docxRes.files || [])]);
      setTab("Downloads");
    } catch (e) {
      setErr("pdf", e.message);
    } finally {
      setLoad("pdf", false);
    }
  }

  const canStart = cvText.trim().length >= MIN_CV_CHARS;
  const busy = loading.analysis || loading.improve || loading.cover || loading.pdf;
  const stageNames = ["Idle", "Analysing", "Building improvements", "Writing cover letter", "Generating documents"];

  return (
    <div style={S.root}>
      <style>{CSS}</style>

      <div style={S.progressWrap}>
        <div style={{ display: "flex", alignItems: "baseline", marginBottom: 10 }}>
          <span style={{ color: "#B89A68", fontFamily: "'DM Serif Display', serif", fontSize: 18 }}>Sofia</span>
          <span style={{ color: "#6B6B8A", fontSize: 12, marginLeft: 14 }}>{busy ? <>{stageNames[stage]}<Ellipsis /></> : stage > 0 ? "Pipeline active" : "Ready"}</span>
          {stage > 0 && !busy && (
            <button onClick={resetAll} style={{ marginLeft: "auto", background: "none", border: "1px solid #1E1E2E", color: "#6B6B8A", borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              Start over
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[1, 2, 3, 4].map(n => <div key={n} style={{ flex: 1, height: 4, borderRadius: 3, background: stage >= n ? "#B89A68" : "#1E1E2E", transition: "background .5s" }} />)}
        </div>
      </div>

      <div style={S.body}>
        <div style={S.left}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ color: "#F1F0FF", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Upload CV</div>
            <div style={{ color: "#6B6B8A", fontSize: 11, marginBottom: 8 }}>PDF or Word &mdash; extracted to text automatically (max {MAX_UPLOAD_MB} MB)</div>
            <div style={S.uploadBox} onClick={() => fileRef.current?.click()}>
              {loading.extract ? <>Extracting<Ellipsis /></> : "Click to upload PDF or .docx"}
              <input ref={fileRef} type="file" accept=".pdf,.docx" style={{ display: "none" }}
                onChange={e => handleFileUpload(e.target.files[0])} />
            </div>
            {errors.extract && <div style={{ color: "#EF4444", fontSize: 11, marginTop: 6 }}>{errors.extract}</div>}
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ color: "#F1F0FF", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Your CV</div>
            <div style={{ color: "#6B6B8A", fontSize: 11, marginBottom: 8 }}>Or paste plain text directly</div>
            <textarea value={cvText} onChange={e => setCvText(e.target.value)} placeholder="Paste your CV here&hellip;" style={S.textarea} />
          </div>

          {rulesResult && <RulesPanel rules={rulesResult} />}

          <div style={{ marginBottom: 18 }}>
            <div style={{ color: "#F1F0FF", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Job Description <span style={{ color: "#6B6B8A", fontWeight: 400 }}>(optional)</span></div>
            <div style={{ color: "#6B6B8A", fontSize: 11, marginBottom: 8 }}>Skip if you just want a general CV rewrite. Cover letter requires a JD.</div>
            <textarea value={jdText} onChange={e => setJdText(e.target.value)} placeholder="Paste the job description here&hellip;" style={{ ...S.textarea, minHeight: 120 }} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ color: "#F1F0FF", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Template</div>
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { id: "A", label: "Classic Sidebar", desc: "Gold sidebar, two-column" },
                { id: "B", label: "Clean Column", desc: "Minimal, single column" },
              ].map(t => (
                <div key={t.id} onClick={() => setTemplate(t.id)} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${template === t.id ? "#B89A68" : "#1E1E2E"}`, cursor: "pointer", background: template === t.id ? "#B89A6810" : "#111118" }}>
                  <div style={{ color: template === t.id ? "#B89A68" : "#F1F0FF", fontSize: 12, fontWeight: 600 }}>{t.label}</div>
                  <div style={{ color: "#6B6B8A", fontSize: 11, marginTop: 2 }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={runStage1} disabled={!canStart || busy}
            style={{ ...S.cta, opacity: !canStart || busy ? 0.45 : 1, cursor: !canStart || busy ? "not-allowed" : "pointer" }}>
            {busy ? <><span>Working</span><Ellipsis /></> : "Analyse CV"}
          </button>
          <div style={{ fontSize: 11, color: "#6B6B8A", marginTop: 10, lineHeight: 1.6 }}>
            Runs analysis then rewrite together{jdText.trim() ? ", then the cover letter," : ""} and finishes with documents (PDF + Word).
          </div>
        </div>

        <div style={S.right}>
          <div style={S.tabBar}>
            {TABS.map(t => {
              const enabled = t === "Analysis" ? !!s1 : t === "Improvements" ? !!s2 : t === "Final CV" ? !!s2 : t === "Cover Letter" ? approved && !!jdText.trim() : !!files;
              return (
                <button key={t} onClick={() => enabled && setTab(t)} style={{ ...S.tab, color: tab === t ? "#F1F0FF" : enabled ? "#6B6B8A" : "#33334a", borderBottom: tab === t ? "2px solid #B89A68" : "2px solid transparent", cursor: enabled ? "pointer" : "default" }}>{t}</button>
              );
            })}
          </div>
          <div style={S.tabContent}>
            {tab === "Analysis" && (loading.analysis ? <Skeleton label="Analysing CV" /> : errors.analysis ? <ErrorCard message={errors.analysis} onRetry={runStage1} /> : s1 ? <AnalysisView s1={s1} /> : <Placeholder text="Run an analysis to begin." />)}
            {tab === "Improvements" && (loading.improve ? <Skeleton label="Building improvements & rewrite" /> : errors.improve ? <ErrorCard message={errors.improve} onRetry={() => runStage2(s1)} /> : s2 ? <ImprovementsView s2={s2} /> : <Placeholder text="Improvements appear after analysis." />)}
            {tab === "Final CV" && (s2 ? <ApprovalGate s2={s2} editedCV={editedCV} setEditedCV={setEditedCV} approved={approved} onApprove={approveAndContinue} busy={loading.cover || loading.pdf} /> : <Placeholder text="The rewritten CV appears after analysis." />)}
            {tab === "Cover Letter" && (
              !jdText.trim() ? <Placeholder text="Add a job description to generate a cover letter." /> :
              loading.cover ? <Skeleton label="Writing cover letter" /> :
              errors.cover ? <ErrorCard message={errors.cover} onRetry={approveAndContinue} /> :
              letter ? <CoverLetterView letter={letter} /> :
              <Placeholder text="Approve the CV to generate the cover letter." />
            )}
            {tab === "Downloads" && (loading.pdf ? <Skeleton label="Generating documents" /> : errors.pdf ? <ErrorCard message={errors.pdf} onRetry={() => runStage4()} /> : files ? <DownloadsView files={files} /> : <Placeholder text="Your documents appear here." />)}
          </div>
        </div>
      </div>
    </div>
  );
}
