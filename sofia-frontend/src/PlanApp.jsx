import React, { useState } from "react";

/**
 * PlanApp — Sofia Business Plan Engine (Engine 3)
 * White theme — matches the landing page palette.
 *
 *  - Short intake form + grant picker
 *  - One call to /generate-plan { grantId, formData }
 *  - Server decides free vs paid; this UI NEVER assumes it has gated content.
 *  - Use-of-funds table rendered when present; server-side warnings surfaced honestly.
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
  try { data = await res.json(); } catch { /* non-JSON error */ }
  if (!res.ok || data.status === "error") {
    throw new Error(data.message || `Request failed (HTTP ${res.status}).`);
  }
  return data;
}

/* Grant list mirrors GRANT_LIBRARY keys in app.py */
const GRANTS = [
  { id: "general",    name: "General business plan",           blurb: "Investors, banks, or internal use." },
  { id: "tef",        name: "Tony Elumelu Foundation",         blurb: "African impact, jobs, scalability." },
  { id: "hult",       name: "Hult Prize",                      blurb: "UN SDG-led, globally minded, data-rigorous." },
  { id: "yali",       name: "YALI Mandela Washington",         blurb: "Leadership story, community impact." },
  { id: "seedstars",  name: "Seedstars Africa Ventures",       blurb: "Traction-first, investor-grade." },
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
  if (SECTION_LABELS[key]) return SECTION_LABELS[key];
  return key.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase()).trim();
}

function money(n) {
  const v = Number(n);
  if (!isFinite(v)) return "—";
  return "$" + v.toLocaleString(undefined, { maximumFractionDigits: 0 });
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
    <button onClick={disabled ? undefined : onClick} style={{
      background: disabled ? C.border : C.gold,
      color: disabled ? C.muted : "#fff",
      border: "none", borderRadius: 10,
      padding: "12px 22px", fontSize: 14,
      fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "inherit",
    }}>
      {children}
    </button>
  );
}

function SecondaryBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: "transparent", color: C.muted,
      border: `1px solid ${C.border}`, borderRadius: 10,
      padding: "11px 20px", fontSize: 14,
      fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
    }}>
      {children}
    </button>
  );
}

function Field({ label: lbl, value, onChange, placeholder, rows }) {
  const baseInput = {
    width: "100%", boxSizing: "border-box",
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 8, color: C.text,
    padding: "9px 11px", fontSize: 14,
    fontFamily: "inherit", outline: "none",
  };
  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 5 }}>{lbl}</div>
      {rows ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          style={{ ...baseInput, resize: "vertical" }}
          onFocus={e => (e.target.style.borderColor = C.gold)}
          onBlur={e => (e.target.style.borderColor = C.border)}
        />
      ) : (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={baseInput}
          onFocus={e => (e.target.style.borderColor = C.gold)}
          onBlur={e => (e.target.style.borderColor = C.border)}
        />
      )}
    </div>
  );
}

function ErrorCard({ message, onRetry }) {
  return (
    <div style={{ background: "#FEF2F2", border: `1px solid ${C.red}33`, borderRadius: 12, padding: "16px 18px", marginTop: 16 }}>
      <div style={{ color: C.red, fontWeight: 600, marginBottom: 6 }}>Couldn't generate the plan</div>
      <div style={{ color: C.text, fontSize: 14, marginBottom: onRetry ? 14 : 0 }}>{message}</div>
      {onRetry && <PrimaryBtn onClick={onRetry}>Try again</PrimaryBtn>}
    </div>
  );
}

/* ─── Section renderers ─────────────────────────────────────────────── */
function LockedSection({ name }) {
  return (
    <div style={{
      ...cardStyle,
      borderStyle: "dashed",
      display: "flex", alignItems: "center",
      justifyContent: "space-between", gap: 16,
    }}>
      <div>
        <div style={{ ...sectionLabel, marginBottom: 6 }}>{name}</div>
        <div style={{ color: C.muted, fontSize: 14 }}>
          Part of the full plan. Upgrade to unlock financials, operations, and go-to-market.
        </div>
      </div>
      <div style={{
        flexShrink: 0, color: C.gold,
        border: `1px solid ${C.gold}`,
        borderRadius: 999, padding: "6px 12px",
        fontSize: 12, fontWeight: 600,
      }}>🔒 Paid</div>
    </div>
  );
}

function TextSection({ name, body }) {
  return (
    <div style={cardStyle}>
      <div style={{ ...sectionLabel, marginBottom: 12 }}>{name}</div>
      {String(body).split(/\n{2,}/).map((para, i) => (
        <p key={i} style={{ margin: "0 0 12px", fontSize: 14.5, lineHeight: 1.7, color: C.text }}>
          {para.trim()}
        </p>
      ))}
    </div>
  );
}

