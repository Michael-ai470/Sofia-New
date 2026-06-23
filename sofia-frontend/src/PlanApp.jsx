import React, { useState } from "react";

/**
 * PlanApp — Sofia Business Plan Engine (Engine 3)
 *
 *  - Short intake form + grant picker
 *  - One call to /generate-plan { grantId, formData }
 *  - Server decides what is free vs paid; this UI NEVER assumes it has
 *    gated content. If data[section] === null and gated[section] === true,
 *    it shows an upgrade prompt instead of inventing text.
 *  - Use-of-funds table is rendered when present; server-side `warnings`
 *    (e.g. funds not summing to the ask) are surfaced honestly.
 *  - Free preview = whatever the server returns in `freeSections`.
 *
 * Props:
 *   backendUrl   Flask base URL (default http://localhost:5000)
 *   isPaid       optional UI hint only; the SERVER is the source of truth
 */

/* ----------------------------------------------------------------- *
 *  Shared palette (must match CVApp.jsx / RecruiterApp.jsx)          *
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

/* Grant list mirrors GRANT_LIBRARY keys in app.py. Labels only —
   the server owns the structure and the free/paid decision. */
const GRANTS = [
  { id: "general", name: "General business plan", blurb: "Investors, banks, or internal use." },
  { id: "tef", name: "Tony Elumelu Foundation", blurb: "African impact, jobs, scalability." },
  { id: "hult", name: "Hult Prize", blurb: "UN SDG-led, globally minded, data-rigorous." },
  { id: "yali", name: "YALI Mandela Washington Fellowship", blurb: "Leadership story, community impact." },
  { id: "seedstars", name: "Seedstars Africa Ventures", blurb: "Traction-first, investor-grade." },
];

/* Section key → human label. Unknown keys fall back to a de-camelCased title. */
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

