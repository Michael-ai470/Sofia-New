import { useState, useEffect, useCallback } from "react";
import LandingPage from "./LandingPage.jsx";
import CVFlow from "./CVFlow.jsx";
import RecruiterApp from "./RecruiterApp.jsx";
import PlanApp from "./PlanApp.jsx";
import PricingPage from "./PricingPage.jsx";
import {
  useLocalStorage, Toast, AuthModal,
  PricingModal, PaymentCallback,
} from "./Auth.jsx";

const BACKEND = "http://localhost:5000";

const C = {
  indigo: "#3D2F8F",
  indigoTint: "#F0EEFF",
  amber: "#F5A623",
  surface: "#FFFFFF",
  text: "#1A1A2E",
  muted: "rgba(26,26,46,0.6)",
  border: "#E8EAF0",
};

const HEADER_H = 60;

const NAV = [
  { id: "landing",    label: "Home" },
  { id: "cv",        label: "CV Builder" },
  { id: "recruiter", label: "Recruiter" },
  { id: "plan",      label: "Business Plan" },
  { id: "pricing",   label: "Pricing" },
];

function CartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

const IS_ENGINE = s => ["cv", "recruiter", "plan"].includes(s);

export default function App() {
  const [screen,      setScreen]           = useState("landing");
  const [user,        setUser]             = useState(null);
  const [token,       setToken, delToken]  = useLocalStorage("sofia_token", "");
  const [credits,     setCredits]          = useState(null);
  const [showAuth,    setShowAuth]         = useState(false);
  const [showPricing, setShowPricing]      = useState(false);
  const [authMode,    setAuthMode]         = useState("login");
  const [currency,    setCurrency]         = useState("NGN");
  const [toast,       setToast]            = useState(null);
  const [navHov,      setNavHov]           = useState(null);
  const [cartHov,     setCartHov]          = useState(false);

  const returningFromPayment =
    new URLSearchParams(window.location.search).get("payment") === "success";

  useEffect(() => {
    try {
      const region = new Intl.Locale(navigator.language || "en-NG").region || "";
      const map = { NG: "NGN", US: "USD", GB: "GBP", GH: "GHS", KE: "KES", ZA: "ZAR", CA: "CAD" };
      if (map[region]) setCurrency(map[region]);
    } catch {}
  }, []);

  const fetchMe = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { delToken(); return; }
      const data = await res.json();
      setUser(data); setCredits(data.credits);
    } catch {}
  }, [token]);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  function handleAuth(data) {
    setToken(data.token); setUser(data); setCredits(data.credits);
    setShowAuth(false);
    setToast({
      message: `Welcome${data.tier === "free" ? " — 5 free credits to start" : ""}!`,
      type: "success",
    });
  }

  function handleLogout() {
    delToken(); setUser(null); setCredits(null);
    setToast({ message: "Signed out.", type: "success" });
  }

  function handleTopUp() {
    if (!user) { setAuthMode("login"); setShowAuth(true); return; }
    setShowPricing(true);
  }

  function home() { setScreen("landing"); }

  /* Header is shown on landing + pricing; engines have their own header for now */
  const showHeader = !IS_ENGINE(screen);

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFA", fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Global fixed header ── */}
      {showHeader && (
        <header style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
          height: HEADER_H, background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center",
          padding: "0 24px", gap: 12,
        }}>
          {/* Wordmark */}
          <button
            onClick={home}
            style={{
              fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
              fontSize: 22, fontWeight: 700, color: C.indigo,
              background: "none", border: "none", cursor: "pointer",
              padding: 0, letterSpacing: "-0.5px", flexShrink: 0,
            }}
          >
            Sofia
          </button>

          {/* Center nav (hidden on mobile via CSS class) */}
          <nav
            className="header-nav"
            style={{ flex: 1, justifyContent: "center", gap: 2, alignItems: "center" }}
          >
            {NAV.map(item => (
              <button
                key={item.id}
                onClick={() => setScreen(item.id)}
                onMouseEnter={() => setNavHov(item.id)}
                onMouseLeave={() => setNavHov(null)}
                style={{
                  fontSize: 14,
                  fontWeight: screen === item.id ? 600 : 400,
                  color: screen === item.id
                    ? C.indigo
                    : navHov === item.id ? C.indigo : C.muted,
                  background: screen === item.id ? C.indigoTint : "none",
                  border: "none", cursor: "pointer",
                  padding: "6px 14px", borderRadius: 6,
                  transition: "color 0.15s, background 0.15s",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right: cart + auth controls */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>

            {/* Cart / credits */}
            <button
              onClick={handleTopUp}
              onMouseEnter={() => setCartHov(true)}
              onMouseLeave={() => setCartHov(false)}
              title={credits !== null ? `${credits} credits — click to top up` : "Buy credits"}
              style={{
                position: "relative", background: "none",
                border: `1.5px solid ${cartHov ? C.indigo : C.border}`,
                borderRadius: 8, padding: "6px 10px", cursor: "pointer",
                color: cartHov ? C.indigo : C.text,
                display: "flex", alignItems: "center",
                transition: "border-color 0.15s, color 0.15s",
              }}
            >
              <CartIcon />
              {credits !== null && (
                <span style={{
                  position: "absolute", top: -7, right: -7,
                  background: C.amber, color: "#fff",
                  fontSize: 10, fontWeight: 700, lineHeight: 1,
                  padding: "2px 5px", borderRadius: 99,
                  minWidth: 16, textAlign: "center",
                }}>
                  {credits}
                </span>
              )}
            </button>

            {user ? (
              <>
                <span style={{
                  fontSize: 13, color: C.muted,
                  maxWidth: 120, overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {user.email.split("@")[0]}
                </span>
                <button
                  onClick={handleLogout}
                  style={{
                    fontSize: 13, fontWeight: 500, color: C.indigo,
                    background: "none", border: `1.5px solid ${C.border}`,
                    borderRadius: 8, padding: "6px 14px", cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setAuthMode("login"); setShowAuth(true); }}
                  style={{
                    fontSize: 13, fontWeight: 500, color: C.indigo,
                    background: "none", border: `1.5px solid ${C.border}`,
                    borderRadius: 8, padding: "6px 14px", cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setAuthMode("signup"); setShowAuth(true); }}
                  style={{
                    fontSize: 13, fontWeight: 600, color: "#fff",
                    background: C.amber, border: "none",
                    borderRadius: 8, padding: "7px 16px", cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </header>
      )}

      {/* ── Page content ── */}
      <div style={showHeader ? { paddingTop: HEADER_H } : {}}>
        {screen === "landing"   && (
          <LandingPage
            onSelect={s => setScreen(s)}
            user={user}
            currency={currency}
            onBuy={handleTopUp}
            onLogin={() => { setAuthMode("login"); setShowAuth(true); }}
          />
        )}
        {screen === "pricing"   && (
          <PricingPage
            user={user} token={token} currency={currency}
            onBuy={handleTopUp}
            onLogin={() => { setAuthMode("login"); setShowAuth(true); }}
          />
        )}
        {screen === "cv"        && <CVFlow       backendUrl={BACKEND} onBack={home} />}
        {screen === "recruiter" && <RecruiterApp backendUrl={BACKEND} onBack={home} />}
        {screen === "plan"      && <PlanApp      backendUrl={BACKEND} onBack={home} />}
      </div>

      {/* ── Modals ── */}
      {showAuth && (
        <AuthModal
          backendUrl={BACKEND} onAuth={handleAuth}
          onClose={() => setShowAuth(false)} initialMode={authMode}
        />
      )}
      {showPricing && (
        <PricingModal
          backendUrl={BACKEND} user={user} token={token} currency={currency}
          onClose={() => setShowPricing(false)}
          onCreditsUpdated={c => { setCredits(c); setShowPricing(false); }}
        />
      )}
      {returningFromPayment && token && (
        <PaymentCallback
          backendUrl={BACKEND} token={token}
          onDone={() => { fetchMe(); setToast({ message: "Credits added to your account!", type: "success" }); }}
        />
      )}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />
      )}
    </div>
  );
}
