import React, { useState } from "react";
import CVApp from "./CVApp.jsx";
import RecruiterApp from "./RecruiterApp.jsx";
import PlanApp from "./PlanApp.jsx";

/**
 * SofiaApp — single mount point for all three engines.
 *
 *   <SofiaApp backendUrl="http://localhost:5000" />
 *
 * Keeps each engine in its own file (CVApp / RecruiterApp / PlanApp) and
 * switches between them with a tab bar. The shell owns nothing but which
 * engine is visible — all logic stays in the engine components.
 */

const C = {
  bg: "#0A0A0F",
  surface: "#111118",
  border: "#1E1E2E",
  gold: "#B89A68",
  text: "#F1F0FF",
  muted: "#6B6B8A",
};

const ENGINES = [
  { id: "cv", label: "Personal CV", sub: "For job seekers", Component: CVApp },
  { id: "recruiter", label: "Recruiter", sub: "Rank a batch of CVs", Component: RecruiterApp },
  { id: "plan", label: "Business Plan", sub: "Grant-ready documents", Component: PlanApp },
];

export default function SofiaApp({ backendUrl = "http://localhost:5000" }) {
  const [active, setActive] = useState("cv");
  const Current = ENGINES.find(e => e.id === active).Component;

  return (
    <div style={{
      background: C.bg, color: C.text, minHeight: "100vh",
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      {/* Brand bar */}
      <header style={{
        borderBottom: `1px solid ${C.border}`,
        padding: "16px 20px 0",
        position: "sticky", top: 0, zIndex: 10,
        background: C.bg,
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
            <span style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 22, color: C.gold,
            }}>Sofia</span>
            <span style={{ fontSize: 12, color: C.muted }}>
              Career &amp; business documents
            </span>
          </div>

          {/* Tabs */}
          <nav style={{ display: "flex", gap: 4 }} role="tablist" aria-label="Engines">
            {ENGINES.map(e => {
              const on = e.id === active;
              return (
                <button
                  key={e.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActive(e.id)}
                  style={{
                    background: "transparent",
                    border: "none",
                    borderBottom: `2px solid ${on ? C.gold : "transparent"}`,
                    color: on ? C.text : C.muted,
                    padding: "8px 14px 12px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 14,
                    fontWeight: on ? 600 : 500,
                    textAlign: "left",
                  }}
                >
                  <div>{e.label}</div>
                  <div style={{
                    fontSize: 11, color: C.muted, fontWeight: 400, marginTop: 2,
                  }}>{e.sub}</div>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Active engine. key={active} remounts on switch so each engine
          starts clean rather than carrying stale state across tabs. */}
      <main>
        <Current key={active} backendUrl={backendUrl} />
      </main>
    </div>
  );
}
