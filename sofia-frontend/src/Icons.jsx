// Stroke-based SVG icons — 24×24 grid, 2px stroke, round caps/joins.
// All accept: size (default 20), color (default "currentColor").

const S = { display: "inline-block", flexShrink: 0, verticalAlign: "middle" };

function Ic({ size, color, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={S}>
      {children}
    </svg>
  );
}

export function AlertTriangle({ size = 20, color = "currentColor" }) {
  return (
    <Ic size={size} color={color}>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="3"/>
    </Ic>
  );
}

export function FileText({ size = 20, color = "currentColor" }) {
  return (
    <Ic size={size} color={color}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <line x1="10" y1="9" x2="8" y2="9"/>
    </Ic>
  );
}

export function Lock({ size = 20, color = "currentColor" }) {
  return (
    <Ic size={size} color={color}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0110 0v4"/>
    </Ic>
  );
}

export function CreditCard({ size = 20, color = "currentColor" }) {
  return (
    <Ic size={size} color={color}>
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </Ic>
  );
}

export function Building({ size = 20, color = "currentColor" }) {
  return (
    <Ic size={size} color={color}>
      <line x1="3" y1="22" x2="21" y2="22"/>
      <line x1="6" y1="18" x2="6" y2="11"/>
      <line x1="10" y1="18" x2="10" y2="11"/>
      <line x1="14" y1="18" x2="14" y2="11"/>
      <line x1="18" y1="18" x2="18" y2="11"/>
      <polygon points="12 2 20 7 4 7"/>
    </Ic>
  );
}

export function Zap({ size = 20, color = "currentColor" }) {
  return (
    <Ic size={size} color={color}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </Ic>
  );
}

export function InfinityIcon({ size = 20, color = "currentColor" }) {
  return (
    <Ic size={size} color={color}>
      <path d="M12 12C10 9 8 7 6 7a5 5 0 000 10c2 0 4-2 6-5z"/>
      <path d="M12 12c2 3 4 5 6 5a5 5 0 000-10c-2 0-4 2-6 5z"/>
    </Ic>
  );
}

export function XCircle({ size = 20, color = "currentColor" }) {
  return (
    <Ic size={size} color={color}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </Ic>
  );
}

export function Sparkle({ size = 20, color = "currentColor" }) {
  return (
    <Ic size={size} color={color}>
      <path d="M12 2l2.09 7.91L22 12l-7.91 2.09L12 22l-2.09-7.91L2 12l7.91-2.09L12 2z" strokeWidth="1.5"/>
    </Ic>
  );
}

export function ArrowRight({ size = 20, color = "currentColor" }) {
  return (
    <Ic size={size} color={color}>
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </Ic>
  );
}

export function ChevronRight({ size = 20, color = "currentColor" }) {
  return (
    <Ic size={size} color={color}>
      <polyline points="9 18 15 12 9 6"/>
    </Ic>
  );
}

export function X({ size = 20, color = "currentColor" }) {
  return (
    <Ic size={size} color={color}>
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </Ic>
  );
}

export function Check({ size = 20, color = "currentColor" }) {
  return (
    <Ic size={size} color={color}>
      <polyline points="20 6 9 17 4 12"/>
    </Ic>
  );
}

export function Clock({ size = 20, color = "currentColor" }) {
  return (
    <Ic size={size} color={color}>
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </Ic>
  );
}

export function Search({ size = 20, color = "currentColor" }) {
  return (
    <Ic size={size} color={color}>
      <circle cx="11" cy="11" r="7"/>
      <path d="M21 21l-4.3-4.3"/>
    </Ic>
  );
}

export function FileCheck({ size = 20, color = "currentColor" }) {
  return (
    <Ic size={size} color={color}>
      <path d="M14 3v4a1 1 0 001 1h4"/>
      <path d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/>
      <path d="M9 14l2 2 4-4"/>
    </Ic>
  );
}
