/**
 * Auth.jsx — authentication, credits, and payment components.
 *
 * Exports:
 *   useLocalStorage, Toast, AuthModal, PricingModal,
 *   PaymentCallback, CreditBadge, UserMenu,
 *   PACKAGES, fmtPrice
 */
import { useState, useEffect } from "react";
import { Check, X, Lock, Building, CreditCard, Zap, InfinityIcon, XCircle, Clock } from "./Icons.jsx";

/* ─── Palette ──────────────────────────────────────────────────────── */
const C = {
  indigo: "#3D2F8F",
  indigoDark: "#2A1F6B",
  indigoTint: "#F0EEFF",
  amber: "#F5A623",
  amberDark: "#E09415",
  amberLight: "rgba(245,166,35,0.10)",
  bg: "#FAFAFA",
  surface: "#FFFFFF",
  text: "#1A1A2E",
  muted: "rgba(26,26,46,0.6)",
  border: "#E8EAF0",
  green: "#16A34A",
  greenBg: "#F0FDF4",
  red: "#DC2626",
  redBg: "#FEF2F2",
  shadow: "0 8px 32px rgba(26,26,46,0.14)",
  shadowSm: "0 2px 8px rgba(26,26,46,0.08)",
};

/* ─── Pricing data ─────────────────────────────────────────────────── */
export const PACKAGES = [
  { id: "starter", name: "Starter", credits: 50,  price_ngn: 2500, original_price_ngn: 4800,  discount: "48% off", usp: "Rewrite 50 CVs",    popular: false, best_for: "Job seekers just starting out" },
  { id: "pro",     name: "Pro",     credits: 200, price_ngn: 4500, original_price_ngn: 10000, discount: "55% off", usp: "Apply to 200 jobs", popular: true,  best_for: "Regular CV updates & cover letters" },
];

const FX  = { NGN: 1, USD: 0.00065, GBP: 0.00051, EUR: 0.00060, GHS: 0.0091, KES: 0.085, ZAR: 0.012, CAD: 0.00088 };
const SYM = { NGN: "₦", USD: "$", GBP: "£", EUR: "€", GHS: "₵", KES: "KSh", ZAR: "R", CAD: "CA$" };

export function fmtPrice(ngn, currency) {
  const rate = FX[currency] || 1;
  const sym  = SYM[currency] || currency;
  const amt  = ngn * rate;
  return `${sym}${amt < 10 ? amt.toFixed(2) : Math.round(amt).toLocaleString()}`;
}

/* ─── useLocalStorage ──────────────────────────────────────────────── */
export function useLocalStorage(key, def) {
  const [val, setVal] = useState(() => {
    try { return localStorage.getItem(key) || def; } catch { return def; }
  });
  const set = v => { try { localStorage.setItem(key, v); } catch {} setVal(v); };
  const del = ()  => { try { localStorage.removeItem(key); } catch {} setVal(def); };
  return [val, set, del];
}

/* ─── Toast ────────────────────────────────────────────────────────── */
export function Toast({ message, type = "success", onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);

  const map = {
    success: { bg: C.greenBg, color: C.green, icon: <Check size={12} /> },
    error:   { bg: C.redBg,   color: C.red,   icon: <X size={12} /> },
    info:    { bg: C.indigoTint, color: C.indigo, icon: "i" },
  };
  const { bg, color, icon } = map[type] || map.info;

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 3000,
      background: bg, border: `1px solid ${color}44`, borderRadius: 12,
      padding: "12px 20px", display: "flex", alignItems: "center", gap: 10,
      boxShadow: C.shadow, maxWidth: 340,
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: "50%", background: color,
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 700, flexShrink: 0,
      }}>{icon}</span>
      <span style={{ fontSize: 13, color, fontWeight: 500 }}>{message}</span>
    </div>
  );
}

/* ─── AuthModal ────────────────────────────────────────────────────── */
function AuthField({ label, type = "text", value, onChange, placeholder, onEnter, autoFocus }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: 6 }}>
        {label}
      </label>
      <input
        type={type} value={value} autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={e => e.key === "Enter" && onEnter?.()}
        style={{
          width: "100%", padding: "11px 14px",
          border: `1.5px solid ${C.border}`,
          borderRadius: 9, fontSize: 14, outline: "none",
          boxSizing: "border-box", color: C.text,
          background: "#fff", fontFamily: "inherit",
          transition: "border-color 0.15s",
        }}
        onFocus={e  => (e.target.style.borderColor = C.indigo)}
        onBlur={e   => (e.target.style.borderColor = C.border)}
      />
    </div>
  );
}

