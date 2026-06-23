import React, { useState, useEffect, useCallback } from "react";
import CVApp from "./CVApp.jsx";
import RecruiterApp from "./RecruiterApp.jsx";
import PlanApp from "./PlanApp.jsx";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:          "#FFFFFF",
  surface:     "#F8F8FB",
  surfaceHover:"#F0F0F7",
  border:      "#E4E4EF",
  borderLight: "#EFEFFA",
  gold:        "#8B6F3E",
  goldLight:   "#C49A52",
  goldBg:      "#FBF6EE",
  text:        "#1A1A2E",
  textSub:     "#4A4A6A",
  muted:       "#9090B0",
  accent:      "#5B5BD6",
  accentLight: "#EDEDFF",
  success:     "#16A34A",
  successBg:   "#F0FDF4",
  error:       "#DC2626",
  errorBg:     "#FEF2F2",
  warning:     "#B45309",
  warningBg:   "#FFFBEB",
  shadowSm:    "0 1px 3px rgba(0,0,0,0.08)",
  shadowMd:    "0 4px 16px rgba(0,0,0,0.10)",
  shadowLg:    "0 8px 32px rgba(0,0,0,0.14)",
};

const ENGINES = [
  { id:"cv",        label:"CV Rewriter",   sub:"Optimise your CV for any role",  icon:"📄", cost:"2 credits" },
  { id:"recruiter", label:"Recruiter",      sub:"Rank and shortlist candidates",  icon:"🔍", cost:"1 credit/CV" },
  { id:"plan",      label:"Business Plan",  sub:"Grant-ready business documents", icon:"📊", cost:"5 credits" },
];

const ENGINE_MAP = { cv: CVApp, recruiter: RecruiterApp, plan: PlanApp };

const PACKAGES = [
  { id:"starter",       name:"Starter",       credits:50,   price_ngn:1500,  popular:false, desc:"Great for trying Sofia out",      best_for:"Job seekers just starting out" },
  { id:"pro",           name:"Pro",            credits:200,  price_ngn:2000,  popular:true,  desc:"For active job seekers",          best_for:"Regular CV updates & cover letters" },
  { id:"business_500",  name:"Business 500",   credits:500,  price_ngn:10000, popular:false, desc:"Power users and teams",           best_for:"Recruiters & business plan writers" },
  { id:"business_1000", name:"Business 1000",  credits:1000, price_ngn:15000, popular:false, desc:"Best value for heavy usage",      best_for:"Agencies & high-volume users" },
];

const FX  = { NGN:1, USD:0.00065, GBP:0.00051, EUR:0.00060, GHS:0.0091, KES:0.085, ZAR:0.012, CAD:0.00088 };
const SYM = { NGN:"₦", USD:"$", GBP:"£", EUR:"€", GHS:"₵", KES:"KSh", ZAR:"R", CAD:"CA$" };

function fmtPrice(ngn, currency) {
  const rate = FX[currency] || 1;
  const sym  = SYM[currency] || currency;
  const amt  = ngn * rate;
  return `${sym}${amt < 10 ? amt.toFixed(2) : Math.round(amt).toLocaleString()}`;
}

function useLocalStorage(key, def) {
  const [val, setVal] = useState(() => {
    try { return localStorage.getItem(key) || def; } catch { return def; }
  });
  const set = (v) => { try { localStorage.setItem(key, v); } catch {} setVal(v); };
  const del = ()  => { try { localStorage.removeItem(key); } catch {} setVal(def); };
  return [val, set, del];
}

// ─── Toast notification ───────────────────────────────────────────────────────
function Toast({ message, type = "success", onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 4000); return () => clearTimeout(t); }, [onDone]);
  const bg    = type === "success" ? C.successBg : type === "error" ? C.errorBg : C.warningBg;
  const color = type === "success" ? C.success   : type === "error" ? C.error   : C.warning;
  const icon  = type === "success" ? "✓" : type === "error" ? "✕" : "!";
  return (
    <div style={{
      position:"fixed", bottom:24, right:24, zIndex:2000,
      background:bg, border:`1px solid ${color}30`, borderRadius:12,
      padding:"12px 20px", display:"flex", alignItems:"center", gap:10,
      boxShadow:C.shadowMd, maxWidth:340, animation:"slideIn 0.2s ease",
    }}>
      <span style={{ width:22, height:22, borderRadius:"50%", background:color,
        color:"#fff", display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:12, fontWeight:700, flexShrink:0 }}>{icon}</span>
      <span style={{ fontSize:13, color, fontWeight:500 }}>{message}</span>
    </div>
  );
}

