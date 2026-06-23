import React from "react";

const C = {
  bg: "#FFFFFF",
  surface: "#F8F7F5",
  border: "#E8E8E8",
  gold: "#B89A68",
  goldLight: "#F5EFE6",
  text: "#1A1A1A",
  muted: "#6B6B6B",
};

const OPTIONS = [
  {
    id: "cv",
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
        <rect x="4" y="3" width="16" height="18" rx="2" stroke={C.gold} strokeWidth="1.8" />
        <path d="M8 8h8M8 12h5M8 16h6" stroke={C.gold} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    title: "My CV",
    sub: "Review, improve, or apply for a role",
    desc: "Get an AI score, see exactly what's hurting your chances, and download a professionally rewritten version — tailored to a job description if you have one.",
  },
  {
    id: "recruiter",
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
        <circle cx="9" cy="8" r="3" stroke={C.gold} strokeWidth="1.8" />
        <circle cx="17" cy="8" r="3" stroke={C.gold} strokeWidth="1.8" />
        <path d="M3 20c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke={C.gold} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M17 14c1.657 0 3 1.343 3 3v3" stroke={C.gold} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    title: "For Recruiters",
    sub: "Rank a batch of CVs for one role",
    desc: "Upload 2–20 candidate CVs. Sofia ranks every applicant, highlights the top three, and flags CVs that look AI-generated. Everything stays on your screen.",
  },
  {
    id: "plan",
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
        <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" stroke={C.gold} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 8v8M8.5 10l3.5 2 3.5-2" stroke={C.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Business Plan",
    sub: "Grant-ready documents",
    desc: "Fill in a short intake form, pick your grant type (TEF, Hult Prize, YALI and more), and Sofia generates a structured, professional business plan.",
  },
];

export default function LandingPage({ onSelect }) {
  return (
    <div style={{
      minHeight: "100svh",
      background: C.bg,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <header style={{
        borderBottom: `1px solid ${C.border}`,
        padding: "18px 24px",
        display: "flex",
        alignItems: "baseline",
        gap: 10,
      }}>
        <span style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 22,
          color: C.gold,
          letterSpacing: "-0.3px",
        }}>Sofia</span>
        <span style={{ fontSize: 13, color: C.muted }}>Career &amp; business documents, powered by AI</span>
      </header>

      {/* Hero */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "56px 24px 40px", textAlign: "center" }}>
        <div style={{
          display: "inline-block",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: C.gold,
          marginBottom: 16,
        }}>
          What can Sofia help with?
        </div>
        <h1 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: "clamp(32px, 5vw, 46px)",
          fontWeight: 400,
          color: C.text,
          margin: "0 0 16px",
          lineHeight: 1.15,
          letterSpacing: "-0.5px",
        }}>
          Your documents,<br />professionally done.
        </h1>
        <p style={{
          fontSize: 16,
          color: C.muted,
          margin: 0,
          lineHeight: 1.65,
          maxWidth: 460,
          marginLeft: "auto",
          marginRight: "auto",
        }}>
          Choose what you're working on. Sofia handles the rest — analysis, rewrites, and downloads in minutes.
        </p>
      </div>

      {/* Option cards */}
      <div style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "0 24px 80px",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}>
        {OPTIONS.map(opt => (
          <OptionCard key={opt.id} opt={opt} onSelect={onSelect} />
        ))}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: "auto",
        borderTop: `1px solid ${C.border}`,
        padding: "18px 24px",
        textAlign: "center",
        fontSize: 12,
        color: C.muted,
      }}>
        Your documents are processed securely. Files are never stored.
      </div>
    </div>
  );
}

function OptionCard({ opt, onSelect }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      onClick={() => onSelect(opt.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        gap: 20,
        padding: "22px 24px",
        borderRadius: 16,
        border: `1.5px solid ${hovered ? C.gold : C.border}`,
        background: hovered ? C.goldLight : C.surface,
        textAlign: "left",
        cursor: "pointer",
        width: "100%",
        transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s",
        boxShadow: hovered ? "0 4px 24px rgba(184,154,104,0.12)" : "none",
      }}
    >
      {/* Icon */}
      <div style={{
        flexShrink: 0,
        width: 52,
        height: 52,
        borderRadius: 12,
        background: hovered ? "rgba(184,154,104,0.15)" : "#EFEFED",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.15s",
      }}>
        {opt.icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: C.text }}>{opt.title}</span>
          <span style={{ fontSize: 12, color: C.muted }}>{opt.sub}</span>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: C.muted, lineHeight: 1.55 }}>{opt.desc}</p>
      </div>

      {/* Arrow */}
      <div style={{
        flexShrink: 0,
        alignSelf: "center",
        color: hovered ? C.gold : C.border,
        fontSize: 20,
        transition: "color 0.15s",
      }}>→</div>
    </button>
  );
}