export function AuthModal({ backendUrl, onAuth, onClose, initialMode = "login" }) {
  const [mode,     setMode]     = useState(initialMode);
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function submit() {
    if (!email || !password) { setError("Email and password are required."); return; }
    setError(""); setLoading(true);
    try {
      const res  = await fetch(`${backendUrl}/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong."); return; }
      onAuth(data);
    } catch {
      setError("Could not connect to server. Is the app running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(10,10,20,0.45)",
        backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 1000, padding: 16,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "#fff", borderRadius: 20, padding: "40px 36px",
        width: "100%", maxWidth: 400,
        boxShadow: C.shadow, position: "relative",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 14, right: 14,
          background: C.bg, border: "none", borderRadius: "50%",
          width: 30, height: 30, cursor: "pointer", color: C.muted,
          fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
        }}><X size={14} /></button>

        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
            fontSize: 22, fontWeight: 700, color: C.indigo, marginBottom: 6,
          }}>Sofia</div>
          <h2 style={{ margin: "0 0 4px", fontSize: 18, color: C.text, fontWeight: 700 }}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
            {mode === "login"
              ? "Sign in to access your documents and credits"
              : "Get 5 free credits — no card required"}
          </p>
        </div>

        {error && (
          <div style={{
            background: C.redBg, border: "1px solid #FECACA",
            borderRadius: 9, padding: "10px 14px",
            marginBottom: 16, color: C.red, fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <AuthField label="Email address" type="email" value={email} onChange={setEmail}
          placeholder="you@example.com" autoFocus />
        <AuthField label="Password" type="password" value={password} onChange={setPassword}
          placeholder={mode === "signup" ? "Min. 8 characters" : "Your password"}
          onEnter={submit} />

        <button onClick={submit} disabled={loading} style={{
          width: "100%", padding: "13px",
          background: loading ? C.indigoDark : C.indigo,
          color: "#fff", border: "none",
          borderRadius: 10, fontSize: 15, fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.8 : 1, marginTop: 4,
          fontFamily: "inherit", transition: "background 0.15s",
        }}>
          {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "20px 0 0" }}>
          <div style={{ flex: 1, height: 1, background: C.border }} />
          <span style={{ fontSize: 12, color: C.muted }}>or</span>
          <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: C.muted }}>
          {mode === "login" ? "New to Sofia? " : "Already have an account? "}
          <button
            onClick={() => { setMode(m => m === "login" ? "signup" : "login"); setError(""); }}
            style={{
              background: "none", border: "none", color: C.indigo,
              cursor: "pointer", fontWeight: 600, fontSize: 13, padding: 0,
            }}
          >
            {mode === "login" ? "Create a free account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

/* ─── PricingModal ─────────────────────────────────────────────────── */
function ProviderBtn({ label, sub, icon, color, loading, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick} disabled={loading}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: 1, padding: "12px 10px",
        border: `1.5px solid ${loading || hov ? color : C.border}`,
        borderRadius: 11,
        background: loading || hov ? `${color}10` : "#fff",
        cursor: loading ? "not-allowed" : "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        transition: "all 0.15s", fontFamily: "inherit",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: loading ? color : C.text }}>{label}</span>
      <span style={{ fontSize: 11, color: C.muted }}>{loading ? "Redirecting…" : sub}</span>
    </button>
  );
}

export function PricingModal({ backendUrl, user, token, currency, onClose, onCreditsUpdated }) {
  const [loading,  setLoading]  = useState(null);
  const [error,    setError]    = useState("");
  const [selected, setSelected] = useState(null);

  async function buy(pkg, provider) {
    setError(""); setLoading(`${pkg.id}-${provider}`);
    try {
      const res  = await fetch(`${backendUrl}/credits/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          package_id:   pkg.id,
          provider,
          callback_url: window.location.origin + "?payment=success&provider=" + provider,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Could not initiate payment."); return; }
      window.location.href = data.payment_url;
    } catch {
      setError("Could not connect to server.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(10,10,20,0.45)",
        backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 1000, padding: 16,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "#fff", borderRadius: 22, padding: "36px 32px",
        width: "100%", maxWidth: 720, boxShadow: C.shadow,
        position: "relative", maxHeight: "92vh", overflowY: "auto",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 14, right: 14,
          background: C.bg, border: "none", borderRadius: "50%",
          width: 30, height: 30, cursor: "pointer", color: C.muted,
          fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
        }}><X size={14} /></button>

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: C.indigo,
            textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, opacity: 0.7,
          }}>Top up credits</div>
          <h2 style={{ margin: "0 0 6px", fontSize: 22, color: C.text, fontWeight: 700,
            fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
            Choose your plan
          </h2>
          <p style={{ margin: 0, color: C.muted, fontSize: 14 }}>
            Credits never expire · Use across all three engines · Pay in Naira
          </p>
        </div>

        {error && (
          <div style={{
            background: C.redBg, border: "1px solid #FECACA",
            borderRadius: 10, padding: "10px 16px", marginBottom: 20,
            color: C.red, fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
          {PACKAGES.map(pkg => {
            const isSel = selected?.id === pkg.id;
            return (
              <div
                key={pkg.id}
                onClick={() => setSelected(isSel ? null : pkg)}
                style={{
                  border: pkg.popular
                    ? `2px solid ${C.indigo}`
                    : isSel ? `2px solid ${C.indigo}` : `1.5px solid ${C.border}`,
                  borderRadius: 14, padding: 20, cursor: "pointer",
                  position: "relative",
                  background: pkg.popular ? C.indigoTint : isSel ? C.indigoTint : "#fff",
                  transition: "all 0.15s",
                }}
              >
                {pkg.popular && (
                  <div style={{
                    position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)",
                    background: C.amber, color: "#fff", fontSize: 10, fontWeight: 700,
                    padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap",
                    textTransform: "uppercase",
                  }}>Most Popular</div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text,
                    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>{pkg.name}</div>
                  <div style={{
                    fontSize: 11, color: C.muted, background: C.bg,
                    padding: "2px 8px", borderRadius: 20,
                  }}>{pkg.credits} credits</div>
                </div>

                <div style={{
                  fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
                  fontSize: 26, fontWeight: 800, color: C.indigo, marginBottom: 2,
                }}>
                  {fmtPrice(pkg.price_ngn, currency)}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
                  {fmtPrice(Math.round(pkg.price_ngn / pkg.credits), currency)} per credit
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>{pkg.best_for}</div>

                {isSel && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8 }}>
                      Choose payment method:
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <ProviderBtn
                        label="Paystack" sub="Card · Bank transfer"
                        icon={<CreditCard size={22} color="#0BA4DB" />} color="#0BA4DB"
                        loading={loading === `${pkg.id}-paystack`}
                        onClick={e => { e.stopPropagation(); buy(pkg, "paystack"); }}
                      />
                      <ProviderBtn
                        label="Monnify" sub="Bank · USSD · Card"
                        icon={<Building size={22} color="#FF6B00" />} color="#FF6B00"
                        loading={loading === `${pkg.id}-monnify`}
                        onClick={e => { e.stopPropagation(); buy(pkg, "monnify"); }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!selected && (
          <p style={{ textAlign: "center", fontSize: 13, color: C.muted, margin: 0 }}>
            Click a plan to see payment options
          </p>
        )}

        <div style={{
          display: "flex", justifyContent: "center", gap: 24,
          marginTop: 20, paddingTop: 20, borderTop: `1px solid ${C.border}`,
          flexWrap: "wrap",
        }}>
          {[
            { icon: <Lock size={14} />,         text: "Secure checkout" },
            { icon: <Building size={14} />,     text: "Bank transfer available" },
            { icon: <Zap size={14} />,          text: "Credits added instantly" },
            { icon: <InfinityIcon size={14} />, text: "Credits never expire" },
          ].map(b => (
            <div key={b.text} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ display: "flex", alignItems: "center", color: C.muted }}>{b.icon}</span>
              <span style={{ fontSize: 11, color: C.muted }}>{b.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── PaymentCallback ──────────────────────────────────────────────── */
export function PaymentCallback({ backendUrl, token, onDone }) {
  const [status,  setStatus]  = useState("verifying");
  const [credits, setCredits] = useState(null);

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search);
    const trxref   = params.get("trxref") || params.get("reference") || params.get("paymentReference");
    const provider = params.get("provider") || "paystack";

    if (!trxref) { setStatus("missing"); return; }

    fetch(`${backendUrl}/credits/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ reference: trxref, provider }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.credits !== undefined) {
          setCredits(data.credits);
          setStatus("success");
          window.history.replaceState({}, "", window.location.pathname);
          setTimeout(onDone, 3000);
        } else {
          setStatus("failed");
        }
      })
      .catch(() => setStatus("failed"));
  }, []);

  const isFailed = status === "failed" || status === "missing";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(10,10,20,0.5)",
      backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 2000,
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: "48px 40px",
        maxWidth: 380, width: "100%", textAlign: "center", boxShadow: C.shadow,
      }}>
        {status === "verifying" && (
          <>
            <div style={{ marginBottom: 16, color: C.indigo }}><Clock size={40} /></div>
            <h3 style={{ color: C.text, margin: "0 0 8px",
              fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>Verifying payment…</h3>
            <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>Please wait while we confirm your payment.</p>
          </>
        )}
        {status === "success" && (
          <>
            <div style={{
              width: 64, height: 64, borderRadius: "50%", background: C.greenBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, margin: "0 auto 16px", color: C.green,
            }}><Check size={28} /></div>
            <h3 style={{ color: C.green, margin: "0 0 8px",
              fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>Payment confirmed!</h3>
            <p style={{ color: C.muted, fontSize: 14, margin: "0 0 4px" }}>
              Your credits have been added to your account.
            </p>
            <p style={{ color: C.indigo, fontWeight: 700, fontSize: 18, margin: "12px 0 0",
              fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
              {credits} credits available
            </p>
          </>
        )}
        {isFailed && (
          <>
            <div style={{ marginBottom: 16, color: C.red }}><XCircle size={40} /></div>
            <h3 style={{ color: C.red, margin: "0 0 8px",
              fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>Payment not confirmed</h3>
            <p style={{ color: C.muted, fontSize: 14, margin: "0 0 20px" }}>
              Your payment could not be verified. If you were charged, contact support.
            </p>
            <button onClick={onDone} style={{
              padding: "10px 24px", background: C.indigo, color: "#fff",
              border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit",
            }}>Continue</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── CreditBadge ──────────────────────────────────────────────────── */
export function CreditBadge({ credits, onTopUp }) {
  const low = typeof credits === "number" && credits <= 3;
  return (
    <button onClick={onTopUp} style={{
      display: "flex", alignItems: "center", gap: 6,
      background: low ? C.redBg : C.indigoTint,
      border: `1px solid ${low ? "#FECACA" : C.indigo + "44"}`,
      borderRadius: 20, padding: "5px 14px 5px 10px",
      cursor: "pointer", transition: "all 0.15s",
      fontFamily: "inherit",
    }}>
      <Zap size={14} />
      <span style={{ fontSize: 13, fontWeight: 600, color: low ? C.red : C.indigo }}>
        {credits === null ? "—" : `${credits} credits`}
      </span>
      {low && <span style={{ fontSize: 10, color: C.red, fontWeight: 500 }}>Low</span>}
    </button>
  );
}

/* ─── UserMenu ─────────────────────────────────────────────────────── */
export function UserMenu({ user, credits, onLogout, onTopUp }) {
  const [open, setOpen] = useState(false);
  const initial = (user?.email || "?")[0].toUpperCase();

  return (
    <div style={{ position: "relative", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: C.bg, border: `1px solid ${C.border}`,
          borderRadius: 20, padding: "5px 12px 5px 6px", cursor: "pointer",
        }}
      >
        <div style={{
          width: 26, height: 26, borderRadius: "50%", background: C.indigo,
          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700,
        }}>{initial}</div>
        <span style={{
          fontSize: 13, color: C.muted,
          maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{user?.email}</span>
        <span style={{ fontSize: 10, color: C.muted }}>▾</span>
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0,
            background: "#fff", border: `1px solid ${C.border}`,
            borderRadius: 12, boxShadow: C.shadow,
            minWidth: 220, zIndex: 200, overflow: "hidden",
          }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, color: C.muted }}>Signed in as</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginTop: 2 }}>{user?.email}</div>
              {user?.tier && (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  Tier: <span style={{ color: C.indigo, fontWeight: 600, textTransform: "capitalize" }}>{user.tier}</span>
                </div>
              )}
            </div>
            <div style={{ padding: "8px 0" }}>
              <button
                onClick={() => { setOpen(false); onTopUp(); }}
                style={{
                  width: "100%", padding: "9px 16px", background: "none", border: "none",
                  textAlign: "left", cursor: "pointer", fontSize: 13, color: C.text,
                  display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                <Zap size={14} /> Top up credits
                {typeof credits === "number" && (
                  <span style={{ marginLeft: "auto", fontSize: 12, color: C.indigo, fontWeight: 600 }}>
                    {credits} left
                  </span>
                )}
              </button>
              <button
                onClick={() => { setOpen(false); onLogout(); }}
                style={{
                  width: "100%", padding: "9px 16px", background: "none", border: "none",
                  textAlign: "left", cursor: "pointer", fontSize: 13, color: C.red,
                  display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = C.redBg)}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                <span>→</span> Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
