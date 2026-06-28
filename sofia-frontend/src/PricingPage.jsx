import React, { useState } from "react";
import { PACKAGES, fmtPrice } from "./Auth.jsx";
import { Lock, Zap, InfinityIcon, Building, Clock, FileCheck, Search } from "./Icons.jsx";

const C = {
  indigo: "#3D2F8F",
  indigoTint: "#F0EEFF",
  amber: "#F5A623",
  amberLight: "rgba(245,166,35,0.10)",
  bg: "#FAFAFA",
  surface: "#FFFFFF",
  text: "#1A1A2E",
  muted: "rgba(26,26,46,0.6)",
  border: "#E8EAF0",
  shadow: "0 1px 2px rgba(26,26,46,.06)",
  shadowFloat: "0 8px 24px rgba(26,26,46,.10)",
};

/* Free plan — display only, not purchasable */
const FREE_PLAN = {
  name: "Free",
  usp: "Try 3 documents",
  credits: 3,
  price_ngn: 0,
};

const PLUS_PLANS = [
  {
    name: "Plus Telegram",
    usp: "3 personalised jobs daily on Telegram",
    perks: [
      "Matched to your CV, scored and ranked",
      "One-line reason on every job",
      "Apply straight from the message",
    ],
    volume: "~90 tailored matches / month",
    price: "₦5,000/mo",
    original: "₦9,000",
    discount: "44% off",
    popular: false,
  },
  {
    name: "Plus WhatsApp",
    usp: "2 personalised jobs daily on WhatsApp",
    perks: [
      "Hand-picked for your role & city",
      "Right in your WhatsApp chat",
      "Zero duplicates, zero spam",
    ],
    volume: "~60 tailored matches / month",
    price: "₦9,000/mo",
    original: "₦15,000",
    discount: "40% off",
    popular: false,
  },
  {
    name: "Plus Both",
    usp: "4 personalised jobs daily, both channels",
    perks: [
      "Widest daily reach — twice the matches",
      "Telegram + WhatsApp, perfectly synced",
      "Best odds of landing the right role",
    ],
    volume: "~120 tailored matches / month",
    price: "₦12,000/mo",
    original: "₦20,000",
    discount: "40% off",
    popular: true,
  },
];

function CheckMark() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke={C.indigo} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* ─── Free plan card ────────────────────────────────────────────────── */
function FreePlanCard({ onLogin }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: C.surface,
        border: `${hov ? "2px" : "1.5px"} solid ${hov ? C.indigo : C.border}`,
        borderRadius: 14, padding: "28px 24px",
        transform: hov ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hov ? C.shadowFloat : C.shadow,
        transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.15s",
        display: "flex", flexDirection: "column", gap: 18,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <div>
        <div style={{
          fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
          fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4,
        }}>Free</div>
        <div style={{ fontSize: 13, color: C.indigo, fontWeight: 600, lineHeight: 1.35 }}>
          Try 3 documents
        </div>
      </div>

      <div>
        <div style={{
          fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
          fontSize: 32, fontWeight: 800, color: C.text, lineHeight: 1,
        }}>₦0</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 5 }}>3 credits · included on signup</div>
      </div>

      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
        {["3 credits, no card required", "Works across all 3 engines", "CV score + preview"].map(feat => (
          <li key={feat} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: C.text }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", background: C.indigoTint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CheckMark />
            </span>
            {feat}
          </li>
        ))}
      </ul>

      <button
        onClick={onLogin}
        style={{
          width: "100%", padding: "13px",
          background: "transparent", color: C.indigo,
          border: `1.5px solid ${C.indigo}`,
          borderRadius: 9, fontSize: 14, fontWeight: 600,
          cursor: "pointer", transition: "background 0.15s, color 0.15s",
          fontFamily: "inherit",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = C.indigoTint; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
      >
        Start free
      </button>
    </div>
  );
}