// ─── Input field ──────────────────────────────────────────────────────────────
function Field({ label, type="text", value, onChange, placeholder, onEnter, autoFocus }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:"block", fontSize:13, fontWeight:500, color:C.textSub, marginBottom:6 }}>
        {label}
      </label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoFocus={autoFocus}
        onKeyDown={e => e.key === "Enter" && onEnter?.()}
        style={{
          width:"100%", padding:"11px 14px", border:`1.5px solid ${C.border}`,
          borderRadius:9, fontSize:14, outline:"none", boxSizing:"border-box",
          color:C.text, background:"#fff", fontFamily:"inherit",
          transition:"border-color 0.15s",
        }}
        onFocus={e  => e.target.style.borderColor = C.gold}
        onBlur={e   => e.target.style.borderColor = C.border}
      />
    </div>
  );
}

// ─── Auth Modal ───────────────────────────────────────────────────────────────
function AuthModal({ backendUrl, onAuth, onClose, initialMode = "login" }) {
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
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong."); return; }
      onAuth(data);
    } catch { setError("Could not connect to server. Is the app running?"); }
    finally { setLoading(false); }
  }

  function switchMode() { setMode(m => m === "login" ? "signup" : "login"); setError(""); }

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(10,10,30,0.5)", backdropFilter:"blur(4px)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background:"#fff", borderRadius:20, padding:"40px 36px", width:"100%", maxWidth:400,
        boxShadow:C.shadowLg, position:"relative",
      }}>
        {/* Close */}
        <button onClick={onClose} style={{
          position:"absolute", top:14, right:14, background:C.surface, border:"none",
          borderRadius:"50%", width:30, height:30, cursor:"pointer", color:C.muted,
          fontSize:16, display:"flex", alignItems:"center", justifyContent:"center",
        }}>✕</button>

        {/* Logo */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:26, fontWeight:800, color:C.gold, letterSpacing:-0.5 }}>Sofia</div>
          <h2 style={{ margin:"4px 0 0", fontSize:18, color:C.text, fontWeight:600 }}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p style={{ margin:"4px 0 0", fontSize:13, color:C.muted }}>
            {mode === "login" ? "Sign in to access your documents and credits" : "Get 5 free credits — no card required"}
          </p>
        </div>

        {error && (
          <div style={{ background:C.errorBg, border:`1px solid #FECACA`, borderRadius:9,
            padding:"10px 14px", marginBottom:16, color:C.error, fontSize:13 }}>
            {error}
          </div>
        )}

        <Field label="Email address" type="email" value={email} onChange={setEmail}
          placeholder="you@example.com" autoFocus />
        <Field label="Password" type="password" value={password} onChange={setPassword}
          placeholder={mode === "signup" ? "Min. 8 characters" : "Your password"} onEnter={submit} />

        <button onClick={submit} disabled={loading} style={{
          width:"100%", padding:"13px", background:C.gold, color:"#fff",
          border:"none", borderRadius:10, fontSize:15, fontWeight:600,
          cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.75 : 1,
          marginTop:4,
        }}>
          {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <div style={{ display:"flex", alignItems:"center", gap:8, margin:"20px 0 0" }}>
          <div style={{ flex:1, height:1, background:C.border }} />
          <span style={{ fontSize:12, color:C.muted }}>or</span>
          <div style={{ flex:1, height:1, background:C.border }} />
        </div>

        <p style={{ textAlign:"center", marginTop:16, fontSize:13, color:C.muted }}>
          {mode === "login" ? "New to Sofia? " : "Already have an account? "}
          <button onClick={switchMode} style={{
            background:"none", border:"none", color:C.accent,
            cursor:"pointer", fontWeight:600, fontSize:13, padding:0,
          }}>
            {mode === "login" ? "Create a free account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

// ─── Provider button ──────────────────────────────────────────────────────────
function ProviderBtn({ provider, label, sub, icon, color, loading, onClick }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      flex:1, padding:"12px 10px", border:`1.5px solid ${loading ? color : C.border}`,
      borderRadius:11, background: loading ? color + "10" : "#fff",
      cursor: loading ? "not-allowed" : "pointer",
      display:"flex", flexDirection:"column", alignItems:"center", gap:4,
      transition:"all 0.15s",
    }}
    onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = color + "08"; }}}
    onMouseLeave={e => { if (!loading) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "#fff"; }}}
    >
      <span style={{ fontSize:20 }}>{icon}</span>
      <span style={{ fontSize:13, fontWeight:700, color: loading ? color : C.text }}>{label}</span>
      <span style={{ fontSize:11, color:C.muted }}>{loading ? "Redirecting…" : sub}</span>
    </button>
  );
}

