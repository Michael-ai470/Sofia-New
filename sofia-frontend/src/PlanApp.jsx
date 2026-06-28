import React, { useState } from "react";
import { AlertTriangle, Lock } from "./Icons.jsx";

const C = {
  indigo: "#3D2F8F",
  indigoDark: "#2A1F6B",
  indigoTint: "#F0EEFF",
  amber: "#F5A623",
  amberLight: "rgba(245,166,35,0.10)",
  bg: "#FAFAFA",
  surface: "#FFFFFF",
  text: "#1A1A2E",
  muted: "rgba(26,26,46,0.6)",
  border: "#E8EAF0",
  green: "#27AE60",
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

/* Grant list mirrors GRANT_LIBRARY keys in app.py */
const GRANTS = [
  { id: "general",   name: "General business plan",       blurb: "Investors, banks, or internal use." },
  { id: "tef",       name: "Tony Elumelu Foundation",     blurb: "African impact, jobs, scalability." },
  { id: "hult",      name: "Hult Prize",                  blurb: "UN SDG-led, globally minded." },
  { id: "yali",      name: "YALI Mandela Washington",     blurb: "Leadership story, community impact." },
  { id: "seedstars", name: "Seedstars Africa Ventures",   blurb: "Traction-first, investor-grade." },
];

const SECTION_LABELS = {
  executiveSummary: "Executive summary",
  problemStatement: "Problem", problem: "Problem", problemAndSDG: "Problem & SDG",
  solution: "Solution", solutionAndProduct: "Solution & product",
  marketOpportunity: "Market opportunity", marketAnalysis: "Market analysis",
  marketSize: "Market size",
  revenueModel: "Revenue model", businessModel: "Business model",
  impactProjection: "Impact projection", socialImpactMetrics: "Social impact metrics",
  communityImpact: "Community impact",
  useOfFunds: "Use of funds", financialAsk: "Funding ask", theAsk: "The ask",
  financials: "Financials", financialProjections: "Financial projections",
  tractionAndMetrics: "Traction & metrics", team: "Team",
  leadershipStory: "Leadership story", businessOverview: "Business overview",
  companyOverview: "Company overview", productsAndServices: "Products & services",
  marketingStrategy: "Marketing strategy", operationsPlan: "Operations plan",
  managementTeam: "Management team", sustainabilityPlan: "Sustainability plan",
};

function labelFor(key) {
  return SECTION_LABELS[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase()).trim();
}

function money(n) {
  const v = Number(n);
  return isFinite(v) ? "$" + v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—";
}

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
        background: "none", border: `1.5px solid ${hov ? C.indigo : C.border}`,
        borderRadius: 8, padding: "6px 14px", cursor: "pointer",
        fontFamily: "inherit", transition: "border-color 0.15s",
      }}
    >
      ← Back to Sofia
    </button>
  );
}

function Field({ label: lbl, value, onChange, placeholder, rows }) {
  const base = {
    width: "100%", boxSizing: "border-box",
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 8, color: C.text, padding: "9px 11px",
    fontSize: 14, fontFamily: "inherit", outline: "none",
    transition: "border-color 0.15s",
  };
  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 5 }}>{lbl}</div>
      {rows ? (
        <textarea value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} rows={rows}
          style={{ ...base, resize: "vertical" }}
          onFocus={e => (e.target.style.borderColor = C.indigo)}
          onBlur={e => (e.target.style.borderColor = C.border)}
        />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} style={base}
          onFocus={e => (e.target.style.borderColor = C.indigo)}
          onBlur={e => (e.target.style.borderColor = C.border)}
        />
      )}
    </div>
  );
}

function ErrorCard({ message, onRetry }) {
  return (
    <div style={{ background: C.redBg, border: `1px solid ${C.red}33`, borderRadius: 12, padding: "16px 18px", marginTop: 16 }}>
      <div style={{ color: C.red, fontWeight: 600, marginBottom: 6 }}>Couldn't generate the plan</div>
      <div style={{ color: C.text, fontSize: 14, marginBottom: onRetry ? 14 : 0 }}>{message}</div>
      {onRetry && <PrimaryBtn onClick={onRetry}>Try again</PrimaryBtn>}
    </div>
  );
}