/* ─── Paid credit plan card ─────────────────────────────────────────── */
function PlanCard({ pkg, currency, user, onBuy, onLogin }) {
  const [hov, setHov] = useState(false);
  const perCredit = fmtPrice(Math.round(pkg.price_ngn / pkg.credits), currency);
  const features = [
    `${pkg.credits} credits, never expire`,
    "Works across all 3 engines",
    "CV analysis, rewrites & cover letters",
    pkg.credits >= 200 ? "Recruiter batch ranking" : "Single CV analysis",
  ];

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: pkg.popular ? C.indigoTint : C.surface,
        border: `${pkg.popular || hov ? "2px" : "1.5px"} solid ${pkg.popular ? C.indigo : hov ? C.indigo : C.border}`,
        borderRadius: 14, padding: "28px 24px",
        position: "relative",
        transform: hov ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hov ? C.shadowFloat : C.shadow,
        transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.15s",
        display: "flex", flexDirection: "column", gap: 18,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {pkg.popular && (
        <div style={{
          position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
          background: C.amber, color: "#fff",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
          padding: "4px 14px", borderRadius: 99, whiteSpace: "nowrap",
          textTransform: "uppercase",
        }}>Most Popular</div>
      )}

      <div>
        <div style={{
          fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
          fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4,
        }}>{pkg.name}</div>
        <div style={{ fontSize: 13, color: C.indigo, fontWeight: 600, lineHeight: 1.35 }}>
          {pkg.usp || pkg.best_for}
        </div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{
            fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
            fontSize: 32, fontWeight: 800, color: C.indigo, lineHeight: 1,
          }}>
            {fmtPrice(pkg.price_ngn, currency)}
          </span>
          {pkg.original_price_ngn && (
            <span style={{ fontSize: 14, color: C.muted, textDecoration: "line-through" }}>
              {fmtPrice(pkg.original_price_ngn, currency)}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 12, color: C.muted }}>
            {pkg.credits} credits · {perCredit} per credit
          </span>
          {pkg.discount && (
            <span style={{
              background: C.amber, color: "#3A2700",
              fontSize: 10, fontWeight: 700,
              padding: "2px 8px", borderRadius: 99,
            }}>{pkg.discount}</span>
          )}
        </div>
      </div>

      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
        {features.map(feat => (
          <li key={feat} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: C.text }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", background: C.indigoTint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CheckMark />
            </span>
            {feat}
          </li>
        ))}
      </ul>

      <button
        onClick={user ? onBuy : onLogin}
        style={{
          width: "100%", padding: "13px",
          background: pkg.popular ? C.indigo : hov ? C.indigo : "transparent",
          color: pkg.popular || hov ? "#fff" : C.indigo,
          border: `1.5px solid ${C.indigo}`,
          borderRadius: 9, fontSize: 14, fontWeight: 600,
          cursor: "pointer", transition: "background 0.15s, color 0.15s",
          fontFamily: "inherit",
        }}
      >
        {user ? `Choose ${pkg.name}` : "Sign in to buy"}
      </button>
    </div>
  );
}