function FundsTable({ rows, warnings }) {
  const total = rows.reduce((s, r) => s + (Number(r.amountUSD) || 0), 0);
  return (
    <div style={cardStyle}>
      <div style={{ ...sectionLabel, marginBottom: 14 }}>Use of funds</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: "10px 0", color: C.text }}>{r.item}</td>
              <td style={{ padding: "10px 0", color: C.gold, textAlign: "right", fontWeight: 600 }}>
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
          background: "rgba(245,158,11,0.08)",
          border: "1px solid rgba(245,158,11,0.3)",
          color: C.amber, fontSize: 13,
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
  const [phase, setPhase] = useState("intake"); // intake | generating | done
  const [resp, setResp] = useState(null);
  const [error, setError] = useState("");

  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  const canGenerate =
    form.businessName.trim() &&
    form.industry.trim() &&
    form.fundingAmount.trim() &&
    form.description.trim().length >= 40;

  async function generate() {
    setError("");
    setPhase("generating");
    try {
      const data = await api(backendUrl, "/generate-plan", { grantId, formData: form });
      setResp(data);
      setPhase("done");
    } catch (ex) {
      setError(ex.message);
      setPhase("intake");
    }
  }

  function resetAll() { setResp(null); setError(""); setPhase("intake"); }

  const sectionKeys = resp?.data
    ? Object.keys(resp.data).filter(k => k !== "useOfFundsTable")
    : [];
  const fundsRows = resp?.data?.useOfFundsTable;

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
        }}>Business plan</h1>
        <p style={{ color: C.muted, fontSize: 15, margin: "0 0 28px", lineHeight: 1.6 }}>
          Tell Sofia about your venture and who you're applying to. The executive summary and
          market section are free; the full plan unlocks with a subscription.
        </p>

        {phase !== "done" && (
          <>
            {/* Grant picker */}
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <div style={{ ...sectionLabel, marginBottom: 12 }}>Who is this for?</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {GRANTS.map(g => {
                  const active = g.id === grantId;
                  return (
                    <button key={g.id} onClick={() => setGrantId(g.id)} style={{
                      textAlign: "left",
                      background: active ? C.goldLight : C.bg,
                      border: `1.5px solid ${active ? C.gold : C.border}`,
                      borderRadius: 10,
                      padding: "12px 14px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "border-color 0.15s, background 0.15s",
                    }}>
                      <div style={{ color: active ? C.gold : C.text, fontWeight: 600, fontSize: 14 }}>
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
            <div style={{ ...cardStyle, marginBottom: 16, display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Business name" value={form.businessName}
                  onChange={set("businessName")} placeholder="e.g. Kano Logistics" />
                <Field label="Industry" value={form.industry}
                  onChange={set("industry")} placeholder="e.g. Agritech" />
                <Field label="Country of operation" value={form.country}
                  onChange={set("country")} placeholder="e.g. Nigeria" />
                <Field label="Business stage" value={form.stage}
                  onChange={set("stage")} placeholder="Idea / Pre-revenue / Scaling" />
                <Field label="Employees" value={form.employees}
                  onChange={set("employees")} placeholder="e.g. 6" />
                <Field label="Funding sought (USD)" value={form.fundingAmount}
                  onChange={set("fundingAmount")} placeholder="e.g. 50000" />
              </div>
              <Field label="Use of funds (optional)" value={form.useOfFunds}
                onChange={set("useOfFunds")} rows={2}
                placeholder="How you'll spend it. Leave blank and Sofia will propose a breakdown." />
              <Field label="What does the business do?" value={form.description}
                onChange={set("description")} rows={4}
                placeholder="The problem, who you serve, and what makes you different. The more specific, the stronger the plan." />
            </div>

            {error && <ErrorCard message={error} onRetry={canGenerate ? generate : null} />}

            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <PrimaryBtn onClick={generate} disabled={!canGenerate || phase === "generating"}>
                {phase === "generating" ? <>Writing your plan<Dots /></> : "Generate plan"}
              </PrimaryBtn>
              <span style={{ fontSize: 13, color: C.muted }}>
                {canGenerate
                  ? "Preview is free · full plan uses 5 credits"
                  : "Fill business name, industry, funding, and a description"}
              </span>
            </div>
          </>
        )}

        {/* Output */}
        {phase === "done" && resp && (
          <>
            <div style={{
              ...cardStyle,
              background: C.goldLight,
              borderColor: "rgba(184,154,104,0.4)",
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
            }}>
              <div>
                <div style={{ ...sectionLabel, color: C.gold, marginBottom: 4 }}>{resp.grant}</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: C.text }}>{form.businessName}</div>
              </div>
              {!resp.paid && (
                <div style={{
                  flexShrink: 0, fontSize: 12, color: C.gold,
                  border: `1px solid rgba(184,154,104,0.5)`,
                  borderRadius: 999, padding: "6px 12px", background: C.bg,
                }}>Free preview</div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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

            {!resp.paid && (
              <div style={{
                ...cardStyle,
                marginTop: 16,
                textAlign: "center",
                borderColor: "rgba(184,154,104,0.4)",
                background: C.goldLight,
              }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                  Unlock the full plan
                </div>
                <div style={{ color: C.muted, fontSize: 14, marginBottom: 16 }}>
                  Financial projections, operations, and go-to-market are part of a subscription.
                </div>
                <PrimaryBtn onClick={() => window.dispatchEvent(new CustomEvent("sofia:upgrade"))}>
                  See plans
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