/* ─── Loading screen ────────────────────────────────────────────────── */
const PLAN_MSGS = [
  "Reading your business details…",
  "Researching the market…",
  "Writing your executive summary…",
  "Drafting your business plan…",
  "Reviewing for accuracy…",
];

function LoadingScreen({ error, onRetry }) {
  const [idx, setIdx] = useState(0);
  React.useEffect(() => {
    if (error) return;
    const id = setInterval(() => setIdx(i => (i + 1) % PLAN_MSGS.length), 2800);
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
            <h2 style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontWeight: 700, color: C.text, margin: "0 0 10px" }}>
              Couldn't generate the plan
            </h2>
            <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>{error}</p>
            {onRetry && <PrimaryBtn onClick={onRetry}>Try again</PrimaryBtn>}
          </div>
        ) : (
          <>
            <div style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontSize: 44, fontWeight: 800, color: C.indigo, letterSpacing: "-1px", animation: "pulseSofia 2.4s ease-in-out infinite" }}>
              Sofia
            </div>
            <p style={{ fontSize: 16, color: C.muted, margin: 0, textAlign: "center", minHeight: 26 }}>
              {PLAN_MSGS[idx]}
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              {PLAN_MSGS.map((_, i) => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === idx ? C.indigo : C.border, transition: "background 0.4s" }} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Section renderers ─────────────────────────────────────────────── */
function LockedSection({ name }) {
  return (
    <div style={{
      background: C.surface, border: `1.5px dashed ${C.border}`,
      borderRadius: 14, padding: "20px 22px",
      position: "relative", overflow: "hidden", minHeight: 100,
    }}>
      {/* Faux blurred text rows */}
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: C.muted, marginBottom: 12 }}>
        {name}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: 0.25, filter: "blur(3px)", userSelect: "none" }}>
        {[90, 75, 85, 60].map((w, i) => (
          <div key={i} style={{ height: 12, width: `${w}%`, background: C.border, borderRadius: 4 }} />
        ))}
      </div>
      {/* Lock overlay */}
      <div style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "rgba(250,250,250,0.75)", backdropFilter: "blur(3px)",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 6, color: C.indigo }}><Lock size={28} /></div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.indigo }}>Paid section</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Unlock with credits</div>
        </div>
      </div>
    </div>
  );
}

function TextSection({ name, body }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: C.muted, marginBottom: 12 }}>
        {name}
      </div>
      {String(body).split(/\n{2,}/).map((para, i) => (
        <p key={i} style={{ margin: "0 0 12px", fontSize: 14.5, lineHeight: 1.7, color: C.text }}>{para.trim()}</p>
      ))}
    </div>
  );
}