/* ─── Plus plan card ────────────────────────────────────────────────── */
function PlusPlanCard({ plan }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: C.surface,
        border: `${plan.popular ? "2px" : hov ? "2px" : "1.5px"} solid ${plan.popular || hov ? C.indigo : C.border}`,
        borderRadius: 14, padding: "24px 20px",
        position: "relative",
        display: "flex", flexDirection: "column", gap: 14,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {plan.popular && (
        <div style={{
          position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
          background: C.indigo, color: "#fff",
          fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
          padding: "3px 12px", borderRadius: 99, whiteSpace: "nowrap",
          textTransform: "uppercase",
        }}>Best value</div>
      )}

      <div>
        <div style={{
          fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
          fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4,
        }}>{plan.name}</div>
        <div style={{ fontSize: 13, color: C.indigo, fontWeight: 600, lineHeight: 1.4 }}>
          {plan.usp}
        </div>
      </div>

      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
        {plan.perks.map(p => (
          <li key={p} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 12.5, lineHeight: 1.5, color: C.text }}>
            <span style={{
              flexShrink: 0, width: 9, height: 9, borderRadius: "50%",
              background: C.indigoTint, border: `2px solid ${C.indigo}`,
              marginTop: 4,
            }} />
            {p}
          </li>
        ))}
      </ul>

      <div style={{ fontSize: 12, color: C.muted }}>{plan.volume}</div>

      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
          <span style={{
            fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
            fontSize: 22, fontWeight: 700, color: C.text,
          }}>{plan.price}</span>
          <span style={{ fontSize: 13, color: C.muted, textDecoration: "line-through" }}>{plan.original}</span>
          <span style={{ background: C.amber, color: "#3A2700", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>
            {plan.discount}
          </span>
        </div>
      </div>

      <button style={{
        width: "100%", padding: "11px",
        background: plan.popular || hov ? C.indigo : "transparent",
        color: plan.popular || hov ? "#fff" : C.indigo,
        border: `1.5px solid ${C.indigo}`,
        borderRadius: 9, fontSize: 13, fontWeight: 600,
        cursor: "pointer", transition: "background 0.15s, color 0.15s",
        fontFamily: "inherit",
      }}>
        Join waitlist
      </button>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────────────── */
export default function PricingPage({ user, currency, onBuy, onLogin }) {
  return (
    <div style={{ minHeight: "calc(100vh - 60px)", background: C.bg, fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Hero ── */}
      <section style={{ textAlign: "center", padding: "clamp(40px, 6vw, 72px) 24px 44px" }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase", color: C.indigo, opacity: 0.7, marginBottom: 14,
        }}>Pricing</div>
        <h1 style={{
          fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
          fontSize: "clamp(28px, 4.5vw, 42px)", fontWeight: 800,
          lineHeight: 1.1, color: C.text, margin: "0 0 16px", letterSpacing: "-0.03em",
        }}>
          One credit, one document.
        </h1>
        <p style={{ fontSize: 16, color: C.muted, margin: 0, lineHeight: 1.65, maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
          Every CV rewrite, candidate ranking, or business plan costs one credit.
          Buy a pack, then add Sofia Plus for daily job alerts.
        </p>
      </section>

      {/* ── Credit plan cards ── */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 64px" }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: C.text, marginBottom: 20, fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
          Credit plans
        </div>
        <div className="plus-grid" style={{ display: "grid", gap: 16 }}>
          <FreePlanCard onLogin={onLogin} />
          {PACKAGES.map(pkg => (
            <PlanCard key={pkg.id} pkg={pkg} currency={currency} user={user} onBuy={onBuy} onLogin={onLogin} />
          ))}
        </div>
      </section>

      {/* ── Sofia Plus ── */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 72px" }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: C.text, marginBottom: 4, fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
          Sofia Plus — personalised job alerts{" "}
          <span style={{ fontWeight: 400, color: C.muted, fontSize: 13, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            · add-on, needs an active credit plan
          </span>
        </div>
        <div style={{ marginBottom: 20, fontSize: 13, color: C.muted }}></div>

        {/* Indigo pitch banner */}
        <div
          className="plus-pitch-grid"
          style={{ background: C.indigo, borderRadius: 12, padding: "clamp(24px, 4vw, 40px)", marginBottom: 16 }}
        >
          {/* Left: headline + lead */}
          <div>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase", color: C.amber, marginBottom: 10,
            }}>
              Matched to your CV — not a generic job board
            </div>
            <h3 style={{
              fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
              color: "#fff", fontSize: "clamp(20px, 3vw, 24px)",
              fontWeight: 700, marginBottom: 12, lineHeight: 1.2,
            }}>
              Every morning, jobs picked for you. By name.
            </h3>
            <p style={{ fontSize: 14.5, opacity: 0.9, lineHeight: 1.65, color: "#fff", margin: 0 }}>
              Sofia reads <strong style={{ color: C.amber }}>your actual CV</strong> — your role, skills, experience level and city — then
              scans Nigeria's top job boards overnight and hand-picks only the listings that genuinely fit.
              No spam, no scrolling. Just the few roles worth applying to, in your inbox by 8 AM.
            </p>
          </div>

          {/* Right: 3 bullet points */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[
              {
                icon: <FileCheck size={16} />,
                title: "Tuned to your exact profile",
                desc: "Matches are scored against your CV, so each job actually fits your level and field.",
              },
              {
                icon: <Search size={16} />,
                title: "Hand-picked, never bulk",
                desc: "2–4 specific roles a day — the strongest fits only, with a one-line reason for each.",
              },
              {
                icon: <Clock size={16} />,
                title: "Fresh every day by 8 AM",
                desc: "Scanned overnight from live boards, with the same job never sent to you twice.",
              },
            ].map(pt => (
              <div key={pt.title} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{
                  flexShrink: 0, width: 32, height: 32, borderRadius: 7,
                  background: "rgba(255,255,255,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: C.amber,
                }}>
                  {pt.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#fff", marginBottom: 2 }}>{pt.title}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.55, color: "rgba(255,255,255,0.82)" }}>{pt.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Plus plan cards */}
        <div className="plus-grid" style={{ display: "grid", gap: 12, marginBottom: 28 }}>
          {PLUS_PLANS.map(plan => (
            <PlusPlanCard key={plan.name} plan={plan} />
          ))}
        </div>
      </section>

      {/* ── Trust badges ── */}
      <section style={{
        maxWidth: 900, margin: "0 auto 72px", padding: "0 24px",
        display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 28,
      }}>
        {[
          { icon: <Lock size={16} />,         label: "Secure checkout via Paystack & Monnify" },
          { icon: <Zap size={16} />,          label: "Credits added instantly after payment" },
          { icon: <InfinityIcon size={16} />, label: "Credits never expire" },
          { icon: <Building size={16} />,     label: "Bank transfer & card accepted" },
        ].map(b => (
          <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "flex", alignItems: "center", color: C.muted }}>{b.icon}</span>
            <span style={{ fontSize: 13, color: C.muted }}>{b.label}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