/* ----------------------------------------------------------------- *
 *  Atoms                                                             *
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
  background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 14, padding: 20,
};
const label = {
  fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
  color: C.gold, fontWeight: 600,
};

function btn(bg, disabled) {
  return {
    background: disabled ? C.border : bg, color: disabled ? C.muted : "#fff",
    border: "none", borderRadius: 10, padding: "11px 18px", fontSize: 14,
    fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
  };
}

function Field({ label: lbl, value, onChange, placeholder, type = "text", rows }) {
  const base = {
    width: "100%", boxSizing: "border-box", background: C.bg,
    border: `1px solid ${C.border}`, borderRadius: 8, color: C.text,
    padding: "9px 11px", fontSize: 14, fontFamily: "inherit",
  };
  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 5 }}>{lbl}</div>
      {rows ? (
        <textarea value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} rows={rows} style={{ ...base, resize: "vertical" }} />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} type={type} style={base} />
      )}
    </div>
  );
}

function ErrorCard({ message, onRetry }) {
  return (
    <div style={{ ...card, borderColor: "#EF4444", marginTop: 16 }}>
      <div style={{ color: "#EF4444", fontWeight: 600, marginBottom: 6 }}>Couldn’t generate the plan</div>
      <div style={{ color: C.text, fontSize: 14, marginBottom: onRetry ? 14 : 0 }}>{message}</div>
      {onRetry && <button onClick={onRetry} style={btn(C.action)}>Try again</button>}
    </div>
  );
}

/* Money formatting that never invents precision. */
function money(n) {
  const v = Number(n);
  if (!isFinite(v)) return "—";
  return "$" + v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/* ----------------------------------------------------------------- *
 *  Section renderers                                                 *
 * ----------------------------------------------------------------- */
function LockedSection({ name }) {
  return (
    <div style={{
      ...card,
      borderStyle: "dashed",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
    }}>
      <div>
        <div style={{ ...label, marginBottom: 6 }}>{name}</div>
        <div style={{ color: C.muted, fontSize: 14 }}>
          Part of the full plan. Upgrade to unlock financials, operations, and go-to-market.
        </div>
      </div>
      <div style={{
        flexShrink: 0, color: C.gold, border: `1px solid ${C.gold}`,
        borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 600,
      }}>🔒 Paid</div>
    </div>
  );
}

function TextSection({ name, body }) {
  return (
    <div style={card}>
      <div style={{ ...label, marginBottom: 10 }}>{name}</div>
      {String(body).split(/\n{2,}/).map((para, i) => (
        <p key={i} style={{
          margin: i === 0 ? "0 0 12px" : "0 0 12px", fontSize: 14.5,
          lineHeight: 1.65, color: C.text,
        }}>{para.trim()}</p>
      ))}
    </div>
  );
}

function FundsTable({ rows, ask, warnings }) {
  const total = rows.reduce((s, r) => s + (Number(r.amountUSD) || 0), 0);
  return (
    <div style={card}>
      <div style={{ ...label, marginBottom: 12 }}>Use of funds</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: "9px 0", color: C.text }}>{r.item}</td>
              <td style={{ padding: "9px 0", color: C.gold, textAlign: "right", fontWeight: 600 }}>
                {money(r.amountUSD)}
              </td>
            </tr>
          ))}
          <tr>
            <td style={{ padding: "11px 0 0", color: C.muted, fontWeight: 600 }}>Total</td>
            <td style={{ padding: "11px 0 0", textAlign: "right", color: C.text, fontWeight: 700 }}>
              {money(total)}
            </td>
          </tr>
        </tbody>
      </table>
      {warnings?.length > 0 && (
        <div style={{
          marginTop: 14, padding: "10px 12px", borderRadius: 8,
          background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.35)",
          color: "#F59E0B", fontSize: 13,
        }}>
          {warnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- *
 *  Main component                                                    *
 * ----------------------------------------------------------------- */
export default function PlanApp({ backendUrl = "http://localhost:5000" }) {
  const [grantId, setGrantId] = useState("general");
  const [form, setForm] = useState({
    businessName: "", industry: "", country: "", stage: "",
    employees: "", fundingAmount: "", useOfFunds: "", description: "",
  });
  const [phase, setPhase] = useState("intake"); // intake | generating | done
  const [resp, setResp] = useState(null);
  const [error, setError] = useState("");

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));
  const canGenerate =
    form.businessName.trim() && form.industry.trim() &&
    form.fundingAmount.trim() && form.description.trim().length >= 40;

  async function generate() {
    setError("");
    setPhase("generating");
    try {
      const data = await api(backendUrl, "/generate-plan", {
        grantId,
        formData: form,
      });
      setResp(data);
      setPhase("done");
    } catch (ex) {
      setError(ex.message);
      setPhase("intake");
    }
  }

  function resetAll() {
    setResp(null);
    setError("");
    setPhase("intake");
  }

  // Render order = key order returned by the server (already in grant order).
  const sectionKeys = resp?.data
    ? Object.keys(resp.data).filter(k => k !== "useOfFundsTable")
    : [];
  const fundsRows = resp?.data?.useOfFundsTable;

  return (
    <div style={{
      background: C.bg, color: C.text, minHeight: "100%",
      fontFamily: "'DM Sans', system-ui, sans-serif", padding: "28px 20px",
    }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ marginBottom: 8 }}><span style={label}>Sofia · Engine 3</span></div>
        <h1 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 30, fontWeight: 400, margin: "2px 0 6px",
        }}>Business plan</h1>
        <p style={{ color: C.muted, fontSize: 14, margin: "0 0 24px", lineHeight: 1.5 }}>
          Tell Sofia about your venture and who you’re applying to. You’ll see the executive
          summary and market section free; the full plan unlocks with a subscription.
        </p>

        {phase !== "done" && (
          <>
            {/* Grant picker */}
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ ...label, marginBottom: 12 }}>Who is this for?</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {GRANTS.map(g => {
                  const active = g.id === grantId;
                  return (
                    <button key={g.id} onClick={() => setGrantId(g.id)} style={{
                      textAlign: "left", background: active ? "rgba(184,154,104,0.1)" : C.bg,
                      border: `1px solid ${active ? C.gold : C.border}`, borderRadius: 10,
                      padding: "12px 14px", cursor: "pointer", fontFamily: "inherit",
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
            <div style={{ ...card, marginBottom: 16, display: "grid", gap: 14 }}>
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

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button onClick={generate} disabled={!canGenerate || phase === "generating"}
                style={btn(C.action, !canGenerate || phase === "generating")}>
                {phase === "generating" ? <>Writing your plan<Ellipsis /></> : "Generate plan"}
              </button>
              <span style={{ fontSize: 12, color: C.muted }}>
                {canGenerate ? "Preview is free · full plan uses 5 credits" : "Fill business name, industry, funding, and a short description"}
              </span>
            </div>
          </>
        )}

        {/* Output */}
        {phase === "done" && resp && (
          <>
            <div style={{
              ...card, marginBottom: 16,
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
            }}>
              <div>
                <div style={{ ...label, marginBottom: 4 }}>{resp.grant}</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{form.businessName}</div>
              </div>
              {!resp.paid && (
                <div style={{
                  flexShrink: 0, fontSize: 12, color: C.gold,
                  border: `1px solid ${C.gold}`, borderRadius: 999, padding: "6px 12px",
                }}>Free preview</div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sectionKeys.map(key => {
                const body = resp.data[key];
                const isGated = resp.gated?.[key];
                if (body == null && isGated) {
                  return <LockedSection key={key} name={labelFor(key)} />;
                }
                if (body == null) return null;
                return <TextSection key={key} name={labelFor(key)} body={body} />;
              })}

              {Array.isArray(fundsRows) && fundsRows.length > 0 && (
                <FundsTable rows={fundsRows} ask={form.fundingAmount} warnings={resp.warnings} />
              )}
              {fundsRows == null && resp.gated?.useOfFunds && !resp.paid && (
                <LockedSection name="Use of funds" />
              )}
            </div>

            {!resp.paid && (
              <div style={{
                ...card, marginTop: 16, textAlign: "center",
                borderColor: "rgba(184,154,104,0.5)",
              }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                  Unlock the full plan
                </div>
                <div style={{ color: C.muted, fontSize: 14, marginBottom: 14 }}>
                  Financial projections, operations, and go-to-market are part of a subscription.
                </div>
                <button style={btn(C.action)} onClick={() => window.dispatchEvent(new CustomEvent("sofia:upgrade"))}>
                  See plans
                </button>
              </div>
            )}

            <button onClick={resetAll} style={{ ...btn(C.border), color: C.text, marginTop: 20 }}>
              Start a new plan
            </button>
          </>
        )}
      </div>
    </div>
  );
}