function FundsTable({ rows, warnings }) {
  const total = rows.reduce((s, r) => s + (Number(r.amountUSD) || 0), 0);
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: C.muted, marginBottom: 14 }}>
        Use of funds
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: "10px 0", color: C.text }}>{r.item}</td>
              <td style={{ padding: "10px 0", color: C.indigo, textAlign: "right", fontWeight: 600 }}>
                {money(r.amountUSD)}
              </td>
            </tr>
          ))}
          <tr>
            <td style={{ padding: "12px 0 0", color: C.muted, fontWeight: 600 }}>Total</td>
            <td style={{ padding: "12px 0 0", textAlign: "right", color: C.text, fontWeight: 700 }}>
              {money(total)}
            </td>
          </tr>
        </tbody>
      </table>
      {(warnings || []).length > 0 && (
        <div style={{
          marginTop: 14, padding: "10px 12px", borderRadius: 8,
          background: C.amberLight, border: `1px solid ${C.amberWarn}44`, color: C.amberWarn, fontSize: 13,
        }}>
          {warnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────────── */
export default function PlanApp({ backendUrl = "http://localhost:5000", onBack }) {
  const [grantId, setGrantId] = useState("general");
  const [form, setForm] = useState({
    businessName: "", industry: "", country: "", stage: "",
    employees: "", fundingAmount: "", useOfFunds: "", description: "",
  });
  const [phase,  setPhase]  = useState("intake");
  const [resp,   setResp]   = useState(null);
  const [error,  setError]  = useState("");
  const [genErr, setGenErr] = useState("");

  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  const DESC_MIN = 40;
  const descLen = form.description.trim().length;

  const missing = [
    !form.businessName.trim() && "business name",
    !form.industry.trim()     && "industry",
    !form.fundingAmount.trim() && "funding amount",
    descLen === 0 && "a description",
    descLen > 0 && descLen < DESC_MIN && `${DESC_MIN - descLen} more characters in the description`,
  ].filter(Boolean);

  const canGenerate = missing.length === 0;

  async function generate() {
    setError(""); setGenErr(""); setPhase("generating");
    try {
      const data = await api(backendUrl, "/generate-plan", { grantId, formData: form });
      setResp(data); setPhase("done");
    } catch (ex) { setGenErr(ex.message); setPhase("error"); }
  }

  function resetAll() { setResp(null); setError(""); setGenErr(""); setPhase("intake"); }

  const sectionKeys = resp?.data ? Object.keys(resp.data).filter(k => k !== "useOfFundsTable") : [];
  const fundsRows = resp?.data?.useOfFundsTable;

  /* Loading / error phase */
  if (phase === "generating") return <LoadingScreen error="" />;
  if (phase === "error") return <LoadingScreen error={genErr} onRetry={() => { setGenErr(""); generate(); }} />;

  /* Step index for progress dots */
  const stepIdx = phase === "intake" ? 0 : phase === "done" ? 2 : 1;

  return (
    <div style={{ minHeight: "100svh", background: C.bg, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 10,
        height: 60, background: C.surface, borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", padding: "0 24px",
      }}>
        <span style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontSize: 20, fontWeight: 700, color: C.indigo }}>Sofia</span>
        {onBack && <div style={{ marginLeft: "auto" }}><BackBtn onClick={onBack} /></div>}
      </header>

      {/* Step dots */}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", padding: "14px 0 2px" }}>
        {["Details", "Generating", "Plan ready"].map((label, i) => (
          <div key={i} title={label} style={{
            width: i === stepIdx ? 22 : 7, height: 7, borderRadius: 99,
            background: i <= stepIdx ? C.indigo : C.border,
            opacity: i < stepIdx ? 0.35 : 1,
            transition: "width 0.3s ease, opacity 0.3s",
          }} />
        ))}
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 24px 80px" }}>
        <h1 style={{
          fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
          fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 700,
          color: C.text, margin: "0 0 8px", letterSpacing: "-0.02em",
        }}>Business plan</h1>
        <p style={{ color: C.muted, fontSize: 15, margin: "0 0 28px", lineHeight: 1.6 }}>
          Tell Sofia about your venture and who you're applying to. The executive summary and
          market section are free; the full plan unlocks with credits.
        </p>

        {phase === "intake" && (
          <>
            {/* Grant picker — cards grid */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: C.muted, marginBottom: 14 }}>
                Who is this for?
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {GRANTS.map(g => {
                  const active = g.id === grantId;
                  return (
                    <button key={g.id} onClick={() => setGrantId(g.id)} style={{
                      textAlign: "left",
                      background: active ? C.indigoTint : C.bg,
                      border: `${active ? "2px" : "1.5px"} solid ${active ? C.indigo : C.border}`,
                      borderRadius: 10, padding: "12px 14px", cursor: "pointer",
                      fontFamily: "inherit", transition: "all 0.15s",
                    }}>
                      <div style={{ color: active ? C.indigo : C.text, fontWeight: 600, fontSize: 14 }}>
                        {g.name}
                      </div>
                      <div style={{ color: C.muted, fontSize: 12, marginTop: 3, lineHeight: 1.4 }}>
                        {g.blurb}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Intake form */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", marginBottom: 16, display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Business name" value={form.businessName} onChange={set("businessName")} placeholder="e.g. Kano Logistics" />
                <Field label="Industry" value={form.industry} onChange={set("industry")} placeholder="e.g. Agritech" />
                <Field label="Country of operation" value={form.country} onChange={set("country")} placeholder="e.g. Nigeria" />
                <Field label="Business stage" value={form.stage} onChange={set("stage")} placeholder="Idea / Pre-revenue / Scaling" />
                <Field label="Employees" value={form.employees} onChange={set("employees")} placeholder="e.g. 6" />
                <Field label="Funding sought (USD)" value={form.fundingAmount} onChange={set("fundingAmount")} placeholder="e.g. 50000" />
              </div>
              <Field label="Use of funds (optional)" value={form.useOfFunds} onChange={set("useOfFunds")} rows={2}
                placeholder="How you'll spend it. Leave blank and Sofia will propose a breakdown." />
              <div>
                <Field label="What does the business do?" value={form.description} onChange={set("description")} rows={4}
                  placeholder="The problem, who you serve, and what makes you different. The more specific, the stronger the plan." />
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: 12, color: descLen >= DESC_MIN ? C.green : C.muted, marginTop: 4,
                }}>
                  <span>{descLen >= DESC_MIN ? "✓ Looks good" : `${descLen} / ${DESC_MIN} characters minimum`}</span>
                  <span>{descLen > 0 && descLen < DESC_MIN ? `${DESC_MIN - descLen} more to go` : ""}</span>
                </div>
              </div>
            </div>

            {error && <ErrorCard message={error} onRetry={canGenerate ? generate : null} />}

            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <PrimaryBtn onClick={generate} disabled={!canGenerate || phase === "generating"}>
                {phase === "generating" ? <>Writing your plan<Dots /></> : "Generate plan"}
              </PrimaryBtn>
              <span style={{ fontSize: 13, color: missing.length > 0 ? C.amberWarn : C.muted }}>
                {canGenerate
                  ? "Preview is free · full plan uses 5 credits"
                  : `Still needed: ${missing.join(", ")}`}
              </span>
            </div>
          </>
        )}

        {/* Output */}
        {phase === "done" && resp && (
          <>
            {/* Plan header card */}
            <div style={{
              background: C.indigoTint, border: `1.5px solid ${C.indigo}44`,
              borderRadius: 14, padding: "20px 24px", marginBottom: 16,
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.indigo, opacity: 0.7, marginBottom: 4 }}>
                  {resp.grant}
                </div>
                <div style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontSize: 20, fontWeight: 700, color: C.text }}>
                  {form.businessName}
                </div>
              </div>
              {!resp.paid && (
                <div style={{
                  flexShrink: 0, fontSize: 12, color: C.indigo,
                  border: `1px solid ${C.indigo}44`, borderRadius: 999,
                  padding: "6px 14px", background: C.surface, fontWeight: 600,
                }}>Free preview</div>
              )}
            </div>

            {/* Section list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeIn 0.3s ease both" }}>
              {sectionKeys.map(key => {
                const body = resp.data[key];
                const isGated = resp.gated?.[key];
                if (body == null && isGated) return <LockedSection key={key} name={labelFor(key)} />;
                if (body == null) return null;
                return <TextSection key={key} name={labelFor(key)} body={body} />;
              })}

              {Array.isArray(fundsRows) && fundsRows.length > 0 && (
                <FundsTable rows={fundsRows} warnings={resp.warnings} />
              )}
              {fundsRows == null && resp.gated?.useOfFunds && !resp.paid && (
                <LockedSection name="Use of funds" />
              )}
            </div>

            {/* Upsell card */}
            {!resp.paid && (
              <div style={{
                background: C.indigoTint, border: `1.5px solid ${C.indigo}44`,
                borderRadius: 14, padding: "24px", marginTop: 16, textAlign: "center",
              }}>
                <div style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>
                  Unlock the full plan
                </div>
                <div style={{ color: C.muted, fontSize: 14, marginBottom: 16, lineHeight: 1.6 }}>
                  Financial projections, operations plan, and go-to-market strategy are in the full version.
                </div>
                <PrimaryBtn onClick={() => window.dispatchEvent(new CustomEvent("sofia:upgrade"))}>
                  See credit plans
                </PrimaryBtn>
              </div>
            )}

            <div style={{ marginTop: 24 }}>
              <SecondaryBtn onClick={resetAll}>Start a new plan</SecondaryBtn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