// ─── Pricing Modal ────────────────────────────────────────────────────────────
function PricingModal({ backendUrl, user, token, currency, onClose, onCreditsUpdated }) {
  const [loading, setLoading] = useState(null); // "starter-paystack" | "pro-monnify" etc.
  const [error,   setError]   = useState("");
  const [selected, setSelected] = useState(null); // pkg being confirmed

  async function buy(pkg, provider) {
    setError(""); setLoading(`${pkg.id}-${provider}`);
    try {
      const res  = await fetch(`${backendUrl}/credits/initiate`, {
        method:"POST",
        headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${token}` },
        body:JSON.stringify({
          package_id:   pkg.id,
          provider:     provider,
          callback_url: window.location.origin + "?payment=success&provider=" + provider,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Could not initiate payment."); return; }
      window.location.href = data.payment_url;
    } catch { setError("Could not connect to server."); }
    finally { setLoading(null); }
  }

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(10,10,30,0.5)", backdropFilter:"blur(4px)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background:"#fff", borderRadius:22, padding:"36px 32px", width:"100%", maxWidth:720,
        boxShadow:C.shadowLg, position:"relative", maxHeight:"92vh", overflowY:"auto",
      }}>
        <button onClick={onClose} style={{
          position:"absolute", top:14, right:14, background:C.surface, border:"none",
          borderRadius:"50%", width:30, height:30, cursor:"pointer", color:C.muted,
          fontSize:16, display:"flex", alignItems:"center", justifyContent:"center",
        }}>✕</button>

        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:13, fontWeight:600, color:C.gold, textTransform:"uppercase",
            letterSpacing:1, marginBottom:6 }}>Top up credits</div>
          <h2 style={{ margin:"0 0 6px", fontSize:22, color:C.text, fontWeight:700 }}>
            Choose your plan
          </h2>
          <p style={{ margin:0, color:C.muted, fontSize:14 }}>
            Credits never expire · Use across all three engines · Pay in Naira
          </p>
        </div>

        {error && (
          <div style={{ background:C.errorBg, border:`1px solid #FECACA`, borderRadius:10,
            padding:"10px 16px", marginBottom:20, color:C.error, fontSize:13 }}>
            {error}
          </div>
        )}

        {/* Package grid */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:24 }}>
          {PACKAGES.map(pkg => {
            const isSelected = selected?.id === pkg.id;
            return (
              <div key={pkg.id} onClick={() => setSelected(isSelected ? null : pkg)} style={{
                border: pkg.popular ? `2px solid ${C.accent}` : isSelected ? `2px solid ${C.gold}` : `1.5px solid ${C.border}`,
                borderRadius:14, padding:20, cursor:"pointer", position:"relative",
                background: pkg.popular ? C.accentLight : isSelected ? C.goldBg : "#fff",
                transition:"all 0.15s",
              }}>
                {pkg.popular && (
                  <div style={{
                    position:"absolute", top:-11, left:"50%", transform:"translateX(-50%)",
                    background:C.accent, color:"#fff", fontSize:10, fontWeight:700,
                    padding:"3px 12px", borderRadius:20, whiteSpace:"nowrap",
                  }}>⭐ MOST POPULAR</div>
                )}

                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{pkg.name}</div>
                  <div style={{ fontSize:11, color:C.muted, background:C.surface,
                    padding:"2px 8px", borderRadius:20 }}>{pkg.credits} credits</div>
                </div>

                <div style={{ fontSize:26, fontWeight:800, color:C.gold, marginBottom:2 }}>
                  {fmtPrice(pkg.price_ngn, currency)}
                </div>
                <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>
                  {fmtPrice(Math.round(pkg.price_ngn / pkg.credits), currency)} per credit
                </div>
                <div style={{ fontSize:12, color:C.textSub }}>{pkg.best_for}</div>

                {isSelected && (
                  <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
                    <div style={{ fontSize:12, fontWeight:600, color:C.textSub, marginBottom:8 }}>
                      Choose payment method:
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <ProviderBtn
                        provider="paystack" label="Paystack" sub="Card · Bank transfer"
                        icon="💳" color="#0BA4DB"
                        loading={loading === `${pkg.id}-paystack`}
                        onClick={e => { e.stopPropagation(); buy(pkg, "paystack"); }}
                      />
                      <ProviderBtn
                        provider="monnify" label="Monnify" sub="Bank · USSD · Card"
                        icon="🏦" color="#FF6B00"
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
          <p style={{ textAlign:"center", fontSize:13, color:C.muted, margin:0 }}>
            Click a plan to see payment options
          </p>
        )}

        {/* Trust badges */}
        <div style={{ display:"flex", justifyContent:"center", gap:24, marginTop:20,
          paddingTop:20, borderTop:`1px solid ${C.border}` }}>
          {[
            { icon:"🔒", text:"Secure checkout" },
            { icon:"🏦", text:"Bank transfer available" },
            { icon:"⚡", text:"Credits added instantly" },
            { icon:"♾️",  text:"Credits never expire" },
          ].map(b => (
            <div key={b.text} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ fontSize:13 }}>{b.icon}</span>
              <span style={{ fontSize:11, color:C.muted }}>{b.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Payment callback handler ─────────────────────────────────────────────────
function PaymentCallback({ backendUrl, token, onDone }) {
  const [status, setStatus] = useState("verifying");
  const [credits, setCredits] = useState(null);

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search);
    const trxref   = params.get("trxref") || params.get("reference") || params.get("paymentReference");
    const provider = params.get("provider") || "paystack";

    if (!trxref) { setStatus("missing"); return; }

    fetch(`${backendUrl}/credits/verify`, {
      method:"POST",
      headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${token}` },
      body:JSON.stringify({ reference: trxref, provider }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.credits !== undefined) {
          setCredits(data.credits);
          setStatus("success");
          // Clean URL
          window.history.replaceState({}, "", window.location.pathname);
          setTimeout(onDone, 3000);
        } else {
          setStatus("failed");
        }
      })
      .catch(() => setStatus("failed"));
  }, []);

  const isSuccess = status === "success";
  const isFailed  = status === "failed" || status === "missing";

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(10,10,30,0.6)", backdropFilter:"blur(4px)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000,
    }}>
      <div style={{
        background:"#fff", borderRadius:20, padding:"48px 40px", maxWidth:380, width:"100%",
        textAlign:"center", boxShadow:C.shadowLg,
      }}>
        {status === "verifying" && (
          <>
            <div style={{ fontSize:40, marginBottom:16 }}>⏳</div>
            <h3 style={{ color:C.text, margin:"0 0 8px" }}>Verifying payment…</h3>
            <p style={{ color:C.muted, fontSize:14, margin:0 }}>Please wait while we confirm your payment.</p>
          </>
        )}
        {isSuccess && (
          <>
            <div style={{ width:64, height:64, borderRadius:"50%", background:C.successBg,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:28, margin:"0 auto 16px" }}>✓</div>
            <h3 style={{ color:C.success, margin:"0 0 8px" }}>Payment confirmed!</h3>
            <p style={{ color:C.textSub, fontSize:14, margin:"0 0 4px" }}>
              Your credits have been added to your account.
            </p>
            <p style={{ color:C.gold, fontWeight:700, fontSize:18, margin:"12px 0 0" }}>
              {credits} credits available
            </p>
          </>
        )}
        {isFailed && (
          <>
            <div style={{ fontSize:40, marginBottom:16 }}>❌</div>
            <h3 style={{ color:C.error, margin:"0 0 8px" }}>Payment not confirmed</h3>
            <p style={{ color:C.muted, fontSize:14, margin:"0 0 20px" }}>
              Your payment could not be verified. If you were charged, contact support.
            </p>
            <button onClick={onDone} style={{
              padding:"10px 24px", background:C.gold, color:"#fff",
              border:"none", borderRadius:8, fontWeight:600, cursor:"pointer",
            }}>Continue</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Credit badge ─────────────────────────────────────────────────────────────
function CreditBadge({ credits, onTopUp }) {
  const low = typeof credits === "number" && credits <= 3;
  return (
    <button onClick={onTopUp} style={{
      display:"flex", alignItems:"center", gap:6,
      background: low ? C.errorBg : C.goldBg,
      border:`1px solid ${low ? "#FECACA" : "#E8D5B0"}`,
      borderRadius:20, padding:"5px 14px 5px 10px",
      cursor:"pointer", transition:"all 0.15s",
    }}>
      <span style={{ fontSize:14 }}>⚡</span>
      <span style={{ fontSize:13, fontWeight:600, color: low ? C.error : C.gold }}>
        {credits === null ? "—" : `${credits} credits`}
      </span>
      {low && <span style={{ fontSize:10, color:C.error, fontWeight:500 }}>Low</span>}
    </button>
  );
}

// ─── User menu ────────────────────────────────────────────────────────────────
function UserMenu({ user, credits, onLogout, onTopUp }) {
  const [open, setOpen] = useState(false);
  const initial = (user.email || "?")[0].toUpperCase();

  return (
    <div style={{ position:"relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display:"flex", alignItems:"center", gap:8, background:C.surface,
        border:`1px solid ${C.border}`, borderRadius:20, padding:"5px 12px 5px 6px",
        cursor:"pointer",
      }}>
        <div style={{ width:26, height:26, borderRadius:"50%", background:C.gold,
          color:"#fff", display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:12, fontWeight:700 }}>{initial}</div>
        <span style={{ fontSize:13, color:C.textSub, maxWidth:140,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.email}</span>
        <span style={{ fontSize:10, color:C.muted }}>▾</span>
      </button>

      {open && (
        <>
          <div style={{ position:"fixed", inset:0, zIndex:199 }} onClick={() => setOpen(false)} />
          <div style={{
            position:"absolute", top:"calc(100% + 8px)", right:0, background:"#fff",
            border:`1px solid ${C.border}`, borderRadius:12, boxShadow:C.shadowMd,
            minWidth:220, zIndex:200, overflow:"hidden",
          }}>
            <div style={{ padding:"14px 16px", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ fontSize:12, color:C.muted }}>Signed in as</div>
              <div style={{ fontSize:13, fontWeight:600, color:C.text, marginTop:2 }}>{user.email}</div>
              <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
                Tier: <span style={{ color:C.gold, fontWeight:600, textTransform:"capitalize" }}>{user.tier}</span>
              </div>
            </div>
            <div style={{ padding:"8px 0" }}>
              <button onClick={() => { setOpen(false); onTopUp(); }} style={{
                width:"100%", padding:"9px 16px", background:"none", border:"none",
                textAlign:"left", cursor:"pointer", fontSize:13, color:C.text,
                display:"flex", alignItems:"center", gap:10,
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.surface}
              onMouseLeave={e => e.currentTarget.style.background = "none"}>
                <span>⚡</span> Top up credits
                {typeof credits === "number" && (
                  <span style={{ marginLeft:"auto", fontSize:12, color:C.gold, fontWeight:600 }}>
                    {credits} left
                  </span>
                )}
              </button>
              <button onClick={() => { setOpen(false); onLogout(); }} style={{
                width:"100%", padding:"9px 16px", background:"none", border:"none",
                textAlign:"left", cursor:"pointer", fontSize:13, color:C.error,
                display:"flex", alignItems:"center", gap:10,
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.errorBg}
              onMouseLeave={e => e.currentTarget.style.background = "none"}>
                <span>→</span> Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function SofiaApp({ backendUrl = "http://localhost:5000" }) {
  const [active,      setActive]      = useState("cv");
  const [user,        setUser]        = useState(null);
  const [token,       setToken,  delToken] = useLocalStorage("sofia_token", "");
  const [credits,     setCredits]     = useState(null);
  const [showAuth,    setShowAuth]    = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [currency,    setCurrency]    = useState("NGN");
  const [toast,       setToast]       = useState(null);
  const [authMode,    setAuthMode]    = useState("login");

  // Check if we're returning from a payment gateway
  const returningFromPayment = new URLSearchParams(window.location.search).get("payment") === "success";

  // Detect currency from browser locale
  useEffect(() => {
    try {
      const locale  = navigator.language || "en-NG";
      const region  = new Intl.Locale(locale).region || "";
      const map     = { NG:"NGN", US:"USD", GB:"GBP", GH:"GHS", KE:"KES", ZA:"ZAR", CA:"CAD" };
      const det     = map[region];
      if (det && FX[det]) setCurrency(det);
    } catch {}
  }, []);

  // Load user from token on mount
  const fetchMe = useCallback(async () => {
    if (!token) return;
    try {
      const res  = await fetch(`${backendUrl}/auth/me`, {
        headers:{ "Authorization":`Bearer ${token}` },
      });
      if (!res.ok) { delToken(); return; }
      const data = await res.json();
      setUser(data); setCredits(data.credits);
    } catch {}
  }, [token, backendUrl]);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  function handleAuth(data) {
    setToken(data.token);
    setUser(data);
    setCredits(data.credits);
    setShowAuth(false);
    setToast({ message: `Welcome${data.tier === "free" ? " — you have 5 free credits to start" : ""}!`, type:"success" });
  }

  function handleLogout() {
    delToken(); setUser(null); setCredits(null);
    setToast({ message:"Signed out successfully.", type:"success" });
  }

  function handleTopUp() {
    if (!user) { setAuthMode("login"); setShowAuth(true); return; }
    setShowPricing(true);
  }

  function handlePaymentDone() {
    fetchMe(); // refresh credits
    setToast({ message:"Credits added to your account!", type:"success" });
  }

  const CurrentEngine = ENGINE_MAP[active];
  const activeEngine  = ENGINES.find(e => e.id === active);

  return (
    <div style={{ background:C.bg, color:C.text, minHeight:"100vh",
      fontFamily:"'DM Sans','Inter',system-ui,sans-serif" }}>

      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <header style={{
        background:"#fff", borderBottom:`1px solid ${C.border}`,
        position:"sticky", top:0, zIndex:100, boxShadow:C.shadowSm,
      }}>
        <div style={{ maxWidth:960, margin:"0 auto", padding:"0 20px" }}>

          {/* Top bar */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:58 }}>
            {/* Logo */}
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ fontSize:24, fontWeight:800, color:C.gold, letterSpacing:-0.5 }}>Sofia</div>
              <div style={{ width:1, height:18, background:C.border }} />
              <div style={{ fontSize:12, color:C.muted }}>AI career &amp; business documents</div>
            </div>

            {/* Right */}
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              {user && <CreditBadge credits={credits} onTopUp={handleTopUp} />}
              {user ? (
                <UserMenu user={user} credits={credits} onLogout={handleLogout} onTopUp={handleTopUp} />
              ) : (
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => { setAuthMode("login"); setShowAuth(true); }} style={{
                    fontSize:13, fontWeight:500, color:C.textSub, background:"none",
                    border:`1px solid ${C.border}`, borderRadius:8, padding:"7px 14px", cursor:"pointer",
                  }}>Sign in</button>
                  <button onClick={() => { setAuthMode("signup"); setShowAuth(true); }} style={{
                    fontSize:13, fontWeight:600, color:"#fff", background:C.gold,
                    border:"none", borderRadius:8, padding:"7px 16px", cursor:"pointer",
                  }}>Get started free</button>
                </div>
              )}
            </div>
          </div>

          {/* Engine tabs */}
          <nav style={{ display:"flex", gap:0, marginTop:-1 }}>
            {ENGINES.map(e => {
              const on = e.id === active;
              return (
                <button key={e.id} onClick={() => setActive(e.id)} style={{
                  background:"transparent", border:"none",
                  borderBottom:`2.5px solid ${on ? C.gold : "transparent"}`,
                  color: on ? C.text : C.muted,
                  padding:"10px 18px 12px", cursor:"pointer",
                  fontFamily:"inherit", fontSize:13, fontWeight: on ? 600 : 500,
                  display:"flex", alignItems:"center", gap:6, transition:"all 0.15s",
                }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.color = C.textSub; }}
                onMouseLeave={e => { if (!on) e.currentTarget.style.color = C.muted; }}>
                  <span>{e.icon}</span>
                  <span>{e.label}</span>
                  <span style={{
                    fontSize:10, background: on ? C.goldBg : C.surface,
                    color: on ? C.gold : C.muted,
                    padding:"1px 6px", borderRadius:10, fontWeight:500,
                  }}>{e.cost}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ── Mode banner ───────────────────────────────────────────────────── */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.borderLight}` }}>
        <div style={{ maxWidth:960, margin:"0 auto", padding:"10px 20px",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:20 }}>{activeEngine.icon}</span>
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{activeEngine.label}</div>
              <div style={{ fontSize:12, color:C.muted }}>{activeEngine.sub}</div>
            </div>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {/* Credit display */}
            {user ? (
              <div style={{ display:"flex", alignItems:"center", gap:6,
                background:"#fff", border:`1px solid ${C.border}`, borderRadius:20,
                padding:"4px 12px" }}>
                <span style={{ fontSize:12 }}>⚡</span>
                <span style={{ fontSize:13, color:C.textSub }}>
                  <span style={{ fontWeight:700, color: (credits||0) <= 3 ? C.error : C.gold }}>
                    {credits ?? "—"}
                  </span> credits
                </span>
              </div>
            ) : (
              <span style={{ fontSize:12, color:C.muted }}>Sign in to track credits</span>
            )}

            <button onClick={handleTopUp} style={{
              fontSize:12, fontWeight:600, color:C.accent, background:C.accentLight,
              border:`1px solid ${C.accent}30`, borderRadius:8, padding:"6px 14px",
              cursor:"pointer",
            }}>+ Top up</button>

            {!user && (
              <button onClick={() => { setAuthMode("signup"); setShowAuth(true); }} style={{
                fontSize:12, fontWeight:600, color:"#fff", background:C.gold,
                border:"none", borderRadius:8, padding:"6px 14px", cursor:"pointer",
              }}>Sign up free</button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main style={{ maxWidth:960, margin:"0 auto", padding:"28px 20px" }}>
        <CurrentEngine key={active} backendUrl={backendUrl} token={token} />
      </main>

      {/* ── Modals & overlays ─────────────────────────────────────────────── */}
      {showAuth && (
        <AuthModal
          backendUrl={backendUrl} onAuth={handleAuth}
          onClose={() => setShowAuth(false)} initialMode={authMode}
        />
      )}

      {showPricing && (
        <PricingModal
          backendUrl={backendUrl} user={user} token={token}
          currency={currency} onClose={() => setShowPricing(false)}
          onCreditsUpdated={c => { setCredits(c); setShowPricing(false); }}
        />
      )}

      {returningFromPayment && token && (
        <PaymentCallback
          backendUrl={backendUrl} token={token}
          onDone={handlePaymentDone}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />
      )}
    </div>
  );
}