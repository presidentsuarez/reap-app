import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { loadStripe } from "@stripe/stripe-js";

// All data fetched from Supabase (migrated from Google Sheets)

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);
const TRIAL_DAYS = 14;

// ── Org / Team tier ranking ──
const PLATFORM_ADMIN_EMAIL = "javier@thesuarezcapital.com";
const TIER_RANK = { free: 0, starter: 1, team: 2, pro: 3, enterprise: 4 };
const getTierRank = (tier) => TIER_RANK[(tier || "starter").toLowerCase()] || 1;

const STATUS_CONFIG = {
  "New":            { color: "#16a34a", bg: "rgba(22,163,74,0.08)",   dot: "#16a34a" },
  "Review":         { color: "#d97706", bg: "rgba(217,119,6,0.08)",   dot: "#d97706" },
  "Underwriting":   { color: "#7c3aed", bg: "rgba(124,58,237,0.08)",  dot: "#7c3aed" },
  "Offer":          { color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  dot: "#f59e0b" },
  "Under Contract": { color: "#0891b2", bg: "rgba(8,145,178,0.08)",   dot: "#0891b2" },
  "Closed":         { color: "#15803d", bg: "rgba(21,128,61,0.08)",   dot: "#15803d" },
  "Dead":           { color: "#dc2626", bg: "rgba(220,38,38,0.07)",   dot: "#dc2626" },
  "On Hold":        { color: "#64748b", bg: "rgba(100,116,135,0.08)", dot: "#94a3b8" },
};

const INVESTOR_STAGE_CONFIG = {
  "Prospect":           { color: "#64748b", bg: "rgba(100,116,135,0.08)" },
  "Initial Outreach":   { color: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
  "Meeting Scheduled":  { color: "#d97706", bg: "rgba(217,119,6,0.08)" },
  "Due Diligence":      { color: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
  "Term Sheet":         { color: "#0891b2", bg: "rgba(8,145,178,0.08)" },
  "Committed":          { color: "#16a34a", bg: "rgba(22,163,74,0.08)" },
  "Funded":             { color: "#15803d", bg: "rgba(21,128,61,0.08)" },
  "Passed":             { color: "#dc2626", bg: "rgba(220,38,38,0.07)" },
};
const INVESTOR_STAGES = Object.keys(INVESTOR_STAGE_CONFIG);
const INVESTOR_TYPES = ["Individual / HNW", "Family Office", "Private Equity Fund", "Institutional"];
const INVESTOR_TEMPS = ["Hot", "Warm", "Cold"];
const TEMP_COLORS = { "Hot": "#16a34a", "Warm": "#d97706", "Cold": "#94a3b8" };

const fmt = (n) => {
  const num = parseFloat(String(n).replace(/[$,]/g, ""));
  if (isNaN(num)) return n || "—";
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `$${num.toLocaleString()}`;
  return `$${num}`;
};

const fmtNum = (n) => {
  const num = parseFloat(String(n).replace(/[$,]/g, ""));
  return isNaN(num) ? "—" : num.toLocaleString();
};

const fmtPct = (n) => {
  if (!n || n === "—") return "—";
  const num = parseFloat(String(n).replace(/[%,$]/g, ""));
  if (isNaN(num)) return "—";
  return `${num.toFixed(1)}%`;
};

const fmtDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const fmtUserName = (email) => {
  if (!email) return "—";
  if (!email.includes("@")) return email;
  const local = email.split("@")[0];
  return local.split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};

// Parse a value to a number for threshold checks
const num = (v) => {
  if (!v || v === "—") return null;
  const n = parseFloat(String(v).replace(/[$,%]/g, ""));
  return isNaN(n) ? null : n;
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG["On Hold"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20,
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.03em",
      fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
      border: `1px solid ${cfg.color}22`
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {status || "—"}
    </span>
  );
}

function MetricCard({ label, value, sub, highlight, good, warn }) {
  const hasValue = value && value !== "—" && value !== "$NaN" && value !== "NaN%";
  const isWarn = warn && hasValue;
  const isGood = good && hasValue && !isWarn;
  const cardBg = isWarn ? "linear-gradient(135deg, #fef2f2, #fee2e2)" : isGood ? "linear-gradient(135deg, #f0fdf4, #dcfce7)" : highlight && hasValue ? "#f8fafc" : "#ffffff";
  const cardBorder = isWarn ? "#fca5a5" : isGood ? "#86efac" : highlight && hasValue ? "#e2e8f0" : "#e2e8f0";
  const numColor = isWarn ? "#dc2626" : isGood ? "#15803d" : highlight && hasValue ? "#0f172a" : "#0f172a";
  return (
    <div style={{
      background: cardBg,
      border: `1px solid ${cardBorder}`,
      borderRadius: 12, padding: "18px 20px",
      display: "flex", flexDirection: "column", gap: 5,
      boxShadow: isGood ? "0 2px 12px rgba(22,163,74,0.1)" : isWarn ? "0 2px 12px rgba(220,38,38,0.08)" : "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.07em", textTransform: "uppercase", fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, color: numColor, fontFamily: "'DM Mono', monospace", letterSpacing: "-0.02em" }}>{hasValue ? value : "—"}</span>
      {sub && <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>{sub}</span>}
      {isGood && (
        <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 3 }}>
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="18 15 12 9 6 15"/></svg>
          Strong
        </span>
      )}
      {isWarn && (
        <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 600, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 3 }}>
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="6 9 12 15 18 9"/></svg>
          Caution
        </span>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, background: "#f8fafc" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTop: "3px solid #16a34a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ color: "#94a3b8", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>Loading deals...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, background: "#f8fafc" }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2}><circle cx={12} cy={12} r={10}/><line x1={12} y1={8} x2={12} y2={12}/><line x1={12} y1={16} x2={12.01} y2={16}/></svg>
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#0f172a", fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, margin: "0 0 6px" }}>Could not load data</p>
        <p style={{ color: "#94a3b8", fontSize: 12, fontFamily: "'DM Sans', sans-serif", margin: 0 }}>{message}</p>
      </div>
      <button onClick={onRetry} style={{ background: "#16a34a", border: "none", borderRadius: 8, padding: "9px 20px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
        Try Again
      </button>
    </div>
  );
}

function SkeletonCards() {
  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ width: 120, height: 18, background: "#e2e8f0", borderRadius: 6, marginBottom: 6, animation: "pulse 1.5s ease-in-out infinite" }} />
          <div style={{ width: 160, height: 12, background: "#f1f5f9", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite 0.1s" }} />
        </div>
        <div style={{ width: 36, height: 36, background: "#f1f5f9", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite 0.2s" }} />
      </div>
      <div style={{ background: "#fff", borderBottom: "1px solid #f1f5f9", padding: "12px 16px", display: "flex", gap: 20 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 24, height: 18, background: "#e2e8f0", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite " + (i * 0.1) + "s" }} />
            <div style={{ width: 50, height: 10, background: "#f1f5f9", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite " + (i * 0.1 + 0.05) + "s" }} />
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "hidden", padding: "12px 12px" }}>
        {[0,1,2,3,4,5,6].map(i => (
          <div key={i} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "14px 16px", marginBottom: 10, animation: "pulse 1.5s ease-in-out infinite " + (i * 0.08) + "s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ width: "70%", height: 14, background: "#e2e8f0", borderRadius: 4, marginBottom: 6 }} />
                <div style={{ width: "45%", height: 10, background: "#f1f5f9", borderRadius: 4 }} />
              </div>
              <div style={{ width: 80, height: 22, background: "#f1f5f9", borderRadius: 12 }} />
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              <div><div style={{ width: 30, height: 8, background: "#f1f5f9", borderRadius: 3, marginBottom: 4 }} /><div style={{ width: 60, height: 14, background: "#e2e8f0", borderRadius: 4 }} /></div>
              <div><div style={{ width: 30, height: 8, background: "#f1f5f9", borderRadius: 3, marginBottom: 4 }} /><div style={{ width: 45, height: 14, background: "#e2e8f0", borderRadius: 4 }} /></div>
              <div><div style={{ width: 30, height: 8, background: "#f1f5f9", borderRadius: 3, marginBottom: 4 }} /><div style={{ width: 50, height: 14, background: "#e2e8f0", borderRadius: 4 }} /></div>
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   NEW DEAL MODAL — Step 23
   ═══════════════════════════════════════════════════════════ */

function NewDealModal({ isOpen, onClose, onSave, saving, isMobile, userEmail }) {
  const [form, setForm] = useState({
    dealName: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    type: "Multifamily",
    sqft: "",
    units: "",
    yearBuilt: "",
    askingPrice: "",
    ourOffer: "",
    lotAcres: "",
    class: "",
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = () => {
    if (!form.dealName && !form.address) return;
    onSave(form);
  };

  if (!isOpen) return null;

  const inputStyle = {
    width: "100%", padding: "12px 14px", fontSize: 14,
    fontFamily: "'DM Sans', sans-serif", border: "1.5px solid #e2e8f0",
    borderRadius: 10, outline: "none", transition: "border-color 0.2s",
    background: "#fff", color: "#0f172a", boxSizing: "border-box",
  };

  const labelStyle = {
    display: "block", fontSize: 11, fontWeight: 700, color: "#94a3b8",
    marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase",
    fontFamily: "'DM Sans', sans-serif",
  };

  const selectStyle = { ...inputStyle, appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' fill='none' stroke-width='1.5'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", animation: "fadeIn 0.2s ease" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "relative", background: "#fff", width: isMobile ? "100%" : 540,
        maxHeight: isMobile ? "92vh" : "85vh", overflow: "auto",
        borderRadius: isMobile ? "20px 20px 0 0" : 20,
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        animation: isMobile ? "slideUp 0.3s cubic-bezier(0.25, 1, 0.5, 1)" : "fadeIn 0.25s ease",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff", zIndex: 1, borderRadius: isMobile ? "20px 20px 0 0" : "20px 20px 0 0" }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.02em" }}>New Deal</h2>
            <p style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: "2px 0 0" }}>Add a property to your pipeline</p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: "20px 24px 24px" }}>
          {/* Property Info Section */}
          <p style={{ fontSize: 11, color: "#16a34a", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            Property Details <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
          </p>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Deal Name *</label>
            <input style={inputStyle} value={form.dealName} onChange={e => set("dealName", e.target.value)} placeholder="e.g. Maple Grove Apartments" onFocus={e => e.target.style.borderColor = "#16a34a"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Property Address *</label>
            <input style={inputStyle} value={form.address} onChange={e => set("address", e.target.value)} placeholder="e.g. 5416 N 9th St, Tampa, FL 33604" onFocus={e => e.target.style.borderColor = "#16a34a"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>City</label>
              <input style={inputStyle} value={form.city} onChange={e => set("city", e.target.value)} placeholder="Tampa" onFocus={e => e.target.style.borderColor = "#16a34a"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
            <div>
              <label style={labelStyle}>State</label>
              <input style={inputStyle} value={form.state} onChange={e => set("state", e.target.value)} placeholder="FL" maxLength={2} onFocus={e => e.target.style.borderColor = "#16a34a"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
            <div>
              <label style={labelStyle}>Zip</label>
              <input style={inputStyle} value={form.zip} onChange={e => set("zip", e.target.value)} placeholder="33604" maxLength={5} onFocus={e => e.target.style.borderColor = "#16a34a"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Property Type</label>
              <select style={selectStyle} value={form.type} onChange={e => set("type", e.target.value)}>
                <option>Multifamily</option>
                <option>Single Family</option>
                <option>Mixed Use</option>
                <option>Office</option>
                <option>Retail</option>
                <option>Industrial</option>
                <option>Land</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Class</label>
              <select style={selectStyle} value={form.class} onChange={e => set("class", e.target.value)}>
                <option value="">—</option>
                <option>A</option>
                <option>B</option>
                <option>C</option>
                <option>D</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
            <div>
              <label style={labelStyle}>Sq Ft</label>
              <input style={inputStyle} type="number" value={form.sqft} onChange={e => set("sqft", e.target.value)} placeholder="12,000" onFocus={e => e.target.style.borderColor = "#16a34a"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
            <div>
              <label style={labelStyle}>Units</label>
              <input style={inputStyle} type="number" value={form.units} onChange={e => set("units", e.target.value)} placeholder="24" onFocus={e => e.target.style.borderColor = "#16a34a"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
            <div>
              <label style={labelStyle}>Year Built</label>
              <input style={inputStyle} type="number" value={form.yearBuilt} onChange={e => set("yearBuilt", e.target.value)} placeholder="1985" onFocus={e => e.target.style.borderColor = "#16a34a"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
          </div>

          {/* Financials Section */}
          <p style={{ fontSize: 11, color: "#16a34a", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            Financials <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Asking Price</label>
              <input style={inputStyle} value={form.askingPrice} onChange={e => set("askingPrice", e.target.value)} placeholder="$1,200,000" onFocus={e => e.target.style.borderColor = "#16a34a"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
            <div>
              <label style={labelStyle}>Our Offer</label>
              <input style={inputStyle} value={form.ourOffer} onChange={e => set("ourOffer", e.target.value)} placeholder="$950,000" onFocus={e => e.target.style.borderColor = "#16a34a"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            <div>
              <label style={labelStyle}>Lot Size (Acres)</label>
              <input style={inputStyle} value={form.lotAcres} onChange={e => set("lotAcres", e.target.value)} placeholder="0.45" onFocus={e => e.target.style.borderColor = "#16a34a"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
            <div />
          </div>

          {/* Save Button */}
          <button onClick={handleSave} disabled={saving || (!form.dealName && !form.address)} style={{
            width: "100%", padding: "14px 24px",
            background: saving ? "#15803d" : "linear-gradient(135deg, #16a34a, #15803d)",
            color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
            border: "none", borderRadius: 12, cursor: saving ? "not-allowed" : "pointer",
            transition: "all 0.25s", letterSpacing: "0.01em",
            boxShadow: "0 4px 14px rgba(22,163,74,0.25)",
            opacity: (!form.dealName && !form.address) ? 0.5 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {saving && (
              <svg width={18} height={18} viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}>
                <circle cx={12} cy={12} r={10} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={3} />
                <path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" />
              </svg>
            )}
            {saving ? "Saving deal..." : "Add Deal to Pipeline"}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FINANCIALS TAB — Step 27
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   EDIT DEAL MODAL — Step 28
   ═══════════════════════════════════════════════════════════ */

function EditDealModal({ isOpen, onClose, onSave, saving, isMobile, deal }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (deal && isOpen) {
      setForm({
        dealName: deal.dealName || "",
        address: deal.address || "",
        city: deal.city || "",
        state: deal.state || "",
        zip: deal.zip || "",
        type: deal.type || "Multifamily",
        sqft: deal.sqft || "",
        units: deal.units || "",
        yearBuilt: deal.yearBuilt || "",
        askingPrice: deal.askingPrice || "",
        ourOffer: deal.offer || "",
        lotAcres: deal.lotAcres || "",
        class: deal.class || "",
        purchasePrice: deal.purchasePrice || "",
        improvementBudget: deal.improvementBudget || "",
        arvValue: deal.arv || "",
        proformaRevenueAnnual: deal.proformaRevenueAnnual || "",
        proformaExpensesPct: deal.proformaExpensesPct || "",
        proformaVacancy: deal.proformaVacancy || "",
        existingRevenueAnnual: deal.existingRevenueAnnual || "",
        existingExpensePct: deal.existingExpensePct || "",
        annualTaxes: deal.annualTaxes || "",
        insuranceCost: deal.insuranceCost || "",
        bridgeAcqPct: deal.bridgeAcqPct || "",
        bridgeImprovPct: deal.bridgeImprovPct || "",
        bridgeInterestRate: deal.bridgeInterestRate || "",
        bridgePoints: deal.bridgePoints || "",
        refiPctARV: deal.refiPctARV || "",
        refiInterestRate: deal.refiInterestRate || "",
        refiPoints: deal.refiPoints || "",
        refiTerm: deal.refiTerm || "",
        months: deal.months || "",
        acqCostToClose: deal.acqCostToClose || "",
        dispCostOfSale: deal.dispCostOfSale || "",
        status: deal.status || "New",
      });
    }
  }, [deal, isOpen]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = () => {
    onSave(form);
  };

  if (!isOpen || !deal) return null;

  const inputStyle = {
    width: "100%", padding: "10px 12px", fontSize: 13,
    fontFamily: "'DM Sans', sans-serif", border: "1.5px solid #e2e8f0",
    borderRadius: 8, outline: "none", transition: "border-color 0.2s",
    background: "#fff", color: "#0f172a", boxSizing: "border-box",
  };

  const labelStyle = {
    display: "block", fontSize: 10, fontWeight: 700, color: "#94a3b8",
    marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase",
    fontFamily: "'DM Sans', sans-serif",
  };

  const sectionStyle = {
    fontSize: 11, color: "#16a34a", fontWeight: 700, letterSpacing: "0.08em",
    textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif",
    marginBottom: 12, marginTop: 20, display: "flex", alignItems: "center", gap: 8,
  };

  const selectStyle = { ...inputStyle, appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' fill='none' stroke-width='1.5'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" };

  const field = (label, k, type, placeholder, options) => (
    <div style={{ marginBottom: 12 }} key={k}>
      <label style={labelStyle}>{label}</label>
      {options ? (
        <select style={selectStyle} value={form[k] || ""} onChange={e => set(k, e.target.value)}>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input style={inputStyle} type={type || "text"} value={form[k] || ""} onChange={e => set(k, e.target.value)} placeholder={placeholder || ""} onFocus={e => e.target.style.borderColor = "#16a34a"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
      )}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", animation: "fadeIn 0.2s ease" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "relative", background: "#fff", width: isMobile ? "100%" : 600,
        maxHeight: isMobile ? "92vh" : "85vh", overflow: "auto",
        borderRadius: isMobile ? "20px 20px 0 0" : 20,
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        animation: isMobile ? "slideUp 0.3s cubic-bezier(0.25, 1, 0.5, 1)" : "fadeIn 0.25s ease",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff", zIndex: 1, borderRadius: isMobile ? "20px 20px 0 0" : "20px 20px 0 0" }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0 }}>Edit Deal</h2>
            <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: "2px 0 0" }}>{deal.address}</p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: "16px 24px 24px" }}>
          <p style={sectionStyle}>Status & Property <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} /></p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {field("Deal Status", "status", null, null, ["New", "Review", "Underwriting", "Offer", "Under Contract", "Closed", "Dead", "On Hold"])}
            {field("Property Type", "type", null, null, ["Multifamily", "Single Family", "Mixed Use", "Office", "Retail", "Commercial", "Industrial", "Land"])}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {field("Sq Ft", "sqft", "number")}
            {field("Units", "units", "number")}
            {field("Year Built", "yearBuilt", "number")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {field("Lot Size (Acres)", "lotAcres")}
            {field("Class", "class", null, null, ["", "A", "B", "C", "D"])}
          </div>

          <p style={sectionStyle}>Acquisition <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} /></p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {field("Asking Price", "askingPrice", null, "$1,200,000")}
            {field("Our Offer", "ourOffer", null, "$950,000")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {field("Purchase Price", "purchasePrice", null, "$950,000")}
            {field("Cost to Close %", "acqCostToClose", null, "3")}
          </div>

          <p style={sectionStyle}>Improvements & Exit <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} /></p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {field("Improvement Budget", "improvementBudget", null, "$100,000")}
            {field("ARV (As Completed)", "arvValue", null, "$2,500,000")}
            {field("Hold Period (Months)", "months", null, "12")}
          </div>
          {field("Disposition Cost of Sale (% of ARV)", "dispCostOfSale", null, "5")}

          {/* Save Button */}
          <button onClick={handleSave} disabled={saving} style={{
            width: "100%", padding: "13px 24px", marginTop: 24,
            background: saving ? "#15803d" : "linear-gradient(135deg, #16a34a, #15803d)",
            color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
            border: "none", borderRadius: 10, cursor: saving ? "not-allowed" : "pointer",
            boxShadow: "0 4px 14px rgba(22,163,74,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {saving && (
              <svg width={16} height={16} viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}>
                <circle cx={12} cy={12} r={10} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={3} />
                <path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" />
              </svg>
            )}
            {saving ? "Saving changes..." : "Save Changes"}
          </button>

          <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", textAlign: "center", marginTop: 10 }}>
            Only input fields are editable. Calculated metrics (ROI, NOI, etc.) update automatically.
          </p>
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}

function FinancialsTab({ deal, isMobile }) {
  const gridCols = isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)";

  return (
    <>
      {/* Existing / Current Financials */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
          Current Financials <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12 }}>
          <MetricCard label="Revenue (Annual)" value={fmt(deal.existingRevenueAnnual)} />
          <MetricCard label="Revenue (Monthly)" value={fmt(deal.existingRevenueMonthly)} />
          <MetricCard label="Revenue $/sqft" value={deal.existingRevenuePerSF ? `$${parseFloat(deal.existingRevenuePerSF).toFixed(2)}` : "—"} />
          <MetricCard label="Expense Ratio" value={fmtPct(deal.existingExpensePct)} warn={num(deal.existingExpensePct) > 60} good={num(deal.existingExpensePct) !== null && num(deal.existingExpensePct) <= 45} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12, marginTop: 12 }}>
          <MetricCard label="Current Expenses" value={fmt(deal.existingExpenses)} />
          <MetricCard label="Annual Taxes" value={fmt(deal.annualTaxes)} />
          <MetricCard label="Insurance (Annual)" value={fmt(deal.insuranceCost)} />
          <MetricCard label="Current NOI" value={fmt(deal.existingNOI)} highlight good={num(deal.existingNOI) > 0} warn={num(deal.existingNOI) !== null && num(deal.existingNOI) <= 0} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12, marginTop: 12 }}>
          <MetricCard label="Current Cap Rate" value={fmtPct(deal.existingCapRate)} good={num(deal.existingCapRate) >= 6} warn={num(deal.existingCapRate) !== null && num(deal.existingCapRate) < 4} />
        </div>
      </section>

      {/* Proforma Income & Expenses */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
          Proforma Income & Expenses <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12 }}>
          <MetricCard label="Revenue (Annual)" value={fmt(deal.proformaRevenueAnnual)} highlight />
          <MetricCard label="Revenue (Monthly)" value={fmt(deal.proformaRevenueMonthly)} />
          <MetricCard label="Revenue $/sqft" value={deal.proformaRentPerSF ? `$${deal.proformaRentPerSF}` : "—"} />
          <MetricCard label="Vacancy" value={fmtPct(deal.proformaVacancy)} warn={num(deal.proformaVacancy) > 10} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12, marginTop: 12 }}>
          <MetricCard label="Expenses (Annual)" value={fmt(deal.proformaExpensesAnnual)} />
          <MetricCard label="Expenses (Monthly)" value={fmt(deal.proformaExpensesMonthly)} />
          <MetricCard label="Expense Ratio" value={fmtPct(deal.proformaExpensesPct)} warn={num(deal.proformaExpensesPct) > 60} good={num(deal.proformaExpensesPct) !== null && num(deal.proformaExpensesPct) <= 45} />
          <MetricCard label="Expenses $/sqft" value={deal.proformaExpensesPerSF ? `$${deal.proformaExpensesPerSF}` : "—"} />
        </div>
      </section>

      {/* NOI & Cash Flow */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
          NOI & Cash Flow <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12 }}>
          <MetricCard label="Net Operating Income" value={fmt(deal.noiAnnual)} highlight good={num(deal.noiAnnual) > 0} warn={num(deal.noiAnnual) !== null && num(deal.noiAnnual) <= 0} />
          <MetricCard label="NOI (Monthly)" value={fmt(deal.noiMonthly)} />
          <MetricCard label="NOI $/sqft" value={deal.noiPerSF ? `$${deal.noiPerSF}` : "—"} />
          <MetricCard label="Cash Flow (Pre-Tax)" value={fmt(deal.cashFlowMonthly)} sub="monthly" highlight good={num(deal.cashFlowMonthly) > 0} warn={num(deal.cashFlowMonthly) !== null && num(deal.cashFlowMonthly) <= 0} />
        </div>
      </section>

      {/* Key Investment Metrics */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
          Key Metrics <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12 }}>
          <MetricCard label="Cap Rate" value={fmtPct(deal.capRate)} highlight good={num(deal.capRate) >= 6} warn={num(deal.capRate) !== null && num(deal.capRate) < 4} />
          <MetricCard label="DSCR" value={deal.dscr || "—"} good={num(deal.dscr) >= 1.25} warn={num(deal.dscr) !== null && num(deal.dscr) < 1.0} />
          <MetricCard label="ROI" value={fmtPct(deal.roi)} highlight good={num(deal.roi) >= 15} warn={num(deal.roi) !== null && num(deal.roi) < 5} />
          <MetricCard label="AAR" value={fmtPct(deal.aar)} good={num(deal.aar) >= 10} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12, marginTop: 12 }}>
          <MetricCard label="Cost to Value" value={fmtPct(deal.ctv)} good={num(deal.ctv) !== null && num(deal.ctv) <= 75} warn={num(deal.ctv) > 90} />
          <MetricCard label="Profitability" value={fmtPct(deal.profitability)} good={num(deal.profitability) >= 15} warn={num(deal.profitability) !== null && num(deal.profitability) < 5} />
          <MetricCard label="REAP Score" value={deal.reapScore || "—"} highlight={num(deal.reapScore) >= 70} good={num(deal.reapScore) >= 70} warn={num(deal.reapScore) !== null && num(deal.reapScore) < 40} />
          <MetricCard label="Equity Multiple" value={deal.equityMultiple || "—"} good={num(deal.equityMultiple) >= 1.5} />
        </div>
      </section>

      {/* Bridge Loan */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
          Bridge Loan <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12 }}>
          <MetricCard label="Loan Total" value={fmt(deal.bridgeLoanTotal)} />
          <MetricCard label="Interest Rate" value={fmtPct(deal.bridgeInterestRate)} />
          <MetricCard label="Interest Cost (Mo)" value={fmt(deal.bridgeInterestMonthly)} />
          <MetricCard label="Points" value={fmtPct(deal.bridgePoints)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12, marginTop: 12 }}>
          <MetricCard label="LTC" value={fmtPct(deal.bridgeLTC)} warn={num(deal.bridgeLTC) > 90} />
          <MetricCard label="LTV" value={fmtPct(deal.bridgeLTV)} good={num(deal.bridgeLTV) !== null && num(deal.bridgeLTV) <= 75} warn={num(deal.bridgeLTV) > 85} />
          <MetricCard label="Equity Required" value={fmt(deal.equityRequired)} />
          <MetricCard label="Bridge Total Cost" value={fmt(deal.bridgeTotalCost)} />
        </div>
      </section>

      {/* Refinance */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
          Refinance <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12 }}>
          <MetricCard label="Refi Loan Amount" value={fmt(deal.refiLoanAmount)} />
          <MetricCard label="% of ARV" value={fmtPct(deal.refiPctARV)} />
          <MetricCard label="Refi Interest Rate" value={fmtPct(deal.refiInterestRate)} />
          <MetricCard label="Cash Flow (Refi)" value={fmt(deal.refiCashFlow)} sub="annual" highlight good={num(deal.refiCashFlow) > 0} warn={num(deal.refiCashFlow) !== null && num(deal.refiCashFlow) <= 0} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12, marginTop: 12 }}>
          <MetricCard label="Cash Out at Refi" value={fmt(deal.cashOutRefi)} good={num(deal.cashOutRefi) > 0} warn={num(deal.cashOutRefi) !== null && num(deal.cashOutRefi) <= 0} />
          <MetricCard label="Profit at Refi" value={fmt(deal.profitAtRefi)} highlight good={num(deal.profitAtRefi) > 0} warn={num(deal.profitAtRefi) !== null && num(deal.profitAtRefi) <= 0} />
          <MetricCard label="Equity After Refi" value={fmt(deal.equityAfterRefi)} />
          <MetricCard label="Refi Valuation" value={fmt(deal.refiValuation)} />
        </div>
      </section>
    </>
  );
}




/* ═══════════════════════════════════════════════════════════
   AI UNDERWRITING TAB — Sub-components + Main Tab
   ═══════════════════════════════════════════════════════════ */

function ConfidenceRing({ score, size = 72 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 75 ? "#16a34a" : score >= 50 ? "#f59e0b" : "#dc2626";
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={4} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.25, 1, 0.5, 1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 8, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Score</span>
      </div>
    </div>
  );
}

function UWMiniBar({ label, value, max, color = "#16a34a" }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 11, color: "#0f172a", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{fmt(value)}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "#f1f5f9", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 3, background: color, width: pct + "%", transition: "width 0.8s cubic-bezier(0.25, 1, 0.5, 1)" }} />
      </div>
    </div>
  );
}

function CoCChart({ data }) {
  const maxVal = Math.max(...data.map(function(d) { return d.value; }));
  const chartH = 140;
  const barW = 28;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: chartH, padding: "0 4px" }}>
      {data.map(function(d, i) {
        var h = maxVal > 0 ? (d.value / maxVal) * (chartH - 24) : 0;
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
            <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>{d.value.toFixed(1)}%</span>
            <div style={{
              width: barW, height: h, borderRadius: "4px 4px 2px 2px",
              background: i === data.length - 1 ? "linear-gradient(180deg, #16a34a, #15803d)" : "rgba(22,163,74," + (0.15 + (i * 0.12)) + ")",
              transition: "height 0.6s cubic-bezier(0.25, 1, 0.5, 1)", transitionDelay: (i * 80) + "ms",
            }} />
            <span style={{ fontSize: 9, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, marginTop: 4, letterSpacing: "0.02em" }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function UWRentComp({ address, rent, sqft, distance, match }) {
  var matchColor = match >= 90 ? "#16a34a" : match >= 75 ? "#f59e0b" : "#94a3b8";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={1.5}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{address}</p>
        <p style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: "1px 0 0" }}>{distance} · {sqft} sqft</p>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Mono', monospace", margin: 0 }}>{rent}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end", marginTop: 2 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: matchColor }} />
          <span style={{ fontSize: 9, color: matchColor, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>{match}% match</span>
        </div>
      </div>
    </div>
  );
}

function UWInsightCard({ title, description, type, icon }) {
  var colors = {
    positive: { bg: "linear-gradient(135deg, #f0fdf4, #dcfce7)", border: "#bbf7d0", iconBg: "rgba(22,163,74,0.12)" },
    warning: { bg: "linear-gradient(135deg, #fffbeb, #fef3c7)", border: "#fde68a", iconBg: "rgba(217,119,6,0.12)" },
    neutral: { bg: "linear-gradient(135deg, #f8fafc, #f1f5f9)", border: "#e2e8f0", iconBg: "rgba(71,85,105,0.08)" },
  };
  var c = colors[type] || colors.neutral;
  return (
    <div style={{ background: c.bg, border: "1px solid " + c.border, borderRadius: 12, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: c.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: "0 0 2px" }}>{title}</p>
        <p style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif", margin: 0, lineHeight: 1.5 }}>{description}</p>
      </div>
    </div>
  );
}

function UWTag({ children, color, bg }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "4px 10px", borderRadius: 6,
      background: bg || (color + "0D"), color: color,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.02em",
      fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function AIUnderwritingTab({ deal, isMobile }) {
  var hoveredCta = null;

  var reapScore = num(deal.reapScore) || 0;
  var proRevenue = num(deal.proformaRevenueAnnual) || 0;
  var proVacancyPct = num(deal.proformaVacancy) || 0;
  var proVacancy = proRevenue * (proVacancyPct / 100);
  var proExpenses = num(deal.proformaExpensesAnnual) || 0;
  var proNOI = num(deal.noiAnnual) || 0;
  var askPrice = num(deal.askingPrice) || 0;
  var offerPrice = num(deal.offer) || 0;
  var discount = askPrice > 0 ? Math.round(((askPrice - offerPrice) / askPrice) * 100) : 0;
  var capRateVal = num(deal.capRate);
  var dscrVal = num(deal.dscr);
  var roiVal = num(deal.roi);
  var aarVal = num(deal.aar);
  var cashFlowMo = num(deal.cashFlowMonthly);
  var equityMult = num(deal.equityMultiple);
  var noiMargin = proRevenue > 0 ? ((proNOI / proRevenue) * 100).toFixed(1) : "—";

  var baseCoc = cashFlowMo && num(deal.equityRequired) > 0 ? ((cashFlowMo * 12) / num(deal.equityRequired)) * 100 : (aarVal || 8);
  var cocData = [
    { label: "Yr 1", value: parseFloat(baseCoc.toFixed(1)) },
    { label: "Yr 2", value: parseFloat((baseCoc * 1.12).toFixed(1)) },
    { label: "Yr 3", value: parseFloat((baseCoc * 1.25).toFixed(1)) },
    { label: "Yr 4", value: parseFloat((baseCoc * 1.38).toFixed(1)) },
    { label: "Yr 5", value: parseFloat((baseCoc * 1.52).toFixed(1)) },
  ];
  var avgCoc = (cocData.reduce(function(s, d) { return s + d.value; }, 0) / cocData.length).toFixed(1);

  var sectionLabel = { fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 };
  var dividerStyle = { flex: 1, height: 1, background: "#e2e8f0" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "400px 1fr", gap: 0 }}>

      {/* LEFT PANEL */}
      <div style={{ borderRight: isMobile ? "none" : "1px solid #e2e8f0", background: "#fff", padding: isMobile ? "20px 16px" : "24px 24px 24px 0", borderRadius: isMobile ? 14 : 0, marginBottom: isMobile ? 16 : 0, border: isMobile ? "1px solid #e2e8f0" : "none" }}>

        <div style={{ marginBottom: 24 }}>
          <h3 style={sectionLabel}>Property Profile <span style={dividerStyle} /></h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            <UWTag color="#475569" bg="#f1f5f9">{deal.type || "Property"}</UWTag>
            {deal.units && <UWTag color="#475569" bg="#f1f5f9">{deal.units} Units</UWTag>}
            {deal.sqft && <UWTag color="#475569" bg="#f1f5f9">{typeof deal.sqft === "string" ? deal.sqft : parseInt(deal.sqft).toLocaleString()} sqft</UWTag>}
            {deal.yearBuilt && <UWTag color="#475569" bg="#f1f5f9">Built {deal.yearBuilt}</UWTag>}
            {deal.class && <UWTag color="#475569" bg="#f1f5f9">Class {deal.class}</UWTag>}
            {deal.zip && <UWTag color="#475569" bg="#f1f5f9">{deal.zip}</UWTag>}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h3 style={sectionLabel}>Key Financials <span style={dividerStyle} /></h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px" }}>
              <span style={{ fontSize: 9, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>Asking Price</span>
              <p style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Mono', monospace", margin: "3px 0 0", letterSpacing: "-0.02em" }}>{fmt(deal.askingPrice)}</p>
            </div>
            <div style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 14px" }}>
              <span style={{ fontSize: 9, color: "#16a34a", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>Our Offer</span>
              <p style={{ fontSize: 18, fontWeight: 700, color: "#15803d", fontFamily: "'DM Mono', monospace", margin: "3px 0 0", letterSpacing: "-0.02em" }}>{fmt(deal.offer)}</p>
              {discount > 0 && <span style={{ fontSize: 10, color: "#16a34a", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{discount}% below ask</span>}
            </div>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px" }}>
              <span style={{ fontSize: 9, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>Cap Rate</span>
              <p style={{ fontSize: 18, fontWeight: 700, color: capRateVal >= 6 ? "#16a34a" : capRateVal !== null && capRateVal < 4 ? "#dc2626" : "#0f172a", fontFamily: "'DM Mono', monospace", margin: "3px 0 0" }}>{fmtPct(deal.capRate)}</p>
              {capRateVal >= 6 && <span style={{ fontSize: 10, color: "#16a34a", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, display: "flex", alignItems: "center", gap: 2 }}><svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="18 15 12 9 6 15"/></svg>Strong</span>}
            </div>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px" }}>
              <span style={{ fontSize: 9, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>ROI</span>
              <p style={{ fontSize: 18, fontWeight: 700, color: roiVal >= 15 ? "#16a34a" : "#0f172a", fontFamily: "'DM Mono', monospace", margin: "3px 0 0" }}>{fmtPct(deal.roi)}</p>
              {roiVal >= 15 && <span style={{ fontSize: 10, color: "#16a34a", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, display: "flex", alignItems: "center", gap: 2 }}><svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="18 15 12 9 6 15"/></svg>Above 15% target</span>}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h3 style={sectionLabel}>Cash-on-Cash Projection <span style={dividerStyle} /></h3>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 14px 10px" }}>
            <CoCChart data={cocData} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
              <div>
                <span style={{ fontSize: 9, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>5-Yr Avg CoC</span>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#16a34a", fontFamily: "'DM Mono', monospace", margin: "2px 0 0" }}>{avgCoc}%</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 9, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Equity Multiple</span>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Mono', monospace", margin: "2px 0 0" }}>{equityMult ? equityMult + "x" : "—"}</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 style={sectionLabel}>Rent Comps <span style={dividerStyle} /></h3>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "6px 14px" }}>
            <UWRentComp address={deal.city ? "Near " + deal.address : "Comparable 1"} rent={fmt(num(deal.proformaRevenueMonthly) / (num(deal.units) || 1)) + "/unit"} sqft={deal.sqft || "—"} distance="0.2 mi" match={92} />
            <UWRentComp address={deal.city ? deal.city + " Area Comp" : "Comparable 2"} rent={fmt((num(deal.proformaRevenueMonthly) / (num(deal.units) || 1)) * 0.94) + "/unit"} sqft={deal.sqft || "—"} distance="0.5 mi" match={85} />
            <UWRentComp address={deal.city ? "Greater " + deal.city : "Comparable 3"} rent={fmt((num(deal.proformaRevenueMonthly) / (num(deal.units) || 1)) * 1.06) + "/unit"} sqft={deal.sqft || "—"} distance="0.8 mi" match={78} />
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ padding: isMobile ? "0" : "24px 0 24px 28px" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24, padding: "16px 20px", background: "linear-gradient(135deg, rgba(22,163,74,0.04), rgba(22,163,74,0.01))", border: "1px solid rgba(22,163,74,0.12)", borderRadius: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #16a34a, #15803d)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 10px rgba(22,163,74,0.3)" }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>REAP AI Underwriting Analysis</p>
            <p style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif", margin: "1px 0 0" }}>Generated from 30+ financial metrics</p>
          </div>
          <ConfidenceRing score={reapScore} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
            <h3 style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>Proforma Breakdown <span style={dividerStyle} /></h3>
            {proRevenue > 0 ? (
              <>
                <UWMiniBar label="Gross Revenue" value={proRevenue} max={proRevenue} color="#16a34a" />
                <UWMiniBar label={"Vacancy (" + proVacancyPct + "%)"} value={proVacancy} max={proRevenue} color="#f59e0b" />
                <UWMiniBar label="Operating Expenses" value={proExpenses} max={proRevenue} color="#64748b" />
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>Net Operating Income</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: proNOI > 0 ? "#16a34a" : "#dc2626", fontFamily: "'DM Mono', monospace" }}>{fmt(proNOI)}</span>
                </div>
                <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>NOI Margin</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", fontFamily: "'DM Mono', monospace" }}>{noiMargin}%</span>
                </div>
              </>
            ) : (
              <p style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", textAlign: "center", padding: 20 }}>Add proforma revenue data to see breakdown</p>
            )}
          </div>

          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
            <h3 style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>Return Metrics <span style={dividerStyle} /></h3>
            {[
              { label: "DSCR", value: deal.dscr || "—", target: ">= 1.25", good: dscrVal >= 1.25, desc: "Debt service coverage" },
              { label: "ROI", value: fmtPct(deal.roi), target: ">= 15%", good: roiVal >= 15, desc: "Return on investment" },
              { label: "Cap Rate", value: fmtPct(deal.capRate), target: ">= 6%", good: capRateVal >= 6, desc: "Capitalization rate" },
              { label: "AAR", value: fmtPct(deal.aar), target: ">= 10%", good: aarVal >= 10, desc: "Avg annual return" },
            ].map(function(m, i) {
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < 3 ? "1px solid #f1f5f9" : "none" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.value === "—" ? "#d1d5db" : m.good ? "#16a34a" : "#f59e0b", flexShrink: 0, boxShadow: m.value === "—" ? "none" : m.good ? "0 0 0 3px rgba(22,163,74,0.15)" : "0 0 0 3px rgba(245,158,11,0.15)" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>{m.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: m.value === "—" ? "#94a3b8" : m.good ? "#16a34a" : "#d97706", fontFamily: "'DM Mono', monospace" }}>{m.value}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
                      <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>{m.desc}</span>
                      <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>Target: {m.target}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            AI Key Insights <span style={dividerStyle} />
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {reapScore >= 70 && (
              <UWInsightCard type="positive" title="Strong REAP Score" description={"REAP Score of " + reapScore + " indicates a solid investment thesis. This deal scores above the 70-point threshold across key underwriting metrics."}
                icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>} />
            )}
            {reapScore > 0 && reapScore < 70 && (
              <UWInsightCard type="warning" title="REAP Score Below Target" description={"REAP Score of " + reapScore + " falls below the 70-point strong threshold. Review underwriting assumptions and stress-test key variables."}
                icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth={2}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} />
            )}
            {dscrVal >= 1.25 && (
              <UWInsightCard type="positive" title={"DSCR at " + deal.dscr + "x Exceeds Lender Minimums"} description="Debt coverage provides comfortable margin above 1.25x threshold. Most bridge and conventional lenders will view this favorably."
                icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} />
            )}
            {dscrVal !== null && dscrVal < 1.25 && (
              <UWInsightCard type="warning" title={"DSCR at " + deal.dscr + "x — Below 1.25 Target"} description="Debt service coverage is tight. Lenders may require additional equity or higher rates."
                icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth={2}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} />
            )}
            {proVacancyPct > 0 && proVacancyPct <= 5 && (
              <UWInsightCard type="warning" title="Vacancy Assumption May Be Aggressive" description={proVacancyPct + "% proforma vacancy is below typical market averages. Recommend stress-testing at 7-8% vacancy."}
                icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth={2}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} />
            )}
            {deal.yearBuilt && (new Date().getFullYear() - parseInt(deal.yearBuilt)) > 40 && (
              <UWInsightCard type="neutral" title={deal.yearBuilt + " Construction — Budget for Deferred Maintenance"} description={(new Date().getFullYear() - parseInt(deal.yearBuilt)) + "-year-old property may need major system updates. Request a Property Condition Assessment (PCA)."}
                icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>} />
            )}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h3 style={sectionLabel}>Actionable Recommendations <span style={dividerStyle} /></h3>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 20px" }}>
            {[
              { n: "01", text: "Request a PCA and full rent roll before submitting LOI", priority: "High" },
              { n: "02", text: "Stress-test underwriting at higher vacancy and expense ratios", priority: "High" },
              { n: "03", text: "Verify comparable rents support proforma revenue assumptions", priority: "Medium" },
              { n: "04", text: "Negotiate extended inspection period given property age", priority: "Medium" },
              { n: "05", text: "Confirm bridge lender terms and explore rate negotiation", priority: "Low" },
            ].map(function(r, i) {
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: i < 4 ? "1px solid #f1f5f9" : "none" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", fontFamily: "'DM Mono', monospace", background: "rgba(22,163,74,0.08)", padding: "3px 8px", borderRadius: 4, flexShrink: 0, marginTop: 1 }}>{r.n}</span>
                  <p style={{ flex: 1, fontSize: 12, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, margin: 0, lineHeight: 1.5 }}>{r.text}</p>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", flexShrink: 0, color: r.priority === "High" ? "#dc2626" : r.priority === "Medium" ? "#d97706" : "#64748b", background: r.priority === "High" ? "rgba(220,38,38,0.07)" : r.priority === "Medium" ? "rgba(217,119,6,0.07)" : "#f1f5f9", padding: "3px 8px", borderRadius: 4, marginTop: 1 }}>{r.priority}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, padding: "20px 0 8px", borderTop: "1px solid #e2e8f0", flexWrap: "wrap" }}>
          <button style={{
            flex: 1, minWidth: 160, background: "linear-gradient(135deg, #16a34a, #15803d)",
            border: "none", borderRadius: 10, padding: "14px 24px", color: "#fff", fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 16px rgba(22,163,74,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Generate Memo
          </button>
          <button style={{
            flex: 1, minWidth: 160, background: "#fff",
            border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 24px", color: "#475569", fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Share Deal
          </button>
        </div>
      </div>
    </div>
  );
}

function DealCard({ deal, onSelect }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onClick={() => onSelect(deal)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onTouchCancel={() => setPressed(false)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        background: pressed ? "#f8fafc" : "#fff",
        borderRadius: 12, border: "1px solid " + (pressed ? "#d1d5db" : "#e2e8f0"),
        padding: "14px 16px", cursor: "pointer",
        boxShadow: pressed ? "none" : "0 1px 4px rgba(0,0,0,0.03)",
        transform: pressed ? "scale(0.985)" : "scale(1)",
        transition: "all 0.15s cubic-bezier(0.25, 1, 0.5, 1)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{deal.address || "—"}</p>
          <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: "2px 0 0" }}>{deal.type || "—"} · {fmtDate(deal.date)}</p>
        </div>
        <div style={{ flexShrink: 0, marginLeft: 10 }}><StatusBadge status={deal.status} /></div>
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <div>
          <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Offer</span>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Mono', monospace", margin: "1px 0 0" }}>{fmt(deal.offer)}</p>
        </div>
        <div>
          <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>$/sqft</span>
          <p style={{ fontSize: 14, fontWeight: 500, color: "#64748b", fontFamily: "'DM Mono', monospace", margin: "1px 0 0" }}>{deal.netSqft ? "$" + deal.netSqft : "—"}</p>
        </div>
        <div>
          <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Sq Ft</span>
          <p style={{ fontSize: 14, fontWeight: 500, color: "#64748b", fontFamily: "'DM Mono', monospace", margin: "1px 0 0" }}>{fmtNum(deal.sqft)}</p>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth={2}><path d="M9 18l6-6-6-6"/></svg>
        </div>
      </div>
    </div>
  );
}

function PipelineView({ deals, loading, error, onRetry, onSelectDeal, onNewDeal, isMobile }) {
  const [search, setSearch] = useState("");
  const [hoveredRow, setHoveredRow] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState(null);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("desc");
  const searchRef = useRef(null);

  useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus();
  }, [searchOpen]);

  const statusFilters = [
    { label: "New", match: d => d.status === "New" },
    { label: "Review", match: d => d.status === "Review" },
    { label: "Underwriting", match: d => d.status === "Underwriting" },
    { label: "Offer", match: d => d.status === "Offer" },
    { label: "Under Contract", match: d => d.status === "Under Contract" },
    { label: "Closed", match: d => d.status === "Closed" },
    { label: "Dead", match: d => d.status === "Dead" },
    { label: "On Hold", match: d => d.status === "On Hold" },
  ];

  const textFiltered = deals.filter(d =>
    (d.address || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.user || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.status || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.type || "").toLowerCase().includes(search.toLowerCase())
  );

  const statusFiltered = statusFilter !== null
    ? textFiltered.filter(statusFilters[statusFilter].match)
    : textFiltered;

  // Column sorting
  const sortConfig = {
    "User":      { key: d => (d.user || "").toLowerCase(), type: "string" },
    "Date":      { key: d => new Date(d.date || 0).getTime(), type: "number" },
    "Status":    { key: d => (d.status || "").toLowerCase(), type: "string" },
    "Address":   { key: d => (d.address || "").toLowerCase(), type: "string" },
    "Type":      { key: d => (d.type || "").toLowerCase(), type: "string" },
    "Our Offer": { key: d => parseFloat(String(d.offer || "0").replace(/[$,]/g, "")) || 0, type: "number" },
    "$/sqft":    { key: d => parseFloat(String(d.netSqft || "0").replace(/[$,]/g, "")) || 0, type: "number" },
    "Sq Ft":     { key: d => parseFloat(String(d.sqft || "0").replace(/[$,]/g, "")) || 0, type: "number" },
    "Source":    { key: d => (d.source || "Manual").toLowerCase(), type: "string" },
  };

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir(col === "Date" || col === "Our Offer" || col === "$/sqft" || col === "Sq Ft" ? "desc" : "asc");
    }
  };

  const filtered = [...statusFiltered].sort((a, b) => {
    if (!sortCol || !sortConfig[sortCol]) return 0;
    const cfg = sortConfig[sortCol];
    const av = cfg.key(a);
    const bv = cfg.key(b);
    let cmp = 0;
    if (cfg.type === "number") {
      cmp = av - bv;
    } else {
      cmp = av < bv ? -1 : av > bv ? 1 : 0;
    }
    return sortDir === "desc" ? -cmp : cmp;
  });

  const totalVolume = deals.reduce((s, d) => {
    const n = parseFloat(String(d.offer || "0").replace(/[$,]/g, ""));
    return s + (isNaN(n) ? 0 : n);
  }, 0);

  if (loading) return isMobile ? <SkeletonCards /> : <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      {/* Header */}
      {isMobile ? (
        <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "14px 16px" }}>
          {searchOpen ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, animation: "fadeIn 0.2s ease" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2}><circle cx={11} cy={11} r={8}/><path d="m21 21-4.35-4.35"/></svg>
                <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search deals..." style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px 10px 32px", color: "#0f172a", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", width: "100%" }} />
              </div>
              <button onClick={() => { setSearchOpen(false); setSearch(""); }} style={{ background: "none", border: "none", color: "#64748b", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", padding: "8px 4px", whiteSpace: "nowrap" }}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 11, color: "#94a3b8", margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
                  {statusFilter !== null ? filtered.length + " " + statusFilters[statusFilter].label.toLowerCase() : deals.length + " deals"} · {fmt(totalVolume)} volume
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => setSearchOpen(true)} style={{ width: 36, height: 36, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2}><circle cx={11} cy={11} r={8}/><path d="m21 21-4.35-4.35"/></svg>
                </button>
                <button onClick={onNewDeal} style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 10px rgba(22,163,74,0.35)", WebkitTapHighlightColor: "transparent" }}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5}><path d="M12 5v14M5 12h14"/></svg>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.02em" }}>Deal Pipeline</h1>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "3px 0 0", fontFamily: "'DM Sans', sans-serif" }}>{deals.length} deals · {fmt(totalVolume)} total volume</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2}><circle cx={11} cy={11} r={8}/><path d="m21 21-4.35-4.35"/></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search deals..." style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px 8px 32px", color: "#0f172a", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", width: 210 }} />
            </div>
            <button onClick={onNewDeal} style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", borderRadius: 8, padding: "9px 18px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 10px rgba(22,163,74,0.35)", whiteSpace: "nowrap" }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14"/></svg>
              New Deal
            </button>
          </div>
        </div>
      )}

      {/* Summary Strip */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f1f5f9", padding: isMobile ? "0" : "12px 32px", display: "flex", gap: 0, overflowX: isMobile ? "auto" : "visible", WebkitOverflowScrolling: "touch" }}>
        {statusFilters.map((s, i) => {
          const count = deals.filter(s.match).length;
          const isActive = statusFilter === i;
          return (
            <button key={s.label} onClick={() => setStatusFilter(isActive ? null : i)} style={{
              display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
              background: "none", border: "none", cursor: "pointer",
              padding: isMobile ? "12px 16px" : "0",
              marginRight: isMobile ? 0 : 32,
              borderBottom: isMobile && isActive ? "2px solid #16a34a" : "2px solid transparent",
              transition: "all 0.2s", WebkitTapHighlightColor: "transparent",
            }}>
              <span style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, color: isActive ? "#16a34a" : "#0f172a", fontFamily: "'DM Mono', monospace", transition: "color 0.2s" }}>{count}</span>
              <span style={{ fontSize: isMobile ? 10 : 11, color: isActive ? "#16a34a" : "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap", transition: "color 0.2s" }}>{s.label}</span>
            </button>
          );
        })}
        {statusFilter !== null && isMobile && (
          <button onClick={() => setStatusFilter(null)} style={{ flexShrink: 0, padding: "12px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#dc2626", fontFamily: "'DM Sans', sans-serif", WebkitTapHighlightColor: "transparent" }}>Clear</button>
        )}
      </div>

      {/* Deals List */}
      <div style={{ flex: 1, overflow: "auto", padding: isMobile ? "12px 12px 24px" : "20px 24px 32px" }}>
        {isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontSize: 13, background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                {statusFilter !== null ? "No " + statusFilters[statusFilter].label.toLowerCase() + " deals" : "No deals found"}
              </div>
            ) : filtered.map((deal, i) => (
              <DealCard key={i} deal={deal} onSelect={onSelectDeal} />
            ))}
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  {["User", "Date", "Status", "Address", "Type", "Our Offer", "$/sqft", "Sq Ft", "Source"].map(h => (
                    <th key={h} onClick={() => handleSort(h)} style={{
                      padding: "11px 16px", textAlign: "left", fontSize: 10, color: sortCol === h ? "#16a34a" : "#94a3b8",
                      fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
                      whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", transition: "color 0.15s",
                    }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {h}
                        {sortCol === h && (
                          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} style={{ transition: "transform 0.2s", transform: sortDir === "asc" ? "rotate(180deg)" : "rotate(0deg)" }}>
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>No deals found</td></tr>
                ) : filtered.map((deal, i) => (
                  <tr key={i} onClick={() => onSelectDeal(deal)} onMouseEnter={() => setHoveredRow(i)} onMouseLeave={() => setHoveredRow(null)} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none", background: hoveredRow === i ? "#f8fafc" : "#fff", cursor: "pointer", transition: "background 0.1s" }}>
                    <td style={{ padding: "13px 16px" }}><span style={{ fontSize: 12, color: "#475569", fontFamily: "'DM Sans', sans-serif", background: "#f1f5f9", padding: "3px 8px", borderRadius: 6, fontWeight: 500 }}>{fmtUserName(deal.user)}</span></td>
                    <td style={{ padding: "13px 16px", fontSize: 12, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>{fmtDate(deal.date)}</td>
                    <td style={{ padding: "13px 16px" }}><StatusBadge status={deal.status} /></td>
                    <td style={{ padding: "13px 16px", fontSize: 13, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{deal.address || "—"}</td>
                    <td style={{ padding: "13px 16px", fontSize: 12, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>{deal.type || "—"}</td>
                    <td style={{ padding: "13px 16px", fontSize: 13, color: "#0f172a", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{fmt(deal.offer)}</td>
                    <td style={{ padding: "13px 16px", fontSize: 12, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>{deal.netSqft ? `$${deal.netSqft}` : "—"}</td>
                    <td style={{ padding: "13px 16px", fontSize: 12, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>{fmtNum(deal.sqft)}</td>
                    <td style={{ padding: "13px 16px" }}><span style={{ fontSize: 11, color: "#16a34a", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>{deal.source || "Manual"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

function DealDetailView({ deal, onBack, onEdit, isMobile, userEmail, onUpdateDeal }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef(null);
  const tabs = ["overview", "financials", "refinance", "bridge loan", "income", "financing", "ai underwriting", "ai summary", "notes", "documents", "shared deal", "activity", "investor updates"];
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [copied, setCopied] = useState(false);

  // ── Documents tab state ──
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // ── Activity tab state ──
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [activitySaving, setActivitySaving] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: "Note", description: "", date: new Date().toISOString().split("T")[0] });

  // ── Notes tab state ──
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  // ── Refinance tab state ──
  const [refiForm, setRefiForm] = useState({});
  const [refiEditing, setRefiEditing] = useState(false);
  const [refiSaving, setRefiSaving] = useState(false);
  useEffect(() => {
    if (deal) setRefiForm({ refiPctARV: deal.refiPctARV || "", refiInterestRate: deal.refiInterestRate || "", refiPoints: deal.refiPoints || "", refiTerm: deal.refiTerm || "" });
  }, [deal?.refiPctARV, deal?.refiInterestRate, deal?.refiPoints, deal?.refiTerm]);

  // ── Bridge Loan tab state ──
  const [bridgeForm, setBridgeForm] = useState({});
  const [bridgeEditing, setBridgeEditing] = useState(false);
  const [bridgeSaving, setBridgeSaving] = useState(false);
  const [bridgeEnabled, setBridgeEnabled] = useState(false);
  useEffect(() => {
    if (deal) {
      setBridgeForm({ bridgeAcqPct: deal.bridgeAcqPct || "", bridgeImprovPct: deal.bridgeImprovPct || "", bridgeInterestRate: deal.bridgeInterestRate || "", bridgePoints: deal.bridgePoints || "" });
      setBridgeEnabled(!!(deal.bridgeAcqPct || deal.bridgeImprovPct || deal.bridgeInterestRate || deal.bridgePoints || deal.bridgeLoanTotal));
    }
  }, [deal?.bridgeAcqPct, deal?.bridgeImprovPct, deal?.bridgeInterestRate, deal?.bridgePoints]);

  // ── Income tab state ──
  const [incomeForm, setIncomeForm] = useState({});
  const [incomeEditing, setIncomeEditing] = useState(false);
  const [incomeSaving, setIncomeSaving] = useState(false);
  useEffect(() => {
    if (deal) setIncomeForm({
      existingRevenueAnnual: deal.existingRevenueAnnual || "", existingExpensePct: deal.existingExpensePct || "", existingVacancyPct: deal.existingVacancyPct || "",
      proformaRevenueAnnual: deal.proformaRevenueAnnual || "", proformaExpensesPct: deal.proformaExpensesPct || "", proformaVacancy: deal.proformaVacancy || "",
      annualTaxes: deal.annualTaxes || "", insuranceCost: deal.insuranceCost || "",
    });
  }, [deal?.existingRevenueAnnual, deal?.proformaRevenueAnnual]);

  // ── Shared Deal tab state ──
  const [sharedUsers, setSharedUsers] = useState([]);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState("viewer");
  const [shareSaving, setShareSaving] = useState(false);

  // ── Document link state ──
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkForm, setLinkForm] = useState({ url: "", title: "", type: "website" });
  const [linkSaving, setLinkSaving] = useState(false);

  // ── Investor Updates tab state ──
  const [updates, setUpdates] = useState([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [updateSaving, setUpdateSaving] = useState(false);
  const [updateForm, setUpdateForm] = useState({ title: "", content: "", type: "General Announcement", isPublic: true });
  const [updatePhotos, setUpdatePhotos] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [notifyInvestors, setNotifyInvestors] = useState(true);
  const [linkedInvestors, setLinkedInvestors] = useState([]);
  const [notificationsSent, setNotificationsSent] = useState({});
  const [engagementData, setEngagementData] = useState({ reads: [], notifications: [] });
  const [showEngagement, setShowEngagement] = useState(false);

  // ── Fetch documents ──
  const fetchDocuments = useCallback(async () => {
    if (!deal?._id) return;
    setDocsLoading(true);
    try {
      const { data, error } = await supabase
        .from("deal_documents")
        .select("*")
        .eq("deal_id", deal._id)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      setDocuments(data || []);
    } catch (err) {
      console.error("Error fetching documents:", err);
    } finally {
      setDocsLoading(false);
    }
  }, [deal?._id]);

  // ── Fetch activities ──
  const fetchActivities = useCallback(async () => {
    if (!deal?._id) return;
    setActivitiesLoading(true);
    try {
      const { data, error } = await supabase
        .from("deal_activities")
        .select("*")
        .eq("deal_id", deal._id)
        .order("activity_date", { ascending: false });
      if (error) throw error;
      setActivities(data || []);
    } catch (err) {
      console.error("Error fetching activities:", err);
    } finally {
      setActivitiesLoading(false);
    }
  }, [deal?._id]);

  // ── Fetch investor updates ──
  const fetchInvestorUpdates = useCallback(async () => {
    if (!deal?._id) return;
    setUpdatesLoading(true);
    try {
      const { data, error } = await supabase
        .from("investor_updates")
        .select("*")
        .eq("deal_id", deal._id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setUpdates(data || []);
    } catch (err) {
      console.error("Error fetching investor updates:", err);
    } finally {
      setUpdatesLoading(false);
    }
  }, [deal?._id]);

  // ── Fetch linked investors for notification preview ──
  const fetchLinkedInvestors = useCallback(async () => {
    if (!deal?.address) return;
    try {
      const { data: allInvestors } = await supabase.from("investors").select("id, investor_name, portal_email, contact_ids, linked_deal_addresses, company");
      const linked = (allInvestors || []).filter(inv => {
        const addrs = inv.linked_deal_addresses ? inv.linked_deal_addresses.split("|||").filter(Boolean) : [];
        return addrs.includes(deal.address);
      });
      // For each investor, look up their contacts for email/phone
      const contactIds = linked.flatMap(inv => inv.contact_ids ? inv.contact_ids.split("|||").filter(Boolean) : []);
      let contactMap = {};
      if (contactIds.length > 0) {
        const { data: contacts } = await supabase.from("contacts").select("id, contact_name, email, phone").in("id", contactIds);
        (contacts || []).forEach(c => { contactMap[c.id] = c; });
      }
      const enriched = linked.map(inv => ({
        ...inv,
        contacts: (inv.contact_ids ? inv.contact_ids.split("|||").filter(Boolean) : []).map(id => contactMap[id]).filter(Boolean),
        allEmails: [
          inv.portal_email,
          ...(inv.contact_ids ? inv.contact_ids.split("|||").filter(Boolean) : []).map(id => contactMap[id]?.email).filter(Boolean)
        ].filter(Boolean),
        allPhones: (inv.contact_ids ? inv.contact_ids.split("|||").filter(Boolean) : []).map(id => contactMap[id]?.phone).filter(Boolean),
      }));
      setLinkedInvestors(enriched);
    } catch (err) { console.error("Error fetching linked investors:", err); }
  }, [deal?.address]);

  // ── Fetch notification status for updates ──
  const fetchNotificationStatus = useCallback(async () => {
    if (updates.length === 0) return;
    try {
      const updateIds = updates.map(u => u.id);
      const { data } = await supabase.from("investor_notifications").select("update_id, status, contact_name").in("update_id", updateIds);
      const grouped = {};
      (data || []).forEach(n => {
        if (!grouped[n.update_id]) grouped[n.update_id] = [];
        grouped[n.update_id].push(n);
      });
      setNotificationsSent(grouped);
    } catch (err) { console.error("Error fetching notification status:", err); }
  }, [updates]);

  // ── Fetch engagement metrics ──
  const fetchEngagementMetrics = useCallback(async () => {
    if (updates.length === 0) return;
    try {
      const updateIds = updates.map(u => u.id);
      const [readsRes, notifsRes] = await Promise.all([
        supabase.from("investor_update_reads").select("*").in("update_id", updateIds),
        supabase.from("investor_notifications").select("*").in("update_id", updateIds),
      ]);
      setEngagementData({ reads: readsRes.data || [], notifications: notifsRes.data || [] });
    } catch (err) { console.error("Engagement fetch error:", err); }
  }, [updates]);

  // Load docs/activities/investor updates when tab switches
  useEffect(() => {
    if (activeTab === "documents" && documents.length === 0 && !docsLoading) fetchDocuments();
    if ((activeTab === "activity" || activeTab === "notes") && activities.length === 0 && !activitiesLoading) fetchActivities();
    if (activeTab === "investor updates") {
      if (updates.length === 0 && !updatesLoading) fetchInvestorUpdates();
      fetchLinkedInvestors();
      fetchEngagementMetrics();
    }
  }, [activeTab, deal?._id, fetchDocuments, fetchActivities, fetchInvestorUpdates, fetchLinkedInvestors]);

  useEffect(() => { if (updates.length > 0) fetchNotificationStatus(); }, [updates, fetchNotificationStatus]);

  // ── Upload document ──
  const handleUploadFiles = async (files) => {
    if (!files || files.length === 0 || !deal?._id) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of files) {
        if (file.size > 50 * 1024 * 1024) {
          setUploadError(`${file.name} exceeds 50MB limit`);
          continue;
        }
        const storagePath = `${deal._id}/${Date.now()}_${file.name}`;
        const { error: storageErr } = await supabase.storage
          .from("deal-documents")
          .upload(storagePath, file, { upsert: false });
        if (storageErr) throw storageErr;
        const { error: dbErr } = await supabase
          .from("deal_documents")
          .insert({
            deal_id: deal._id,
            user_email: userEmail,
            filename: file.name,
            file_size: file.size,
            mime_type: file.type || "application/octet-stream",
            storage_path: storagePath,
          });
        if (dbErr) throw dbErr;
        // Auto-log activity
        await supabase.from("deal_activities").insert({
          deal_id: deal._id,
          user_email: userEmail,
          activity_type: "Document Added",
          description: `Uploaded "${file.name}"`,
          activity_date: new Date().toISOString(),
        });
      }
      fetchDocuments();
      fetchActivities();
    } catch (err) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // ── Download document ──
  const handleDownloadDoc = async (doc) => {
    try {
      const { data, error } = await supabase.storage
        .from("deal-documents")
        .download(doc.storage_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Download failed: " + err.message);
    }
  };

  // ── Delete document ──
  const handleDeleteDoc = async (doc) => {
    if (!window.confirm(`Delete "${doc.filename}"?`)) return;
    try {
      await supabase.storage.from("deal-documents").remove([doc.storage_path]);
      await supabase.from("deal_documents").delete().eq("id", doc.id);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  // ── Log activity ──
  const handleLogActivity = async () => {
    if (!activityForm.description.trim()) return;
    setActivitySaving(true);
    try {
      const { error } = await supabase.from("deal_activities").insert({
        deal_id: deal._id,
        user_email: userEmail,
        activity_type: activityForm.type,
        description: activityForm.description.trim(),
        activity_date: activityForm.date ? new Date(activityForm.date).toISOString() : new Date().toISOString(),
      });
      if (error) throw error;
      setShowLogModal(false);
      setActivityForm({ type: "Note", description: "", date: new Date().toISOString().split("T")[0] });
      fetchActivities();
    } catch (err) {
      alert("Error logging activity: " + err.message);
    } finally {
      setActivitySaving(false);
    }
  };

  // ── Save note (writes to deal_activities as type "Note") ──
  const handleSaveNote = async () => {
    if (!noteText.trim() || !deal?._id) return;
    setNoteSaving(true);
    try {
      const { error } = await supabase.from("deal_activities").insert({
        deal_id: deal._id,
        user_email: userEmail,
        activity_type: "Note",
        description: noteText.trim(),
        activity_date: new Date().toISOString(),
      });
      if (error) throw error;
      setNoteText("");
      fetchActivities();
    } catch (err) {
      alert("Error saving note: " + err.message);
    } finally {
      setNoteSaving(false);
    }
  };
  const getDocIcon = (filename) => {
    const ext = (filename || "").split(".").pop().toLowerCase();
    if (ext === "pdf") return { label: "PDF", color: "#dc2626" };
    if (["doc","docx"].includes(ext)) return { label: "DOC", color: "#2563eb" };
    if (["xls","xlsx","csv"].includes(ext)) return { label: "XLS", color: "#16a34a" };
    if (["jpg","jpeg","png","gif","webp","svg"].includes(ext)) return { label: "IMG", color: "#7c3aed" };
    if (["ppt","pptx"].includes(ext)) return { label: "PPT", color: "#d97706" };
    if (["zip","rar","7z","tar","gz"].includes(ext)) return { label: "ZIP", color: "#64748b" };
    return { label: ext.toUpperCase() || "FILE", color: "#94a3b8" };
  };

  const fmtFileSize = (bytes) => {
    if (!bytes) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const ACTIVITY_TYPES = ["Note", "Call", "Email", "Meeting", "Status Change", "Offer Sent", "Document Added", "Site Visit"];
  const ACTIVITY_ICONS = {
    "Note":            { icon: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7", color: "#3b82f6" },
    "Call":            { icon: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z", color: "#16a34a" },
    "Email":           { icon: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6", color: "#7c3aed" },
    "Meeting":         { icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75", color: "#d97706" },
    "Status Change":   { icon: "M23 4v6h-6 M1 20v-6h6 M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15", color: "#0891b2" },
    "Offer Sent":      { icon: "M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z", color: "#dc2626" },
    "Document Added":  { icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M12 18v-6 M9 15h6", color: "#64748b" },
    "Site Visit":      { icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10", color: "#f59e0b" },
  };

  const generateSummary = async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await fetch(process.env.REACT_APP_SUPABASE_URL + "/functions/v1/generate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + process.env.REACT_APP_SUPABASE_ANON_KEY },
        body: JSON.stringify({ deal }),
      });
      const result = await res.json();
      if (result.summary) {
        setSummary(result.summary);
      } else {
        setSummaryError(result.error || "Failed to generate summary");
      }
    } catch (err) {
      setSummaryError("Network error: " + err.message);
    } finally {
      setSummaryLoading(false);
    }
  };

  const copySummary = () => {
    if (summary) {
      navigator.clipboard.writeText(summary.replace(/\*\*/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── Save refinance fields inline ──
  const handleSaveRefi = async () => {
    if (!deal?._id) return;
    setRefiSaving(true);
    try {
      const clean = (v) => v ? String(v).replace(/[$,]/g, "") : "";
      const { error } = await supabase.from("deals").update({
        refi_pct_arv: parseFloat(clean(refiForm.refiPctARV)) || null,
        refi_interest_rate: parseFloat(clean(refiForm.refiInterestRate)) || null,
        refi_points_pct: parseFloat(clean(refiForm.refiPoints)) || null,
        refi_term_years: parseInt(clean(refiForm.refiTerm)) || null,
      }).eq("id", deal._id);
      if (error) throw error;
      setRefiEditing(false);
      if (onUpdateDeal) onUpdateDeal();
    } catch (err) { alert("Error saving refinance: " + err.message); }
    finally { setRefiSaving(false); }
  };

  // ── Save bridge loan fields inline ──
  const handleSaveBridge = async () => {
    if (!deal?._id) return;
    setBridgeSaving(true);
    try {
      const clean = (v) => v ? String(v).replace(/[$,]/g, "") : "";
      const { error } = await supabase.from("deals").update({
        bridge_acq_financed_pct: bridgeEnabled ? (parseFloat(clean(bridgeForm.bridgeAcqPct)) || null) : null,
        bridge_improv_financed_pct: bridgeEnabled ? (parseFloat(clean(bridgeForm.bridgeImprovPct)) || null) : null,
        bridge_interest_rate: bridgeEnabled ? (parseFloat(clean(bridgeForm.bridgeInterestRate)) || null) : null,
        bridge_points_pct: bridgeEnabled ? (parseFloat(clean(bridgeForm.bridgePoints)) || null) : null,
      }).eq("id", deal._id);
      if (error) throw error;
      setBridgeEditing(false);
      if (onUpdateDeal) onUpdateDeal();
    } catch (err) { alert("Error saving bridge loan: " + err.message); }
    finally { setBridgeSaving(false); }
  };

  // ── Save income fields inline ──
  const handleSaveIncome = async () => {
    if (!deal?._id) return;
    setIncomeSaving(true);
    try {
      const clean = (v) => v ? String(v).replace(/[$,]/g, "") : "";
      const { error } = await supabase.from("deals").update({
        existing_revenue_annual: parseFloat(clean(incomeForm.existingRevenueAnnual)) || null,
        existing_expense_pct: parseFloat(clean(incomeForm.existingExpensePct)) || null,
        proforma_revenue_annual: parseFloat(clean(incomeForm.proformaRevenueAnnual)) || null,
        proforma_expenses_pct: parseFloat(clean(incomeForm.proformaExpensesPct)) || null,
        proforma_vacancy_pct: parseFloat(clean(incomeForm.proformaVacancy)) || null,
        annual_taxes: parseFloat(clean(incomeForm.annualTaxes)) || null,
        insurance_cost_annual: parseFloat(clean(incomeForm.insuranceCost)) || null,
      }).eq("id", deal._id);
      if (error) throw error;
      setIncomeEditing(false);
      if (onUpdateDeal) onUpdateDeal();
    } catch (err) { alert("Error saving income: " + err.message); }
    finally { setIncomeSaving(false); }
  };

  // ── Fetch shared users ──
  const fetchSharedUsers = useCallback(async () => {
    if (!deal?._id) return;
    setSharedLoading(true);
    try {
      const { data, error } = await supabase.from("deal_shares").select("*").eq("deal_id", deal._id).order("created_at", { ascending: false });
      if (error) throw error;
      setSharedUsers(data || []);
    } catch (err) { console.error("Error fetching shared users:", err); }
    finally { setSharedLoading(false); }
  }, [deal?._id]);

  // ── Add shared user ──
  const handleShareDeal = async () => {
    if (!shareEmail.trim() || !deal?._id) return;
    setShareSaving(true);
    try {
      const { error } = await supabase.from("deal_shares").upsert({
        deal_id: deal._id, shared_with_email: shareEmail.trim().toLowerCase(), role: shareRole, shared_by_email: userEmail,
      }, { onConflict: "deal_id,shared_with_email" });
      if (error) throw error;
      setShareEmail(""); setShareRole("viewer");
      fetchSharedUsers();
    } catch (err) { alert("Error sharing deal: " + err.message); }
    finally { setShareSaving(false); }
  };

  // ── Remove shared user ──
  const handleRemoveShare = async (id) => {
    if (!window.confirm("Remove this user's access?")) return;
    try {
      await supabase.from("deal_shares").delete().eq("id", id);
      setSharedUsers(prev => prev.filter(s => s.id !== id));
    } catch (err) { alert("Remove failed: " + err.message); }
  };

  // ── Update shared user role ──
  const handleUpdateShareRole = async (id, newRole) => {
    try {
      await supabase.from("deal_shares").update({ role: newRole }).eq("id", id);
      setSharedUsers(prev => prev.map(s => s.id === id ? { ...s, role: newRole } : s));
    } catch (err) { alert("Update failed: " + err.message); }
  };

  // ── Add document link ──
  const handleAddLink = async () => {
    if (!linkForm.url.trim() || !deal?._id) return;
    setLinkSaving(true);
    try {
      const { error } = await supabase.from("deal_documents").insert({
        deal_id: deal._id, user_email: userEmail,
        filename: linkForm.title.trim() || linkForm.url.trim(),
        file_size: null, mime_type: "link/" + linkForm.type,
        storage_path: linkForm.url.trim(), is_link: true,
      });
      if (error) throw error;
      await supabase.from("deal_activities").insert({ deal_id: deal._id, user_email: userEmail, activity_type: "Document Added", description: `Added link "${linkForm.title || linkForm.url}"`, activity_date: new Date().toISOString() });
      setLinkForm({ url: "", title: "", type: "website" }); setShowLinkForm(false);
      fetchDocuments();
    } catch (err) { alert("Error adding link: " + err.message); }
    finally { setLinkSaving(false); }
  };

  // Load shared users when tab is selected
  useEffect(() => {
    if (activeTab === "shared deal" && sharedUsers.length === 0 && !sharedLoading) fetchSharedUsers();
  }, [activeTab, deal?._id]);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) setScrolled(scrollRef.current.scrollTop > 60);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && isMobile) {
      el.addEventListener("scroll", handleScroll, { passive: true });
      return () => el.removeEventListener("scroll", handleScroll);
    }
  }, [isMobile, handleScroll]);

  return (
    <div ref={scrollRef} style={{ flex: 1, overflow: "auto", background: "#f8fafc" }}>
      {/* Sticky collapsed header — mobile only */}
      {isMobile && (
        <div style={{
          position: "sticky", top: 0, zIndex: 20,
          background: scrolled ? "rgba(255,255,255,0.95)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? "1px solid #e2e8f0" : "1px solid transparent",
          padding: scrolled ? "10px 16px" : "0",
          display: "flex", alignItems: "center", gap: 10,
          transition: "all 0.25s cubic-bezier(0.25, 1, 0.5, 1)",
          height: scrolled ? "auto" : 0, overflow: "hidden", opacity: scrolled ? 1 : 0,
        }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4, display: "flex" }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{deal.address || "—"}</p>
          </div>
          <StatusBadge status={deal.status} />
        </div>
      )}

      {/* Full header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: isMobile ? "14px 16px" : "18px 32px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 5, marginBottom: isMobile ? 10 : 14, padding: 0, fontWeight: 500 }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back to Pipeline
        </button>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 11, color: "#16a34a", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.08em", fontWeight: 700, textTransform: "uppercase", margin: "0 0 6px" }}>{deal.type || "Property"} · {deal.city || ""} {deal.state || ""}</p>
            <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: "0 0 10px", letterSpacing: "-0.02em", wordBreak: "break-word" }}>{deal.address || "—"}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <StatusBadge status={deal.status} />
              {deal.user && <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>Assigned to {fmtUserName(deal.user)}</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignSelf: isMobile ? "stretch" : "auto" }}>
            <button onClick={onEdit} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: isMobile ? "10px 18px" : "10px 18px", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6, flex: isMobile ? 1 : "none" }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit Deal
            </button>
            <button style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", borderRadius: 8, padding: isMobile ? "10px 18px" : "10px 22px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 10px rgba(22,163,74,0.35)", whiteSpace: "nowrap", flex: isMobile ? 1 : "none", textAlign: "center" }}>Submit Offer</button>
          </div>
        </div>
      </div>

      <div style={{ padding: isMobile ? "20px 16px" : "28px 32px" }}>
        {/* Google Street View */}
        <div style={{ width: "100%", height: isMobile ? 160 : 220, borderRadius: 14, overflow: "hidden", marginBottom: isMobile ? 20 : 28, position: "relative", background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
          <img
            src={`https://maps.googleapis.com/maps/api/streetview?size=1200x220&location=${encodeURIComponent(deal.address)}&fov=90&pitch=0&key=AIzaSyBwEzMkQVeMtBo7BCcjU6XTIPjG2o-McoU`}
            alt={deal.address}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={e => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }}
          />
          <div style={{ display: "none", position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, background: "linear-gradient(135deg, #f0fdf4, #dcfce7)" }}>
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={1.2}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <p style={{ color: "#16a34a", fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, margin: 0 }}>No street view available</p>
          </div>
          <div style={{ position: "absolute", bottom: 12, right: 12, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>
            Street View
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: isMobile ? 20 : 28, borderBottom: "1px solid #e2e8f0", overflowX: isMobile ? "auto" : "visible", WebkitOverflowScrolling: "touch" }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ background: "transparent", border: "none", borderBottom: activeTab === t ? "2px solid #16a34a" : "2px solid transparent", padding: isMobile ? "10px 14px" : "10px 20px", color: activeTab === t ? "#16a34a" : "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize", transition: "all 0.15s", marginBottom: -1, whiteSpace: "nowrap", flexShrink: 0 }}>{t}</button>
          ))}
        </div>

        {activeTab === "overview" && (
          <>
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
                Deal Overview <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 12 }}>
                <MetricCard label="Property Type" value={deal.type} />
                <MetricCard label="Square Footage" value={fmtNum(deal.sqft)} sub="sq ft" />
                <MetricCard label="Our Offer" value={fmt(deal.offer)} sub={deal.netSqft ? `$${deal.netSqft} / sqft` : ""} />
                <MetricCard label="Units" value={deal.units || "—"} />
              </div>
            </section>

            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
                Investment Overview <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 12 }}>
                <MetricCard label="Purchase Price" value={fmt(deal.purchasePrice)} />
                <MetricCard label="Improvement Budget" value={fmt(deal.improvementBudget)} />
                <MetricCard label="As Completed Value" value={fmt(deal.arv)} />
                <MetricCard label="Projected Profit" value={fmt(deal.profit)} highlight good={num(deal.profit) > 0} warn={num(deal.profit) !== null && num(deal.profit) <= 0} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
                <MetricCard label="ROI" value={fmtPct(deal.roi)} highlight good={num(deal.roi) >= 15} warn={num(deal.roi) !== null && num(deal.roi) < 5} />
                <MetricCard label="Cost / Value" value={fmtPct(deal.ctv)} good={num(deal.ctv) !== null && num(deal.ctv) <= 75} warn={num(deal.ctv) > 90} />
                <MetricCard label="Avg Annual Return" value={fmtPct(deal.aar)} good={num(deal.aar) >= 10} />
                <MetricCard label="Profitability" value={fmtPct(deal.profitability)} good={num(deal.profitability) >= 15} warn={num(deal.profitability) !== null && num(deal.profitability) < 5} />
              </div>
            </section>
          </>
        )}

        {activeTab === "financials" && (
          <FinancialsTab deal={deal} isMobile={isMobile} />
        )}

        {/* ── REFINANCE TAB ── */}
        {activeTab === "refinance" && (() => {
          const gridCols = isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)";
          const inpStyle = { width: "100%", padding: "10px 12px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", border: "1.5px solid #e2e8f0", borderRadius: 8, outline: "none", background: "#fff", color: "#0f172a", boxSizing: "border-box" };
          const lblStyle = { display: "block", fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" };
          // Auto-calc refinance metrics
          const pctARV = parseFloat(String(refiForm.refiPctARV).replace(/[%,$]/g, "")) || 0;
          const arvVal = parseFloat(String(deal.arv).replace(/[$,]/g, "")) || 0;
          const refiRate = parseFloat(String(refiForm.refiInterestRate).replace(/[%,$]/g, "")) || 0;
          const refiTermYrs = parseInt(String(refiForm.refiTerm).replace(/[,]/g, "")) || 0;
          const refiLoanAmt = arvVal * (pctARV / 100);
          const monthlyRate = refiRate / 100 / 12;
          const totalPayments = refiTermYrs * 12;
          const refiMonthlyPayment = monthlyRate > 0 && totalPayments > 0 ? refiLoanAmt * (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / (Math.pow(1 + monthlyRate, totalPayments) - 1) : 0;
          const refiAnnualDebtService = refiMonthlyPayment * 12;
          const noiAnnual = parseFloat(String(deal.noiAnnual).replace(/[$,]/g, "")) || 0;
          const refiCashFlow = noiAnnual - refiAnnualDebtService;
          const refiDSCR = refiAnnualDebtService > 0 ? (noiAnnual / refiAnnualDebtService).toFixed(2) : "—";
          return (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  Refinance Details <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
                </h2>
                {!refiEditing ? (
                  <button onClick={() => setRefiEditing(true)} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#475569", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setRefiEditing(false)} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#64748b", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
                    <button onClick={handleSaveRefi} disabled={refiSaving} style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 10px rgba(22,163,74,0.3)" }}>{refiSaving ? "Saving..." : "Save"}</button>
                  </div>
                )}
              </div>
              {refiEditing ? (
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: isMobile ? "16px" : "24px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 14 }}>
                    <div><label style={lblStyle}>% of ARV</label><input style={inpStyle} value={refiForm.refiPctARV} onChange={e => setRefiForm(f => ({...f, refiPctARV: e.target.value}))} placeholder="75" onFocus={e => e.target.style.borderColor="#16a34a"} onBlur={e => e.target.style.borderColor="#e2e8f0"} /></div>
                    <div><label style={lblStyle}>Interest Rate %</label><input style={inpStyle} value={refiForm.refiInterestRate} onChange={e => setRefiForm(f => ({...f, refiInterestRate: e.target.value}))} placeholder="7" onFocus={e => e.target.style.borderColor="#16a34a"} onBlur={e => e.target.style.borderColor="#e2e8f0"} /></div>
                    <div><label style={lblStyle}>Points %</label><input style={inpStyle} value={refiForm.refiPoints} onChange={e => setRefiForm(f => ({...f, refiPoints: e.target.value}))} placeholder="2" onFocus={e => e.target.style.borderColor="#16a34a"} onBlur={e => e.target.style.borderColor="#e2e8f0"} /></div>
                    <div><label style={lblStyle}>Term (Years)</label><input style={inpStyle} value={refiForm.refiTerm} onChange={e => setRefiForm(f => ({...f, refiTerm: e.target.value}))} placeholder="25" onFocus={e => e.target.style.borderColor="#16a34a"} onBlur={e => e.target.style.borderColor="#e2e8f0"} /></div>
                  </div>
                </div>
              ) : null}
              <div style={{ marginTop: refiEditing ? 20 : 0 }}>
                <h3 style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
                  Calculated Metrics <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12 }}>
                  <MetricCard label="Refi Loan Amount" value={refiLoanAmt > 0 ? fmt(refiLoanAmt) : fmt(deal.refiLoanAmount)} />
                  <MetricCard label="% of ARV" value={fmtPct(refiForm.refiPctARV || deal.refiPctARV)} />
                  <MetricCard label="Monthly Payment" value={refiMonthlyPayment > 0 ? fmt(refiMonthlyPayment) : "—"} />
                  <MetricCard label="Annual Debt Service" value={refiAnnualDebtService > 0 ? fmt(refiAnnualDebtService) : "—"} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12, marginTop: 12 }}>
                  <MetricCard label="Cash Flow (Refi)" value={refiCashFlow !== 0 || refiAnnualDebtService > 0 ? fmt(refiCashFlow) : fmt(deal.refiCashFlow)} sub="annual" highlight good={refiCashFlow > 0 || num(deal.refiCashFlow) > 0} warn={(refiAnnualDebtService > 0 && refiCashFlow <= 0) || (num(deal.refiCashFlow) !== null && num(deal.refiCashFlow) <= 0)} />
                  <MetricCard label="DSCR (Refi)" value={refiDSCR} good={num(refiDSCR) >= 1.25} warn={num(refiDSCR) !== null && num(refiDSCR) < 1.0} />
                  <MetricCard label="Cash Out at Refi" value={fmt(deal.cashOutRefi)} good={num(deal.cashOutRefi) > 0} warn={num(deal.cashOutRefi) !== null && num(deal.cashOutRefi) <= 0} />
                  <MetricCard label="Equity After Refi" value={fmt(deal.equityAfterRefi)} />
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── BRIDGE LOAN TAB ── */}
        {activeTab === "bridge loan" && (() => {
          const gridCols = isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)";
          const inpStyle = { width: "100%", padding: "10px 12px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", border: "1.5px solid #e2e8f0", borderRadius: 8, outline: "none", background: "#fff", color: "#0f172a", boxSizing: "border-box" };
          const lblStyle = { display: "block", fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" };
          return (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <h2 style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>Bridge Loan</h2>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: bridgeEnabled ? "#16a34a" : "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>
                    <div onClick={() => { setBridgeEnabled(!bridgeEnabled); if (!bridgeEditing) setBridgeEditing(true); }} style={{ width: 40, height: 22, borderRadius: 11, background: bridgeEnabled ? "#16a34a" : "#e2e8f0", position: "relative", cursor: "pointer", transition: "background 0.2s" }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: bridgeEnabled ? 20 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                    </div>
                    {bridgeEnabled ? "Active" : "Not Using"}
                  </label>
                </div>
                {bridgeEnabled && !bridgeEditing ? (
                  <button onClick={() => setBridgeEditing(true)} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#475569", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit
                  </button>
                ) : bridgeEnabled && bridgeEditing ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setBridgeEditing(false)} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#64748b", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
                    <button onClick={handleSaveBridge} disabled={bridgeSaving} style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 10px rgba(22,163,74,0.3)" }}>{bridgeSaving ? "Saving..." : "Save"}</button>
                  </div>
                ) : null}
              </div>
              {!bridgeEnabled ? (
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "48px 20px", textAlign: "center" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(100,116,139,0.06)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={1.5}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg>
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: "0 0 4px" }}>Bridge Loan Not Active</p>
                  <p style={{ fontSize: 13, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>Toggle the switch above to enable bridge loan tracking for this deal.</p>
                </div>
              ) : (
                <>
                  {bridgeEditing && (
                    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: isMobile ? "16px" : "24px", marginBottom: 20 }}>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 14 }}>
                        <div><label style={lblStyle}>Acquisition Financed %</label><input style={inpStyle} value={bridgeForm.bridgeAcqPct} onChange={e => setBridgeForm(f => ({...f, bridgeAcqPct: e.target.value}))} placeholder="75" onFocus={e => e.target.style.borderColor="#16a34a"} onBlur={e => e.target.style.borderColor="#e2e8f0"} /></div>
                        <div><label style={lblStyle}>Improvement Financed %</label><input style={inpStyle} value={bridgeForm.bridgeImprovPct} onChange={e => setBridgeForm(f => ({...f, bridgeImprovPct: e.target.value}))} placeholder="100" onFocus={e => e.target.style.borderColor="#16a34a"} onBlur={e => e.target.style.borderColor="#e2e8f0"} /></div>
                        <div><label style={lblStyle}>Interest Rate %</label><input style={inpStyle} value={bridgeForm.bridgeInterestRate} onChange={e => setBridgeForm(f => ({...f, bridgeInterestRate: e.target.value}))} placeholder="10" onFocus={e => e.target.style.borderColor="#16a34a"} onBlur={e => e.target.style.borderColor="#e2e8f0"} /></div>
                        <div><label style={lblStyle}>Points %</label><input style={inpStyle} value={bridgeForm.bridgePoints} onChange={e => setBridgeForm(f => ({...f, bridgePoints: e.target.value}))} placeholder="2" onFocus={e => e.target.style.borderColor="#16a34a"} onBlur={e => e.target.style.borderColor="#e2e8f0"} /></div>
                      </div>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12 }}>
                    <MetricCard label="Loan Total" value={fmt(deal.bridgeLoanTotal)} />
                    <MetricCard label="Interest Rate" value={fmtPct(deal.bridgeInterestRate)} />
                    <MetricCard label="Interest Cost (Mo)" value={fmt(deal.bridgeInterestMonthly)} />
                    <MetricCard label="Points" value={fmtPct(deal.bridgePoints)} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12, marginTop: 12 }}>
                    <MetricCard label="LTC" value={fmtPct(deal.bridgeLTC)} warn={num(deal.bridgeLTC) > 90} />
                    <MetricCard label="LTV" value={fmtPct(deal.bridgeLTV)} good={num(deal.bridgeLTV) !== null && num(deal.bridgeLTV) <= 75} warn={num(deal.bridgeLTV) > 85} />
                    <MetricCard label="Equity Required" value={fmt(deal.equityRequired)} />
                    <MetricCard label="Bridge Total Cost" value={fmt(deal.bridgeTotalCost)} />
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* ── INCOME TAB ── */}
        {activeTab === "income" && (() => {
          const gridCols = isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)";
          const inpStyle = { width: "100%", padding: "10px 12px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", border: "1.5px solid #e2e8f0", borderRadius: 8, outline: "none", background: "#fff", color: "#0f172a", boxSizing: "border-box" };
          const lblStyle = { display: "block", fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" };
          return (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  Income & Expenses <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
                </h2>
                {!incomeEditing ? (
                  <button onClick={() => setIncomeEditing(true)} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#475569", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setIncomeEditing(false)} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#64748b", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
                    <button onClick={handleSaveIncome} disabled={incomeSaving} style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 10px rgba(22,163,74,0.3)" }}>{incomeSaving ? "Saving..." : "Save"}</button>
                  </div>
                )}
              </div>
              {incomeEditing && (
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: isMobile ? "16px" : "24px", marginBottom: 24 }}>
                  <p style={{ fontSize: 11, color: "#16a34a", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>Current Financials <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} /></p>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
                    <div><label style={lblStyle}>Revenue (Annual)</label><input style={inpStyle} value={incomeForm.existingRevenueAnnual} onChange={e => setIncomeForm(f => ({...f, existingRevenueAnnual: e.target.value}))} placeholder="$237,600" onFocus={e => e.target.style.borderColor="#16a34a"} onBlur={e => e.target.style.borderColor="#e2e8f0"} /></div>
                    <div><label style={lblStyle}>Expense Ratio %</label><input style={inpStyle} value={incomeForm.existingExpensePct} onChange={e => setIncomeForm(f => ({...f, existingExpensePct: e.target.value}))} placeholder="40" onFocus={e => e.target.style.borderColor="#16a34a"} onBlur={e => e.target.style.borderColor="#e2e8f0"} /></div>
                    <div><label style={lblStyle}>Annual Taxes</label><input style={inpStyle} value={incomeForm.annualTaxes} onChange={e => setIncomeForm(f => ({...f, annualTaxes: e.target.value}))} placeholder="$12,000" onFocus={e => e.target.style.borderColor="#16a34a"} onBlur={e => e.target.style.borderColor="#e2e8f0"} /></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr", gap: 14, marginBottom: 20 }}>
                    <div><label style={lblStyle}>Insurance (Annual)</label><input style={inpStyle} value={incomeForm.insuranceCost} onChange={e => setIncomeForm(f => ({...f, insuranceCost: e.target.value}))} placeholder="$8,000" onFocus={e => e.target.style.borderColor="#16a34a"} onBlur={e => e.target.style.borderColor="#e2e8f0"} /></div>
                  </div>
                  <p style={{ fontSize: 11, color: "#16a34a", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>Proforma Income <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} /></p>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 14 }}>
                    <div><label style={lblStyle}>Revenue (Annual)</label><input style={inpStyle} value={incomeForm.proformaRevenueAnnual} onChange={e => setIncomeForm(f => ({...f, proformaRevenueAnnual: e.target.value}))} placeholder="$240,000" onFocus={e => e.target.style.borderColor="#16a34a"} onBlur={e => e.target.style.borderColor="#e2e8f0"} /></div>
                    <div><label style={lblStyle}>Expense Ratio %</label><input style={inpStyle} value={incomeForm.proformaExpensesPct} onChange={e => setIncomeForm(f => ({...f, proformaExpensesPct: e.target.value}))} placeholder="30" onFocus={e => e.target.style.borderColor="#16a34a"} onBlur={e => e.target.style.borderColor="#e2e8f0"} /></div>
                    <div><label style={lblStyle}>Vacancy %</label><input style={inpStyle} value={incomeForm.proformaVacancy} onChange={e => setIncomeForm(f => ({...f, proformaVacancy: e.target.value}))} placeholder="5" onFocus={e => e.target.style.borderColor="#16a34a"} onBlur={e => e.target.style.borderColor="#e2e8f0"} /></div>
                  </div>
                </div>
              )}
              {/* Display metrics */}
              <section style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>Current Financials <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} /></h3>
                <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12 }}>
                  <MetricCard label="Revenue (Annual)" value={fmt(deal.existingRevenueAnnual)} />
                  <MetricCard label="Revenue (Monthly)" value={fmt(deal.existingRevenueMonthly)} />
                  <MetricCard label="Expense Ratio" value={fmtPct(deal.existingExpensePct)} warn={num(deal.existingExpensePct) > 60} good={num(deal.existingExpensePct) !== null && num(deal.existingExpensePct) <= 45} />
                  <MetricCard label="Current NOI" value={fmt(deal.existingNOI)} highlight good={num(deal.existingNOI) > 0} warn={num(deal.existingNOI) !== null && num(deal.existingNOI) <= 0} />
                </div>
              </section>
              <section>
                <h3 style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>Proforma Income <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} /></h3>
                <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12 }}>
                  <MetricCard label="Revenue (Annual)" value={fmt(deal.proformaRevenueAnnual)} highlight />
                  <MetricCard label="Revenue (Monthly)" value={fmt(deal.proformaRevenueMonthly)} />
                  <MetricCard label="Vacancy" value={fmtPct(deal.proformaVacancy)} warn={num(deal.proformaVacancy) > 10} />
                  <MetricCard label="Proforma NOI" value={fmt(deal.noiAnnual)} highlight good={num(deal.noiAnnual) > 0} warn={num(deal.noiAnnual) !== null && num(deal.noiAnnual) <= 0} />
                </div>
              </section>
            </div>
          );
        })()}

        {/* ── FINANCING TAB (read-only summary) ── */}
        {activeTab === "financing" && (() => {
          const gridCols = isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)";
          return (
            <div>
              <h2 style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 20px", display: "flex", alignItems: "center", gap: 8 }}>
                Financing Summary <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
              </h2>
              {/* Bridge Loan Summary */}
              <section style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth={2}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg>
                  Bridge Loan
                  {(deal.bridgeLoanTotal && num(deal.bridgeLoanTotal) > 0) ? <span style={{ fontSize: 10, background: "#f0fdf4", color: "#16a34a", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>Active</span> : <span style={{ fontSize: 10, background: "#f1f5f9", color: "#94a3b8", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>N/A</span>}
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12 }}>
                  <MetricCard label="Loan Total" value={fmt(deal.bridgeLoanTotal)} />
                  <MetricCard label="Interest Rate" value={fmtPct(deal.bridgeInterestRate)} />
                  <MetricCard label="Monthly Interest" value={fmt(deal.bridgeInterestMonthly)} />
                  <MetricCard label="Total Cost" value={fmt(deal.bridgeTotalCost)} />
                </div>
              </section>
              {/* Refinance Summary */}
              <section style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth={2}><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                  Refinance
                  {(deal.refiLoanAmount && num(deal.refiLoanAmount) > 0) ? <span style={{ fontSize: 10, background: "#f0fdf4", color: "#16a34a", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>Active</span> : <span style={{ fontSize: 10, background: "#f1f5f9", color: "#94a3b8", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>N/A</span>}
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12 }}>
                  <MetricCard label="Refi Loan Amount" value={fmt(deal.refiLoanAmount)} />
                  <MetricCard label="Interest Rate" value={fmtPct(deal.refiInterestRate)} />
                  <MetricCard label="Cash Flow (Refi)" value={fmt(deal.refiCashFlow)} sub="annual" highlight good={num(deal.refiCashFlow) > 0} warn={num(deal.refiCashFlow) !== null && num(deal.refiCashFlow) <= 0} />
                  <MetricCard label="Cash Out at Refi" value={fmt(deal.cashOutRefi)} good={num(deal.cashOutRefi) > 0} />
                </div>
              </section>
              {/* Key Ratios */}
              <section>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  Key Ratios
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12 }}>
                  <MetricCard label="LTC" value={fmtPct(deal.bridgeLTC)} warn={num(deal.bridgeLTC) > 90} />
                  <MetricCard label="LTV" value={fmtPct(deal.bridgeLTV)} good={num(deal.bridgeLTV) !== null && num(deal.bridgeLTV) <= 75} warn={num(deal.bridgeLTV) > 85} />
                  <MetricCard label="DSCR" value={deal.dscr || "—"} good={num(deal.dscr) >= 1.25} warn={num(deal.dscr) !== null && num(deal.dscr) < 1.0} />
                  <MetricCard label="Equity Required" value={fmt(deal.equityRequired)} />
                </div>
              </section>
            </div>
          );
        })()}

        {activeTab === "ai underwriting" && (
          <AIUnderwritingTab deal={deal} isMobile={isMobile} />
        )}
        {activeTab === "ai summary" && (
          <div>
            {!summary && !summaryLoading && (
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: isMobile ? "32px 20px" : "48px 40px", textAlign: "center" }}>
                <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg, rgba(22,163,74,0.1), rgba(22,163,74,0.05))", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                  <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={1.5}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: "0 0 8px", letterSpacing: "-0.02em" }}>AI Executive Summary</h3>
                <p style={{ fontSize: 14, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: "0 0 24px", maxWidth: 400, marginLeft: "auto", marginRight: "auto", lineHeight: 1.6 }}>
                  Generate an institutional-quality investment memo using AI. It analyzes all deal metrics and creates a professional summary ready for investors.
                </p>
                <button onClick={generateSummary} style={{
                  background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", borderRadius: 10,
                  padding: "12px 28px", color: "#fff", fontSize: 14, fontWeight: 600,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  boxShadow: "0 2px 12px rgba(22,163,74,0.35)",
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  Generate Summary
                </button>
                {summaryError && (
                  <p style={{ fontSize: 13, color: "#dc2626", fontFamily: "'DM Sans', sans-serif", margin: "16px 0 0" }}>{summaryError}</p>
                )}
              </div>
            )}

            {summaryLoading && (
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "48px 40px", textAlign: "center" }}>
                <div style={{ width: 40, height: 40, border: "3px solid #e2e8f0", borderTop: "3px solid #16a34a", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: "0 0 4px" }}>Generating Executive Summary...</p>
                <p style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>AI is analyzing deal metrics. This takes 10-15 seconds.</p>
              </div>
            )}

            {summary && !summaryLoading && (
              <div>
                {/* Action Bar */}
                <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  <button onClick={copySummary} style={{
                    background: copied ? "#16a34a" : "#fff", border: "1px solid " + (copied ? "#16a34a" : "#e2e8f0"),
                    borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600,
                    color: copied ? "#fff" : "#475569", cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6,
                    transition: "all 0.2s",
                  }}>
                    {copied ? (
                      <><svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>Copied!</>
                    ) : (
                      <><svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy to Clipboard</>
                    )}
                  </button>
                  <button onClick={() => { setSummary(null); generateSummary(); }} style={{
                    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8,
                    padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#475569",
                    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                    Regenerate
                  </button>
                </div>

                {/* Summary Content */}
                <div style={{
                  background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0",
                  padding: isMobile ? "24px 20px" : "32px 36px",
                  boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #16a34a, #15803d)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>REAP AI Executive Summary</p>
                      <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>{deal.address} · Generated {new Date().toLocaleDateString()}</p>
                    </div>
                  </div>

                  {summary.split("\n").map((line, i) => {
                    const trimmed = line.trim();
                    if (!trimmed) return <div key={i} style={{ height: 12 }} />;
                    if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
                      return (
                        <h3 key={i} style={{
                          fontSize: 15, fontWeight: 700, color: "#0f172a",
                          fontFamily: "'DM Sans', sans-serif", margin: "24px 0 10px",
                          paddingBottom: 8, borderBottom: "1px solid #f1f5f9",
                          letterSpacing: "-0.01em",
                        }}>
                          {trimmed.replace(/\*\*/g, "")}
                        </h3>
                      );
                    }
                    return (
                      <p key={i} style={{
                        fontSize: 14, color: "#475569", fontFamily: "'DM Sans', sans-serif",
                        lineHeight: 1.75, margin: "0 0 8px",
                      }}>
                        {trimmed.replace(/\*\*/g, "")}
                      </p>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === "notes" && (
          <div style={{ padding: isMobile ? "16px 12px" : "24px 28px" }}>
            {/* Note input */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: isMobile ? "14px" : "18px 20px", marginBottom: 20 }}>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Add a note about this deal..."
                style={{
                  width: "100%", minHeight: 100, border: "1px solid #e2e8f0", borderRadius: 10,
                  padding: "12px 14px", fontSize: 14, fontFamily: "'DM Sans', sans-serif",
                  color: "#0f172a", background: "#f8fafc", outline: "none", resize: "vertical",
                  lineHeight: 1.6, boxSizing: "border-box",
                }}
                onFocus={e => { e.target.style.borderColor = "#16a34a"; e.target.style.background = "#fff"; }}
                onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.background = "#f8fafc"; }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <button
                  onClick={handleSaveNote}
                  disabled={!noteText.trim() || noteSaving}
                  style={{
                    background: noteText.trim() ? "linear-gradient(135deg, #16a34a, #15803d)" : "#e2e8f0",
                    color: noteText.trim() ? "#fff" : "#94a3b8",
                    border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600,
                    cursor: noteText.trim() ? "pointer" : "default", fontFamily: "'DM Sans', sans-serif",
                    display: "flex", alignItems: "center", gap: 6,
                    boxShadow: noteText.trim() ? "0 2px 10px rgba(22,163,74,0.3)" : "none",
                    transition: "all 0.2s", opacity: noteSaving ? 0.6 : 1,
                  }}
                >
                  {noteSaving ? "Saving..." : "📝 Save Note"}
                </button>
              </div>
            </div>

            {/* Notes list */}
            {activitiesLoading ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ width: 28, height: 28, border: "3px solid #e2e8f0", borderTop: "3px solid #16a34a", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                <p style={{ fontSize: 13, color: "#94a3b8" }}>Loading notes...</p>
              </div>
            ) : (() => {
              const notes = activities.filter(a => a.activity_type === "Note");
              return notes.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <p style={{ fontSize: 32, margin: "0 0 8px" }}>📝</p>
                  <p style={{ fontSize: 14, color: "#94a3b8", margin: 0 }}>No notes yet — add your first note above</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {notes.map((note, i) => (
                    <div key={note.id || i} style={{
                      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
                      padding: isMobile ? "14px" : "16px 20px",
                      borderLeft: "3px solid #3b82f6",
                    }}>
                      <p style={{ fontSize: 14, color: "#0f172a", margin: 0, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{note.description}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>
                          {note.user_email ? note.user_email.split("@")[0] : ""}
                        </span>
                        <span style={{ fontSize: 11, color: "#cbd5e1" }}>·</span>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>
                          {note.activity_date ? new Date(note.activity_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
        {activeTab === "documents" && (
          <div>
            {/* Action buttons row */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUploadFiles(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  flex: 1, background: dragOver ? "rgba(22,163,74,0.06)" : "#fff",
                  border: `2px dashed ${dragOver ? "#16a34a" : "#e2e8f0"}`,
                  borderRadius: 14, padding: isMobile ? "24px 16px" : "28px 32px",
                  textAlign: "center", cursor: "pointer", transition: "all 0.2s",
                }}
              >
                <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => handleUploadFiles(e.target.files)} />
                {uploading ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 28, height: 28, border: "3px solid #e2e8f0", borderTop: "3px solid #16a34a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#16a34a", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>Uploading...</p>
                  </div>
                ) : (
                  <>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(22,163,74,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={1.5}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: "0 0 3px" }}>{dragOver ? "Drop files here" : "Upload File"}</p>
                    <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>Drag & drop or click to browse</p>
                  </>
                )}
              </div>
              <div
                onClick={() => setShowLinkForm(!showLinkForm)}
                style={{
                  flex: 1, background: showLinkForm ? "rgba(59,130,246,0.04)" : "#fff",
                  border: `2px dashed ${showLinkForm ? "#3b82f6" : "#e2e8f0"}`,
                  borderRadius: 14, padding: isMobile ? "24px 16px" : "28px 32px",
                  textAlign: "center", cursor: "pointer", transition: "all 0.2s",
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(59,130,246,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={1.5}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: "0 0 3px" }}>Add Link</p>
                <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>Reference a URL instead</p>
              </div>
            </div>

            {/* Link form */}
            {showLinkForm && (
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: isMobile ? "16px" : "20px 24px", marginBottom: 16 }}>
                <p style={{ fontSize: 11, color: "#3b82f6", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", marginBottom: 14 }}>Add a Link</p>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>URL *</label>
                    <input value={linkForm.url} onChange={e => setLinkForm(f => ({...f, url: e.target.value}))} placeholder="https://example.com/document" style={{ width: "100%", padding: "10px 12px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", border: "1.5px solid #e2e8f0", borderRadius: 8, outline: "none", background: "#fff", color: "#0f172a", boxSizing: "border-box" }} onFocus={e => e.target.style.borderColor="#3b82f6"} onBlur={e => e.target.style.borderColor="#e2e8f0"} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>Title</label>
                    <input value={linkForm.title} onChange={e => setLinkForm(f => ({...f, title: e.target.value}))} placeholder="PSA Document" style={{ width: "100%", padding: "10px 12px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", border: "1.5px solid #e2e8f0", borderRadius: 8, outline: "none", background: "#fff", color: "#0f172a", boxSizing: "border-box" }} onFocus={e => e.target.style.borderColor="#3b82f6"} onBlur={e => e.target.style.borderColor="#e2e8f0"} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>Type</label>
                    <select value={linkForm.type} onChange={e => setLinkForm(f => ({...f, type: e.target.value}))} style={{ width: "100%", padding: "10px 12px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", border: "1.5px solid #e2e8f0", borderRadius: 8, outline: "none", background: "#fff", color: "#0f172a", boxSizing: "border-box", appearance: "none" }}>
                      <option value="website">Website</option>
                      <option value="file">File</option>
                      <option value="video">Video</option>
                      <option value="spreadsheet">Spreadsheet</option>
                      <option value="document">Document</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => { setShowLinkForm(false); setLinkForm({ url: "", title: "", type: "website" }); }} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#64748b", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
                  <button onClick={handleAddLink} disabled={!linkForm.url.trim() || linkSaving} style={{ background: linkForm.url.trim() ? "linear-gradient(135deg, #3b82f6, #2563eb)" : "#e2e8f0", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, color: linkForm.url.trim() ? "#fff" : "#94a3b8", cursor: linkForm.url.trim() ? "pointer" : "default", fontFamily: "'DM Sans', sans-serif" }}>{linkSaving ? "Adding..." : "Add Link"}</button>
                </div>
              </div>
            )}

            {/* Upload error */}
            {uploadError && (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                <span style={{ fontSize: 13, color: "#dc2626", fontFamily: "'DM Sans', sans-serif", flex: 1 }}>{uploadError}</span>
                <button onClick={() => setUploadError(null)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 16, fontWeight: 700, padding: 0 }}>×</button>
              </div>
            )}

            {/* Document list */}
            {docsLoading ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ width: 28, height: 28, border: "3px solid #e2e8f0", borderTop: "3px solid #16a34a", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
              </div>
            ) : documents.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(22,163,74,0.06)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={1.5}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/></svg>
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: "0 0 4px" }}>No documents yet</p>
                <p style={{ fontSize: 13, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>Upload a file or add a link to get started.</p>
              </div>
            ) : (
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                {documents.map((doc, i) => {
                  const isLink = doc.is_link || (doc.mime_type && doc.mime_type.startsWith("link/"));
                  const linkType = isLink ? (doc.mime_type || "").replace("link/", "") : null;
                  const icon = isLink ? { label: (linkType || "LINK").toUpperCase().slice(0, 4), color: "#3b82f6" } : getDocIcon(doc.filename);
                  return (
                    <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: isMobile ? "12px 14px" : "14px 20px", borderBottom: i < documents.length - 1 ? "1px solid #f1f5f9" : "none", transition: "background 0.1s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div style={{ width: 38, height: 38, borderRadius: 8, background: icon.color + "12", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {isLink ? (
                          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={icon.color} strokeWidth={2}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                        ) : (
                          <span style={{ fontSize: 10, fontWeight: 800, color: icon.color, fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.04em" }}>{icon.label}</span>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.filename}</p>
                        <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: "2px 0 0" }}>
                          {isLink ? (linkType || "link") : fmtFileSize(doc.file_size)} · {fmtDate(doc.uploaded_at)} · {fmtUserName(doc.user_email)}
                        </p>
                      </div>
                      {isLink ? (
                        <button onClick={() => window.open(doc.storage_path, "_blank")} title="Open Link" style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={2}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </button>
                      ) : (
                        <button onClick={() => handleDownloadDoc(doc)} title="Download" style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </button>
                      )}
                      <button onClick={() => handleDeleteDoc(doc)} title="Delete" style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #fee2e2", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SHARED DEAL TAB ── */}
        {activeTab === "shared deal" && (
          <div>
            <h2 style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 20px", display: "flex", alignItems: "center", gap: 8 }}>
              Share This Deal <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
            </h2>
            {/* Add person form */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: isMobile ? "16px" : "20px 24px", marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: "0 0 14px" }}>Add a person</p>
              <div style={{ display: "flex", gap: 10, flexWrap: isMobile ? "wrap" : "nowrap" }}>
                <input value={shareEmail} onChange={e => setShareEmail(e.target.value)} placeholder="Email address" style={{ flex: 2, padding: "10px 14px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", border: "1.5px solid #e2e8f0", borderRadius: 8, outline: "none", background: "#fff", color: "#0f172a", boxSizing: "border-box", minWidth: 0 }} onFocus={e => e.target.style.borderColor="#16a34a"} onBlur={e => e.target.style.borderColor="#e2e8f0"} />
                <select value={shareRole} onChange={e => setShareRole(e.target.value)} style={{ flex: 1, padding: "10px 14px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", border: "1.5px solid #e2e8f0", borderRadius: 8, outline: "none", background: "#fff", color: "#0f172a", boxSizing: "border-box", appearance: "none", minWidth: 120 }}>
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
                <button onClick={handleShareDeal} disabled={!shareEmail.trim() || shareSaving} style={{ background: shareEmail.trim() ? "linear-gradient(135deg, #16a34a, #15803d)" : "#e2e8f0", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, color: shareEmail.trim() ? "#fff" : "#94a3b8", cursor: shareEmail.trim() ? "pointer" : "default", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", boxShadow: shareEmail.trim() ? "0 2px 10px rgba(22,163,74,0.3)" : "none" }}>{shareSaving ? "Adding..." : "Share"}</button>
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[{v:"viewer",l:"Viewer",d:"Can only view deal details"},{v:"editor",l:"Editor",d:"Can view and edit the deal"},{v:"admin",l:"Admin",d:"Full access including sharing"}].map(r => (
                  <span key={r.v} style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>
                    <strong style={{ color: "#64748b" }}>{r.l}:</strong> {r.d}
                  </span>
                ))}
              </div>
            </div>
            {/* Shared users list */}
            {sharedLoading ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ width: 28, height: 28, border: "3px solid #e2e8f0", borderTop: "3px solid #16a34a", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
              </div>
            ) : sharedUsers.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(22,163,74,0.06)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={1.5}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: "0 0 4px" }}>Not shared with anyone</p>
                <p style={{ fontSize: 13, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>Add people above to share this deal.</p>
              </div>
            ) : (
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                {sharedUsers.map((su, i) => {
                  const roleColors = { viewer: "#3b82f6", editor: "#d97706", admin: "#7c3aed" };
                  const roleColor = roleColors[su.role] || "#94a3b8";
                  return (
                    <div key={su.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: isMobile ? "12px 14px" : "14px 20px", borderBottom: i < sharedUsers.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                      <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>{fmtUserName(su.shared_with_email).split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>{fmtUserName(su.shared_with_email)}</p>
                        <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: "2px 0 0" }}>{su.shared_with_email}</p>
                      </div>
                      <select value={su.role} onChange={e => handleUpdateShareRole(su.id, e.target.value)} style={{ padding: "6px 10px", fontSize: 12, fontFamily: "'DM Sans', sans-serif", border: "1px solid #e2e8f0", borderRadius: 6, outline: "none", background: "#fff", color: roleColor, fontWeight: 600, appearance: "none", cursor: "pointer", minWidth: 80, textAlign: "center" }}>
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button onClick={() => handleRemoveShare(su.id)} title="Remove access" style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #fee2e2", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div>
            {/* Log Activity button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <button onClick={() => { setActivityForm({ type: "Note", description: "", date: new Date().toISOString().split("T")[0] }); setShowLogModal(true); }} style={{
                background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", borderRadius: 10,
                padding: "10px 20px", color: "#fff", fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                boxShadow: "0 2px 10px rgba(22,163,74,0.3)",
                display: "flex", alignItems: "center", gap: 7,
              }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14"/></svg>
                Log Activity
              </button>
            </div>

            {/* Activity timeline */}
            {activitiesLoading ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ width: 28, height: 28, border: "3px solid #e2e8f0", borderTop: "3px solid #16a34a", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
              </div>
            ) : activities.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(22,163,74,0.06)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={1.5}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: "0 0 4px" }}>No activity yet</p>
                <p style={{ fontSize: 13, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>Log your first note or activity to start the timeline.</p>
              </div>
            ) : (
              <div style={{ position: "relative", paddingLeft: 28 }}>
                {/* Timeline line */}
                <div style={{ position: "absolute", left: 11, top: 6, bottom: 6, width: 2, background: "#e2e8f0", borderRadius: 1 }} />
                {activities.map((act, i) => {
                  const cfg = ACTIVITY_ICONS[act.activity_type] || ACTIVITY_ICONS["Note"];
                  return (
                    <div key={act.id} style={{ position: "relative", marginBottom: i < activities.length - 1 ? 4 : 0 }}>
                      {/* Dot */}
                      <div style={{ position: "absolute", left: -22, top: 16, width: 12, height: 12, borderRadius: "50%", background: "#fff", border: `2.5px solid ${cfg.color}`, zIndex: 1 }} />
                      {/* Card */}
                      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: isMobile ? "14px 14px" : "16px 20px", transition: "all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: cfg.color + "12", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={cfg.icon}/></svg>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>{act.activity_type}</span>
                              <span style={{ fontSize: 11, color: "#cbd5e1" }}>·</span>
                              <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>{fmtDate(act.activity_date)}</span>
                              <span style={{ fontSize: 11, color: "#cbd5e1" }}>·</span>
                              <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>{fmtUserName(act.user_email)}</span>
                            </div>
                            <p style={{ fontSize: 13, color: "#334155", fontFamily: "'DM Sans', sans-serif", margin: 0, lineHeight: 1.6 }}>{act.description}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Log Activity Modal */}
            {showLogModal && (
              <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", animation: "fadeIn 0.2s ease" }}>
                <div onClick={() => setShowLogModal(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} />
                <div style={{
                  position: "relative", background: "#fff", width: isMobile ? "100%" : 480,
                  borderRadius: isMobile ? "20px 20px 0 0" : 20,
                  boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                  animation: isMobile ? "slideUp 0.3s cubic-bezier(0.25, 1, 0.5, 1)" : "fadeIn 0.25s ease",
                }}>
                  {/* Modal header */}
                  <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.02em" }}>Log Activity</h2>
                      <p style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: "2px 0 0" }}>Record a note, call, or meeting</p>
                    </div>
                    <button onClick={() => setShowLogModal(false)} style={{ width: 36, height: 36, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                  {/* Modal body */}
                  <div style={{ padding: "20px 24px 24px" }}>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>Activity Type</label>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {ACTIVITY_TYPES.filter(t => t !== "Status Change" && t !== "Document Added").map(t => {
                          const ac = activityForm.type === t;
                          const cfg = ACTIVITY_ICONS[t] || {};
                          return (
                            <button key={t} onClick={() => setActivityForm(prev => ({ ...prev, type: t }))} style={{
                              padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                              border: "1.5px solid " + (ac ? cfg.color : "#e2e8f0"),
                              background: ac ? cfg.color + "10" : "#fff",
                              color: ac ? cfg.color : "#64748b",
                              cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                              transition: "all 0.15s",
                            }}>{t}</button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>Date</label>
                      <input type="date" value={activityForm.date} onChange={e => setActivityForm(prev => ({ ...prev, date: e.target.value }))} style={{ width: "100%", padding: "10px 14px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", border: "1.5px solid #e2e8f0", borderRadius: 8, outline: "none", background: "#fff", color: "#0f172a", boxSizing: "border-box" }} />
                    </div>
                    <div style={{ marginBottom: 20 }}>
                      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>Description *</label>
                      <textarea value={activityForm.description} onChange={e => setActivityForm(prev => ({ ...prev, description: e.target.value }))} placeholder="What happened?" rows={4} style={{ width: "100%", padding: "10px 14px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", border: "1.5px solid #e2e8f0", borderRadius: 8, outline: "none", background: "#fff", color: "#0f172a", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6 }} onFocus={e => e.target.style.borderColor = "#16a34a"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => setShowLogModal(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
                      <button onClick={handleLogActivity} disabled={activitySaving || !activityForm.description.trim()} style={{
                        flex: 1, padding: "12px 0", borderRadius: 10, border: "none",
                        background: activityForm.description.trim() ? "linear-gradient(135deg, #16a34a, #15803d)" : "#e2e8f0",
                        color: activityForm.description.trim() ? "#fff" : "#94a3b8",
                        fontSize: 14, fontWeight: 600, cursor: activityForm.description.trim() ? "pointer" : "default",
                        fontFamily: "'DM Sans', sans-serif",
                        boxShadow: activityForm.description.trim() ? "0 2px 10px rgba(22,163,74,0.3)" : "none",
                        opacity: activitySaving ? 0.7 : 1,
                      }}>
                        {activitySaving ? "Saving..." : "Log Activity"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "investor updates" && (
          <div>
            {/* Engagement Metrics Dashboard */}
            {updates.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <button onClick={() => { setShowEngagement(!showEngagement); if (!showEngagement) fetchEngagementMetrics(); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 12, border: "1px solid #e2e8f0", background: showEngagement ? "#f0fdf4" : "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: showEngagement ? "#16a34a" : "#64748b", fontFamily: "'DM Sans', sans-serif", width: "100%", marginBottom: showEngagement ? 14 : 0 }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
                  Engagement Metrics
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ marginLeft: "auto", transform: showEngagement ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {showEngagement && (() => {
                  const totalUpdates = updates.length;
                  const publicUpdates = updates.filter(u => u.is_public !== false).length;
                  const totalReads = engagementData.reads.length;
                  const uniqueReaders = new Set(engagementData.reads.map(r => r.portal_email)).size;
                  const totalNotifs = engagementData.notifications.length;
                  const sentNotifs = engagementData.notifications.filter(n => n.status === "sent").length;
                  const failedNotifs = engagementData.notifications.filter(n => n.status === "failed").length;
                  const emailNotifs = engagementData.notifications.filter(n => n.notification_type === "email");
                  const smsNotifs = engagementData.notifications.filter(n => n.notification_type === "sms");

                  // Per-update engagement
                  const readsByUpdate = {};
                  engagementData.reads.forEach(r => { readsByUpdate[r.update_id] = (readsByUpdate[r.update_id] || 0) + 1; });
                  const notifsByUpdate = {};
                  engagementData.notifications.forEach(n => { if (!notifsByUpdate[n.update_id]) notifsByUpdate[n.update_id] = []; notifsByUpdate[n.update_id].push(n); });

                  return (
                    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                      {/* Summary Cards */}
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 0, borderBottom: "1px solid #f1f5f9" }}>
                        {[
                          { label: "Total Updates", value: totalUpdates, sub: publicUpdates + " public", color: "#0f172a" },
                          { label: "Read Receipts", value: totalReads, sub: uniqueReaders + " unique investor" + (uniqueReaders !== 1 ? "s" : ""), color: "#16a34a" },
                          { label: "Notifications Sent", value: sentNotifs, sub: totalNotifs + " total" + (failedNotifs > 0 ? " · " + failedNotifs + " failed" : ""), color: "#2563eb" },
                          { label: "Delivery Rate", value: totalNotifs > 0 ? Math.round((sentNotifs / totalNotifs) * 100) + "%" : "—", sub: emailNotifs.length + " email · " + smsNotifs.length + " SMS", color: "#7c3aed" },
                        ].map((card, i) => (
                          <div key={i} style={{ padding: 18, borderRight: (isMobile ? (i % 2 === 0) : (i < 3)) ? "1px solid #f1f5f9" : "none", borderBottom: isMobile && i < 2 ? "1px solid #f1f5f9" : "none" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>{card.label}</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: card.color, fontFamily: "'DM Sans', sans-serif" }}>{card.value}</div>
                            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{card.sub}</div>
                          </div>
                        ))}
                      </div>

                      {/* Per-update breakdown */}
                      <div style={{ padding: 18 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12, fontFamily: "'DM Sans', sans-serif" }}>Update Performance</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {updates.slice(0, 5).map(u => {
                            const reads = readsByUpdate[u.id] || 0;
                            const notifs = notifsByUpdate[u.id] || [];
                            const sent = notifs.filter(n => n.status === "sent").length;
                            const tc = {
                              "Construction Progress": "#EA580C", "Financial Update": "#2563EB",
                              "Status Change": "#16A34A", "General Announcement": "#7C3AED",
                            }[u.update_type] || "#64748b";
                            return (
                              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                                <div style={{ width: 4, height: 32, borderRadius: 2, background: tc, flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.title}</div>
                                  <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>{new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                                </div>
                                <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                                  <div style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: "#16a34a" }}>{reads}</div>
                                    <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>Reads</div>
                                  </div>
                                  <div style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: "#2563eb" }}>{sent}</div>
                                    <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>Sent</div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {uniqueReaders > 0 && (
                          <div style={{ marginTop: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>Active Investors</div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {[...new Set(engagementData.reads.map(r => r.portal_email))].map(email => {
                                const readCount = engagementData.reads.filter(r => r.portal_email === email).length;
                                return (
                                  <span key={email} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", fontFamily: "'DM Sans', sans-serif" }}>
                                    {email.split("@")[0]} · {readCount} read{readCount !== 1 ? "s" : ""}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Post New Update */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: isMobile ? 16 : 24, marginBottom: 20 }}>
              <h2 style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
                Post Investor Update <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
              </h2>

              <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                {[
                  { id: "Construction Progress", color: "#EA580C", bg: "#FFF7ED", border: "#FDBA74" },
                  { id: "Financial Update", color: "#2563EB", bg: "#EFF6FF", border: "#93C5FD" },
                  { id: "Status Change", color: "#16A34A", bg: "#F0FDF4", border: "#86EFAC" },
                  { id: "General Announcement", color: "#7C3AED", bg: "#F5F3FF", border: "#C4B5FD" },
                ].map(t => (
                  <button key={t.id} onClick={() => setUpdateForm(prev => ({ ...prev, type: t.id }))} style={{
                    padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
                    border: "1.5px solid " + (updateForm.type === t.id ? t.color : "#e2e8f0"),
                    background: updateForm.type === t.id ? t.bg : "#fff",
                    color: updateForm.type === t.id ? t.color : "#64748b",
                  }}>{t.id}</button>
                ))}
              </div>

              <input value={updateForm.title} onChange={e => setUpdateForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Update title" style={{ width: "100%", padding: "10px 14px", fontSize: 14, fontFamily: "'DM Sans', sans-serif", border: "1.5px solid #e2e8f0", borderRadius: 10, outline: "none", background: "#fff", color: "#0f172a", boxSizing: "border-box", marginBottom: 12 }}
                onFocus={e => e.target.style.borderColor = "#16a34a"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />

              <textarea value={updateForm.content} onChange={e => setUpdateForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Write your update here... This will be visible to all investors linked to this deal."
                rows={4} style={{ width: "100%", padding: "10px 14px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", border: "1.5px solid #e2e8f0", borderRadius: 10, outline: "none", background: "#fff", color: "#0f172a", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6, marginBottom: 14 }}
                onFocus={e => e.target.style.borderColor = "#16a34a"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />

              {/* Photo Upload */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "6px 14px", borderRadius: 8, border: "1px dashed #cbd5e1", background: "#f8fafc", fontSize: 12, fontWeight: 600, color: "#64748b", fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s" }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    {photoUploading ? "Uploading..." : "Add Photos"}
                    <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={async (e) => {
                      const files = Array.from(e.target.files);
                      if (files.length === 0) return;
                      setPhotoUploading(true);
                      const newPhotos = [];
                      for (const file of files) {
                        if (file.size > 10 * 1024 * 1024) { alert(file.name + " is too large (max 10MB)"); continue; }
                        const storagePath = `update-photos/${deal._id}/${Date.now()}_${file.name}`;
                        const { data, error } = await supabase.storage.from("deal-documents").upload(storagePath, file, { upsert: false });
                        if (error) { console.error("Photo upload error:", error); continue; }
                        const { data: urlData } = supabase.storage.from("deal-documents").getPublicUrl(storagePath);
                        newPhotos.push({ path: storagePath, url: urlData.publicUrl, name: file.name });
                      }
                      setUpdatePhotos(prev => [...prev, ...newPhotos]);
                      setPhotoUploading(false);
                      e.target.value = "";
                    }} />
                  </label>
                  {updatePhotos.length > 0 && <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{updatePhotos.length} photo{updatePhotos.length !== 1 ? "s" : ""} attached</span>}
                </div>
                {updatePhotos.length > 0 && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {updatePhotos.map((p, i) => (
                      <div key={i} style={{ position: "relative", width: 72, height: 72, borderRadius: 10, overflow: "hidden", border: "1px solid #e2e8f0" }}>
                        <img src={p.url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button onClick={() => {
                          supabase.storage.from("deal-documents").remove([p.path]);
                          setUpdatePhotos(prev => prev.filter((_, idx) => idx !== i));
                        }} style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Public / Private toggle */}
              <div style={{ marginBottom: 14, padding: "12px 16px", borderRadius: 10, background: updateForm.isPublic ? "#f0fdf4" : "#fef9c3", border: "1px solid " + (updateForm.isPublic ? "#86efac" : "#fde68a"), transition: "all 0.2s" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button onClick={() => setUpdateForm(prev => ({ ...prev, isPublic: !prev.isPublic }))} style={{
                      width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
                      background: updateForm.isPublic ? "#16a34a" : "#eab308", position: "relative", transition: "background 0.2s",
                    }}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: updateForm.isPublic ? 21 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                    </button>
                    <span style={{ fontSize: 13, fontWeight: 600, color: updateForm.isPublic ? "#16a34a" : "#a16207", fontFamily: "'DM Sans', sans-serif" }}>
                      {updateForm.isPublic ? "Public — visible to investors" : "Private — internal team only"}
                    </span>
                  </div>
                  <span style={{ fontSize: 20 }}>{updateForm.isPublic ? "🌐" : "🔒"}</span>
                </div>
              </div>

              {/* Notify investors toggle */}
              {linkedInvestors.length > 0 && updateForm.isPublic && (
                <div style={{ marginBottom: 14, padding: "12px 16px", borderRadius: 10, background: notifyInvestors ? "#f0fdf4" : "#f8fafc", border: "1px solid " + (notifyInvestors ? "#86efac" : "#e2e8f0"), transition: "all 0.2s" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: notifyInvestors ? 10 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button onClick={() => setNotifyInvestors(!notifyInvestors)} style={{
                        width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
                        background: notifyInvestors ? "#16a34a" : "#cbd5e1", position: "relative", transition: "background 0.2s",
                      }}>
                        <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: notifyInvestors ? 21 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                      </button>
                      <span style={{ fontSize: 13, fontWeight: 600, color: notifyInvestors ? "#16a34a" : "#64748b", fontFamily: "'DM Sans', sans-serif" }}>
                        Notify {linkedInvestors.length} investor{linkedInvestors.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>
                      {linkedInvestors.reduce((sum, inv) => sum + inv.allEmails.length, 0)} email{linkedInvestors.reduce((sum, inv) => sum + inv.allEmails.length, 0) !== 1 ? "s" : ""}
                      {linkedInvestors.reduce((sum, inv) => sum + inv.allPhones.length, 0) > 0 ? ` · ${linkedInvestors.reduce((sum, inv) => sum + inv.allPhones.length, 0)} SMS` : ""}
                    </span>
                  </div>
                  {notifyInvestors && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {linkedInvestors.map(inv => (
                        <span key={inv.id} style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: "#fff", border: "1px solid #e2e8f0", color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>
                          {inv.investor_name}{inv.allEmails.length > 0 ? " ✓" : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button onClick={async () => {
                if (!updateForm.title.trim() || !updateForm.content.trim() || !deal?._id) return;
                setUpdateSaving(true);
                try {
                  // 1. Post the update
                  const photoUrls = updatePhotos.length > 0 ? JSON.stringify(updatePhotos.map(p => ({ url: p.url, path: p.path, name: p.name }))) : null;
                  const { data: insertedRows, error } = await supabase.from("investor_updates").insert({
                    deal_id: deal._id, update_type: updateForm.type,
                    title: updateForm.title.trim(), body: updateForm.content.trim(),
                    posted_by: userEmail, is_public: updateForm.isPublic,
                    photos: photoUrls,
                  }).select();
                  if (error) throw error;
                  const updateId = insertedRows && insertedRows[0] ? insertedRows[0].id : null;

                  // 2. Create notification records for each investor (only if public)
                  if (updateForm.isPublic && notifyInvestors && updateId && linkedInvestors.length > 0) {
                    const notifRecords = [];
                    linkedInvestors.forEach(inv => {
                      inv.allEmails.forEach(email => {
                        notifRecords.push({
                          update_id: updateId, investor_id: inv.id,
                          contact_email: email, contact_name: inv.investor_name,
                          notification_type: "email", status: "pending",
                        });
                      });
                      inv.allPhones.forEach(phone => {
                        notifRecords.push({
                          update_id: updateId, investor_id: inv.id,
                          contact_phone: phone, contact_name: inv.investor_name,
                          notification_type: "sms", status: "pending",
                        });
                      });
                    });
                    if (notifRecords.length > 0) {
                      await supabase.from("investor_notifications").insert(notifRecords);
                      // 3. Invoke Edge Function to actually deliver notifications
                      try {
                        await supabase.functions.invoke("send-investor-notifications", {
                          body: { updateId },
                        });
                      } catch (fnErr) {
                        console.log("[REAP] Edge Function not deployed yet, notifications queued as pending:", fnErr);
                      }
                    }
                  }

                  setUpdateForm({ title: "", content: "", type: "General Announcement", isPublic: true });
                  setUpdatePhotos([]);
                  fetchInvestorUpdates();
                } catch (err) { alert("Error posting update: " + err.message); } finally { setUpdateSaving(false); }
              }} disabled={updateSaving || !updateForm.title.trim() || !updateForm.content.trim()} style={{
                padding: "10px 24px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, cursor: updateForm.title.trim() && updateForm.content.trim() ? "pointer" : "default",
                fontFamily: "'DM Sans', sans-serif",
                background: updateForm.title.trim() && updateForm.content.trim() ? "linear-gradient(135deg, #16a34a, #15803d)" : "#e2e8f0",
                color: updateForm.title.trim() && updateForm.content.trim() ? "#fff" : "#94a3b8",
                boxShadow: updateForm.title.trim() && updateForm.content.trim() ? "0 2px 10px rgba(22,163,74,0.3)" : "none",
                opacity: updateSaving ? 0.7 : 1, transition: "all 0.2s",
              }}>
                {updateSaving ? "Posting..." : (updateForm.isPublic && notifyInvestors && linkedInvestors.length > 0 ? "Post & Notify" : "Post Update")}
              </button>
            </div>

            {/* Previous Updates */}
            <h2 style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
              Previous Updates ({updates.length}) <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
            </h2>

            {updatesLoading ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ width: 28, height: 28, border: "3px solid #e2e8f0", borderTop: "3px solid #16a34a", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
              </div>
            ) : updates.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={1.8}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: "0 0 4px" }}>No updates yet</p>
                <p style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>Post your first investor update above to get started.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {updates.map(u => {
                  const typeConfig = {
                    "Construction Progress": { color: "#EA580C", bg: "#FFF7ED", border: "#FDBA74" },
                    "Financial Update": { color: "#2563EB", bg: "#EFF6FF", border: "#93C5FD" },
                    "Status Change": { color: "#16A34A", bg: "#F0FDF4", border: "#86EFAC" },
                    "General Announcement": { color: "#7C3AED", bg: "#F5F3FF", border: "#C4B5FD" },
                  }[u.update_type] || { color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" };
                  return (
                    <div key={u.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: isMobile ? 14 : 20, position: "relative" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                        <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", background: typeConfig.bg, color: typeConfig.color, border: "1px solid " + typeConfig.border }}>{u.update_type}</span>
                        <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>{new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", background: u.is_public !== false ? "#f0fdf4" : "#fef9c3", color: u.is_public !== false ? "#16a34a" : "#a16207", border: "1px solid " + (u.is_public !== false ? "#86efac" : "#fde68a") }}>{u.is_public !== false ? "Public" : "Private"}</span>
                        <span style={{ fontSize: 11, color: "#cbd5e1", fontFamily: "'DM Mono', monospace" }}>{u.posted_by}</span>
                        {notificationsSent[u.id] && notificationsSent[u.id].length > 0 && (
                          <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", border: "1px solid #86efac", fontFamily: "'DM Sans', sans-serif" }}>
                            {notificationsSent[u.id].filter(n => n.status === "sent").length}/{notificationsSent[u.id].length} notified
                          </span>
                        )}
                      </div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: "0 0 6px" }}>{u.title}</h3>
                      <p style={{ fontSize: 13, color: "#475569", fontFamily: "'DM Sans', sans-serif", margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{u.body}</p>
                      {u.photos && (() => { try { const photos = JSON.parse(u.photos); return photos.length > 0 ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                          {photos.map((p, i) => (
                            <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" style={{ width: 80, height: 80, borderRadius: 10, overflow: "hidden", border: "1px solid #e2e8f0", display: "block" }}>
                              <img src={p.url} alt={p.name || "Photo"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            </a>
                          ))}
                        </div>
                      ) : null; } catch { return null; } })()}
                      <button onClick={async () => {
                        if (!window.confirm("Delete this update?")) return;
                        try {
                          if (u.photos) { try { const photos = JSON.parse(u.photos); await supabase.storage.from("deal-documents").remove(photos.map(p => p.path)); } catch {} }
                          await supabase.from("investor_updates").delete().eq("id", u.id);
                          fetchInvestorUpdates();
                        } catch (err) { alert("Error: " + err.message); }
                      }} style={{ position: "absolute", top: isMobile ? 10 : 16, right: isMobile ? 10 : 16, width: 28, height: 28, borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="Delete update">
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   INVESTOR PORTAL VIEW — branded portal for investors
   ═══════════════════════════════════════════════════════ */
function InvestorPortalView({ investorProfile, onSignOut }) {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [deals, setDeals] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [readUpdates, setReadUpdates] = useState(new Set());
  const [typeFilter, setTypeFilter] = useState(null);
  const [notifPrefs, setNotifPrefs] = useState({ email: true, sms: true });
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  // Fetch notification preferences + check onboarding
  useEffect(() => {
    if (!investorProfile?.id) return;
    async function fetchPrefs() {
      try {
        const { data } = await supabase.from("investors").select("notification_prefs").eq("id", investorProfile.id).limit(1);
        if (data && data[0] && data[0].notification_prefs) {
          try { setNotifPrefs(JSON.parse(data[0].notification_prefs)); } catch {}
        }
        // Check if investor has been onboarded (stored in localStorage)
        const onboardedKey = `reap_onboarded_${investorProfile.id}`;
        if (!localStorage.getItem(onboardedKey)) {
          setShowOnboarding(true);
        }
      } catch {}
      setPrefsLoaded(true);
    }
    fetchPrefs();
  }, [investorProfile?.id]);

  // Fetch investor's linked deals
  useEffect(() => {
    if (!investorProfile?.linkedDealAddresses?.length) { setLoading(false); return; }
    async function fetchData() {
      setLoading(true);
      try {
        // Fetch deals by address
        const { data: allDeals } = await supabase.from("deals").select("*");
        const linked = (allDeals || []).filter(d => investorProfile.linkedDealAddresses.includes(d.property_address));
        const v = (val) => val != null ? String(val) : "";
        const parsed = linked.map(r => ({
          _id: r.id, address: r.property_address || "", status: r.deal_status || "", type: r.type || "",
          purchasePrice: v(r.purchase_price), arv: v(r.arv_value), profit: v(r.profit), roi: v(r.roi),
          improvementBudget: v(r.improvement_budget), capRate: v(r.cap_rate),
          noiAnnual: v(r.noi_annual), cashFlowMonthly: v(r.cash_flow_monthly),
          city: r.city || "", state: r.state || "", dealName: r.deal_name || "",
        }));
        setDeals(parsed);

        // Fetch updates for all linked deals
        const dealIds = parsed.map(d => d._id).filter(Boolean);
        if (dealIds.length > 0) {
          const { data: updatesData } = await supabase.from("investor_updates").select("*").in("deal_id", dealIds).eq("is_public", true).order("created_at", { ascending: false });
          setUpdates(updatesData || []);

          // Fetch read receipts for this investor
          const { data: reads } = await supabase.from("investor_update_reads").select("update_id").eq("portal_email", investorProfile.email);
          const readSet = new Set((reads || []).map(r => r.update_id));
          setReadUpdates(readSet);

          // Mark all currently fetched updates as read
          const unread = (updatesData || []).filter(u => !readSet.has(u.id));
          if (unread.length > 0) {
            const readRecords = unread.map(u => ({
              update_id: u.id, investor_id: investorProfile.id,
              portal_email: investorProfile.email,
            }));
            await supabase.from("investor_update_reads").insert(readRecords).then(() => {
              setReadUpdates(prev => {
                const next = new Set(prev);
                unread.forEach(u => next.add(u.id));
                return next;
              });
            });
          }
        }
      } catch (err) { console.error("Portal data error:", err); } finally { setLoading(false); }
    }
    fetchData();
  }, [investorProfile]);

  const typeConfig = (type) => ({
    "Construction Progress": { color: "#EA580C", bg: "#FFF7ED", border: "#FDBA74", icon: "🏗️" },
    "Financial Update": { color: "#2563EB", bg: "#EFF6FF", border: "#93C5FD", icon: "💰" },
    "Status Change": { color: "#16A34A", bg: "#F0FDF4", border: "#86EFAC", icon: "📋" },
    "General Announcement": { color: "#7C3AED", bg: "#F5F3FF", border: "#C4B5FD", icon: "📢" },
  }[type] || { color: "#64748b", bg: "#f8fafc", border: "#e2e8f0", icon: "📝" });

  const fmt = (v) => { const n = parseFloat(v); return isNaN(n) ? "—" : "$" + n.toLocaleString(); };

  const completeOnboarding = () => {
    const onboardedKey = `reap_onboarded_${investorProfile.id}`;
    localStorage.setItem(onboardedKey, "true");
    setShowOnboarding(false);
  };

  // ── Onboarding Welcome Screen ──
  if (showOnboarding && !loading) {
    const steps = [
      { title: "Welcome to Your Investor Portal", subtitle: "We're glad you're here, " + (investorProfile?.investorName?.split(" ")[0] || "Investor") + ".", icon: (
        <div style={{ width: 80, height: 80, borderRadius: 20, background: "linear-gradient(135deg, #16a34a, #15803d)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 8px 30px rgba(22,163,74,0.3)" }}>
          <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        </div>
      ), body: (
        <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.7, maxWidth: 420, margin: "0 auto" }}>
          <p style={{ marginBottom: 16 }}>This is your personal portal with <strong style={{ color: "#0f172a" }}>{investorProfile?.company || "the team"}</strong>. Here you can track your investments, view property updates, and stay informed on deal progress.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 20 }}>
            {[{ icon: "📊", label: "Dashboard", desc: "See your portfolio at a glance" }, { icon: "📰", label: "Updates", desc: "Construction & financial news" }, { icon: "🏠", label: "My Deals", desc: "Detailed property info" }, { icon: "⚙️", label: "Settings", desc: "Notification preferences" }].map(f => (
              <div key={f.label} style={{ padding: 16, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{f.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>{f.label}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )},
      { title: "Your Investments", subtitle: deals.length > 0 ? "You're linked to " + deals.length + " active deal" + (deals.length !== 1 ? "s" : "") + "." : "Your deals will appear here once linked.", icon: (
        <div style={{ width: 80, height: 80, borderRadius: 20, background: "linear-gradient(135deg, #2563eb, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 8px 30px rgba(37,99,235,0.3)" }}>
          <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
      ), body: (
        <div style={{ maxWidth: 420, margin: "0 auto" }}>
          {deals.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {deals.slice(0, 4).map(d => (
                <div key={d._id} style={{ padding: 16, borderRadius: 12, background: "#fff", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{d.dealName || d.address}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{d.city}{d.state ? ", " + d.state : ""}</div>
                  </div>
                  <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", border: "1px solid #86efac" }}>{d.status || "Active"}</span>
                </div>
              ))}
              {deals.length > 4 && <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center" }}>+{deals.length - 4} more properties</div>}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 30, background: "#f8fafc", borderRadius: 14, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🏗️</div>
              <p style={{ fontSize: 14, color: "#475569" }}>No deals linked yet. Your investment team will connect your properties here shortly.</p>
            </div>
          )}
        </div>
      )},
      { title: "Stay in the Loop", subtitle: "Choose how you'd like to receive updates.", icon: (
        <div style={{ width: 80, height: 80, borderRadius: 20, background: "linear-gradient(135deg, #7c3aed, #6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 8px 30px rgba(124,58,237,0.3)" }}>
          <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </div>
      ), body: (
        <div style={{ maxWidth: 360, margin: "0 auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[{ key: "email", icon: "📧", label: "Email Notifications", desc: "Get updates delivered to your inbox" },
              { key: "sms", icon: "📱", label: "SMS Notifications", desc: "Instant text alerts for new updates" }].map(ch => (
              <div key={ch.key} onClick={() => setNotifPrefs(prev => ({ ...prev, [ch.key]: !prev[ch.key] }))} style={{ padding: 18, borderRadius: 14, background: notifPrefs[ch.key] ? "#f0fdf4" : "#fff", border: "1.5px solid " + (notifPrefs[ch.key] ? "#16a34a" : "#e2e8f0"), cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 24 }}>{ch.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{ch.label}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>{ch.desc}</div>
                </div>
                <div style={{ width: 22, height: 22, borderRadius: 6, border: "2px solid " + (notifPrefs[ch.key] ? "#16a34a" : "#cbd5e1"), background: notifPrefs[ch.key] ? "#16a34a" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
                  {notifPrefs[ch.key] && <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )},
    ];
    const step = steps[onboardingStep];
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f8fafc 0%, #f0fdf4 100%)", fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');
          @keyframes fadeSlide { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
        <div key={onboardingStep} style={{ maxWidth: 520, width: "100%", textAlign: "center", animation: "fadeSlide 0.4s ease" }}>
          {step.icon}
          <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: "0 0 8px" }}>{step.title}</h1>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 28 }}>{step.subtitle}</p>
          {step.body}
        </div>
        <div style={{ marginTop: 36, display: "flex", gap: 12, alignItems: "center" }}>
          {onboardingStep > 0 && (
            <button onClick={() => setOnboardingStep(s => s - 1)} style={{ padding: "10px 24px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>Back</button>
          )}
          {onboardingStep < steps.length - 1 ? (
            <button onClick={() => setOnboardingStep(s => s + 1)} style={{ padding: "10px 28px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 10px rgba(22,163,74,0.3)" }}>Continue</button>
          ) : (
            <button onClick={async () => {
              // Save notification preferences
              try { await supabase.from("investors").update({ notification_prefs: JSON.stringify(notifPrefs) }).eq("id", investorProfile.id); } catch {}
              completeOnboarding();
            }} style={{ padding: "10px 28px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 10px rgba(22,163,74,0.3)" }}>Enter Portal</button>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ width: i === onboardingStep ? 24 : 8, height: 8, borderRadius: 4, background: i === onboardingStep ? "#16a34a" : "#cbd5e1", transition: "all 0.3s" }} />
          ))}
        </div>
        <button onClick={completeOnboarding} style={{ marginTop: 16, background: "none", border: "none", color: "#94a3b8", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Skip for now</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: isMobile ? "16px 20px" : "16px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg, #16a34a, #15803d)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(22,163,74,0.3)" }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <div>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", letterSpacing: "-0.02em" }}>{investorProfile?.company || "Investor Portal"}</span>
            <span style={{ fontSize: 10, color: "#94a3b8", display: "block", marginTop: -1 }}>Powered by <span style={{ color: "#16a34a", fontWeight: 700 }}>Reap</span></span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", display: "block" }}>{investorProfile?.investorName || "Investor"}</span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{investorProfile?.company || ""}</span>
          </div>
          <button onClick={onSignOut} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Sign Out</button>
        </div>
      </div>

      {/* Nav tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: isMobile ? "0 16px" : "0 40px" }}>
        <div style={{ display: "flex", gap: 0 }}>
          {(() => {
            const unreadCount = updates.filter(u => !readUpdates.has(u.id)).length;
            return [{ id: "dashboard", label: "Dashboard" }, { id: "updates", label: "Updates" }, { id: "deals", label: "My Deals" }, { id: "settings", label: "Settings" }].map(t => (
              <button key={t.id} onClick={() => { setActiveSection(t.id); setSelectedDeal(null); }} style={{
                background: "transparent", border: "none", borderBottom: activeSection === t.id ? "2px solid #16a34a" : "2px solid transparent",
                padding: "12px 20px", color: activeSection === t.id ? "#16a34a" : "#94a3b8", fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s", marginBottom: -1, position: "relative", display: "flex", alignItems: "center", gap: 6,
              }}>
                {t.label}
                {t.id === "updates" && unreadCount > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, borderRadius: 9, background: "#16a34a", color: "#fff", fontSize: 10, fontWeight: 700, padding: "0 5px", lineHeight: 1 }}>{unreadCount}</span>
                )}
              </button>
            ));
          })()}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: isMobile ? "20px 16px" : "28px 40px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTop: "3px solid #16a34a", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
            <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 16 }}>Loading your portfolio...</p>
          </div>
        ) : selectedDeal ? (
          /* ── Deal Detail View ── */
          <div>
            <button onClick={() => setSelectedDeal(null)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#16a34a", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginBottom: 20 }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6"/></svg>
              Back to {activeSection === "deals" ? "My Deals" : "Dashboard"}
            </button>
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: isMobile ? 16 : 28, marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: "0 0 4px" }}>{selectedDeal.dealName || selectedDeal.address}</h2>
              <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 20px" }}>{selectedDeal.city}{selectedDeal.state ? ", " + selectedDeal.state : ""}</p>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 14 }}>
                {[{ label: "Status", value: selectedDeal.status }, { label: "Type", value: selectedDeal.type }, { label: "Purchase Price", value: fmt(selectedDeal.purchasePrice) }, { label: "ARV", value: fmt(selectedDeal.arv) }, { label: "Improvement Budget", value: fmt(selectedDeal.improvementBudget) }, { label: "Cap Rate", value: selectedDeal.capRate ? selectedDeal.capRate + "%" : "—" }, { label: "NOI (Annual)", value: fmt(selectedDeal.noiAnnual) }, { label: "Cash Flow / Mo", value: fmt(selectedDeal.cashFlowMonthly) }].map(m => (
                  <div key={m.label} style={{ padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{m.value || "—"}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Updates for this deal */}
            <h3 style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px" }}>Updates for This Property</h3>
            {updates.filter(u => u.deal_id === selectedDeal._id).length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0" }}>
                <p style={{ fontSize: 13, color: "#94a3b8" }}>No updates posted for this property yet.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {updates.filter(u => u.deal_id === selectedDeal._id).map(u => {
                  const tc = typeConfig(u.update_type);
                  return (
                    <div key={u.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: isMobile ? 14 : 20, borderLeft: "4px solid " + tc.color }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: tc.bg, color: tc.color, border: "1px solid " + tc.border }}>{u.update_type}</span>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>{new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                      <h4 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>{u.title}</h4>
                      <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{u.body}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeSection === "dashboard" ? (
          /* ── Dashboard ── */
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: "0 0 4px" }}>Welcome back, {(investorProfile?.investorName || "").split(" ")[0] || "Investor"}</h1>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 24px" }}>Here's an overview of your investments.</p>

            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 14, marginBottom: 28 }}>
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Active Deals</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#0f172a" }}>{deals.length}</div>
              </div>
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Unread Updates</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#16a34a" }}>{updates.filter(u => !readUpdates.has(u.id)).length}</div>
              </div>
              {!isMobile && (
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Capital Committed</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#0f172a" }}>{fmt(investorProfile?.capitalCommitted)}</div>
                </div>
              )}
            </div>

            {/* Recent updates */}
            <h2 style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
              Recent Updates <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
            </h2>
            {updates.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: "0 0 4px" }}>No updates yet</p>
                <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Updates from the team will appear here as they're posted.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {updates.slice(0, 5).map(u => {
                  const tc = typeConfig(u.update_type);
                  const deal = deals.find(d => d._id === u.deal_id);
                  const isUnread = !readUpdates.has(u.id);
                  return (
                    <div key={u.id} onClick={() => { const d = deals.find(dd => dd._id === u.deal_id); if (d) { setSelectedDeal(d); setActiveSection("deals"); } }} style={{ background: isUnread ? "#f0fdf4" : "#fff", borderRadius: 14, border: "1px solid " + (isUnread ? "#bbf7d0" : "#e2e8f0"), padding: isMobile ? 14 : 20, borderLeft: "4px solid " + tc.color, cursor: deal ? "pointer" : "default", transition: "box-shadow 0.2s", position: "relative" }}>
                      {isUnread && <span style={{ position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: "50%", background: "#16a34a" }} />}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                        <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: tc.bg, color: tc.color, border: "1px solid " + tc.border }}>{u.update_type}</span>
                        {deal && <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 600 }}>{deal.dealName || deal.address}</span>}
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>{new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>{u.title}</h3>
                      <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, margin: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{u.body}</p>
                      {u.photos && (() => { try { const photos = JSON.parse(u.photos); return photos.length > 0 ? (
                        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                          {photos.slice(0, 4).map((p, i) => (
                            <div key={i} style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0", position: "relative" }}>
                              <img src={p.url} alt={p.name || "Photo"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              {i === 3 && photos.length > 4 && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>+{photos.length - 4}</div>}
                            </div>
                          ))}
                        </div>
                      ) : null; } catch { return null; } })()}
                    </div>
                  );
                })}
                {updates.length > 5 && (
                  <button onClick={() => setActiveSection("updates")} style={{ padding: "10px 0", background: "none", border: "none", color: "#16a34a", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>View all {updates.length} updates →</button>
                )}
              </div>
            )}

            {/* Deals overview */}
            {deals.length > 0 && (
              <>
                <h2 style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "28px 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
                  Your Properties ({deals.length}) <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
                  {deals.map(d => (
                    <div key={d._id} onClick={() => { setSelectedDeal(d); setActiveSection("deals"); }} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 18, cursor: "pointer", transition: "box-shadow 0.2s" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 2px" }}>{d.dealName || d.address}</h3>
                          <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>{d.city}{d.state ? ", " + d.state : ""}</p>
                        </div>
                        <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: d.status === "Active" ? "#f0fdf4" : "#f8fafc", color: d.status === "Active" ? "#16a34a" : "#64748b", border: "1px solid " + (d.status === "Active" ? "#86efac" : "#e2e8f0") }}>{d.status || "New"}</span>
                      </div>
                      <div style={{ display: "flex", gap: 16 }}>
                        <div><div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>Purchase</div><div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{fmt(d.purchasePrice)}</div></div>
                        <div><div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>ARV</div><div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{fmt(d.arv)}</div></div>
                        {d.roi && <div><div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>ROI</div><div style={{ fontSize: 13, fontWeight: 700, color: "#16a34a" }}>{d.roi}%</div></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : activeSection === "updates" ? (
          /* ── All Updates ── */
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: "0 0 16px" }}>All Updates</h1>
            {/* Type filter */}
            <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
              <button onClick={() => setTypeFilter(null)} style={{ padding: "5px 14px", borderRadius: 20, border: "1px solid " + (!typeFilter ? "#16a34a" : "#e2e8f0"), background: !typeFilter ? "#f0fdf4" : "#fff", color: !typeFilter ? "#16a34a" : "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>All ({updates.length})</button>
              {["Construction Progress", "Financial Update", "Status Change", "General Announcement"].map(t => {
                const count = updates.filter(u => u.update_type === t).length;
                if (count === 0) return null;
                const tc = typeConfig(t);
                return <button key={t} onClick={() => setTypeFilter(t)} style={{ padding: "5px 14px", borderRadius: 20, border: "1px solid " + (typeFilter === t ? tc.color : "#e2e8f0"), background: typeFilter === t ? tc.bg : "#fff", color: typeFilter === t ? tc.color : "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>{t} ({count})</button>;
              })}
            </div>
            {(() => {
              const filtered = typeFilter ? updates.filter(u => u.update_type === typeFilter) : updates;
              return filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: "0 0 4px" }}>{typeFilter ? "No " + typeFilter.toLowerCase() + " updates" : "No updates yet"}</p>
                  <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>{typeFilter ? "Try selecting a different filter." : "Check back soon for investment updates."}</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filtered.map(u => {
                    const tc = typeConfig(u.update_type);
                    const deal = deals.find(d => d._id === u.deal_id);
                    const isUnread = !readUpdates.has(u.id);
                    return (
                      <div key={u.id} style={{ background: isUnread ? "#f0fdf4" : "#fff", borderRadius: 14, border: "1px solid " + (isUnread ? "#bbf7d0" : "#e2e8f0"), padding: isMobile ? 14 : 20, borderLeft: "4px solid " + tc.color, position: "relative" }}>
                        {isUnread && <span style={{ position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: "50%", background: "#16a34a" }} />}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                          <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: tc.bg, color: tc.color, border: "1px solid " + tc.border }}>{u.update_type}</span>
                          {deal && <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 600 }}>{deal.dealName || deal.address}</span>}
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>{new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        </div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>{u.title}</h3>
                        <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{u.body}</p>
                        {u.photos && (() => { try { const photos = JSON.parse(u.photos); return photos.length > 0 ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                            {photos.map((p, i) => (
                              <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #e2e8f0", display: "block" }}>
                                <img src={p.url} alt={p.name || "Photo"} style={{ width: 120, height: 90, objectFit: "cover", display: "block" }} />
                              </a>
                            ))}
                          </div>
                        ) : null; } catch { return null; } })()}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        ) : activeSection === "deals" ? (
          /* ── My Deals ── */
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: "0 0 20px" }}>My Deals</h1>
            {deals.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: "0 0 4px" }}>No deals linked yet</p>
                <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Your investment deals will appear here once they're assigned.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
                {deals.map(d => (
                  <div key={d._id} onClick={() => setSelectedDeal(d)} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 20, cursor: "pointer", transition: "box-shadow 0.2s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 2px" }}>{d.dealName || d.address}</h3>
                        <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>{d.city}{d.state ? ", " + d.state : ""} · {d.type || "—"}</p>
                      </div>
                      <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: d.status === "Active" ? "#f0fdf4" : "#f8fafc", color: d.status === "Active" ? "#16a34a" : "#64748b", border: "1px solid " + (d.status === "Active" ? "#86efac" : "#e2e8f0") }}>{d.status || "New"}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      <div><div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>Purchase</div><div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{fmt(d.purchasePrice)}</div></div>
                      <div><div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>ARV</div><div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{fmt(d.arv)}</div></div>
                      <div><div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>Updates</div><div style={{ fontSize: 14, fontWeight: 700, color: "#16a34a" }}>{updates.filter(u => u.deal_id === d._id).length}</div></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeSection === "settings" ? (
          /* ── Settings ── */
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: "0 0 20px" }}>Settings</h1>

            {/* Notification Preferences */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: isMobile ? 18 : 24, marginBottom: 16 }}>
              <h2 style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 16px", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 8 }}>
                Notification Preferences <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
              </h2>
              <p style={{ fontSize: 13, color: "#64748b", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, margin: "0 0 20px" }}>
                Choose how you'd like to be notified when new investment updates are posted.
              </p>

              {/* Email toggle */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 10, background: notifPrefs.email ? "#f0fdf4" : "#f8fafc", border: "1px solid " + (notifPrefs.email ? "#86efac" : "#e2e8f0"), marginBottom: 10, transition: "all 0.2s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: notifPrefs.email ? "rgba(22,163,74,0.08)" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={notifPrefs.email ? "#16a34a" : "#94a3b8"} strokeWidth={1.5}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4l-10 8L2 4"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>Email Notifications</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>Receive updates via email</div>
                  </div>
                </div>
                <button onClick={() => setNotifPrefs(p => ({ ...p, email: !p.email }))} style={{
                  width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                  background: notifPrefs.email ? "#16a34a" : "#cbd5e1", position: "relative", transition: "background 0.2s",
                }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: notifPrefs.email ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </button>
              </div>

              {/* SMS toggle */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 10, background: notifPrefs.sms ? "#f0fdf4" : "#f8fafc", border: "1px solid " + (notifPrefs.sms ? "#86efac" : "#e2e8f0"), marginBottom: 20, transition: "all 0.2s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: notifPrefs.sms ? "rgba(22,163,74,0.08)" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={notifPrefs.sms ? "#16a34a" : "#94a3b8"} strokeWidth={1.5}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>Text Message (SMS)</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>Receive updates via text</div>
                  </div>
                </div>
                <button onClick={() => setNotifPrefs(p => ({ ...p, sms: !p.sms }))} style={{
                  width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                  background: notifPrefs.sms ? "#16a34a" : "#cbd5e1", position: "relative", transition: "background 0.2s",
                }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: notifPrefs.sms ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </button>
              </div>

              <button onClick={async () => {
                setPrefsSaving(true);
                try {
                  const { error } = await supabase.from("investors").update({ notification_prefs: JSON.stringify(notifPrefs) }).eq("id", investorProfile.id);
                  if (error) throw error;
                  alert("Notification preferences saved!");
                } catch (err) { alert("Error saving preferences: " + err.message); } finally { setPrefsSaving(false); }
              }} disabled={prefsSaving} style={{
                padding: "10px 24px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif", background: "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff",
                boxShadow: "0 2px 10px rgba(22,163,74,0.3)", opacity: prefsSaving ? 0.7 : 1, transition: "all 0.2s",
              }}>
                {prefsSaving ? "Saving..." : "Save Preferences"}
              </button>
            </div>

            {/* Account Info */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: isMobile ? 18 : 24 }}>
              <h2 style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 16px", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 8 }}>
                Account Information <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "12px 24px" }}>
                {[
                  ["Name", investorProfile?.investorName || "—"],
                  ["Company", investorProfile?.company || "—"],
                  ["Email", investorProfile?.email || "—"],
                  ["Investor type", investorProfile?.investorType || "—"],
                ].map(([label, value], i) => (
                  <div key={i}>
                    <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState(() => {
    const params = window.location.search;
    if (params.includes("signup")) return "signup";
    return "login";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pageLoaded, setPageLoaded] = useState(false);
  const [hoverBtn, setHoverBtn] = useState(false);
  const [hoverGoogle, setHoverGoogle] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  useEffect(() => { const t = setTimeout(() => setPageLoaded(true), 100); return () => clearTimeout(t); }, []);

  const handleLogin = async () => {
    setLoading(true); setError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else onAuth(data.user);
    setLoading(false);
  };

  const handleSignup = async () => {
    setLoading(true); setError("");
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (error) setError(error.message);
    else setSuccess("Check your email to confirm your account, then log in.");
    setLoading(false);
  };

  const handleForgot = async () => {
    if (!email) { setError("Enter your email first"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) setError(error.message);
    else setSuccess("Password reset email sent.");
    setLoading(false);
  };

  const switchMode = (m) => { setMode(m); setError(""); setSuccess(""); setEmail(""); setPassword(""); setName(""); };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setError(error.message);
  };

  // ─── SHARED FORM (used by both mobile and desktop) ───
  const formContent = (
    <div>
      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13.5, color: "#DC2626", fontFamily: "'DM Sans', sans-serif", animation: "fadeUp 0.3s ease" }}>{error}</div>
      )}
      {success && (
        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13.5, color: "#0B3D2C", fontFamily: "'DM Sans', sans-serif", animation: "fadeUp 0.3s ease" }}>{success}</div>
      )}

      {mode === "signup" && (
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#4A5E52", marginBottom: 6, letterSpacing: "0.01em" }}>Full name</label>
          <input className="reap-input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Javier Suarez" style={{ width: "100%", padding: "13px 16px", fontSize: 15, fontFamily: "'DM Sans', sans-serif", border: "1.5px solid #DCE4DF", borderRadius: 10, outline: "none", transition: "all 0.2s", background: "#fff", color: "#1A2E22", boxSizing: "border-box" }} />
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#4A5E52", marginBottom: 6, letterSpacing: "0.01em" }}>Email address</label>
        <input className="reap-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" style={{ width: "100%", padding: "13px 16px", fontSize: 15, fontFamily: "'DM Sans', sans-serif", border: "1.5px solid #DCE4DF", borderRadius: 10, outline: "none", transition: "all 0.2s", background: "#fff", color: "#1A2E22", boxSizing: "border-box" }} />
      </div>

      {mode !== "forgot" && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#4A5E52", letterSpacing: "0.01em" }}>Password</label>
            {mode === "login" && (
              <button onClick={() => switchMode("forgot")} className="reap-link" style={{ background: "none", border: "none", fontSize: 13, color: "#0B3D2C", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, cursor: "pointer", padding: 0, transition: "opacity 0.15s" }}>Forgot password?</button>
            )}
          </div>
          <input className="reap-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && mode === "login" && handleLogin()} style={{ width: "100%", padding: "13px 16px", fontSize: 15, fontFamily: "'DM Sans', sans-serif", border: "1.5px solid #DCE4DF", borderRadius: 10, outline: "none", transition: "all 0.2s", background: "#fff", color: "#1A2E22", boxSizing: "border-box" }} />
        </div>
      )}

      <button
        onClick={mode === "login" ? handleLogin : mode === "signup" ? handleSignup : handleForgot}
        disabled={loading}
        onMouseEnter={() => setHoverBtn(true)}
        onMouseLeave={() => setHoverBtn(false)}
        style={{
          width: "100%", padding: "14px 20px", marginTop: 24,
          background: loading ? "#0E4D37" : hoverBtn ? "#0E4D37" : "#0B3D2C",
          color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
          border: "none", borderRadius: 10,
          cursor: loading ? "not-allowed" : "pointer",
          transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          letterSpacing: "0.01em",
          transform: hoverBtn && !loading ? "translateY(-2px)" : "translateY(0)",
          boxShadow: hoverBtn && !loading ? "0 6px 20px rgba(11,61,44,0.35)" : "0 2px 8px rgba(11,61,44,0.15)",
        }}
      >
        {loading && (
          <svg width={18} height={18} viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}>
            <circle cx={12} cy={12} r={10} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={3} />
            <path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" />
          </svg>
        )}
        {mode === "login" && (loading ? "Signing in..." : "Sign in")}
        {mode === "signup" && (loading ? "Creating account..." : "Create account")}
        {mode === "forgot" && (loading ? "Sending link..." : "Send reset link")}
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "24px 0" }}>
        <div style={{ flex: 1, height: 1, background: "#E8ECE9" }} />
        <span style={{ fontSize: 11, color: "#8A9B91", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>or</span>
        <div style={{ flex: 1, height: 1, background: "#E8ECE9" }} />
      </div>

      <button
        onClick={handleGoogleLogin}
        onMouseEnter={() => setHoverGoogle(true)}
        onMouseLeave={() => setHoverGoogle(false)}
        style={{
          width: "100%", padding: "13px 20px",
          background: hoverGoogle ? "#F1F5F3" : "#fff",
          border: `1.5px solid ${hoverGoogle ? "#B8C4BC" : "#DCE4DF"}`,
          borderRadius: 10, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          fontSize: 14, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", color: "#1A2E22",
          transition: "all 0.2s",
          transform: hoverGoogle ? "translateY(-1px)" : "translateY(0)",
          boxShadow: hoverGoogle ? "0 4px 12px rgba(0,0,0,0.06)" : "none",
        }}>
        <svg width={18} height={18} viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      <div style={{ marginTop: 28, textAlign: "center", fontSize: 14, color: isMobile ? "rgba(255,255,255,0.5)" : "#8A9B91", fontFamily: "'DM Sans', sans-serif" }}>
        {mode === "login" && (<>Don't have an account?{" "}<button onClick={() => switchMode("signup")} className="reap-link" style={{ background: "none", border: "none", color: isMobile ? "#22C55E" : "#0B3D2C", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: 0, transition: "opacity 0.15s" }}>Start free trial</button></>)}
        {mode === "signup" && (<>Already have an account?{" "}<button onClick={() => switchMode("login")} className="reap-link" style={{ background: "none", border: "none", color: isMobile ? "#22C55E" : "#0B3D2C", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: 0, transition: "opacity 0.15s" }}>Sign in</button></>)}
        {mode === "forgot" && (<button onClick={() => switchMode("login")} className="reap-link" style={{ background: "none", border: "none", color: isMobile ? "#22C55E" : "#0B3D2C", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: 0, transition: "opacity 0.15s" }}>← Back to sign in</button>)}
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; overflow: ${isMobile ? 'auto' : 'hidden'}; }
        input::placeholder { color: #8A9B91; }
        .reap-input:focus { border-color: #22C55E !important; box-shadow: 0 0 0 3px rgba(34,197,94,0.12) !important; outline: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes float1 { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(30px,-20px) scale(1.05); } 66% { transform: translate(-20px,15px) scale(0.95); } }
        @keyframes float2 { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(-25px,20px) scale(1.08); } 66% { transform: translate(15px,-25px) scale(0.92); } }
        @keyframes float3 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(20px,10px); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes cardFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 20px rgba(34,197,94,0.15); } 50% { box-shadow: 0 0 40px rgba(34,197,94,0.3); } }
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .stat-card { animation: cardFloat 4s ease-in-out infinite; }
        .stat-card:nth-child(2) { animation-delay: 0.5s; }
        .stat-card:nth-child(3) { animation-delay: 1s; }
        .stat-card:hover { background: rgba(255,255,255,0.12) !important; border-color: rgba(255,255,255,0.2) !important; transform: translateY(-4px) scale(1.02) !important; }
        .reap-link:hover { opacity: 0.8; }
      `}</style>

      {/* ─── MOBILE LAYOUT ─── */}
      {isMobile ? (
        <div style={{
          minHeight: "100vh", fontFamily: "'DM Sans', sans-serif",
          background: "linear-gradient(170deg, #051E15 0%, #0B3D2C 40%, #0E4D37 80%, #0A3425 100%)",
          backgroundSize: "200% 200%", animation: "gradientShift 12s ease infinite",
          position: "relative", overflow: "auto", padding: "0 0 40px",
        }}>
          <div style={{ position: "fixed", top: -80, right: -60, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 65%)", pointerEvents: "none", animation: "float1 8s ease-in-out infinite" }} />
          <div style={{ position: "fixed", bottom: -40, left: -40, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 65%)", pointerEvents: "none", animation: "float2 10s ease-in-out infinite" }} />
          <div style={{ position: "fixed", inset: 0, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.02) 1px, transparent 0)", backgroundSize: "24px 24px", pointerEvents: "none" }} />

          <div style={{ position: "relative", zIndex: 1, padding: "48px 28px 0", textAlign: "center",
            opacity: pageLoaded ? 1 : 0, transform: pageLoaded ? "translateY(0)" : "translateY(16px)",
            transition: "all 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", animation: "pulseGlow 3s ease-in-out infinite" }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
              </div>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>REAP</span>
            </div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 600, color: "#fff", lineHeight: 1.15, margin: "0 auto", letterSpacing: "-0.02em", maxWidth: 300 }}>
              Smarter real estate decisions, powered <span style={{ color: "#22C55E" }}>by AI</span>
            </h1>
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 24,
              opacity: pageLoaded ? 1 : 0, transition: "opacity 0.8s ease 0.4s",
            }}>
              {[
                { label: "Volume", value: "$1.33B+" },
                { label: "Deals", value: "1,041+" },
                { label: "Speed", value: "3 min", accent: true },
              ].map((s, i) => (
                <div key={i} className="stat-card" style={{
                  background: "rgba(255,255,255,0.06)", backdropFilter: "blur(16px)",
                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12,
                  padding: "10px 14px", textAlign: "center", flex: 1, maxWidth: 110,
                  transition: "all 0.3s",
                }}>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 17, fontWeight: 500, color: s.accent ? "#22C55E" : "#fff" }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            position: "relative", zIndex: 1,
            margin: "28px 20px 0", padding: "28px 24px 32px",
            background: "#fff", borderRadius: 20,
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            opacity: pageLoaded ? 1 : 0,
            transform: pageLoaded ? "translateY(0)" : "translateY(24px)",
            transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s",
          }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 600, color: "#1A2E22", margin: 0, letterSpacing: "-0.02em" }}>
                {mode === "login" && "Welcome back"}
                {mode === "signup" && "Create your account"}
                {mode === "forgot" && "Reset your password"}
              </h2>
              <p style={{ fontSize: 14, color: "#8A9B91", margin: "6px 0 0 0", lineHeight: 1.5 }}>
                {mode === "login" && "Sign in to access your deal pipeline."}
                {mode === "signup" && "Start analyzing deals in under 3 minutes."}
                {mode === "forgot" && "We'll send you a reset link."}
              </p>
            </div>
            {formContent}
          </div>

          <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "center", gap: 20, marginTop: 28, fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif" }}>
            <span>© 2026 REAP Analytics</span>
            <a href="https://getreap.ai" style={{ color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>Privacy</a>
            <a href="https://getreap.ai" style={{ color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>Terms</a>
          </div>
        </div>

      ) : (
        /* ─── DESKTOP LAYOUT ─── */
        <div style={{ display: "flex", minHeight: "100vh", height: "100vh", fontFamily: "'DM Sans', sans-serif", background: "#F8FAF9", overflow: "hidden" }}>
          <div style={{
            flex: "0 0 50%", position: "relative", overflow: "hidden",
            background: "linear-gradient(160deg, #051E15 0%, #0B3D2C 35%, #0E4D37 70%, #0A3425 100%)",
            backgroundSize: "200% 200%", animation: "gradientShift 12s ease infinite",
            display: "flex", flexDirection: "column", justifyContent: "space-between",
            padding: "48px 56px",
          }}>
            <div style={{ position: "absolute", top: -100, right: -60, width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,197,94,0.18) 0%, transparent 65%)", pointerEvents: "none", animation: "float1 8s ease-in-out infinite" }} />
            <div style={{ position: "absolute", bottom: -60, left: -40, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,197,94,0.1) 0%, transparent 65%)", pointerEvents: "none", animation: "float2 10s ease-in-out infinite" }} />
            <div style={{ position: "absolute", top: "40%", left: "50%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 65%)", pointerEvents: "none", animation: "float3 7s ease-in-out infinite" }} />
            <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.025) 1px, transparent 0)", backgroundSize: "28px 28px", pointerEvents: "none" }} />

            <div style={{ position: "relative", zIndex: 1, opacity: pageLoaded ? 1 : 0, transform: pageLoaded ? "translateY(0)" : "translateY(-12px)", transition: "all 0.6s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", animation: "pulseGlow 3s ease-in-out infinite" }}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                </div>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>REAP</span>
              </div>
            </div>

            <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ opacity: pageLoaded ? 1 : 0, transform: pageLoaded ? "translateY(0)" : "translateY(20px)", transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s" }}>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 42, fontWeight: 600, color: "#fff", lineHeight: 1.12, margin: 0, letterSpacing: "-0.025em" }}>
                  Smarter real estate<br />decisions, powered<br /><span style={{ color: "#22C55E" }}>by AI</span>
                </h1>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.65, margin: "18px 0 0 0", maxWidth: 380 }}>
                  Underwrite deals in minutes, track portfolios in real-time, and uncover opportunities others miss.
                </p>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 40, opacity: pageLoaded ? 1 : 0, transform: pageLoaded ? "translateY(0)" : "translateY(20px)", transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.6s" }}>
                {[
                  { label: "Deal Volume", value: "$1.33B+", accent: false },
                  { label: "Deals Analyzed", value: "1,041+", accent: false },
                  { label: "Avg. Underwriting", value: "3 min", accent: true },
                ].map((stat, i) => (
                  <div key={i} className="stat-card" style={{
                    background: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)",
                    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14,
                    padding: "16px 20px", cursor: "default", transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                    flex: 1,
                  }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>{stat.label}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 500, color: stat.accent ? "#22C55E" : "#fff" }}>{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ position: "relative", zIndex: 1, fontSize: 13, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif" }}>
              Trusted by real estate professionals nationwide.
            </div>
          </div>

          <div style={{
            flex: "0 0 50%", display: "flex", alignItems: "center", justifyContent: "center",
            padding: "48px 56px", position: "relative", overflow: "auto",
          }}>
            <div style={{
              width: "100%", maxWidth: 420,
              opacity: pageLoaded ? 1 : 0,
              transform: pageLoaded ? "translateY(0)" : "translateY(16px)",
              transition: "all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.4s",
            }}>
              <div style={{ marginBottom: 36 }}>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 600, color: "#1A2E22", margin: 0, letterSpacing: "-0.025em" }}>
                  {mode === "login" && "Welcome back"}
                  {mode === "signup" && "Create your account"}
                  {mode === "forgot" && "Reset your password"}
                </h2>
                <p style={{ fontSize: 15, color: "#8A9B91", margin: "8px 0 0 0", lineHeight: 1.5 }}>
                  {mode === "login" && "Sign in to access your deal pipeline."}
                  {mode === "signup" && "Start analyzing deals in under 3 minutes."}
                  {mode === "forgot" && "We'll send you a reset link."}
                </p>
              </div>
              {formContent}
            </div>

            <div style={{ position: "absolute", bottom: 24, left: 56, right: 56, display: "flex", justifyContent: "space-between", fontSize: 12, color: "#B0BAB4", fontFamily: "'DM Sans', sans-serif" }}>
              <span>© 2026 REAP Analytics, Inc.</span>
              <div style={{ display: "flex", gap: 20 }}>
                <a href="https://getreap.ai" className="reap-link" style={{ color: "#B0BAB4", textDecoration: "none", transition: "opacity 0.15s" }}>Privacy</a>
                <a href="https://getreap.ai" className="reap-link" style={{ color: "#B0BAB4", textDecoration: "none", transition: "opacity 0.15s" }}>Terms</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PricingScreen({ userEmail, daysLeft, onCheckout, checkoutLoading }) {
  const [hoverBtn, setHoverBtn] = useState(false);
  const isMobile = window.innerWidth < 768;
  const expired = daysLeft <= 0;

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(170deg, #051E15 0%, #0B3D2C 40%, #0E4D37 80%, #0A3425 100%)",
      fontFamily: "'DM Sans', sans-serif", padding: 20,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500;600&display=swap');
        @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 20px rgba(34,197,94,0.15); } 50% { box-shadow: 0 0 40px rgba(34,197,94,0.3); } }
      `}</style>
      <div style={{
        background: "#fff", borderRadius: 24, padding: isMobile ? "32px 24px" : "48px 56px",
        maxWidth: 480, width: "100%", textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", animation: "pulseGlow 3s ease-in-out infinite" }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
          </div>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em" }}>REAP</span>
        </div>

        {expired ? (
          <>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: "#0f172a", margin: "0 0 12px", letterSpacing: "-0.02em" }}>Your free trial has ended</h1>
            <p style={{ fontSize: 15, color: "#64748b", margin: "0 0 32px", lineHeight: 1.6 }}>Upgrade to REAP Starter to keep analyzing deals, generating AI summaries, and closing faster.</p>
          </>
        ) : (
          <>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: "#0f172a", margin: "0 0 12px", letterSpacing: "-0.02em" }}>Upgrade to REAP Starter</h1>
            <p style={{ fontSize: 15, color: "#64748b", margin: "0 0 32px", lineHeight: 1.6 }}>You have <strong style={{ color: "#16a34a" }}>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong> left on your free trial. Upgrade now to lock in your access.</p>
          </>
        )}

        <div style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", border: "2px solid #16a34a", borderRadius: 16, padding: "28px 24px", marginBottom: 28 }}>
          <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>STARTER</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4, marginBottom: 12 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 48, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.03em" }}>$99</span>
            <span style={{ fontSize: 16, color: "#64748b" }}>/month</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left", marginTop: 16 }}>
            {["Unlimited deal analysis", "Live financial metrics", "AI Executive Summaries", "Deal pipeline management", "Google Street View integration"].map((feature, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#1e293b" }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
                {feature}
              </div>
            ))}
          </div>
        </div>

        <button onClick={onCheckout} disabled={checkoutLoading} onMouseEnter={() => setHoverBtn(true)} onMouseLeave={() => setHoverBtn(false)} style={{
          width: "100%", padding: "16px 24px",
          background: checkoutLoading ? "#15803d" : hoverBtn ? "#15803d" : "linear-gradient(135deg, #16a34a, #15803d)",
          color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
          border: "none", borderRadius: 12, cursor: checkoutLoading ? "not-allowed" : "pointer",
          transition: "all 0.25s", letterSpacing: "0.01em",
          transform: hoverBtn && !checkoutLoading ? "translateY(-2px)" : "translateY(0)",
          boxShadow: hoverBtn && !checkoutLoading ? "0 8px 24px rgba(22,163,74,0.4)" : "0 4px 14px rgba(22,163,74,0.25)",
        }}>
          {checkoutLoading ? "Redirecting to checkout..." : "Subscribe — $99/month"}
        </button>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "16px 0 0", lineHeight: 1.5 }}>Secure payment via Stripe. Cancel anytime.</p>
        <button onClick={() => supabase.auth.signOut()} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", marginTop: 20, padding: "8px 16px", transition: "color 0.2s" }}>Sign out</button>
      </div>
    </div>
  );
}

function OnboardingScreen({ userName, onComplete, onCreateDeal }) {
  const [pageLoaded, setPageLoaded] = useState(false);
  const firstName = userName ? userName.split(" ")[0] : "there";

  useEffect(() => { const t = setTimeout(() => setPageLoaded(true), 100); return () => clearTimeout(t); }, []);

  const steps = [
    {
      icon: (
        <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={1.5}>
          <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
      ),
      title: "Add Your Deals",
      desc: "Enter a property address and key numbers. REAP auto-calculates 30+ financial metrics instantly.",
    },
    {
      icon: (
        <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={1.5}>
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="3" y1="20" x2="21" y2="20"/>
        </svg>
      ),
      title: "See the Full Picture",
      desc: "NOI, cap rate, DSCR, bridge loans, refinance — every metric a CRE investor needs, live.",
    },
    {
      icon: (
        <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={1.5}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 12l2 2 4-4"/>
        </svg>
      ),
      title: "AI Executive Summaries",
      desc: "One click generates a professional investment summary you can send to partners and lenders.",
    },
  ];

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg, #f0fdf4 0%, #f8fafc 40%, #fff 100%)",
      fontFamily: "'DM Sans', sans-serif",
      padding: 20,
    }}>
      <style>{`
        @keyframes onbFadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes onbPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(22,163,74,0.3); } 50% { box-shadow: 0 0 0 12px rgba(22,163,74,0); } }
      `}</style>
      <div style={{
        maxWidth: 480, width: "100%", textAlign: "center",
        opacity: pageLoaded ? 1 : 0,
        transform: pageLoaded ? "translateY(0)" : "translateY(24px)",
        transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        {/* Logo mark */}
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: "linear-gradient(135deg, #0B3D2C, #16a34a)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 28px", boxShadow: "0 8px 30px rgba(11,61,44,0.25)",
        }}>
          <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        </div>

        {/* Welcome text */}
        <h1 style={{
          fontSize: 28, fontWeight: 700, color: "#0B3D2C",
          fontFamily: "'Playfair Display', serif",
          marginBottom: 8, letterSpacing: "-0.02em",
        }}>
          Welcome, {firstName}
        </h1>
        <p style={{ fontSize: 15, color: "#64748b", lineHeight: 1.6, marginBottom: 40 }}>
          REAP is your deal analysis co-pilot. Here's how it works.
        </p>

        {/* 3 Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 40, textAlign: "left" }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              display: "flex", gap: 16, alignItems: "flex-start",
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 14, padding: "20px 22px",
              animation: `onbFadeUp 0.5s ease ${0.15 + i * 0.12}s both`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 13, flexShrink: 0,
                background: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid #bbf7d0",
              }}>
                {s.icon}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: "#16a34a",
                    background: "#f0fdf4", border: "1px solid #bbf7d0",
                    borderRadius: 6, padding: "2px 7px",
                    fontFamily: "'DM Mono', monospace",
                  }}>0{i + 1}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{s.title}</span>
                </div>
                <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, margin: 0 }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onCreateDeal}
          style={{
            width: "100%", padding: "16px 24px",
            background: "linear-gradient(135deg, #0B3D2C, #16a34a)",
            color: "#fff", fontSize: 16, fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif",
            border: "none", borderRadius: 12, cursor: "pointer",
            boxShadow: "0 4px 20px rgba(22,163,74,0.3)",
            transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            letterSpacing: "0.01em",
            animation: "onbPulse 2s ease-in-out infinite 1s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}
          onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(22,163,74,0.4)"; }}
          onMouseOut={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(22,163,74,0.3)"; }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create Your First Deal
        </button>

        <button
          onClick={onComplete}
          style={{
            background: "none", border: "none", color: "#94a3b8",
            fontSize: 13, fontFamily: "'DM Sans', sans-serif",
            cursor: "pointer", marginTop: 16, padding: "8px 16px",
            transition: "color 0.2s",
          }}
          onMouseOver={e => e.currentTarget.style.color = "#64748b"}
          onMouseOut={e => e.currentTarget.style.color = "#94a3b8"}
        >
          Skip for now — explore the pipeline
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD VIEW
   ═══════════════════════════════════════════════════════════ */

function DashboardView({ deals, loading, onSelectDeal, isMobile }) {
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortField, setSortField] = useState("reapScore");
  const [sortDir, setSortDir] = useState("desc");

  const num = (v) => {
    if (!v && v !== 0) return NaN;
    const n = parseFloat(String(v).replace(/[$,%x]/g, "").trim());
    return isNaN(n) ? NaN : n;
  };
  const fmtK = (v) => {
    const n = num(v);
    if (isNaN(n)) return "—";
    if (Math.abs(n) >= 1000000) return "$" + (n / 1000000).toFixed(1) + "M";
    if (Math.abs(n) >= 1000) return "$" + (n / 1000).toFixed(0) + "K";
    return "$" + n.toFixed(0);
  };
  const fmtPct = (v) => { const n = num(v); return isNaN(n) ? "—" : n.toFixed(1) + "%"; };
  const fmtScore = (v) => { const n = num(v); return isNaN(n) ? "—" : Math.round(n); };

  const STATUS_LIST = ["All", "New", "Review", "Underwriting", "Offer", "Under Contract", "Closed", "Dead", "On Hold"];
  const STATUS_COLORS = {
    "New": "#16a34a", "Review": "#d97706", "Underwriting": "#7c3aed",
    "Offer": "#ca8a04", "Under Contract": "#0891b2", "Closed": "#15803d",
    "Dead": "#dc2626", "On Hold": "#64748b", "All": "#16a34a"
  };

  const activeDeals = deals.filter(d => !["Dead", "Closed"].includes(d.status));

  // Top-line stats computed from all deals
  const totalPipelineValue = deals.reduce((s, d) => {
    const n = num(d.offer); return s + (isNaN(n) ? 0 : n);
  }, 0);
  const dealsWithCapRate = deals.filter(d => !isNaN(num(d.capRate)));
  const avgCapRate = dealsWithCapRate.length
    ? dealsWithCapRate.reduce((s, d) => s + num(d.capRate), 0) / dealsWithCapRate.length : NaN;
  const dealsWithScore = deals.filter(d => !isNaN(num(d.reapScore)));
  const avgReapScore = dealsWithScore.length
    ? dealsWithScore.reduce((s, d) => s + num(d.reapScore), 0) / dealsWithScore.length : NaN;
  const totalNOI = deals.reduce((s, d) => {
    const n = num(d.noiAnnual); return s + (isNaN(n) ? 0 : n);
  }, 0);

  // Status breakdown
  const statusCounts = {};
  STATUS_LIST.slice(1).forEach(s => { statusCounts[s] = 0; });
  deals.forEach(d => { if (statusCounts[d.status] !== undefined) statusCounts[d.status]++; });

  // Filtered + sorted deal table
  const filtered = statusFilter === "All" ? deals : deals.filter(d => d.status === statusFilter);
  const sorted = [...filtered].sort((a, b) => {
    let va = num(a[sortField]), vb = num(b[sortField]);
    if (isNaN(va) && isNaN(vb)) return 0;
    if (isNaN(va)) return 1;
    if (isNaN(vb)) return -1;
    return sortDir === "desc" ? vb - va : va - vb;
  });

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const scoreColor = (v) => {
    const n = num(v);
    if (isNaN(n)) return "#94a3b8";
    if (n >= 70) return "#16a34a";
    if (n >= 40) return "#d97706";
    return "#dc2626";
  };
  const scoreLabel = (v) => {
    const n = num(v);
    if (isNaN(n)) return "—";
    if (n >= 70) return "Strong";
    if (n >= 40) return "Fair";
    return "Weak";
  };

  const SortArrow = ({ field }) => {
    if (sortField !== field) return <span style={{ color: "#cbd5e1", marginLeft: 3 }}>↕</span>;
    return <span style={{ color: "#16a34a", marginLeft: 3 }}>{sortDir === "desc" ? "↓" : "↑"}</span>;
  };

  const StatCard = ({ label, value, sub, accent }) => (
    <div style={{
      background: "#fff", borderRadius: 14, padding: isMobile ? "16px 18px" : "20px 24px",
      border: "1px solid #e2e8f0", flex: 1, minWidth: isMobile ? "calc(50% - 6px)" : 0,
      position: "relative", overflow: "hidden"
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: accent || "#16a34a", borderRadius: "14px 14px 0 0"
      }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#64748b", fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>{sub}</div>}
    </div>
  );

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 12 }}>
      <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTop: "3px solid #16a34a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ fontSize: 13, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>Loading dashboard…</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: "#f8fafc", fontFamily: "'DM Sans', sans-serif" }}>

      {/* Uniform Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: isMobile ? "14px 16px" : "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.02em" }}>Pipeline Dashboard</h1>
          <p style={{ fontSize: isMobile ? 11 : 12, color: "#94a3b8", margin: "3px 0 0", fontFamily: "'DM Sans', sans-serif" }}>{deals.length} deals · as of today</p>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 12px" : "24px 32px" }}>

      {/* Top Stats */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard
          label="Total Pipeline Value"
          value={totalPipelineValue >= 1000000 ? "$" + (totalPipelineValue / 1000000).toFixed(1) + "M" : "$" + (totalPipelineValue / 1000).toFixed(0) + "K"}
          sub={`${activeDeals.length} active deals`}
          accent="#16a34a"
        />
        <StatCard
          label="Avg Cap Rate"
          value={fmtPct(avgCapRate)}
          sub={`${dealsWithCapRate.length} deals with data`}
          accent="#0891b2"
        />
        <StatCard
          label="Avg REAP Score"
          value={isNaN(avgReapScore) ? "—" : Math.round(avgReapScore)}
          sub={`${dealsWithScore.length} deals scored`}
          accent={isNaN(avgReapScore) ? "#94a3b8" : avgReapScore >= 70 ? "#16a34a" : avgReapScore >= 40 ? "#d97706" : "#dc2626"}
        />
        <StatCard
          label="Total NOI (Annual)"
          value={totalNOI >= 1000000 ? "$" + (totalNOI / 1000000).toFixed(1) + "M" : totalNOI >= 1000 ? "$" + (totalNOI / 1000).toFixed(0) + "K" : totalNOI > 0 ? "$" + totalNOI.toFixed(0) : "—"}
          sub="proforma across pipeline"
          accent="#7c3aed"
        />
      </div>

      {/* Status Breakdown */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: isMobile ? "16px" : "20px 24px", marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14, fontFamily: "'DM Sans', sans-serif" }}>Deals by Status</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {STATUS_LIST.slice(1).filter(s => statusCounts[s] > 0).map(s => {
            const count = statusCounts[s];
            const pct = Math.round((count / deals.length) * 100);
            const color = STATUS_COLORS[s] || "#94a3b8";
            return (
              <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "All" : s)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                  borderRadius: 10, border: `1.5px solid ${statusFilter === s ? color : "#e2e8f0"}`,
                  background: statusFilter === s ? color + "14" : "#f8fafc",
                  cursor: "pointer", transition: "all 0.15s"
                }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>{s}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: color, fontFamily: "'DM Mono', monospace" }}>{count}</span>
                <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>{pct}%</span>
              </button>
            );
          })}
        </div>
        {/* Mini bar chart */}
        <div style={{ display: "flex", height: 6, borderRadius: 99, overflow: "hidden", marginTop: 16, gap: 1 }}>
          {STATUS_LIST.slice(1).filter(s => statusCounts[s] > 0).map(s => (
            <div key={s} style={{
              flex: statusCounts[s], background: STATUS_COLORS[s] || "#94a3b8",
              transition: "flex 0.4s ease", cursor: "pointer",
              opacity: statusFilter === "All" || statusFilter === s ? 1 : 0.2
            }} onClick={() => setStatusFilter(statusFilter === s ? "All" : s)} title={`${s}: ${statusCounts[s]}`} />
          ))}
        </div>
      </div>

      {/* Deal Analysis Table */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <div style={{ padding: isMobile ? "14px 16px" : "18px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>Deal Analysis</div>
            <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>
              {statusFilter === "All" ? `All ${filtered.length} deals` : `${filtered.length} ${statusFilter} deals`} · click to open
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["All", ...STATUS_LIST.slice(1).filter(s => statusCounts[s] > 0)].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{
                  padding: "5px 10px", borderRadius: 7, border: `1.5px solid ${statusFilter === s ? (STATUS_COLORS[s] || "#16a34a") : "#e2e8f0"}`,
                  background: statusFilter === s ? (STATUS_COLORS[s] || "#16a34a") + "14" : "transparent",
                  fontSize: 11, fontWeight: 600, color: statusFilter === s ? (STATUS_COLORS[s] || "#16a34a") : "#64748b",
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap"
                }}>{s}</button>
            ))}
          </div>
        </div>

        {isMobile ? (
          // Mobile: cards
          <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            {sorted.slice(0, 20).map((deal, i) => {
              const score = num(deal.reapScore);
              const sc = STATUS_COLORS[deal.status] || "#94a3b8";
              return (
                <button key={i} onClick={() => onSelectDeal(deal)}
                  style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", cursor: "pointer", textAlign: "left", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{deal.address || "—"}</div>
                      <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>{deal.type || "—"} · {deal.city || ""}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: scoreColor(score), fontFamily: "'DM Mono', monospace",
                        background: scoreColor(score) + "14", padding: "2px 7px", borderRadius: 6 }}>
                        {isNaN(score) ? "—" : Math.round(score)} · {scoreLabel(score)}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: sc, background: sc + "14", padding: "2px 7px", borderRadius: 6, fontFamily: "'DM Sans', sans-serif" }}>{deal.status || "—"}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>Offer: <strong style={{ color: "#0f172a" }}>{fmtK(deal.offer)}</strong></span>
                    <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>Cap: <strong style={{ color: "#0f172a" }}>{fmtPct(deal.capRate)}</strong></span>
                    <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>ROI: <strong style={{ color: "#0f172a" }}>{fmtPct(deal.roi)}</strong></span>
                  </div>
                </button>
              );
            })}
            {sorted.length > 20 && <div style={{ textAlign: "center", padding: "8px 0", fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>Showing 20 of {sorted.length} deals</div>}
          </div>
        ) : (
          // Desktop: table
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  {[
                    { label: "Address", field: null },
                    { label: "Status", field: null },
                    { label: "Type", field: null },
                    { label: "Offer Price", field: "offer" },
                    { label: "Cap Rate", field: "capRate" },
                    { label: "ROI", field: "roi" },
                    { label: "NOI / yr", field: "noiAnnual" },
                    { label: "DSCR", field: "dscr" },
                    { label: "REAP Score", field: "reapScore" },
                  ].map(({ label, field }) => (
                    <th key={label}
                      onClick={() => field && handleSort(field)}
                      style={{
                        padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700,
                        color: field && sortField === field ? "#16a34a" : "#64748b",
                        letterSpacing: "0.06em", textTransform: "uppercase",
                        cursor: field ? "pointer" : "default", whiteSpace: "nowrap",
                        userSelect: "none"
                      }}>
                      {label}{field && <SortArrow field={field} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, 50).map((deal, i) => {
                  const score = num(deal.reapScore);
                  const sc = STATUS_COLORS[deal.status] || "#94a3b8";
                  return (
                    <tr key={i} onClick={() => onSelectDeal(deal)}
                      style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer", transition: "background 0.1s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "12px 16px", maxWidth: 220 }}>
                        <div style={{ fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{deal.address || "—"}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{deal.city || ""}{deal.state ? ", " + deal.state : ""}</div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: sc, background: sc + "14", padding: "3px 9px", borderRadius: 6, whiteSpace: "nowrap" }}>{deal.status || "—"}</span>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#475569", whiteSpace: "nowrap" }}>{deal.type || "—"}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>{fmtK(deal.offer)}</td>
                      <td style={{ padding: "12px 16px", color: "#0f172a", whiteSpace: "nowrap" }}>{fmtPct(deal.capRate)}</td>
                      <td style={{ padding: "12px 16px", color: "#0f172a", whiteSpace: "nowrap" }}>{fmtPct(deal.roi)}</td>
                      <td style={{ padding: "12px 16px", color: "#0f172a", whiteSpace: "nowrap" }}>{fmtK(deal.noiAnnual)}</td>
                      <td style={{ padding: "12px 16px", color: "#0f172a", whiteSpace: "nowrap" }}>{isNaN(num(deal.dscr)) ? "—" : num(deal.dscr).toFixed(2) + "x"}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {/* Score bar */}
                          <div style={{ width: 48, height: 5, background: "#e2e8f0", borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ width: isNaN(score) ? "0%" : Math.min(score, 100) + "%", height: "100%", background: scoreColor(score), borderRadius: 99, transition: "width 0.3s" }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(score), fontFamily: "'DM Mono', monospace", minWidth: 24 }}>{fmtScore(deal.reapScore)}</span>
                          <span style={{ fontSize: 11, color: scoreColor(score), fontWeight: 600 }}>{scoreLabel(deal.reapScore)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sorted.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: "40px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No deals match this filter</td></tr>
                )}
              </tbody>
            </table>
            {sorted.length > 50 && (
              <div style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, color: "#94a3b8", borderTop: "1px solid #f1f5f9" }}>Showing 50 of {sorted.length} deals · use filters to narrow down</div>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMMAND CENTER — Cross-platform cockpit
   ═══════════════════════════════════════════════════════════ */

function CommandCenterView({ deals, loading, onSelectDeal, isMobile, session, teamEmails }) {
  const [contactsCount, setContactsCount] = useState(0);
  const [hotContactsCount, setHotContactsCount] = useState(0);
  const [investorsData, setInvestorsData] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [capitalCommitted, setCapitalCommitted] = useState(0);
  const [goals, setGoals] = useState(() => {
    try { const saved = localStorage.getItem("reap_goals"); return saved ? JSON.parse(saved) : [
      { label: "Close 15 deals", current: 0, target: 15, color: "#16a34a", emoji: "🏆" },
      { label: "Submit 50 offers", current: 0, target: 50, color: "#3b82f6", emoji: "📨" },
      { label: "Deploy $5M capital", current: 0, target: 5000000, color: "#7c3aed", emoji: "💰", isCurrency: true },
    ]; } catch { return []; }
  });
  const [editingGoals, setEditingGoals] = useState(false);

  const userEmail = session?.user?.email || "";
  const firstName = (session?.user?.user_metadata?.full_name || userEmail.split("@")[0]).split(" ")[0];
  const emailsToShow = teamEmails && teamEmails.length > 0 ? teamEmails : [userEmail.toLowerCase()];

  useEffect(() => {
    async function fetchExtras() {
      try {
        const { data: contacts } = await supabase.from("contacts").select("id, temperature, user_email");
        if (contacts) {
          const mine = contacts.filter(c => emailsToShow.includes((c.user_email || "").toLowerCase()));
          setContactsCount(mine.length);
          setHotContactsCount(mine.filter(c => (c.temperature || "").toLowerCase().includes("hot")).length);
        }
        const { data: investors } = await supabase.from("investors").select("id, investor_name, capital_committed, pipeline_stage, next_follow_up, user_email, date_last_contact");
        if (investors) {
          const mine = investors.filter(inv => emailsToShow.includes((inv.user_email || "").toLowerCase()));
          setInvestorsData(mine);
          setCapitalCommitted(mine.reduce((s, inv) => s + (parseFloat(inv.capital_committed) || 0), 0));
        }
        const { data: activities } = await supabase.from("deal_activities").select("*").order("created_at", { ascending: false }).limit(8);
        if (activities) setRecentActivities(activities);
      } catch (err) { console.error("Command center data fetch:", err); }
    }
    if (session) fetchExtras();
  }, [session]);

  useEffect(() => {
    try { localStorage.setItem("reap_goals", JSON.stringify(goals)); } catch {}
  }, [goals]);

  const num = (v) => { if (!v && v !== 0) return 0; const n = parseFloat(String(v).replace(/[$,%x]/g, "").trim()); return isNaN(n) ? 0 : n; };
  const fmtK = (v) => { const n = num(v); if (Math.abs(n) >= 1000000) return "$" + (n / 1000000).toFixed(1) + "M"; if (Math.abs(n) >= 1000) return "$" + (n / 1000).toFixed(0) + "K"; return "$" + n.toFixed(0); };

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const qEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
  const daysLeft = Math.max(0, Math.ceil((qEnd - now) / 86400000));
  const qLabel = "Q" + (Math.floor(now.getMonth() / 3) + 1) + " " + now.getFullYear();
  const isThisQ = (d) => { const dt = new Date(d.date); return dt >= qStart && dt <= now; };

  const qDeals = deals.filter(isThisQ);
  const STATUS_ORDER = ["New", "Review", "Underwriting", "Offer", "Under Contract", "Closed"];
  const statusIdx = (s) => { const i = STATUS_ORDER.indexOf(s); return i >= 0 ? i : -1; };

  const added = qDeals.length;
  const underwritten = qDeals.filter(d => statusIdx(d.status) >= 2).length;
  const offersMade = qDeals.filter(d => statusIdx(d.status) >= 3).length;
  const accepted = qDeals.filter(d => statusIdx(d.status) >= 4).length;
  const inEscrow = qDeals.filter(d => d.status === "Under Contract").length;
  const closings = qDeals.filter(d => d.status === "Closed").length;
  const closeRate = added > 0 ? ((closings / added) * 100).toFixed(1) : "0";

  const totalPipelineValue = deals.reduce((s, d) => s + num(d.offer), 0);

  useEffect(() => {
    setGoals(prev => prev.map(g => {
      if (g.label.toLowerCase().includes("close")) return { ...g, current: closings };
      if (g.label.toLowerCase().includes("offer")) return { ...g, current: offersMade };
      return g;
    }));
  }, [closings, offersMade]);

  const scoredDeals = deals.filter(d => num(d.reapScore) > 0).sort((a, b) => num(b.reapScore) - num(a.reapScore)).slice(0, 5);

  const attentionItems = [];
  const daysSince = (dateStr) => { if (!dateStr) return 999; return Math.floor((now - new Date(dateStr)) / 86400000); };
  deals.filter(d => !["Dead", "Closed"].includes(d.status)).forEach(d => {
    const days = daysSince(d.date);
    if (days > 14 && ["Underwriting", "Review"].includes(d.status)) {
      attentionItems.push({ text: (d.address || "Deal") + " — stuck " + days + "d in " + d.status, severity: days > 21 ? "high" : "med", deal: d, emoji: "⚠️" });
    }
  });
  investorsData.forEach(inv => {
    if (inv.next_follow_up && new Date(inv.next_follow_up) < now) {
      const overdue = daysSince(inv.next_follow_up);
      attentionItems.push({ text: (inv.investor_name || "Investor") + " — follow-up overdue " + overdue + "d", severity: overdue > 7 ? "high" : "med", emoji: "📞" });
    }
  });
  const unscored = deals.filter(d => d.status === "New" && !num(d.reapScore)).length;
  if (unscored > 0) attentionItems.push({ text: unscored + " new deal" + (unscored > 1 ? "s" : "") + " need underwriting", severity: "med", emoji: "📋" });
  attentionItems.sort((a, b) => (a.severity === "high" ? 0 : 1) - (b.severity === "high" ? 0 : 1));

  const velocityData = STATUS_ORDER.map(s => {
    const inStatus = deals.filter(d => d.status === s);
    if (inStatus.length === 0) return { status: s, days: 0 };
    return { status: s, days: Math.round(inStatus.reduce((sum, d) => sum + daysSince(d.date), 0) / inStatus.length) };
  });
  const maxVelocity = Math.max(...velocityData.map(v => v.days), 1);

  const timeAgo = (dateStr) => {
    if (!dateStr) return "";
    const mins = Math.floor((now - new Date(dateStr)) / 60000);
    if (mins < 60) return mins + "m ago";
    if (mins < 1440) return Math.floor(mins / 60) + "h ago";
    const d = Math.floor(mins / 1440);
    return d === 1 ? "yesterday" : d + "d ago";
  };

  const scoreColor = (s) => {
    const n = num(s);
    if (n >= 70) return { bg: "linear-gradient(135deg, #dcfce7, #bbf7d0)", color: "#15803d", glow: "rgba(22,163,74,0.15)" };
    if (n >= 40) return { bg: "linear-gradient(135deg, #fef9c3, #fde68a)", color: "#a16207", glow: "rgba(234,179,8,0.15)" };
    return { bg: "linear-gradient(135deg, #fecaca, #fca5a5)", color: "#991b1b", glow: "rgba(239,68,68,0.15)" };
  };

  const activityEmojis = { "Status Change": "🔄", "Note": "📝", "Call": "📞", "Email": "✉️", "Meeting": "🤝", "Offer Sent": "🚀", "Document Added": "📎", "Site Visit": "🏠" };

  if (loading) return <LoadingSpinner />;

  const funnelData = [
    { n: added, label: "Added", emoji: "📥", gradient: "linear-gradient(135deg, #dbeafe, #bfdbfe)", border: "#93c5fd", text: "#1e40af" },
    { n: underwritten, label: "Underwritten", emoji: "🔍", gradient: "linear-gradient(135deg, #ede9fe, #ddd6fe)", border: "#c4b5fd", text: "#5b21b6" },
    { n: offersMade, label: "Offers Made", emoji: "📨", gradient: "linear-gradient(135deg, #fef3c7, #fde68a)", border: "#fcd34d", text: "#92400e" },
    { n: accepted, label: "Accepted", emoji: "🤝", gradient: "linear-gradient(135deg, #ffedd5, #fed7aa)", border: "#fdba74", text: "#9a3412" },
    { n: inEscrow, label: "In Escrow", emoji: "🔐", gradient: "linear-gradient(135deg, #e0f2fe, #bae6fd)", border: "#7dd3fc", text: "#075985" },
    { n: closings, label: "Closings", emoji: "🏆", gradient: "linear-gradient(135deg, #dcfce7, #bbf7d0)", border: "#86efac", text: "#166534" },
  ];

  const gridCols = isMobile ? "repeat(3, minmax(0, 1fr))" : "repeat(6, minmax(0, 1fr))";
  const midGrid = isMobile ? "1fr" : "1fr 1fr";
  const velGrid = isMobile ? "repeat(3, minmax(0, 1fr))" : "repeat(6, minmax(0, 1fr))";

  const CardWrap = ({ children, style = {} }) => (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: isMobile ? "16px 14px" : "20px 24px", boxShadow: "0 1px 8px rgba(0,0,0,0.04)", ...style }}>{children}</div>
  );

  return (
    <div style={{ flex: 1, overflow: "auto", background: "#f8fafc", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ padding: isMobile ? "0 0 100px" : "0 0 40px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Hero Header */}
      <div style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        padding: isMobile ? "24px 16px 20px" : "32px 32px 28px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(22,163,74,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -40, left: "30%", width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />

        <p style={{ fontSize: isMobile ? 13 : 14, color: "#94a3b8", margin: "0 0 4px", fontWeight: 500 }}>{greeting}, {firstName} 👋</p>
        <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: "#fff", fontFamily: "'Playfair Display', serif", margin: "0 0 12px", letterSpacing: "-0.02em" }}>Command Center</h1>

        <div style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? 12 : 20, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{qLabel}</span>
            <span style={{ background: "rgba(22,163,74,0.2)", color: "#4ade80", fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 600 }}>{daysLeft}d left</span>
          </div>
          <div style={{ display: "flex", gap: isMobile ? 12 : 20 }}>
            <span style={{ fontSize: 12, color: "#cbd5e1" }}>📊 {deals.length} deals</span>
            <span style={{ fontSize: 12, color: "#cbd5e1" }}>💼 {fmtK(totalPipelineValue)} pipeline</span>
            <span style={{ fontSize: 12, color: "#cbd5e1" }}>👥 {contactsCount} contacts</span>
            {!isMobile && <span style={{ fontSize: 12, color: "#cbd5e1" }}>💰 {fmtK(capitalCommitted)} committed</span>}
          </div>
        </div>
      </div>

      <div style={{ padding: isMobile ? "16px 12px 0" : "24px 32px 0" }}>

      {/* Funnel Numbers */}
      <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: isMobile ? 8 : 12, marginBottom: isMobile ? 4 : 8 }}>
        {funnelData.map((f, i) => (
          <div key={f.label} style={{
            background: f.gradient, border: "1px solid " + f.border, borderRadius: 14,
            padding: isMobile ? "14px 8px" : "18px 12px", textAlign: "center",
            transition: "transform 0.2s, box-shadow 0.2s", cursor: "default",
          }}
          onMouseEnter={e => { if (!isMobile) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)"; } }}
          onMouseLeave={e => { if (!isMobile) { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; } }}
          >
            <span style={{ fontSize: isMobile ? 16 : 20 }}>{f.emoji}</span>
            <p style={{ fontSize: isMobile ? 26 : 34, fontWeight: 700, margin: "4px 0 0", color: f.text, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{f.n}</p>
            <p style={{ fontSize: isMobile ? 9 : 11, color: f.text, margin: "4px 0 0", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, opacity: 0.7 }}>{f.label}</p>
          </div>
        ))}
      </div>

      {/* Funnel Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: isMobile ? 16 : 24, padding: "0 4px" }}>
        <div style={{ flex: 1, display: "flex", height: 6, borderRadius: 3, overflow: "hidden", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)" }}>
          {funnelData.map((f) => (
            <div key={f.label} style={{ flex: Math.max(f.n, 1), height: "100%", background: f.border, transition: "flex 0.5s" }} />
          ))}
        </div>
        <span style={{ fontSize: 12, color: "#64748b", flexShrink: 0, fontWeight: 600 }}>
          {closeRate}% <span style={{ color: "#94a3b8", fontWeight: 400 }}>close rate</span>
        </span>
      </div>

      {/* Goals + Top Deals */}
      <div style={{ display: "grid", gridTemplateColumns: midGrid, gap: isMobile ? 12 : 16, marginBottom: isMobile ? 12 : 20 }}>

        {/* Quarterly Goals */}
        <CardWrap>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#0f172a" }}>🎯 Quarterly Goals</p>
            <button onClick={() => setEditingGoals(!editingGoals)} style={{ fontSize: 11, color: "#16a34a", background: editingGoals ? "rgba(22,163,74,0.08)" : "none", border: editingGoals ? "1px solid rgba(22,163,74,0.2)" : "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontFamily: "'DM Sans', sans-serif", padding: "4px 10px" }}>{editingGoals ? "✓ Done" : "Edit"}</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {goals.map((g, i) => {
              const pct = g.target > 0 ? Math.min((g.current / g.target) * 100, 100) : 0;
              const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7));
              const remaining = Math.max(0, g.target - g.current);
              const perWeek = (remaining / weeksLeft).toFixed(1);
              return (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    {editingGoals ? (
                      <input value={g.label} onChange={e => { const updated = [...goals]; updated[i].label = e.target.value; setGoals(updated); }} style={{ fontSize: 13, color: "#0f172a", border: "1px solid #e2e8f0", borderRadius: 8, padding: "4px 10px", fontFamily: "'DM Sans', sans-serif", outline: "none", flex: 1, marginRight: 8 }} />
                    ) : (
                      <span style={{ fontSize: 13, color: "#0f172a", fontWeight: 500 }}>{g.emoji} {g.label}</span>
                    )}
                    <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: pct >= 100 ? "#16a34a" : "#0f172a", flexShrink: 0 }}>
                      {g.isCurrency ? fmtK(g.current) : g.current}<span style={{ color: "#94a3b8", fontWeight: 400 }}> / {g.isCurrency ? fmtK(g.target) : g.target}</span>
                    </span>
                  </div>
                  {editingGoals && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                      <input type="number" value={g.current} onChange={e => { const updated = [...goals]; updated[i].current = parseFloat(e.target.value) || 0; setGoals(updated); }} style={{ width: 80, fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 8, padding: "4px 8px", fontFamily: "'DM Mono', monospace" }} placeholder="Current" />
                      <input type="number" value={g.target} onChange={e => { const updated = [...goals]; updated[i].target = parseFloat(e.target.value) || 0; setGoals(updated); }} style={{ width: 80, fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 8, padding: "4px 8px", fontFamily: "'DM Mono', monospace" }} placeholder="Target" />
                    </div>
                  )}
                  <div style={{ height: 10, background: "#f1f5f9", borderRadius: 5, overflow: "hidden" }}>
                    <div style={{
                      width: pct + "%", height: "100%", borderRadius: 5, transition: "width 0.8s cubic-bezier(0.25, 1, 0.5, 1)",
                      background: pct >= 100 ? "linear-gradient(90deg, #16a34a, #22c55e)" : pct >= 60 ? "linear-gradient(90deg, " + g.color + ", " + g.color + "cc)" : g.color,
                    }} />
                  </div>
                  <p style={{ fontSize: 11, margin: "4px 0 0", fontWeight: 500, color: pct >= 100 ? "#16a34a" : pct >= 80 ? "#16a34a" : pct >= 50 ? "#d97706" : "#94a3b8" }}>
                    {pct >= 100 ? "🎉 Goal reached!" : pct >= 80 ? "🔥 Almost there — " + remaining + " to go" : "📈 Need " + perWeek + "/wk · " + daysLeft + "d left"}
                  </p>
                </div>
              );
            })}
          </div>
        </CardWrap>

        {/* Top Deals by REAP Score */}
        <CardWrap>
          <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px", color: "#0f172a" }}>🏅 Top Deals by REAP Score</p>
          {scoredDeals.length === 0 ? (
            <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>No scored deals yet — underwrite a deal to see rankings</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {scoredDeals.map((d, i) => {
                const sc = scoreColor(d.reapScore);
                const medals = ["🥇", "🥈", "🥉"];
                return (
                  <div key={i} onClick={() => onSelectDeal(d)} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderRadius: 10,
                    borderBottom: i < scoredDeals.length - 1 ? "1px solid #f1f5f9" : "none",
                    cursor: "pointer", transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#f8fafc"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{i < 3 ? medals[i] : (i + 1)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: "#0f172a", margin: 0, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.address}</p>
                      <p style={{ fontSize: 11, color: "#94a3b8", margin: "1px 0 0" }}>{d.type || "—"} · {d.status}</p>
                    </div>
                    <span style={{
                      fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono', monospace",
                      background: sc.bg, color: sc.color, padding: "4px 12px", borderRadius: 10,
                      boxShadow: "0 2px 8px " + sc.glow,
                    }}>{Math.round(num(d.reapScore))}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardWrap>
      </div>

      {/* Needs Attention + Recent Activity */}
      <div style={{ display: "grid", gridTemplateColumns: midGrid, gap: isMobile ? 12 : 16, marginBottom: isMobile ? 12 : 20 }}>

        {/* Needs Attention */}
        <CardWrap>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <p style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#0f172a" }}>🚨 Needs Attention</p>
            {attentionItems.length > 0 && <span style={{
              fontSize: 11, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, #ef4444, #dc2626)",
              padding: "3px 10px", borderRadius: 20, minWidth: 20, textAlign: "center",
              boxShadow: "0 2px 8px rgba(239,68,68,0.3)",
            }}>{attentionItems.length}</span>}
          </div>
          {attentionItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <p style={{ fontSize: 28, margin: "0 0 6px" }}>✅</p>
              <p style={{ fontSize: 13, color: "#16a34a", fontWeight: 600, margin: 0 }}>All clear — nothing needs attention</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {attentionItems.slice(0, 5).map((item, i) => (
                <div key={i} onClick={() => item.deal ? onSelectDeal(item.deal) : null} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 4px",
                  borderBottom: i < Math.min(attentionItems.length, 5) - 1 ? "1px solid #f1f5f9" : "none",
                  cursor: item.deal ? "pointer" : "default", borderRadius: 6, transition: "background 0.15s",
                }}
                onMouseEnter={e => { if (item.deal) e.currentTarget.style.background = "#fef2f2"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{item.emoji}</span>
                  <p style={{ fontSize: 13, margin: 0, color: "#0f172a", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.text}</p>
                  {item.deal && <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2}><polyline points="9 18 15 12 9 6"/></svg>}
                </div>
              ))}
            </div>
          )}
        </CardWrap>

        {/* Recent Activity */}
        <CardWrap>
          <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px", color: "#0f172a" }}>⚡ Recent Activity</p>
          {recentActivities.length === 0 ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <p style={{ fontSize: 28, margin: "0 0 6px" }}>📭</p>
              <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>No activity yet — start logging calls, notes, and visits</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {recentActivities.slice(0, 5).map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 4px", borderBottom: i < Math.min(recentActivities.length, 5) - 1 ? "1px solid #f1f5f9" : "none" }}>
                  <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{activityEmojis[a.activity_type] || "📌"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: "#0f172a", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.description || a.activity_type}</p>
                    <p style={{ fontSize: 11, color: "#94a3b8", margin: "1px 0 0" }}>{a.user_email ? a.user_email.split("@")[0] : ""} · {timeAgo(a.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardWrap>
      </div>

      {/* Pipeline Velocity */}
      <CardWrap style={{ marginBottom: isMobile ? 12 : 20 }}>
        <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px", color: "#0f172a" }}>⏱️ Pipeline Velocity <span style={{ fontSize: 12, fontWeight: 400, color: "#94a3b8" }}>avg days per stage</span></p>
        <div style={{ display: "grid", gridTemplateColumns: velGrid, gap: isMobile ? 8 : 12 }}>
          {velocityData.map((v, i) => {
            const pct = maxVelocity > 0 ? Math.max((v.days / maxVelocity) * 100, 5) : 5;
            const isBottleneck = v.days > 12;
            const velGradients = [
              "linear-gradient(180deg, #93c5fd, #3b82f6)",
              "linear-gradient(180deg, #c4b5fd, #7c3aed)",
              "linear-gradient(180deg, #fdba74, #ea580c)",
              "linear-gradient(180deg, #fcd34d, #d97706)",
              "linear-gradient(180deg, #7dd3fc, #0284c7)",
              "linear-gradient(180deg, #86efac, #16a34a)",
            ];
            const velEmojis = ["📥", "🔍", "📐", "📨", "🔐", "🏆"];
            return (
              <div key={v.status} style={{ textAlign: "center" }}>
                <div style={{ height: 70, display: "flex", alignItems: "flex-end", justifyContent: "center", marginBottom: 8 }}>
                  <div style={{
                    width: "55%", maxWidth: 36, height: pct + "%", minHeight: 4,
                    background: isBottleneck ? "linear-gradient(180deg, #fca5a5, #dc2626)" : velGradients[i],
                    borderRadius: "6px 6px 2px 2px", transition: "height 0.8s cubic-bezier(0.25, 1, 0.5, 1)",
                    boxShadow: isBottleneck ? "0 2px 8px rgba(220,38,38,0.25)" : "0 2px 6px rgba(0,0,0,0.08)",
                  }} />
                </div>
                <span style={{ fontSize: 14 }}>{velEmojis[i]}</span>
                <p style={{ fontSize: 16, fontWeight: 700, fontFamily: "'DM Mono', monospace", margin: "2px 0 0", color: isBottleneck ? "#dc2626" : "#0f172a" }}>{v.days}d</p>
                <p style={{ fontSize: isMobile ? 9 : 11, color: isBottleneck ? "#dc2626" : "#94a3b8", margin: "2px 0 0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{v.status === "Under Contract" ? "Escrow" : v.status}</p>
              </div>
            );
          })}
        </div>
      </CardWrap>

      {/* Quick Stats Footer */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: isMobile ? 8 : 12 }}>
        <div style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)", borderRadius: 14, padding: isMobile ? "14px 12px" : "18px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 11, color: "#64748b", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>🔥 Hot Contacts</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b", margin: "4px 0 0", fontFamily: "'DM Mono', monospace" }}>{hotContactsCount}</p>
        </div>
        <div style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)", borderRadius: 14, padding: isMobile ? "14px 12px" : "18px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 11, color: "#64748b", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>💰 Capital Committed</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: "#a78bfa", margin: "4px 0 0", fontFamily: "'DM Mono', monospace" }}>{fmtK(capitalCommitted)}</p>
        </div>
        <div style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)", borderRadius: 14, padding: isMobile ? "14px 12px" : "18px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 11, color: "#64748b", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>📊 Avg REAP Score</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: "#4ade80", margin: "4px 0 0", fontFamily: "'DM Mono', monospace" }}>{scoredDeals.length > 0 ? Math.round(scoredDeals.reduce((s, d) => s + num(d.reapScore), 0) / scoredDeals.length) : "—"}</p>
        </div>
        <div style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)", borderRadius: 14, padding: isMobile ? "14px 12px" : "18px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 11, color: "#64748b", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>🏢 Investors</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: "#38bdf8", margin: "4px 0 0", fontFamily: "'DM Mono', monospace" }}>{investorsData.length}</p>
        </div>
      </div>

      </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   BUYER PIPELINE
   ═══════════════════════════════════════════════════════════ */

const BUYER_STATUS_CONFIG = {
  "New":              { color: "#16a34a", bg: "rgba(22,163,74,0.08)",   dot: "#16a34a" },
  "Contacted":        { color: "#d97706", bg: "rgba(217,119,6,0.08)",   dot: "#d97706" },
  "Info Gathering":   { color: "#7c3aed", bg: "rgba(124,58,237,0.08)",  dot: "#7c3aed" },
  "Confirmed Buyer":  { color: "#0891b2", bg: "rgba(8,145,178,0.08)",   dot: "#0891b2" },
  "Active":           { color: "#2563eb", bg: "rgba(37,99,235,0.08)",   dot: "#2563eb" },
  "Closed":           { color: "#64748b", bg: "rgba(100,116,139,0.08)", dot: "#64748b" },
};
const BUYER_STATUS_LIST = ["New", "Contacted", "Info Gathering", "Confirmed Buyer", "Active", "Closed"];
const BUYER_PROPERTY_TYPES = ["Single Family", "Multifamily", "Commercial", "Office", "Industrial", "Mixed Use", "Land", "Retail"];
const BUYER_MARKETS = ["Tampa", "Orlando", "Miami", "Jacksonville", "St. Petersburg", "Fort Lauderdale", "Clearwater", "Sarasota"];

function BuyerStatusBadge({ status }) {
  const cfg = BUYER_STATUS_CONFIG[status] || BUYER_STATUS_CONFIG["New"];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", border: `1px solid ${cfg.color}22` }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {status || "—"}
    </span>
  );
}

function BuyerModal({ isOpen, onClose, onSave, saving, isMobile, buyer }) {
  const isEdit = !!buyer?.rowId;
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", buyerStatus: "New", assetPreference: "", temperature: "", manager: "", notes: "", leadSource: "" });

  useEffect(() => {
    if (isOpen && buyer) {
      setForm({ name: buyer.name || "", email: buyer.email || "", phone: buyer.phone || "", company: buyer.company || "", buyerStatus: buyer.buyerStatus || "New", assetPreference: buyer.assetPreference || "", temperature: buyer.temperature || "", manager: buyer.manager || "", notes: buyer.notes || "", leadSource: buyer.leadSource || "" });
    } else if (isOpen) {
      setForm({ name: "", email: "", phone: "", company: "", buyerStatus: "New", assetPreference: "", temperature: "", manager: "", notes: "", leadSource: "" });
    }
  }, [isOpen, buyer]);

  if (!isOpen) return null;
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const handleSave = () => { if (!form.name) return; onSave(form); };
  const inputStyle = { width: "100%", padding: "12px 14px", fontSize: 14, fontFamily: "'DM Sans', sans-serif", border: "1.5px solid #e2e8f0", borderRadius: 10, outline: "none", transition: "border-color 0.2s", background: "#fff", color: "#0f172a", boxSizing: "border-box" };
  const labelStyle = { display: "block", fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" };
  const selectStyle = { ...inputStyle, appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' fill='none' stroke-width='1.5'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" };
  const focusH = (e) => { e.target.style.borderColor = "#16a34a"; };
  const blurH = (e) => { e.target.style.borderColor = "#e2e8f0"; };
  const secStyle = { fontSize: 11, color: "#16a34a", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", animation: "fadeIn 0.2s ease" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", background: "#fff", width: isMobile ? "100%" : 540, maxHeight: isMobile ? "92vh" : "85vh", overflow: "auto", borderRadius: isMobile ? "20px 20px 0 0" : 20, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", animation: isMobile ? "slideUp 0.3s cubic-bezier(0.25, 1, 0.5, 1)" : "fadeIn 0.25s ease" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff", zIndex: 1, borderRadius: isMobile ? "20px 20px 0 0" : "20px 20px 0 0" }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.02em" }}>{isEdit ? "Edit Buyer" : "New Buyer"}</h2>
            <p style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: "2px 0 0" }}>{isEdit ? "Update buyer details" : "Add a buyer to your pipeline"}</p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ padding: "20px 24px 24px" }}>
          <p style={secStyle}>Contact Information <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} /></p>
          <div style={{ marginBottom: 16 }}><label style={labelStyle}>Full Name *</label><input style={inputStyle} value={form.name} onChange={e => set("name", e.target.value)} placeholder="John Smith" onFocus={focusH} onBlur={blurH} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div><label style={labelStyle}>Email</label><input style={inputStyle} type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="john@example.com" onFocus={focusH} onBlur={blurH} /></div>
            <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="(813) 555-1234" onFocus={focusH} onBlur={blurH} /></div>
          </div>
          <div style={{ marginBottom: 24 }}><label style={labelStyle}>Company</label><input style={inputStyle} value={form.company} onChange={e => set("company", e.target.value)} placeholder="ABC Investments LLC" onFocus={focusH} onBlur={blurH} /></div>
          <p style={secStyle}>Pipeline <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} /></p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div><label style={labelStyle}>Buyer Status</label><select style={selectStyle} value={form.buyerStatus} onChange={e => set("buyerStatus", e.target.value)}>{BUYER_STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label style={labelStyle}>Temperature</label><select style={selectStyle} value={form.temperature} onChange={e => set("temperature", e.target.value)}><option value="">—</option><option value="🔥 Hot">🔥 Hot</option><option value="🤔 Medium">🤔 Medium</option><option value="🧊 Cold">🧊 Cold</option></select></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            <div><label style={labelStyle}>Asset Preference</label><select style={selectStyle} value={form.assetPreference} onChange={e => set("assetPreference", e.target.value)}><option value="">—</option>{BUYER_PROPERTY_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}</select></div>
            <div><label style={labelStyle}>Lead Source</label><input style={inputStyle} value={form.leadSource} onChange={e => set("leadSource", e.target.value)} placeholder="Referral, Cold Call, etc." onFocus={focusH} onBlur={blurH} /></div>
          </div>
          <p style={secStyle}>Additional <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} /></p>
          <div style={{ marginBottom: 16 }}><label style={labelStyle}>Manager / Assigned To</label><input style={inputStyle} value={form.manager} onChange={e => set("manager", e.target.value)} placeholder="Team member name" onFocus={focusH} onBlur={blurH} /></div>
          <div style={{ marginBottom: 24 }}><label style={labelStyle}>Notes</label><textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Budget, criteria, follow-up notes..." onFocus={focusH} onBlur={blurH} /></div>
          <button onClick={handleSave} disabled={saving || !form.name} style={{ width: "100%", padding: "14px 24px", background: saving ? "#15803d" : "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", border: "none", borderRadius: 12, cursor: saving ? "not-allowed" : "pointer", transition: "all 0.25s", letterSpacing: "0.01em", boxShadow: "0 4px 14px rgba(22,163,74,0.25)", opacity: !form.name ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {saving && <svg width={18} height={18} viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}><circle cx={12} cy={12} r={10} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={3} /><path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" /></svg>}
            {saving ? "Saving..." : isEdit ? "Update Buyer" : "Add Buyer"}
          </button>
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}

function BuyerPipelineView({ session, isMobile, showBuyerModal, onCloseBuyerModal, onSaveBuyer, savingBuyer, editingBuyer, onSetEditingBuyer, onNewBuyer, teamEmails: teamEmailsProp }) {
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [hoveredRow, setHoveredRow] = useState(null);
  const searchRef = useRef(null);

  useEffect(() => { if (searchOpen && searchRef.current) searchRef.current.focus(); }, [searchOpen]);

  const fetchBuyers = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: rows, error: fetchErr } = await supabase.from("contacts").select("*").order("date_added", { ascending: false });
      if (fetchErr) throw new Error(fetchErr.message);
      const parsed = (rows || []).map(r => ({
        rowId: r.id, name: r.contact_name || "", firstName: r.first_name || "",
        email: r.email || "", phone: r.phone || "", contactType: r.contact_type || "",
        buyerStatus: r.buyer_status || "", assetPreference: r.asset_preference || "",
        temperature: r.temperature || "", manager: r.manager || "", notes: r.notes || "",
        leadSource: r.lead_source || "", company: r.company || "", dateAdded: r.date_added || "",
        lastContact: r.last_contact || "", followUpNotes: r.follow_up_notes || "",
        user: r.user_email || "",
      })).filter(c => c.name && c.name.trim() !== "");
      const teamList = teamEmailsProp && teamEmailsProp.length > 0 ? teamEmailsProp.map(e => e.toLowerCase()) : [];
      const filtered = teamList.length > 0
        ? parsed.filter(c => { const contactUser = (c.user || "").toLowerCase().trim(); return contactUser && teamList.includes(contactUser); })
        : parsed;
      setBuyers(filtered);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, [teamEmailsProp]);

  useEffect(() => { if (session) fetchBuyers(); }, [session, fetchBuyers]);

  const statusFilters = BUYER_STATUS_LIST.map(label => ({ label, match: b => (b.buyerStatus || "").trim() === label }));
  const typeFiltered = typeFilter ? buyers.filter(b => (b.contactType || "").toLowerCase().includes(typeFilter.toLowerCase())) : buyers;
  const textFiltered = typeFiltered.filter(b => (b.name || "").toLowerCase().includes(search.toLowerCase()) || (b.email || "").toLowerCase().includes(search.toLowerCase()) || (b.company || "").toLowerCase().includes(search.toLowerCase()) || (b.phone || "").toLowerCase().includes(search.toLowerCase()));
  const statusFiltered = statusFilter !== null ? textFiltered.filter(statusFilters[statusFilter].match) : textFiltered;

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={fetchBuyers} />;

  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      {isMobile ? (
        <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "14px 16px" }}>
          {searchOpen ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, animation: "fadeIn 0.2s ease" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2}><circle cx={11} cy={11} r={8} /><path d="m21 21-4.35-4.35" /></svg>
                <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts..." style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px 10px 32px", color: "#0f172a", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", width: "100%" }} />
              </div>
              <button onClick={() => { setSearchOpen(false); setSearch(""); }} style={{ background: "none", border: "none", color: "#64748b", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", padding: "8px 4px", whiteSpace: "nowrap" }}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h1 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.02em" }}>Contacts</h1>
                <p style={{ fontSize: 11, color: "#94a3b8", margin: "3px 0 0", fontFamily: "'DM Sans', sans-serif" }}>{statusFilter !== null ? statusFiltered.length + " " + statusFilters[statusFilter].label.toLowerCase() : buyers.length + " contacts"}</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setSearchOpen(true)} style={{ width: 36, height: 36, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2}><circle cx={11} cy={11} r={8} /><path d="m21 21-4.35-4.35" /></svg>
                </button>
                <button onClick={onNewBuyer} style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 8px rgba(22,163,74,0.35)" }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5}><path d="M12 5v14M5 12h14" /></svg>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.02em" }}>Contacts</h1>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "3px 0 0", fontFamily: "'DM Sans', sans-serif" }}>{buyers.length} contacts</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", color: "#0f172a", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none" }}>
              <option value="">All Types</option>
              <option value="Buyer">Buyers</option>
              <option value="Investor">Investors</option>
              <option value="Wholesaler">Wholesalers</option>
              <option value="Sphere of Influence">Sphere of Influence</option>
              <option value="Community">Community</option>
            </select>
            <div style={{ position: "relative" }}>
              <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2}><circle cx={11} cy={11} r={8} /><path d="m21 21-4.35-4.35" /></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts..." style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px 8px 32px", color: "#0f172a", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", width: 210 }} />
            </div>
            <button onClick={onNewBuyer} style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", borderRadius: 8, padding: "9px 18px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 10px rgba(22,163,74,0.35)", whiteSpace: "nowrap" }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14" /></svg>
              New Contact
            </button>
          </div>
        </div>
      )}
      <div style={{ background: "#fff", borderBottom: "1px solid #f1f5f9", padding: isMobile ? "0" : "12px 32px", display: "flex", gap: 0, overflowX: isMobile ? "auto" : "visible", WebkitOverflowScrolling: "touch" }}>
        {statusFilters.map((s, i) => {
          const count = buyers.filter(s.match).length; const isActive = statusFilter === i;
          return (<button key={s.label} onClick={() => setStatusFilter(isActive ? null : i)} style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: isMobile ? "12px 16px" : "0", marginRight: isMobile ? 0 : 32, borderBottom: isMobile && isActive ? "2px solid #16a34a" : "2px solid transparent", transition: "all 0.2s", WebkitTapHighlightColor: "transparent" }}>
            <span style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, color: isActive ? "#16a34a" : "#0f172a", fontFamily: "'DM Mono', monospace", transition: "color 0.2s" }}>{count}</span>
            <span style={{ fontSize: isMobile ? 11 : 12, color: isActive ? "#16a34a" : "#94a3b8", fontWeight: 500, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>{s.label}</span>
          </button>);
        })}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: isMobile ? "12px 12px" : "16px 32px" }}>
        {statusFiltered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>
            <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth={1.5} style={{ margin: "0 auto 12px", display: "block" }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx={9} cy={7} r={4} /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#64748b", margin: "0 0 4px" }}>{buyers.length === 0 ? "No contacts yet" : "No contacts match your filters"}</p>
            <p style={{ fontSize: 13, margin: 0 }}>{buyers.length === 0 ? "Add your first contact to get started" : "Try adjusting your search or status filter"}</p>
          </div>
        ) : isMobile ? (
          statusFiltered.map((b, i) => (
            <div key={b.rowId || b.name + i} onClick={() => onSetEditingBuyer(b)} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "14px 16px", cursor: "pointer", marginBottom: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.03)", WebkitTapHighlightColor: "transparent" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name || "—"}</p>
                  <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: "2px 0 0" }}>{[b.company, b.assetPreference].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <div style={{ flexShrink: 0, marginLeft: 10 }}><BuyerStatusBadge status={b.buyerStatus || "New"} /></div>
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                {b.temperature && <div><span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Temp</span><p style={{ fontSize: 13, fontWeight: 500, color: "#64748b", fontFamily: "'DM Sans', sans-serif", margin: "1px 0 0" }}>{b.temperature}</p></div>}
                {b.phone && <div><span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Phone</span><p style={{ fontSize: 13, fontWeight: 500, color: "#64748b", fontFamily: "'DM Mono', monospace", margin: "1px 0 0" }}>{b.phone}</p></div>}
                <div style={{ marginLeft: "auto" }}><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth={2}><path d="M9 18l6-6-6-6" /></svg></div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Sans', sans-serif" }}>
              <thead><tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                {["Name", "Company", "Type", "Status", "Temp", "Asset Pref", "Phone", "Email", "Manager"].map(h => (<th key={h} style={{ textAlign: "left", padding: "12px 14px", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>))}
              </tr></thead>
              <tbody>
                {statusFiltered.map((b, i) => (
                  <tr key={b.rowId || b.name + i} onClick={() => onSetEditingBuyer(b)} onMouseEnter={() => setHoveredRow(i)} onMouseLeave={() => setHoveredRow(null)} style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer", background: hoveredRow === i ? "#f8fafc" : "transparent", transition: "background 0.1s" }}>
                    <td style={{ padding: "12px 14px" }}><span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{b.name || "—"}</span></td>
                    <td style={{ padding: "12px 14px", fontSize: 13, color: "#64748b" }}>{b.company || "—"}</td>
                    <td style={{ padding: "12px 14px", fontSize: 11, color: "#64748b" }}>{b.contactType || "—"}</td>
                    <td style={{ padding: "12px 14px" }}><BuyerStatusBadge status={b.buyerStatus || "New"} /></td>
                    <td style={{ padding: "12px 14px", fontSize: 13 }}>{b.temperature || "—"}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#64748b" }}>{b.assetPreference || "—"}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>{b.phone || "—"}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#94a3b8" }}>{b.email || "—"}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#64748b" }}>{b.manager || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <BuyerModal isOpen={showBuyerModal} onClose={onCloseBuyerModal} onSave={onSaveBuyer} saving={savingBuyer} isMobile={isMobile} buyer={editingBuyer} />
    </div>
  );
}



/* ═══════════════════════════════════════════════════════════
   PORTFOLIO TRACKER — 4th Nav Item
   ═══════════════════════════════════════════════════════════ */

var PORTFOLIO_TYPES = {
  "Owned": { color: "#16a34a", bg: "rgba(22,163,74,0.08)", icon: "key" },
  "Acquisition": { color: "#7c3aed", bg: "rgba(124,58,237,0.08)", icon: "target" },
  "Watch List": { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", icon: "eye" },
};

function PortfolioTypeBadge({ type }) {
  var cfg = PORTFOLIO_TYPES[type] || PORTFOLIO_TYPES["Watch List"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20,
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.03em",
      fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
      border: "1px solid " + cfg.color + "22",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
      {type}
    </span>
  );
}

function PortfolioStatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: accent ? "linear-gradient(135deg, #f0fdf4, #dcfce7)" : "#fff",
      border: "1px solid " + (accent ? "#bbf7d0" : "#e2e8f0"),
      borderRadius: 12, padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 3,
    }}>
      <span style={{ fontSize: 9, color: accent ? "#16a34a" : "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, color: accent ? "#15803d" : "#0f172a", fontFamily: "'DM Mono', monospace", letterSpacing: "-0.02em" }}>{value}</span>
      {sub && <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>{sub}</span>}
    </div>
  );
}

function PortfolioPropertyCard({ deal, onClick }) {
  var capRateVal = num(deal.capRate);
  return (
    <div onClick={onClick} style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
      padding: "16px", cursor: "pointer",
      boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
      transition: "all 0.15s",
    }}
      onMouseEnter={function(e) { e.currentTarget.style.borderColor = "#16a34a"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(22,163,74,0.1)"; }}
      onMouseLeave={function(e) { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.03)"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: "0 0 3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{deal.address || "—"}</p>
          <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>{deal.city || ""}{deal.city && deal.state ? ", " : ""}{deal.state || ""} {deal.zip || ""}</p>
        </div>
        <StatusBadge status={deal.status} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <div>
          <span style={{ fontSize: 9, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", display: "block" }}>Units</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Mono', monospace" }}>{deal.units || "—"}</span>
        </div>
        <div>
          <span style={{ fontSize: 9, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", display: "block" }}>Cap Rate</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: capRateVal >= 6 ? "#16a34a" : capRateVal !== null && capRateVal < 4 ? "#dc2626" : "#0f172a", fontFamily: "'DM Mono', monospace" }}>{fmtPct(deal.capRate)}</span>
        </div>
        <div>
          <span style={{ fontSize: 9, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", display: "block" }}>Occupancy</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Mono', monospace" }}>{deal.proformaVacancy ? (100 - parseFloat(deal.proformaVacancy)).toFixed(0) + "%" : "—"}</span>
        </div>
      </div>
    </div>
  );
}

function CreatePortfolioModal({ isOpen, onClose, onSave, isMobile, deals, portfolio }) {
  var [name, setName] = useState(portfolio ? portfolio.name : "");
  var [type, setType] = useState(portfolio ? portfolio.type : "Owned");
  var [selectedDeals, setSelectedDeals] = useState(portfolio ? portfolio.dealAddresses : []);
  var [searchText, setSearchText] = useState("");

  useEffect(function() {
    if (isOpen) {
      setName(portfolio ? portfolio.name : "");
      setType(portfolio ? portfolio.type : "Owned");
      setSelectedDeals(portfolio ? portfolio.dealAddresses : []);
      setSearchText("");
    }
  }, [isOpen, portfolio]);

  var filteredDeals = (function() {
    var selected = deals.filter(function(d) { return selectedDeals.includes(d.address); });
    var unselected = deals.filter(function(d) { return !selectedDeals.includes(d.address); });
    if (!searchText) return selected.concat(unselected);
    var q = searchText.toLowerCase().trim();
    var matchedUnselected = unselected.filter(function(d) {
      return (d.address && d.address.toLowerCase().includes(q)) ||
             (d.dealName && d.dealName.toLowerCase().includes(q));
    });
    return selected.concat(matchedUnselected);
  })();

  var toggleDeal = function(addr) {
    if (selectedDeals.includes(addr)) {
      setSelectedDeals(selectedDeals.filter(function(a) { return a !== addr; }));
    } else {
      setSelectedDeals(selectedDeals.concat([addr]));
    }
  };

  var handleSave = function() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), type: type, dealAddresses: selectedDeals });
  };

  if (!isOpen) return null;

  var inputStyle = { width: "100%", padding: "10px 14px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", border: "1.5px solid #e2e8f0", borderRadius: 8, outline: "none", background: "#fff", color: "#0f172a", boxSizing: "border-box" };
  var labelStyle = { display: "block", fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", animation: "fadeIn 0.2s ease" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "relative", background: "#fff", width: isMobile ? "100%" : 560,
        maxHeight: isMobile ? "92vh" : "85vh", overflow: "auto",
        borderRadius: isMobile ? "20px 20px 0 0" : 20,
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        animation: isMobile ? "slideUp 0.3s cubic-bezier(0.25, 1, 0.5, 1)" : "fadeIn 0.25s ease",
      }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff", zIndex: 1, borderRadius: isMobile ? "20px 20px 0 0" : "20px 20px 0 0" }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.02em" }}>{portfolio ? "Edit Portfolio" : "Create Portfolio"}</h2>
            <p style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: "2px 0 0" }}>Group deals into a portfolio</p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div style={{ padding: "20px 24px 24px" }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Portfolio Name *</label>
            <input style={inputStyle} value={name} onChange={function(e) { setName(e.target.value); }} placeholder="e.g. Tampa Multifamily" onFocus={function(e) { e.target.style.borderColor = "#16a34a"; }} onBlur={function(e) { e.target.style.borderColor = "#e2e8f0"; }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Portfolio Type</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["Owned", "Acquisition", "Watch List"].map(function(t) {
                var active = type === t;
                var cfg = PORTFOLIO_TYPES[t];
                return (
                  <button key={t} onClick={function() { setType(t); }} style={{
                    flex: 1, padding: "10px 12px", borderRadius: 8,
                    border: "1.5px solid " + (active ? cfg.color : "#e2e8f0"),
                    background: active ? cfg.bg : "#fff",
                    color: active ? cfg.color : "#64748b",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
                  }}>{t}</button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Assign Deals ({selectedDeals.length} selected of {deals.length})</label>
            <input style={{ ...inputStyle, marginBottom: 10 }} value={searchText} onChange={function(e) { setSearchText(e.target.value); }} placeholder="Search by property address..." onFocus={function(e) { e.target.style.borderColor = "#16a34a"; }} onBlur={function(e) { e.target.style.borderColor = "#e2e8f0"; }} />
            <div style={{ maxHeight: 240, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 10, background: "#f8fafc" }}>
              {filteredDeals.length === 0 ? (
                <p style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12, fontFamily: "'DM Sans', sans-serif", margin: 0 }}>No deals found</p>
              ) : filteredDeals.map(function(d, i) {
                var selected = selectedDeals.includes(d.address);
                return (
                  <div key={d.address || i} onClick={function() { toggleDeal(d.address); }} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                    borderBottom: i < filteredDeals.length - 1 ? "1px solid #e2e8f0" : "none",
                    cursor: "pointer", background: selected ? "rgba(22,163,74,0.04)" : "transparent",
                    transition: "background 0.1s",
                  }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      border: selected ? "none" : "1.5px solid #d1d5db",
                      background: selected ? "#16a34a" : "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s",
                    }}>
                      {selected && <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.address || d.dealName || "—"}</p>
                      <p style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: "1px 0 0" }}>{d.dealName && d.address ? d.dealName + " · " : ""}{d.type || ""} · {d.city || ""}{d.state ? ", " + d.state : ""}</p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{fmt(d.offer)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <button onClick={handleSave} disabled={!name.trim()} style={{
            width: "100%", padding: "14px 24px",
            background: !name.trim() ? "#94a3b8" : "linear-gradient(135deg, #16a34a, #15803d)",
            color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
            border: "none", borderRadius: 12, cursor: !name.trim() ? "not-allowed" : "pointer",
            boxShadow: name.trim() ? "0 4px 14px rgba(22,163,74,0.25)" : "none",
            opacity: !name.trim() ? 0.5 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.2s",
          }}>
            {portfolio ? "Save Changes" : "Create Portfolio"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PortfolioDetailView({ portfolio, deals, onBack, onEdit, onSelectDeal, isMobile }) {
  var portfolioDeals = deals.filter(function(d) { return portfolio.dealAddresses.includes(d.address); });
  var totalValue = portfolioDeals.reduce(function(s, d) { return s + (num(d.offer) || 0); }, 0);
  var totalUnits = portfolioDeals.reduce(function(s, d) { return s + (parseInt(d.units) || 0); }, 0);
  var totalNOI = portfolioDeals.reduce(function(s, d) { return s + (num(d.noiAnnual) || 0); }, 0);
  var capRates = portfolioDeals.map(function(d) { return num(d.capRate); }).filter(function(v) { return v !== null; });
  var avgCapRate = capRates.length > 0 ? (capRates.reduce(function(s, v) { return s + v; }, 0) / capRates.length).toFixed(1) : "—";
  var occupancies = portfolioDeals.map(function(d) { return d.proformaVacancy ? 100 - parseFloat(d.proformaVacancy) : null; }).filter(function(v) { return v !== null; });
  var avgOccupancy = occupancies.length > 0 ? (occupancies.reduce(function(s, v) { return s + v; }, 0) / occupancies.length).toFixed(0) : "—";

  var cities = {};
  portfolioDeals.forEach(function(d) { if (d.city) { cities[d.city] = (cities[d.city] || 0) + 1; } });
  var cityList = Object.keys(cities).sort(function(a, b) { return cities[b] - cities[a]; });

  return (
    <div style={{ flex: 1, overflow: "auto", background: "#f8fafc" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: isMobile ? "14px 16px" : "18px 32px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 5, marginBottom: isMobile ? 10 : 14, padding: 0, fontWeight: 500 }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back to Portfolios
        </button>
        <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.02em" }}>{portfolio.name}</h1>
              <PortfolioTypeBadge type={portfolio.type} />
            </div>
            <p style={{ fontSize: 13, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>{portfolioDeals.length} properties · Created {fmtDate(portfolio.createdAt)}</p>
          </div>
          <button onClick={onEdit} style={{
            background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8,
            padding: "10px 18px", color: "#475569", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit Portfolio
          </button>
        </div>
      </div>

      <div style={{ padding: isMobile ? "20px 16px" : "28px 32px" }}>

        {/* Geographic Overview */}
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
            Geographic Overview <span style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          </h3>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px", display: "flex", gap: 20, alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row" }}>
            <div style={{ width: isMobile ? "100%" : 200, height: isMobile ? 120 : 100, borderRadius: 10, background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative", overflow: "hidden" }}>
              <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={1.2}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <div style={{ position: "absolute", bottom: 6, right: 8, fontSize: 9, color: "#16a34a", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Map View</div>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: "0 0 6px" }}>Markets</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {cityList.length > 0 ? cityList.map(function(city) {
                  return (
                    <span key={city} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "4px 10px", borderRadius: 6,
                      background: "#f1f5f9", color: "#475569",
                      fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                    }}>
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      {city} ({cities[city]})
                    </span>
                  );
                }) : <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>No properties assigned</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Portfolio Stats */}
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
            Portfolio Summary <span style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(5, 1fr)", gap: 12 }}>
            <PortfolioStatCard label="Total Value" value={fmt(totalValue)} accent />
            <PortfolioStatCard label="Properties" value={portfolioDeals.length} />
            <PortfolioStatCard label="Total Units" value={totalUnits || "—"} />
            <PortfolioStatCard label="Avg Occupancy" value={avgOccupancy !== "—" ? avgOccupancy + "%" : "—"} />
            <PortfolioStatCard label="Annual NOI" value={fmt(totalNOI)} sub={avgCapRate !== "—" ? "Avg " + avgCapRate + "% Cap" : ""} />
          </div>
        </div>

        {/* Properties */}
        <div>
          <h3 style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
            Properties ({portfolioDeals.length}) <span style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          </h3>
          {portfolioDeals.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px dashed #e2e8f0", padding: "40px 20px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>No properties in this portfolio yet. Edit to assign deals.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
              {portfolioDeals.map(function(d, i) {
                return <PortfolioPropertyCard key={d.address || i} deal={d} onClick={function() { onSelectDeal(d); }} />;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PortfolioView({ deals, isMobile, onSelectDeal, session, pendingPortfolioId, onClearPendingPortfolio, onHashUpdate, teamEmails: teamEmailsProp }) {
  var [portfolios, setPortfolios] = useState([]);
  var [portfoliosLoading, setPortfoliosLoading] = useState(true);
  var [selectedPortfolio, setSelectedPortfolio] = useState(null);
  var [showCreateModal, setShowCreateModal] = useState(false);
  var [editingPortfolio, setEditingPortfolio] = useState(null);
  var [hoveredCard, setHoveredCard] = useState(null);

  var userEmail = session && session.user ? session.user.email : "";
  var emailsToShow = teamEmailsProp && teamEmailsProp.length > 0 ? teamEmailsProp : [userEmail.toLowerCase()];

  var fetchPortfolios = async function() {
    setPortfoliosLoading(true);
    try {
      var { data: rows, error: fetchErr } = await supabase.from("portfolios").select("*").order("created_at", { ascending: false });
      if (fetchErr) throw new Error(fetchErr.message);
      var parsed = (rows || []).filter(function(r) { return emailsToShow.includes((r.user_email || "").toLowerCase()); }).map(function(r) {
        return {
          id: r.id || "",
          user: r.user_email || "",
          name: r.name || "",
          type: r.type || "Owned",
          dealAddresses: r.deal_addresses ? r.deal_addresses.split("|||").filter(function(a) { return a; }) : [],
          createdAt: r.created_at || "",
        };
      });
      setPortfolios(parsed);
    } catch(err) { console.error("Error fetching portfolios:", err); }
    setPortfoliosLoading(false);
  };

  useEffect(function() {
    if (userEmail) fetchPortfolios();
  }, [userEmail]);

  // Resolve pending portfolio from hash
  useEffect(function() {
    if (pendingPortfolioId && portfolios.length > 0) {
      var p = portfolios.find(function(p) { return p.id === pendingPortfolioId; });
      if (p) setSelectedPortfolio(p);
      if (onClearPendingPortfolio) onClearPendingPortfolio();
    }
  }, [pendingPortfolioId, portfolios, onClearPendingPortfolio]);

  var selectPortfolio = function(p) {
    setSelectedPortfolio(p);
    if (onHashUpdate) onHashUpdate("portfolio/" + encodeURIComponent(p.id));
  };

  var backToPortfolios = function() {
    setSelectedPortfolio(null);
    if (onHashUpdate) onHashUpdate("portfolios");
  };

  var handleCreateSave = async function(data) {
    try {
      if (editingPortfolio) {
        var { error } = await supabase.from("portfolios").update({ name: data.name, type: data.type, deal_addresses: (data.dealAddresses || []).join("|||") }).eq("id", editingPortfolio.id);
        if (error) throw error;
        var updatedP = Object.assign({}, editingPortfolio, data);
        setPortfolios(portfolios.map(function(p) { return p.id === editingPortfolio.id ? updatedP : p; }));
        if (selectedPortfolio && selectedPortfolio.id === editingPortfolio.id) setSelectedPortfolio(updatedP);
      } else {
        var newId = "p_" + Date.now();
        var { error } = await supabase.from("portfolios").insert({ id: newId, user_email: userEmail, org_id: null, name: data.name, type: data.type, deal_addresses: (data.dealAddresses || []).join("|||") });
        if (error) throw error;
        setPortfolios(portfolios.concat([{ id: newId, user: userEmail, name: data.name, type: data.type, dealAddresses: data.dealAddresses || [], createdAt: new Date().toISOString() }]));
      }
    } catch(err) { console.error("Portfolio save error:", err); }
    setShowCreateModal(false);
    setEditingPortfolio(null);
  };

  var handleDelete = async function(id) {
    try {
      var { error } = await supabase.from("portfolios").delete().eq("id", id);
      if (error) throw error;
      setPortfolios(portfolios.filter(function(p) { return p.id !== id; }));
      if (selectedPortfolio && selectedPortfolio.id === id) backToPortfolios();
    } catch(err) { console.error("Delete portfolio error:", err); }
  };

  var getPortfolioStats = function(p) {
    var pDeals = deals.filter(function(d) { return p.dealAddresses.includes(d.address); });
    var totalValue = pDeals.reduce(function(s, d) { return s + (num(d.offer) || 0); }, 0);
    var totalUnits = pDeals.reduce(function(s, d) { return s + (parseInt(d.units) || 0); }, 0);
    var totalNOI = pDeals.reduce(function(s, d) { return s + (num(d.noiAnnual) || 0); }, 0);
    var capRates = pDeals.map(function(d) { return num(d.capRate); }).filter(function(v) { return v !== null; });
    var avgCap = capRates.length > 0 ? (capRates.reduce(function(s, v) { return s + v; }, 0) / capRates.length).toFixed(1) : null;
    var occupancies = pDeals.map(function(d) { return d.proformaVacancy ? 100 - parseFloat(d.proformaVacancy) : null; }).filter(function(v) { return v !== null; });
    var avgOcc = occupancies.length > 0 ? (occupancies.reduce(function(s, v) { return s + v; }, 0) / occupancies.length).toFixed(0) : null;
    return { count: pDeals.length, totalValue: totalValue, totalUnits: totalUnits, totalNOI: totalNOI, avgCap: avgCap, avgOcc: avgOcc };
  };

  if (selectedPortfolio) {
    return (
      <>
        <PortfolioDetailView
          portfolio={selectedPortfolio}
          deals={deals}
          onBack={function() { backToPortfolios(); }}
          onEdit={function() { setEditingPortfolio(selectedPortfolio); setShowCreateModal(true); }}
          onSelectDeal={onSelectDeal}
          isMobile={isMobile}
        />
        <CreatePortfolioModal
          isOpen={showCreateModal}
          onClose={function() { setShowCreateModal(false); setEditingPortfolio(null); }}
          onSave={handleCreateSave}
          isMobile={isMobile}
          deals={deals}
          portfolio={editingPortfolio}
        />
      </>
    );
  }

  return (
    <div style={{ flex: 1, overflow: "auto", background: "#f8fafc" }}>
      {/* Header */}
      <div style={{ padding: isMobile ? "14px 16px" : "18px 32px", background: "#fff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.02em" }}>Portfolios</h1>
          <p style={{ fontSize: isMobile ? 11 : 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: "3px 0 0" }}>{portfolios.length} portfolio{portfolios.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={function() { setEditingPortfolio(null); setShowCreateModal(true); }} style={{
          background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", borderRadius: 10,
          padding: isMobile ? "10px 16px" : "10px 20px", color: "#fff", fontSize: 13, fontWeight: 600,
          cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          boxShadow: "0 2px 10px rgba(22,163,74,0.35)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14"/></svg>
          {isMobile ? "New" : "New Portfolio"}
        </button>
      </div>

      {/* Portfolio Grid */}
      <div style={{ padding: isMobile ? "16px" : "24px 32px" }}>
        {portfoliosLoading ? (
          <div style={{ padding: 60, textAlign: "center" }}>
            <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTop: "3px solid #16a34a", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
            <p style={{ fontSize: 13, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>Loading portfolios...</p>
          </div>
        ) : portfolios.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px dashed #e2e8f0", padding: isMobile ? "40px 20px" : "60px 40px", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg, rgba(22,163,74,0.1), rgba(22,163,74,0.05))", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={1.5}><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/></svg>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: "0 0 8px", letterSpacing: "-0.02em" }}>Create Your First Portfolio</h3>
            <p style={{ fontSize: 14, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: "0 0 24px", maxWidth: 400, marginLeft: "auto", marginRight: "auto", lineHeight: 1.6 }}>
              Group your deals into portfolios — track owned properties, active acquisitions, or watch list targets all in one place.
            </p>
            <button onClick={function() { setEditingPortfolio(null); setShowCreateModal(true); }} style={{
              background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", borderRadius: 10,
              padding: "12px 28px", color: "#fff", fontSize: 14, fontWeight: 600,
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              boxShadow: "0 2px 12px rgba(22,163,74,0.35)",
              display: "inline-flex", alignItems: "center", gap: 8,
            }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14"/></svg>
              Create Portfolio
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
            {portfolios.map(function(p, i) {
              var stats = getPortfolioStats(p);
              var isHovered = hoveredCard === p.id;
              return (
                <div key={p.id} onClick={function() { selectPortfolio(p); }}
                  onMouseEnter={function() { setHoveredCard(p.id); }}
                  onMouseLeave={function() { setHoveredCard(null); }}
                  style={{
                    background: "#fff", border: "1px solid " + (isHovered ? "#16a34a" : "#e2e8f0"),
                    borderRadius: 16, padding: "20px",
                    cursor: "pointer", transition: "all 0.2s",
                    boxShadow: isHovered ? "0 4px 20px rgba(22,163,74,0.12)" : "0 1px 4px rgba(0,0,0,0.03)",
                    transform: isHovered ? "translateY(-2px)" : "none",
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <div>
                      <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: "0 0 6px" }}>{p.name}</h3>
                      <PortfolioTypeBadge type={p.type} />
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={function(e) { e.stopPropagation(); setEditingPortfolio(p); setShowCreateModal(true); }} style={{ width: 30, height: 30, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={function(e) { e.stopPropagation(); if (window.confirm("Delete \"" + p.name + "\"?")) handleDelete(p.id); }} style={{ width: 30, height: 30, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
                    <div>
                      <span style={{ fontSize: 9, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", display: "block" }}>Value</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Mono', monospace" }}>{fmt(stats.totalValue)}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 9, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", display: "block" }}>Properties</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Mono', monospace" }}>{stats.count}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 9, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", display: "block" }}>Units</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Mono', monospace" }}>{stats.totalUnits || "—"}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 12, paddingTop: 14, borderTop: "1px solid #f1f5f9" }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 9, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", display: "block" }}>Avg Cap</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: stats.avgCap && parseFloat(stats.avgCap) >= 6 ? "#16a34a" : "#0f172a", fontFamily: "'DM Mono', monospace" }}>{stats.avgCap ? stats.avgCap + "%" : "—"}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 9, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", display: "block" }}>Occupancy</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Mono', monospace" }}>{stats.avgOcc ? stats.avgOcc + "%" : "—"}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 9, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", display: "block" }}>NOI/yr</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: stats.totalNOI > 0 ? "#16a34a" : "#0f172a", fontFamily: "'DM Mono', monospace" }}>{fmt(stats.totalNOI)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreatePortfolioModal
        isOpen={showCreateModal}
        onClose={function() { setShowCreateModal(false); setEditingPortfolio(null); }}
        onSave={handleCreateSave}
        isMobile={isMobile}
        deals={deals}
        portfolio={editingPortfolio}
      />
    </div>
  );
}



/* ═══════════════════════════════════════════════════════════════════
   MARKET INTELLIGENCE — Session 8
   Heat map placeholder + trending markets table
   Reads from Supabase markets table
   ═══════════════════════════════════════════════════════════════════ */

const AI_SIGNAL_CONFIG = {
  "Hot": { color: "#dc2626", bg: "#fef2f2", icon: "🔥", glow: "rgba(220,38,38,0.15)" },
  "Warm": { color: "#d97706", bg: "#fffbeb", icon: "☀️", glow: "rgba(217,119,6,0.12)" },
  "Neutral": { color: "#6366f1", bg: "#eef2ff", icon: "⚖️", glow: "rgba(99,102,241,0.12)" },
  "Cooling": { color: "#0891b2", bg: "#ecfeff", icon: "❄️", glow: "rgba(8,145,178,0.12)" },
};

function MarketSignalBadge({ signal }) {
  const cfg = AI_SIGNAL_CONFIG[signal] || AI_SIGNAL_CONFIG["Neutral"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 20,
      background: cfg.bg, color: cfg.color,
      fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
      letterSpacing: "0.03em", border: "1px solid " + cfg.color + "22",
      boxShadow: "0 1px 6px " + cfg.glow,
    }}>
      <span style={{ fontSize: 11 }}>{cfg.icon}</span> {signal}
    </span>
  );
}

function MarketStatCard({ label, value, sub, accent, icon }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "18px 22px",
      border: "1px solid #e2e8f0", flex: 1, minWidth: 0,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: accent || "#16a34a", borderRadius: "14px 14px 0 0",
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        {icon && <span style={{ fontSize: 14, opacity: 0.7 }}>{icon}</span>}
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#64748b", fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function HeatMapPlaceholder({ markets, isMobile }) {
  // Group markets by region for the visual
  const regionColors = {
    "Southeast": "#16a34a", "Northeast": "#3b82f6", "Midwest": "#d97706",
    "Southwest": "#dc2626", "West": "#7c3aed", "Mid-Atlantic": "#0891b2",
    "Pacific": "#6366f1", "Mountain": "#ca8a04", "Other": "#64748b"
  };
  
  // Approximate US positions for each region
  const regionPositions = {
    "Southeast": { x: 72, y: 62 }, "Northeast": { x: 82, y: 28 },
    "Midwest": { x: 55, y: 32 }, "Southwest": { x: 30, y: 60 },
    "West": { x: 15, y: 40 }, "Mid-Atlantic": { x: 78, y: 42 },
    "Pacific": { x: 8, y: 30 }, "Mountain": { x: 28, y: 35 },
    "Other": { x: 50, y: 50 }
  };

  // Aggregate markets by region
  const regionData = {};
  markets.forEach(m => {
    const r = m.region || "Other";
    if (!regionData[r]) regionData[r] = { count: 0, signals: [], markets: [] };
    regionData[r].count++;
    regionData[r].signals.push(m.aiSignal);
    regionData[r].markets.push(m.market);
  });

  // Get dominant signal per region
  const getDominantSignal = (signals) => {
    const counts = {};
    signals.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Neutral";
  };

  return (
    <div style={{
      background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0",
      padding: isMobile ? "16px" : "24px", marginBottom: 20,
      position: "relative", overflow: "hidden",
    }}>
      {/* Subtle grid background */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.03,
        backgroundImage: "radial-gradient(circle, #0f172a 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }} />
      
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #16a34a, #15803d)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(22,163,74,0.25)",
          }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}>
              <circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.01em" }}>Market Heat Map</h3>
            <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0", fontFamily: "'DM Sans', sans-serif" }}>Geographic signal overview · {markets.length} markets tracked</p>
          </div>
        </div>

        {/* Heat map visual */}
        <div style={{
          position: "relative", width: "100%", paddingBottom: isMobile ? "55%" : "40%",
          background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
          borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0",
        }}>
          {/* US outline hint */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: "radial-gradient(ellipse 85% 75% at 50% 50%, rgba(22,163,74,0.04) 0%, transparent 70%)",
          }} />
          
          {Object.entries(regionData).map(([region, data]) => {
            const pos = regionPositions[region] || regionPositions["Other"];
            const dominant = getDominantSignal(data.signals);
            const signalCfg = AI_SIGNAL_CONFIG[dominant] || AI_SIGNAL_CONFIG["Neutral"];
            const size = Math.min(60, 24 + data.count * 12);
            return (
              <div key={region} style={{
                position: "absolute",
                left: pos.x + "%", top: pos.y + "%",
                transform: "translate(-50%, -50%)",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              }}>
                <div style={{
                  width: size, height: size, borderRadius: "50%",
                  background: signalCfg.bg,
                  border: "2px solid " + signalCfg.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 2px 12px " + signalCfg.glow + ", 0 0 0 4px " + signalCfg.color + "08",
                  cursor: "default", transition: "transform 0.2s",
                }}>
                  <span style={{ fontSize: Math.max(11, size * 0.35), fontWeight: 800, color: signalCfg.color, fontFamily: "'DM Mono', monospace" }}>{data.count}</span>
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 700, color: "#64748b",
                  fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase",
                  letterSpacing: "0.06em", whiteSpace: "nowrap",
                  background: "rgba(255,255,255,0.9)", padding: "1px 5px", borderRadius: 4,
                }}>{region}</span>
              </div>
            );
          })}
        </div>

        {/* Signal legend */}
        <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap", justifyContent: "center" }}>
          {Object.entries(AI_SIGNAL_CONFIG).map(([signal, cfg]) => (
            <div key={signal} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color }} />
              <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>{signal}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MarketIntelligenceView({ deals, isMobile, session, teamEmails: teamEmailsProp }) {
  const [markets, setMarkets] = useState([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [sortField, setSortField] = useState("aiSignalRank");
  const [sortDir, setSortDir] = useState("asc");
  const [signalFilter, setSignalFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const num = (v) => {
    if (!v && v !== 0) return NaN;
    const n = parseFloat(String(v).replace(/[$,%x]/g, "").trim());
    return isNaN(n) ? NaN : n;
  };

  // Fetch Markets from Supabase
  useEffect(() => {
    async function fetchMarkets() {
      setMarketsLoading(true);
      try {
        const { data: rows, error: fetchErr } = await supabase.from("markets").select("*");
        if (fetchErr) throw new Error(fetchErr.message);
        if (!rows || rows.length === 0) { computeFromDeals(); return; }
        const parsed = rows.map(r => ({
          market: r.market_name || "",
          medianPPU: r.median_price_per_unit != null ? String(r.median_price_per_unit) : "",
          capRateAvg: r.cap_rate_avg != null ? String(r.cap_rate_avg) : "",
          rentGrowth: r.rent_growth_yoy != null ? String(r.rent_growth_yoy) : "",
          popGrowth: r.population_growth != null ? String(r.population_growth) : "",
          aiSignal: r.ai_signal || "Neutral",
          region: r.region || "Other",
          dealCount: r.deal_count != null ? String(r.deal_count) : "",
          avgReapScore: r.avg_reap_score != null ? String(r.avg_reap_score) : "",
          totalVolume: r.total_volume != null ? String(r.total_volume) : "",
        }));
        setMarkets(parsed);
      } catch (err) {
        console.warn("Markets fetch failed, computing from deals:", err);
        computeFromDeals();
      }
      setMarketsLoading(false);
    }

    function computeFromDeals() {
      // Aggregate deal data by city+state as fallback
      const marketMap = {};
      const emailsToShow = teamEmailsProp && teamEmailsProp.length > 0 ? teamEmailsProp : [session?.user?.email?.toLowerCase() || ""];
      const userDeals = deals.filter(d => emailsToShow.includes((d.user || "").toLowerCase()));
      
      userDeals.forEach(d => {
        const city = (d.city || "").trim();
        const state = (d.state || "").trim();
        if (!city) return;
        const key = city + ", " + state;
        if (!marketMap[key]) marketMap[key] = { deals: [], city, state };
        marketMap[key].deals.push(d);
      });

      const stateRegions = {
        "FL": "Southeast", "GA": "Southeast", "AL": "Southeast", "SC": "Southeast",
        "NC": "Southeast", "TN": "Southeast", "MS": "Southeast", "LA": "Southeast",
        "AR": "Southeast", "VA": "Southeast", "KY": "Southeast",
        "NY": "Northeast", "NJ": "Northeast", "CT": "Northeast", "MA": "Northeast",
        "PA": "Northeast", "NH": "Northeast", "VT": "Northeast", "ME": "Northeast", "RI": "Northeast",
        "OH": "Midwest", "MI": "Midwest", "IN": "Midwest", "IL": "Midwest",
        "WI": "Midwest", "MN": "Midwest", "IA": "Midwest", "MO": "Midwest",
        "ND": "Midwest", "SD": "Midwest", "NE": "Midwest", "KS": "Midwest",
        "TX": "Southwest", "AZ": "Southwest", "NM": "Southwest", "OK": "Southwest",
        "CA": "Pacific", "OR": "Pacific", "WA": "Pacific", "HI": "Pacific",
        "CO": "Mountain", "UT": "Mountain", "NV": "Mountain", "ID": "Mountain",
        "MT": "Mountain", "WY": "Mountain",
        "MD": "Mid-Atlantic", "DE": "Mid-Atlantic", "DC": "Mid-Atlantic", "WV": "Mid-Atlantic",
        "AK": "Pacific",
      };

      const computed = Object.entries(marketMap).map(([key, data]) => {
        const ds = data.deals;
        const units = ds.map(d => num(d.units)).filter(n => !isNaN(n));
        const offers = ds.map(d => num(d.offer)).filter(n => !isNaN(n));
        const caps = ds.map(d => num(d.capRate)).filter(n => !isNaN(n));
        const scores = ds.map(d => num(d.reapScore)).filter(n => !isNaN(n));
        const totalUnits = units.reduce((a, b) => a + b, 0);
        const totalOffer = offers.reduce((a, b) => a + b, 0);
        const avgCap = caps.length ? (caps.reduce((a, b) => a + b, 0) / caps.length) : NaN;
        const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : NaN;
        const medianPPU = totalUnits > 0 ? totalOffer / totalUnits : NaN;

        // AI signal heuristic from deal metrics
        let signal = "Neutral";
        if (!isNaN(avgScore)) {
          if (avgScore >= 75 && !isNaN(avgCap) && avgCap >= 7) signal = "Hot";
          else if (avgScore >= 60) signal = "Warm";
          else if (avgScore < 40) signal = "Cooling";
        }

        const region = stateRegions[data.state] || "Other";

        return {
          market: key,
          medianPPU: isNaN(medianPPU) ? "" : "$" + Math.round(medianPPU).toLocaleString(),
          capRateAvg: isNaN(avgCap) ? "" : avgCap.toFixed(1) + "%",
          rentGrowth: "",
          popGrowth: "",
          aiSignal: signal,
          region: region,
          dealCount: String(ds.length),
          avgReapScore: isNaN(avgScore) ? "" : Math.round(avgScore).toString(),
          totalVolume: totalOffer > 0 ? "$" + Math.round(totalOffer).toLocaleString() : "",
        };
      });

      // Sort by deal count desc
      computed.sort((a, b) => num(b.dealCount) - num(a.dealCount));
      setMarkets(computed);
    }

    fetchMarkets();
  }, [deals, session]);

  // Signal rank for sorting
  const signalRank = { "Hot": 1, "Warm": 2, "Neutral": 3, "Cooling": 4 };

  // Filtering
  const signalFilters = ["All", "Hot", "Warm", "Neutral", "Cooling"];
  const filtered = markets.filter(m => {
    if (signalFilter !== "All" && m.aiSignal !== signalFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!m.market.toLowerCase().includes(term) && !(m.region || "").toLowerCase().includes(term)) return false;
    }
    return true;
  });

  // Sorting
  const sorted = [...filtered].sort((a, b) => {
    let va, vb;
    if (sortField === "aiSignalRank") {
      va = signalRank[a.aiSignal] || 99;
      vb = signalRank[b.aiSignal] || 99;
    } else if (sortField === "market") {
      return sortDir === "asc" ? a.market.localeCompare(b.market) : b.market.localeCompare(a.market);
    } else {
      va = num(a[sortField]);
      vb = num(b[sortField]);
    }
    if (isNaN(va) && isNaN(vb)) return 0;
    if (isNaN(va)) return 1;
    if (isNaN(vb)) return -1;
    return sortDir === "asc" ? va - vb : vb - va;
  });

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortField(field); setSortDir(field === "market" ? "asc" : "desc"); }
  };

  // Top-line aggregated stats
  const hotCount = markets.filter(m => m.aiSignal === "Hot").length;
  const warmCount = markets.filter(m => m.aiSignal === "Warm").length;
  const totalDealCount = markets.reduce((s, m) => s + (num(m.dealCount) || 0), 0);
  const allCaps = markets.map(m => num(m.capRateAvg)).filter(n => !isNaN(n));
  const avgCapAll = allCaps.length ? (allCaps.reduce((a, b) => a + b, 0) / allCaps.length).toFixed(1) + "%" : "—";
  const totalVol = markets.reduce((s, m) => {
    const n = num(m.totalVolume); return s + (isNaN(n) ? 0 : n);
  }, 0);
  const fmtVol = totalVol >= 1000000 ? "$" + (totalVol / 1000000).toFixed(1) + "M" : totalVol >= 1000 ? "$" + (totalVol / 1000).toFixed(0) + "K" : "$" + totalVol;

  const SortArrow = ({ field }) => {
    if (sortField !== field) return <span style={{ color: "#cbd5e1", marginLeft: 3 }}>↕</span>;
    return <span style={{ color: "#16a34a", marginLeft: 3 }}>{sortDir === "desc" ? "↓" : "↑"}</span>;
  };

  const pctColor = (v) => {
    const n = num(v);
    if (isNaN(n)) return "#94a3b8";
    if (n > 3) return "#16a34a";
    if (n > 0) return "#d97706";
    return "#dc2626";
  };

  if (marketsLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 12 }}>
      <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTop: "3px solid #16a34a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ fontSize: 13, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>Loading market intelligence…</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: "#f8fafc", fontFamily: "'DM Sans', sans-serif" }}>

      {/* Uniform Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: isMobile ? "14px 16px" : "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.02em" }}>Market Intelligence</h1>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", padding: "3px 8px", borderRadius: 6, fontFamily: "'DM Mono', monospace", letterSpacing: "0.05em", border: "1px solid #bbf7d0" }}>BETA</span>
          </div>
          <p style={{ fontSize: isMobile ? 11 : 12, color: "#94a3b8", margin: "3px 0 0", fontFamily: "'DM Sans', sans-serif" }}>Trending markets · AI signal rankings</p>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 12px" : "24px 32px" }}>

      {/* Top Stats */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <MarketStatCard label="Markets Tracked" value={markets.length} sub={hotCount + " hot · " + warmCount + " warm"} accent="#16a34a" icon="📊" />
        <MarketStatCard label="Avg Cap Rate" value={avgCapAll} sub="across all markets" accent="#3b82f6" icon="📈" />
        <MarketStatCard label="Deal Volume" value={fmtVol} sub={totalDealCount + " total deals"} accent="#7c3aed" icon="💰" />
        {!isMobile && <MarketStatCard label="Hot Markets" value={hotCount} sub={warmCount + " warming up"} accent="#dc2626" icon="🔥" />}
      </div>

      {/* Heat Map */}
      <HeatMapPlaceholder markets={markets} isMobile={isMobile} />

      {/* Trending Markets Table */}
      <div style={{
        background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0",
        overflow: "hidden",
      }}>
        {/* Table Header Bar */}
        <div style={{
          padding: isMobile ? "14px 16px" : "18px 24px",
          borderBottom: "1px solid #e2e8f0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 10,
        }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0 }}>Trending Markets</h3>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 0", fontFamily: "'DM Sans', sans-serif" }}>{filtered.length} market{filtered.length !== 1 ? "s" : ""}</p>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {/* Signal Filters */}
            {signalFilters.map(sf => (
              <button key={sf} onClick={() => setSignalFilter(sf)} style={{
                padding: "5px 12px", borderRadius: 20, border: "1px solid " + (signalFilter === sf ? "#16a34a" : "#e2e8f0"),
                background: signalFilter === sf ? "#f0fdf4" : "#fff",
                color: signalFilter === sf ? "#16a34a" : "#64748b",
                fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                cursor: "pointer", transition: "all 0.15s",
              }}>{sf === "All" ? "All" : (AI_SIGNAL_CONFIG[sf]?.icon || "") + " " + sf}</button>
            ))}
            {/* Search */}
            <div style={{ position: "relative" }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search markets…" style={{
                background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
                padding: "7px 12px 7px 30px", color: "#0f172a", fontSize: 12,
                fontFamily: "'DM Sans', sans-serif", outline: "none", width: isMobile ? 140 : 180,
              }} />
            </div>
          </div>
        </div>

        {/* Table */}
        {isMobile ? (
          /* Mobile: Cards */
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {sorted.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px" }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#64748b", margin: 0 }}>No markets found</p>
                <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0" }}>No markets data found</p>
              </div>
            ) : sorted.map((m, i) => (
              <div key={i} style={{
                background: "#f8fafc", borderRadius: 12, padding: "14px 16px",
                border: "1px solid #e2e8f0",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>{m.market}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", marginTop: 1 }}>{m.region} · {m.dealCount || 0} deals</div>
                  </div>
                  <MarketSignalBadge signal={m.aiSignal} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>$/Unit</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Mono', monospace" }}>{m.medianPPU || "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Cap Rate</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Mono', monospace" }}>{m.capRateAvg || "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Rent Growth</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: pctColor(m.rentGrowth), fontFamily: "'DM Mono', monospace" }}>{m.rentGrowth || "—"}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Desktop: Table */
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Sans', sans-serif" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  {[
                    { label: "Market", field: "market", width: "20%" },
                    { label: "Region", field: "region", width: "12%" },
                    { label: "Median $/Unit", field: "medianPPU", width: "13%" },
                    { label: "Cap Rate Avg", field: "capRateAvg", width: "11%" },
                    { label: "Rent Growth YoY", field: "rentGrowth", width: "12%" },
                    { label: "Pop Growth", field: "popGrowth", width: "10%" },
                    { label: "AI Signal", field: "aiSignalRank", width: "12%" },
                    { label: "Deals", field: "dealCount", width: "8%" },
                  ].map(col => (
                    <th key={col.field} onClick={() => handleSort(col.field)} style={{
                      padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700,
                      color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase",
                      fontFamily: "'DM Sans', sans-serif", cursor: "pointer", userSelect: "none",
                      width: col.width, whiteSpace: "nowrap",
                    }}>
                      {col.label}<SortArrow field={col.field} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: "40px 16px", color: "#94a3b8", fontSize: 14 }}>
                    No markets found. Add market data in Supabase, or add deals with city data.
                  </td></tr>
                ) : sorted.map((m, i) => (
                  <tr key={i} style={{
                    borderBottom: "1px solid #f1f5f9",
                    transition: "background 0.15s",
                    cursor: "default",
                  }} onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                     onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{m.market}</div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontSize: 12, color: "#64748b", background: "#f1f5f9", padding: "3px 8px", borderRadius: 6 }}>{m.region}</span>
                    </td>
                    <td style={{ padding: "14px 16px", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{m.medianPPU || "—"}</td>
                    <td style={{ padding: "14px 16px", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{m.capRateAvg || "—"}</td>
                    <td style={{ padding: "14px 16px" }}>
                      {m.rentGrowth ? (
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: pctColor(m.rentGrowth) }}>
                          {num(m.rentGrowth) > 0 ? "+" : ""}{m.rentGrowth}
                        </span>
                      ) : <span style={{ color: "#cbd5e1" }}>—</span>}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      {m.popGrowth ? (
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: pctColor(m.popGrowth) }}>
                          {num(m.popGrowth) > 0 ? "+" : ""}{m.popGrowth}
                        </span>
                      ) : <span style={{ color: "#cbd5e1" }}>—</span>}
                    </td>
                    <td style={{ padding: "14px 16px" }}><MarketSignalBadge signal={m.aiSignal} /></td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{
                        fontSize: 13, fontWeight: 700, color: "#0f172a",
                        fontFamily: "'DM Mono', monospace",
                        background: "#f0fdf4", padding: "3px 8px", borderRadius: 6,
                        border: "1px solid #bbf7d0",
                      }}>{m.dealCount || 0}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div style={{ textAlign: "center", padding: "16px 0 8px", fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>
        Data sourced from your deal pipeline + Markets tab · AI signals update when data changes
      </div>
      </div>
    </div>
  );
}

function ProfileView({ session, isMobile, isSubscribed, trialDaysLeft, onCheckout, onSignOut, onClose, orgData, orgMembers, inviteEmail, setInviteEmail, inviteSaving, inviteSuccess, onInviteMember, onRemoveMember, features, featureFlags, onToggleFeature, isAdmin }) {
  const [activeTab, setActiveTab] = useState("profile");
  const user = session?.user || {};
  const email = user.email || "—";
  const fullName = user.user_metadata?.full_name || "";
  const displayName = fullName || fmtUserName(email);
  const initials = displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const createdAt = user.created_at ? fmtDate(user.created_at) : "—";
  const provider = user.app_metadata?.provider || "email";
  const isOwner = orgData && orgData.owner_email === email;

  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "team", label: "Team" },
    { id: "permissions", label: "Permissions" },
    { id: "pricing", label: "Pricing" },
    ...(isAdmin ? [{ id: "admin", label: "Admin" }] : []),
  ];

  const TIER_LABELS = { free: "Free", starter: "Starter", team: "Team", pro: "Pro", enterprise: "Enterprise" };
  const TIER_PRICES = { free: "$0/mo", starter: "$99/mo", team: "$499/mo", pro: "$249/mo", enterprise: "Custom" };
  const TIER_DESC = {
    free: "View-only access, up to 5 deals",
    starter: "Individual plan with core features",
    team: "Shared pipeline, contacts & portfolios for your whole team",
    pro: "Advanced AI features and document generation",
    enterprise: "Custom integrations, SSO, dedicated support",
  };

  const tabStyle = (id) => ({
    padding: isMobile ? "10px 14px" : "10px 20px",
    fontSize: 13, fontWeight: activeTab === id ? 600 : 500, cursor: "pointer",
    color: activeTab === id ? "#16a34a" : "#64748b",
    borderBottom: activeTab === id ? "2px solid #16a34a" : "2px solid transparent",
    fontFamily: "'DM Sans', sans-serif", background: "none", border: "none",
    borderBottomWidth: 2, borderBottomStyle: "solid",
    borderBottomColor: activeTab === id ? "#16a34a" : "transparent",
    transition: "all 0.15s", whiteSpace: "nowrap",
  });

  const cardStyle = { background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: isMobile ? "16px 20px" : "20px 28px", marginBottom: 20 };
  const sectionLabel = { fontSize: 11, fontWeight: 700, color: "#94a3b8", fontFamily: "'DM Mono', monospace", letterSpacing: "0.06em", marginBottom: 12, textTransform: "uppercase" };
  const rowStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #f1f5f9" };

  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: isMobile ? "14px 16px 0" : "18px 32px 0" }}>
        <div style={{ marginBottom: 14 }}>
          <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.02em" }}>Settings</h1>
          <p style={{ fontSize: isMobile ? 11 : 12, color: "#94a3b8", margin: "3px 0 0", fontFamily: "'DM Sans', sans-serif" }}>
            {orgData ? orgData.name + " — " + (TIER_LABELS[orgData.plan_tier] || "Team") + " Plan" : "Account & preferences"}
          </p>
        </div>
        {/* Tab bar */}
        <div style={{ display: "flex", gap: 0, overflowX: "auto", borderBottom: "none" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={tabStyle(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: isMobile ? "20px 16px" : "28px 32px", maxWidth: 700 }}>

        {/* ═══ PROFILE TAB ═══ */}
        {activeTab === "profile" && (
          <>
            {/* Profile card */}
            <div style={{ ...cardStyle, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(135deg, #16a34a, #15803d)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #16a34a, #15803d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 12px rgba(22,163,74,0.3)", flexShrink: 0 }}>{initials}</div>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0 }}>{displayName}</h2>
                  <p style={{ fontSize: 13, color: "#64748b", fontFamily: "'DM Sans', sans-serif", margin: "2px 0 0" }}>{email}</p>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", fontFamily: "'DM Mono', monospace", padding: "3px 8px", borderRadius: 6, background: isSubscribed ? "#f0fdf4" : trialDaysLeft > 3 ? "#f0fdf4" : "#fef2f2", color: isSubscribed ? "#16a34a" : trialDaysLeft > 3 ? "#16a34a" : "#dc2626", border: "1px solid " + (isSubscribed || trialDaysLeft > 3 ? "#bbf7d0" : "#fca5a5") }}>{isSubscribed ? "SUBSCRIBED" : trialDaysLeft > 0 ? trialDaysLeft + " DAYS LEFT" : "TRIAL EXPIRED"}</span>
                    {orgData && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", fontFamily: "'DM Mono', monospace", padding: "3px 8px", borderRadius: 6, background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe" }}>{isOwner ? "OWNER" : "MEMBER"}</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Account details */}
            <div style={cardStyle}>
              <div style={sectionLabel}>Account</div>
              <div style={rowStyle}><span style={{ fontSize: 13, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>Email</span><span style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>{email}</span></div>
              <div style={rowStyle}><span style={{ fontSize: 13, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>Sign-in</span><span style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>{provider === "google" ? "Google OAuth" : "Email & Password"}</span></div>
              <div style={rowStyle}><span style={{ fontSize: 13, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>Member since</span><span style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>{createdAt}</span></div>
              <div style={{ ...rowStyle, borderBottom: "none" }}><span style={{ fontSize: 13, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>Subscription</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>{isSubscribed ? "REAP Starter — $99/mo" : trialDaysLeft > 0 ? trialDaysLeft + " days left" : "Expired"}</span>
                  {!isSubscribed && <button onClick={onCheckout} style={{ padding: "5px 12px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Upgrade</button>}
                </div>
              </div>
            </div>

            {/* Sign Out */}
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div><div style={{ fontSize: 13, fontWeight: 600, color: "#dc2626", fontFamily: "'DM Sans', sans-serif" }}>Sign Out</div><div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>End your current session</div></div>
                <button onClick={onSignOut} style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, color: "#dc2626", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Sign Out</button>
              </div>
            </div>
          </>
        )}

        {/* ═══ TEAM TAB ═══ */}
        {activeTab === "team" && (
          <>
            {/* Org header card */}
            <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 14, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: orgData ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "#e2e8f0" }} />
              <div style={{ width: 48, height: 48, borderRadius: 14, background: orgData ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>{orgData ? orgData.name.charAt(0) : "?"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>{orgData ? orgData.name : "No Organization"}</div>
                <div style={{ fontSize: 12, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>{orgData ? (orgMembers.filter(m => m.status === "active").length) + " active members · " + (TIER_LABELS[orgData.plan_tier] || "Team") + " Plan" : "You’re on an individual plan"}</div>
              </div>
              {isOwner && <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono', monospace", padding: "3px 10px", borderRadius: 6, background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe" }}>OWNER</span>}
            </div>

            {/* Members list */}
            {orgData && (
              <div style={cardStyle}>
                <div style={sectionLabel}>Members ({orgMembers.length})</div>
                {orgMembers.map((m, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: i < orgMembers.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: m.status === "active" ? "linear-gradient(135deg, #16a34a, #15803d)" : m.status === "invited" ? "linear-gradient(135deg, #d97706, #b45309)" : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
                        {(m.user_email || "").split("@")[0].split(/[._-]/).map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmtUserName(m.user_email)}</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.user_email}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono', monospace", padding: "2px 8px", borderRadius: 5, background: m.role === "owner" ? "#f5f3ff" : "#f8fafc", color: m.role === "owner" ? "#7c3aed" : "#64748b", border: "1px solid " + (m.role === "owner" ? "#ddd6fe" : "#e2e8f0"), textTransform: "uppercase" }}>{m.role}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono', monospace", padding: "2px 8px", borderRadius: 5, background: m.status === "active" ? "#f0fdf4" : m.status === "invited" ? "#fffbeb" : "#f8fafc", color: m.status === "active" ? "#16a34a" : m.status === "invited" ? "#d97706" : "#94a3b8", border: "1px solid " + (m.status === "active" ? "#bbf7d0" : m.status === "invited" ? "#fde68a" : "#e2e8f0"), textTransform: "uppercase" }}>{m.status}</span>
                      </div>
                    </div>
                    {isOwner && m.role !== "owner" && (
                      <button onClick={() => onRemoveMember(m.user_email)} style={{ marginLeft: 10, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 600, color: "#dc2626", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Remove</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Invite */}
            {isOwner && (
              <div style={cardStyle}>
                <div style={sectionLabel}>Invite member</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="teammate@company.com" onKeyDown={e => e.key === "Enter" && onInviteMember()} style={{ flex: 1, padding: "11px 14px", fontSize: 14, fontFamily: "'DM Sans', sans-serif", border: "1.5px solid #e2e8f0", borderRadius: 10, outline: "none", color: "#0f172a" }} />
                  <button onClick={onInviteMember} disabled={inviteSaving || !inviteEmail} style={{ padding: "11px 22px", background: inviteSaving ? "#94a3b8" : "#16a34a", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: inviteSaving || !inviteEmail ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", opacity: !inviteEmail ? 0.5 : 1, whiteSpace: "nowrap" }}>{inviteSaving ? "Sending..." : "Send Invite"}</button>
                </div>
                {inviteSuccess && <div style={{ marginTop: 8, fontSize: 12, color: inviteSuccess.startsWith("Error") ? "#dc2626" : "#16a34a", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{inviteSuccess}</div>}
                <div style={{ marginTop: 12, fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>They’ll see an invite banner when they log in. Once accepted, they’ll have access to all shared team data.</div>
              </div>
            )}

            {!orgData && (
              <div style={cardStyle}>
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>No team yet</div>
                  <div style={{ fontSize: 13, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>You’re on an individual plan. Team features will be available when you upgrade to the Team tier.</div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ PERMISSIONS TAB ═══ */}
        {activeTab === "permissions" && (
          <>
            <div style={cardStyle}>
              <div style={sectionLabel}>Feature access</div>
              <div style={{ fontSize: 13, color: "#64748b", fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>
                {isOwner ? "Toggle which features are enabled for your organization. Changes apply to all team members." : "Features available on your current plan."}
              </div>
              {(featureFlags || []).map((f, i) => {
                const enabled = features[f.feature_key] !== false;
                return (
                  <div key={f.feature_key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: i < (featureFlags || []).length - 1 ? "1px solid #f1f5f9" : "none" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>{f.display_name}</div>
                        <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "'DM Mono', monospace", padding: "1px 6px", borderRadius: 4, background: f.min_tier === "starter" ? "#f0fdf4" : f.min_tier === "team" ? "#f5f3ff" : "#fffbeb", color: f.min_tier === "starter" ? "#16a34a" : f.min_tier === "team" ? "#7c3aed" : "#d97706", border: "1px solid " + (f.min_tier === "starter" ? "#bbf7d0" : f.min_tier === "team" ? "#ddd6fe" : "#fde68a"), textTransform: "uppercase" }}>{f.min_tier}+</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>{f.description}</div>
                    </div>
                    {isOwner ? (
                      <div onClick={() => onToggleFeature(f.feature_key, enabled)} style={{ width: 44, height: 24, borderRadius: 12, background: enabled ? "#16a34a" : "#d1d5db", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0, marginLeft: 16 }}>
                        <div style={{ width: 20, height: 20, borderRadius: 10, background: "#fff", position: "absolute", top: 2, left: enabled ? 22 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "'DM Mono', monospace", color: enabled ? "#16a34a" : "#dc2626", flexShrink: 0, marginLeft: 16 }}>{enabled ? "✓ ON" : "✗ OFF"}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ═══ PRICING TAB ═══ */}
        {activeTab === "pricing" && (
          <>
            <div style={{ fontSize: 13, color: "#64748b", fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>
              Compare plans and see which features are included at each tier.
            </div>
            {["free", "starter", "team", "pro", "enterprise"].map(tier => {
              const isCurrentTier = orgData ? orgData.plan_tier === tier : (isSubscribed ? "starter" === tier : "free" === tier);
              const tierFeatures = (featureFlags || []).filter(f => getTierRank(tier) >= getTierRank(f.min_tier));
              return (
                <div key={tier} style={{ ...cardStyle, border: isCurrentTier ? "2px solid #16a34a" : "1px solid #e2e8f0", position: "relative", overflow: "hidden" }}>
                  {isCurrentTier && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(135deg, #16a34a, #15803d)" }} />}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>{TIER_LABELS[tier]}</span>
                        {isCurrentTier && <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "'DM Mono', monospace", padding: "2px 8px", borderRadius: 5, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>CURRENT</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>{TIER_DESC[tier]}</div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{TIER_PRICES[tier]}</div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    {tierFeatures.map(f => (
                      <span key={f.feature_key} style={{ fontSize: 11, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", padding: "3px 10px", borderRadius: 6, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>✓ {f.display_name}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ═══ ADMIN TAB ═══ */}
        {activeTab === "admin" && isAdmin && (
          <AdminView session={session} isMobile={isMobile} />
        )}

      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ADMIN VIEW — Platform owner only (rendered inside Settings)
   ═══════════════════════════════════════════════════════════ */

function AdminView({ session, isMobile }) {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [editingOrg, setEditingOrg] = useState(null);
  const [viewedOrgMembers, setViewedOrgMembers] = useState([]);
  const [addToOrgModal, setAddToOrgModal] = useState(null);
  const [addEmail, setAddEmail] = useState("");
  const [newOrgModal, setNewOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgOwner, setNewOrgOwner] = useState("");
  const [newOrgTier, setNewOrgTier] = useState("team");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchUsers = async () => {
    const { data, error } = await supabase.rpc("admin_get_all_users");
    if (error) { console.error("Admin users error:", error); setMsg("Error: " + error.message); }
    else setUsers(data || []);
  };
  const fetchOrgs = async () => {
    const { data, error } = await supabase.rpc("admin_get_all_orgs");
    if (error) { console.error("Admin orgs error:", error); setMsg("Error: " + error.message); }
    else setOrgs(data || []);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchUsers(), fetchOrgs()]).finally(() => setLoading(false));
  }, []);

  const handleSaveUser = async () => {
    if (!editingUser) return;
    setSaving(true); setMsg("");
    try {
      const { error } = await supabase.rpc("admin_update_user", {
        target_user_id: editingUser.id,
        new_plan_tier: editingUser.plan_tier,
        new_is_subscribed: editingUser.is_subscribed,
        new_full_name: editingUser.full_name,
        new_org_id: editingUser.org_id || null,
      });
      if (error) throw error;
      setMsg("User updated!");
      setEditingUser(null);
      fetchUsers();
    } catch (err) { setMsg("Error: " + err.message); }
    finally { setSaving(false); }
  };

  const handleSaveOrg = async () => {
    if (!editingOrg) return;
    setSaving(true); setMsg("");
    try {
      const { error } = await supabase.rpc("admin_update_org", {
        target_org_id: editingOrg.id,
        new_name: editingOrg.name,
        new_plan_tier: editingOrg.plan_tier,
        new_owner_email: editingOrg.owner_email,
      });
      if (error) throw error;
      setMsg("Organization updated!");
      setEditingOrg(null);
      fetchOrgs();
    } catch (err) { setMsg("Error: " + err.message); }
    finally { setSaving(false); }
  };

  const handleViewMembers = async (orgId) => {
    const { data } = await supabase.rpc("admin_get_org_members", { target_org_id: orgId });
    setViewedOrgMembers(data || []);
  };

  const handleAddToOrg = async () => {
    if (!addToOrgModal || !addEmail) return;
    setSaving(true); setMsg("");
    try {
      const { error } = await supabase.rpc("admin_add_user_to_org", {
        target_org_id: addToOrgModal,
        target_email: addEmail.toLowerCase().trim(),
      });
      if (error) throw error;
      setMsg("User added to org!");
      setAddEmail("");
      setAddToOrgModal(null);
      fetchOrgs(); fetchUsers();
    } catch (err) { setMsg("Error: " + err.message); }
    finally { setSaving(false); }
  };

  const handleCreateOrg = async () => {
    if (!newOrgName || !newOrgOwner) return;
    setSaving(true); setMsg("");
    try {
      const { error } = await supabase.rpc("admin_create_org", {
        org_name: newOrgName,
        org_owner_email: newOrgOwner.toLowerCase().trim(),
        org_plan_tier: newOrgTier,
      });
      if (error) throw error;
      setMsg("Organization created!");
      setNewOrgModal(false); setNewOrgName(""); setNewOrgOwner(""); setNewOrgTier("team");
      fetchOrgs();
    } catch (err) { setMsg("Error: " + err.message); }
    finally { setSaving(false); }
  };

  const cardS = { background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: isMobile ? "16px" : "20px 24px", marginBottom: 16 };
  const inpS = { width: "100%", padding: "9px 12px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", border: "1.5px solid #e2e8f0", borderRadius: 8, outline: "none", color: "#0f172a", boxSizing: "border-box" };
  const selS = { ...inpS, background: "#fff", cursor: "pointer" };
  const btnP = { padding: "8px 18px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" };
  const btnS = { padding: "8px 18px", background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" };
  const bdg = (text, color, bg, bc) => <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono', monospace", padding: "2px 7px", borderRadius: 5, background: bg, color, border: "1px solid " + bc, textTransform: "uppercase" }}>{text}</span>;

  const tStyle = (id) => ({
    padding: isMobile ? "10px 14px" : "10px 20px", fontSize: 13, fontWeight: tab === id ? 600 : 500, cursor: "pointer",
    color: tab === id ? "#dc2626" : "#64748b", background: "none", border: "none",
    borderBottom: tab === id ? "2px solid #dc2626" : "2px solid transparent",
    fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s", whiteSpace: "nowrap",
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: isMobile ? "14px 16px 0" : "18px 32px 0" }}>
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #dc2626, #b91c1c)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div>
            <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0 }}>Platform Admin</h1>
            <p style={{ fontSize: 11, color: "#dc2626", margin: "2px 0 0", fontFamily: "'DM Mono', monospace", fontWeight: 600, letterSpacing: "0.04em" }}>OWNER ACCESS ONLY</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 0 }}>
          <button onClick={() => setTab("users")} style={tStyle("users")}>Users ({users.length})</button>
          <button onClick={() => setTab("orgs")} style={tStyle("orgs")}>Organizations ({orgs.length})</button>
        </div>
      </div>

      <div style={{ padding: isMobile ? "16px" : "24px 32px", maxWidth: 900 }}>
        {msg && <div style={{ padding: "10px 16px", borderRadius: 10, marginBottom: 16, fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, background: msg.startsWith("Error") ? "#fef2f2" : "#f0fdf4", color: msg.startsWith("Error") ? "#dc2626" : "#16a34a", border: "1px solid " + (msg.startsWith("Error") ? "#fca5a5" : "#bbf7d0") }}>{msg}</div>}

        {tab === "users" && (
          <>
            <div style={{ fontSize: 12, color: "#64748b", fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>All registered users across the platform. Click a row to edit.</div>
            {users.map((u) => (
              <div key={u.id} onClick={() => setEditingUser({ ...u })} style={{ ...cardS, cursor: "pointer", transition: "all 0.15s", border: editingUser?.id === u.id ? "2px solid #dc2626" : "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: u.is_subscribed ? "linear-gradient(135deg, #16a34a, #15803d)" : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: u.is_subscribed ? "#fff" : "#94a3b8", fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>{(u.full_name || u.email || "?").split(/[\s@._-]/).map(w => w[0]).join("").toUpperCase().slice(0, 2)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>{u.full_name || fmtUserName(u.email)}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {bdg(u.plan_tier || "starter", u.plan_tier === "team" ? "#7c3aed" : "#64748b", u.plan_tier === "team" ? "#f5f3ff" : "#f8fafc", u.plan_tier === "team" ? "#ddd6fe" : "#e2e8f0")}
                    {u.is_subscribed ? bdg("subscribed", "#16a34a", "#f0fdf4", "#bbf7d0") : bdg("no sub", "#94a3b8", "#f8fafc", "#e2e8f0")}
                    {u.org_name && bdg(u.org_name, "#0891b2", "#ecfeff", "#a5f3fc")}
                  </div>
                </div>
              </div>
            ))}

            {editingUser && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={() => setEditingUser(null)}>
                <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, padding: 28, maxWidth: 480, width: "100%", maxHeight: "80vh", overflow: "auto" }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: "0 0 4px" }}>Edit User</h3>
                  <p style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", marginBottom: 20 }}>{editingUser.email}</p>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", fontFamily: "'DM Sans', sans-serif", display: "block", marginBottom: 4 }}>Full Name</label>
                    <input value={editingUser.full_name || ""} onChange={e => setEditingUser({ ...editingUser, full_name: e.target.value })} style={inpS} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", fontFamily: "'DM Sans', sans-serif", display: "block", marginBottom: 4 }}>Plan Tier</label>
                      <select value={editingUser.plan_tier || "starter"} onChange={e => setEditingUser({ ...editingUser, plan_tier: e.target.value })} style={selS}>
                        <option value="free">Free</option><option value="starter">Starter</option><option value="team">Team</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", fontFamily: "'DM Sans', sans-serif", display: "block", marginBottom: 4 }}>Subscribed</label>
                      <select value={editingUser.is_subscribed ? "yes" : "no"} onChange={e => setEditingUser({ ...editingUser, is_subscribed: e.target.value === "yes" })} style={selS}>
                        <option value="yes">Yes</option><option value="no">No</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", fontFamily: "'DM Sans', sans-serif", display: "block", marginBottom: 4 }}>Organization</label>
                    <select value={editingUser.org_id || ""} onChange={e => setEditingUser({ ...editingUser, org_id: e.target.value || null })} style={selS}>
                      <option value="">None (Solo User)</option>
                      {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
                    <button onClick={() => setEditingUser(null)} style={btnS}>Cancel</button>
                    <button onClick={handleSaveUser} disabled={saving} style={{ ...btnP, opacity: saving ? 0.6 : 1 }}>{saving ? "Saving..." : "Save Changes"}</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "orgs" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>All organizations on the platform.</div>
              <button onClick={() => setNewOrgModal(true)} style={btnP}>+ New Org</button>
            </div>
            {orgs.map((o) => (
              <div key={o.id} style={cardS}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: editingOrg?.id === o.id ? 14 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #7c3aed, #6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>{o.name.charAt(0)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>{o.name}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>Owner: {o.owner_email} · {o.member_count} member{Number(o.member_count) !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {bdg(o.plan_tier || "team", "#7c3aed", "#f5f3ff", "#ddd6fe")}
                    <button onClick={() => { setEditingOrg({ ...o }); handleViewMembers(o.id); }} style={btnS}>Edit</button>
                    <button onClick={() => setAddToOrgModal(o.id)} style={btnS}>+ Member</button>
                  </div>
                </div>

                {editingOrg?.id === o.id && (
                  <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 14, marginTop: 8 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", fontFamily: "'DM Sans', sans-serif", display: "block", marginBottom: 4 }}>Name</label>
                        <input value={editingOrg.name} onChange={e => setEditingOrg({ ...editingOrg, name: e.target.value })} style={inpS} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", fontFamily: "'DM Sans', sans-serif", display: "block", marginBottom: 4 }}>Plan</label>
                        <select value={editingOrg.plan_tier || "team"} onChange={e => setEditingOrg({ ...editingOrg, plan_tier: e.target.value })} style={selS}>
                          <option value="free">Free</option><option value="starter">Starter</option><option value="team">Team</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", fontFamily: "'DM Sans', sans-serif", display: "block", marginBottom: 4 }}>Owner Email</label>
                      <input value={editingOrg.owner_email} onChange={e => setEditingOrg({ ...editingOrg, owner_email: e.target.value })} style={inpS} />
                    </div>
                    {viewedOrgMembers.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>MEMBERS</div>
                        {viewedOrgMembers.map((m, mi) => (
                          <div key={mi} style={{ fontSize: 12, color: "#475569", fontFamily: "'DM Sans', sans-serif", padding: "4px 0", display: "flex", gap: 8, alignItems: "center" }}>
                            <span>{m.user_email}</span>
                            {bdg(m.role, m.role === "owner" ? "#7c3aed" : "#64748b", m.role === "owner" ? "#f5f3ff" : "#f8fafc", m.role === "owner" ? "#ddd6fe" : "#e2e8f0")}
                            {bdg(m.status, m.status === "active" ? "#16a34a" : "#d97706", m.status === "active" ? "#f0fdf4" : "#fffbeb", m.status === "active" ? "#bbf7d0" : "#fde68a")}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button onClick={() => { setEditingOrg(null); setViewedOrgMembers([]); }} style={btnS}>Cancel</button>
                      <button onClick={handleSaveOrg} disabled={saving} style={{ ...btnP, opacity: saving ? 0.6 : 1 }}>{saving ? "Saving..." : "Save"}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {addToOrgModal && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={() => { setAddToOrgModal(null); setAddEmail(""); }}>
                <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, padding: 28, maxWidth: 420, width: "100%" }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: "0 0 4px" }}>Add User to Organization</h3>
                  <p style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>{orgs.find(x => x.id === addToOrgModal)?.name || ""}</p>
                  <input value={addEmail} onChange={e => setAddEmail(e.target.value)} placeholder="user@email.com" style={{ ...inpS, marginBottom: 16 }} onKeyDown={e => e.key === "Enter" && handleAddToOrg()} />
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => { setAddToOrgModal(null); setAddEmail(""); }} style={btnS}>Cancel</button>
                    <button onClick={handleAddToOrg} disabled={saving || !addEmail} style={{ ...btnP, opacity: !addEmail ? 0.5 : 1 }}>{saving ? "Adding..." : "Add to Org"}</button>
                  </div>
                </div>
              </div>
            )}

            {newOrgModal && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={() => setNewOrgModal(false)}>
                <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, padding: 28, maxWidth: 420, width: "100%" }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: "0 0 16px" }}>Create Organization</h3>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", fontFamily: "'DM Sans', sans-serif", display: "block", marginBottom: 4 }}>Name</label>
                    <input value={newOrgName} onChange={e => setNewOrgName(e.target.value)} placeholder="Acme Capital LLC" style={inpS} />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", fontFamily: "'DM Sans', sans-serif", display: "block", marginBottom: 4 }}>Owner Email</label>
                    <input value={newOrgOwner} onChange={e => setNewOrgOwner(e.target.value)} placeholder="owner@company.com" style={inpS} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", fontFamily: "'DM Sans', sans-serif", display: "block", marginBottom: 4 }}>Plan Tier</label>
                    <select value={newOrgTier} onChange={e => setNewOrgTier(e.target.value)} style={selS}>
                      <option value="free">Free</option><option value="starter">Starter</option><option value="team">Team</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => setNewOrgModal(false)} style={btnS}>Cancel</button>
                    <button onClick={handleCreateOrg} disabled={saving || !newOrgName || !newOrgOwner} style={{ ...btnP, opacity: !newOrgName || !newOrgOwner ? 0.5 : 1 }}>{saving ? "Creating..." : "Create"}</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MLS FEED VIEW — 3 tabs: Cards, Table, Dashboard
   ═══════════════════════════════════════════════════════════ */

const MLS_STATUS_COLORS = {
  "Active":           { color: "#16a34a", bg: "rgba(22,163,74,0.08)" },
  "Pending":          { color: "#d97706", bg: "rgba(217,119,6,0.08)" },
  "Sold":             { color: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
  "Closed":           { color: "#64748b", bg: "rgba(100,116,139,0.08)" },
  "Withdrawn":        { color: "#dc2626", bg: "rgba(220,38,38,0.07)" },
  "Expired":          { color: "#94a3b8", bg: "rgba(148,163,184,0.08)" },
  "Coming Soon":      { color: "#0891b2", bg: "rgba(8,145,178,0.08)" },
};

function MLSStatusBadge({ status }) {
  const cfg = MLS_STATUS_COLORS[status] || { color: "#64748b", bg: "rgba(100,116,139,0.08)" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 600, letterSpacing: "0.03em", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", border: `1px solid ${cfg.color}22` }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
      {status || "—"}
    </span>
  );
}

function MLSFeedView({ session, isMobile, deals, onAddToPipeline, onShowUpload }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [addingId, setAddingId] = useState(null);
  const [activeTab, setActiveTab] = useState("cards");
  const [statusFilter, setStatusFilter] = useState(null);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("desc");
  const searchRef = useRef(null);

  useEffect(() => { if (searchOpen && searchRef.current) searchRef.current.focus(); }, [searchOpen]);

  const fetchListings = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: rows, error: fetchErr } = await supabase.from("mls_listings").select("*").order("created_at", { ascending: false });
      if (fetchErr) throw new Error(fetchErr.message);
      const v = (val) => val != null ? String(val) : "";
      const parsed = (rows || []).map((r, i) => ({
        rowIndex: i + 2,
        mlsNumber: r.mls_number || "",
        status: r.status || "",
        adom: v(r.adom),
        cdom: v(r.cdom),
        price: v(r.price),
        address: r.address || "",
        city: r.city || "",
        county: r.county || "",
        ownership: r.ownership || "",
        propType: r.prop_type || "",
        style: r.style || "",
        units: v(r.units),
        heatedArea: v(r.heated_area),
        lotAcres: v(r.lot_acres),
        beds: v(r.beds),
        baths: v(r.baths),
        yearBuilt: v(r.year_built),
        ppsf: v(r.ppsf),
        agent: r.agent || "",
        publicRemarks: r.public_remarks || "",
        realtorRemarks: r.realtor_remarks || "",
        zip: r.zip || "",
        sqftTotal: v(r.sqft_total),
      })).filter(l => l.address || l.mlsNumber);
      setListings(parsed);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const handleAddToPipeline = async (listing) => {
    setAddingId(listing.rowIndex);
    try {
      const clean = (v) => v ? String(v).replace(/[$,]/g, "") : "";
      const dealData = {
        "Deal / Name": listing.address || "MLS " + listing.mlsNumber,
        "Property / Address": listing.address,
        "City": listing.city,
        "State": "",
        "Zip Code": listing.zip,
        "Type": listing.propType || "",
        "Asking / Price": clean(listing.price),
        "SQFT / Net": clean(listing.heatedArea || listing.sqftTotal),
        "Units": clean(listing.units),
        "Lot / Size Acres": clean(listing.lotAcres),
        "Year Built": listing.yearBuilt,
        "Deal / Status": "New",
        "User": session?.user?.email || "",
        "Date / Added": new Date().toLocaleDateString("en-US"),
        "Source": "MLS Feed",
        "MLS Number": listing.mlsNumber,
      };
      const { error: insertErr } = await supabase.from("deals").insert({
        user_email: session?.user?.email || "",
        deal_name: dealData["Deal / Name"],
        property_address: dealData["Property / Address"],
        city: dealData["City"],
        state: dealData["State"],
        zip_code: dealData["Zip Code"],
        type: dealData["Type"],
        asking_price: parseFloat(dealData["Asking / Price"]) || null,
        sqft_net: parseFloat(dealData["SQFT / Net"]) || null,
        units: parseInt(dealData["Units"]) || null,
        lot_acres: parseFloat(dealData["Lot / Size Acres"]) || null,
        year_built: dealData["Year Built"] || null,
        deal_status: "New",
        source: "MLS Feed",
      });
      if (insertErr) throw new Error(insertErr.message);
      if (onAddToPipeline) onAddToPipeline();
    } catch (err) {
      alert("Error adding to pipeline: " + err.message);
    } finally {
      setAddingId(null);
    }
  };

  // Filter
  const textFiltered = listings.filter(l =>
    (l.address || "").toLowerCase().includes(search.toLowerCase()) ||
    (l.mlsNumber || "").toLowerCase().includes(search.toLowerCase()) ||
    (l.city || "").toLowerCase().includes(search.toLowerCase()) ||
    (l.agent || "").toLowerCase().includes(search.toLowerCase()) ||
    (l.propType || "").toLowerCase().includes(search.toLowerCase())
  );
  const filtered = statusFilter ? textFiltered.filter(l => l.status === statusFilter) : textFiltered;

  // Sort for table
  const sorted = [...filtered].sort((a, b) => {
    if (!sortCol) return 0;
    let va = a[sortCol] || "", vb = b[sortCol] || "";
    const na = parseFloat(String(va).replace(/[$,%]/g, "")), nb = parseFloat(String(vb).replace(/[$,%]/g, ""));
    if (!isNaN(na) && !isNaN(nb)) return sortDir === "asc" ? na - nb : nb - na;
    return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });

  const handleSort = (col) => {
    if (sortCol === col) { setSortDir(d => d === "asc" ? "desc" : "asc"); }
    else { setSortCol(col); setSortDir("desc"); }
  };

  // Status counts for dashboard + filters
  const statusCounts = {};
  listings.forEach(l => { const s = l.status || "Unknown"; statusCounts[s] = (statusCounts[s] || 0) + 1; });
  const statuses = Object.keys(statusCounts).sort((a, b) => statusCounts[b] - statusCounts[a]);

  // Dashboard stats
  const totalListings = listings.length;
  const prices = listings.map(l => parseFloat(String(l.price).replace(/[$,]/g, ""))).filter(n => !isNaN(n));
  const avgPrice = prices.length > 0 ? prices.reduce((s, n) => s + n, 0) / prices.length : 0;
  const medianPrice = prices.length > 0 ? [...prices].sort((a, b) => a - b)[Math.floor(prices.length / 2)] : 0;
  const avgPPSF = (() => { const vals = listings.map(l => parseFloat(String(l.ppsf).replace(/[$,]/g, ""))).filter(n => !isNaN(n)); return vals.length > 0 ? vals.reduce((s, n) => s + n, 0) / vals.length : 0; })();
  const propTypeCounts = {};
  listings.forEach(l => { const t = l.propType || "Unknown"; propTypeCounts[t] = (propTypeCounts[t] || 0) + 1; });
  const propTypes = Object.entries(propTypeCounts).sort((a, b) => b[1] - a[1]);
  const avgDOM = (() => { const vals = listings.map(l => parseInt(l.cdom || l.adom)).filter(n => !isNaN(n)); return vals.length > 0 ? Math.round(vals.reduce((s, n) => s + n, 0) / vals.length) : 0; })();

  const tabs = [
    { id: "cards", label: "Cards", icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
    { id: "table", label: "Table", icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg> },
    { id: "dashboard", label: "Dashboard", icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  ];

  const thStyle = { padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" };
  const SortArrow = ({ col }) => sortCol === col ? <span style={{ marginLeft: 3, fontSize: 9 }}>{sortDir === "asc" ? "▲" : "▼"}</span> : null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f8fafc", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: isMobile ? "16px 16px 0" : "20px 28px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0 }}>MLS Feed</h1>
            <p style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: "4px 0 0" }}>
              {loading ? "Loading listings..." : `${filtered.length} listing${filtered.length !== 1 ? "s" : ""}${statusFilter ? " · " + statusFilter : ""}`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {searchOpen ? (
              <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} onBlur={() => { if (!search) setSearchOpen(false); }}
                placeholder="Search address, city, agent..."
                style={{ width: isMobile ? 160 : 240, height: 36, borderRadius: 10, border: "1px solid #e2e8f0", padding: "0 12px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", background: "#f8fafc" }} />
            ) : (
              <button onClick={() => setSearchOpen(true)} style={{ width: 36, height: 36, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2}><circle cx={11} cy={11} r={8}/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </button>
            )}
            {onShowUpload && (
              <button onClick={onShowUpload} style={{
                height: 36, borderRadius: 10, background: "linear-gradient(135deg, #16a34a, #15803d)",
                border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                padding: "0 14px", color: "#fff", fontSize: 12, fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 8px rgba(22,163,74,0.3)",
              }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload
              </button>
            )}
          </div>
        </div>

        {/* Tab bar + Status filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, overflow: "auto" }}>
          <div style={{ display: "flex", gap: 2, background: "#f1f5f9", borderRadius: 10, padding: 3 }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, border: "none",
                background: activeTab === tab.id ? "#fff" : "transparent",
                color: activeTab === tab.id ? "#0f172a" : "#94a3b8",
                fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                boxShadow: activeTab === tab.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s", whiteSpace: "nowrap",
              }}>{tab.icon} {tab.label}</button>
            ))}
          </div>
          {activeTab !== "dashboard" && (
            <div style={{ display: "flex", gap: 6, overflow: "auto", paddingBottom: 2 }}>
              <button onClick={() => setStatusFilter(null)} style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid " + (!statusFilter ? "#16a34a" : "#e2e8f0"), background: !statusFilter ? "#f0fdf4" : "#fff", color: !statusFilter ? "#16a34a" : "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>All</button>
              {statuses.slice(0, 6).map(s => (
                <button key={s} onClick={() => setStatusFilter(statusFilter === s ? null : s)} style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid " + (statusFilter === s ? (MLS_STATUS_COLORS[s]?.color || "#16a34a") : "#e2e8f0"), background: statusFilter === s ? (MLS_STATUS_COLORS[s]?.bg || "#f0fdf4") : "#fff", color: statusFilter === s ? (MLS_STATUS_COLORS[s]?.color || "#16a34a") : "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>{s} ({statusCounts[s]})</button>
              ))}
            </div>
          )}
        </div>
        <div style={{ height: 1, background: "#e2e8f0", marginTop: 12 }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: isMobile ? 12 : 20 }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[0,1,2,3,4].map(i => (
              <div key={i} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 18px", animation: "pulse 1.5s ease-in-out infinite " + (i * 0.1) + "s" }}>
                <div style={{ width: "60%", height: 14, background: "#e2e8f0", borderRadius: 4, marginBottom: 8 }} />
                <div style={{ width: "30%", height: 10, background: "#f1f5f9", borderRadius: 4 }} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <p style={{ color: "#dc2626", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>Error: {error}</p>
            <button onClick={fetchListings} style={{ background: "#16a34a", border: "none", borderRadius: 8, padding: "8px 16px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: 12 }}>Try Again</button>
          </div>
        ) : filtered.length === 0 && activeTab !== "dashboard" ? (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px dashed #e2e8f0", padding: "48px 20px", textAlign: "center" }}>
            <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth={1.5} style={{ marginBottom: 12 }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <p style={{ fontSize: 14, color: "#64748b", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, margin: "0 0 4px" }}>No MLS listings{statusFilter ? (" for " + statusFilter) : ""}</p>
            <p style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>Upload a CSV via the File Uploader to populate the MLS Feed.</p>
          </div>

        /* ── CARDS VIEW ── */
        ) : activeTab === "cards" ? (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(340, 1fr))", gap: 14 }}>
            {filtered.map(listing => (
              <div key={listing.rowIndex} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.03)", transition: "box-shadow 0.15s" }}>
                {/* Image placeholder — future Zillow API */}
                <div style={{ height: 140, background: "linear-gradient(135deg, #f1f5f9, #e2e8f0)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth={1.5}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  <div style={{ position: "absolute", top: 10, left: 10 }}><MLSStatusBadge status={listing.status} /></div>
                  <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.6)", color: "#fff", padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>MLS# {listing.mlsNumber || "—"}</div>
                </div>
                {/* Card body */}
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: "0 0 3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{listing.address || "—"}</p>
                      <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>{[listing.city, listing.county, listing.zip].filter(Boolean).join(", ") || "—"}</p>
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", marginLeft: 10 }}>{listing.price ? fmt(listing.price) : "—"}</span>
                  </div>
                  {/* Key metrics row */}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                    {listing.beds && <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}><strong>{listing.beds}</strong> Beds</span>}
                    {listing.baths && <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}><strong>{listing.baths}</strong> Baths</span>}
                    {(listing.heatedArea || listing.sqftTotal) && <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}><strong>{fmtNum(listing.heatedArea || listing.sqftTotal)}</strong> SF</span>}
                    {listing.lotAcres && <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}><strong>{listing.lotAcres}</strong> Acres</span>}
                    {listing.yearBuilt && <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>Built <strong>{listing.yearBuilt}</strong></span>}
                    {listing.ppsf && <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}><strong>{listing.ppsf.startsWith("$") ? listing.ppsf : "$" + listing.ppsf}</strong>/SF</span>}
                    {listing.units && parseInt(listing.units) > 1 && <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}><strong>{listing.units}</strong> Units</span>}
                    {listing.cdom && <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>{listing.cdom}d on market</span>}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    {listing.propType && <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>{listing.propType}</span>}
                    <button onClick={() => handleAddToPipeline(listing)} disabled={addingId === listing.rowIndex} style={{
                      padding: "7px 16px", borderRadius: 8, border: "1px solid #16a34a22",
                      background: addingId === listing.rowIndex ? "#f0fdf4" : "rgba(22,163,74,0.06)",
                      color: "#16a34a", fontSize: 11, fontWeight: 700, cursor: addingId === listing.rowIndex ? "not-allowed" : "pointer",
                      fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s", display: "inline-flex", alignItems: "center", gap: 4, marginLeft: "auto",
                    }}>
                      {addingId === listing.rowIndex ? "Adding..." : "+ Pipeline"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

        /* ── TABLE VIEW ── */
        ) : activeTab === "table" ? (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Sans', sans-serif", minWidth: 1000 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <th onClick={() => handleSort("address")} style={thStyle}>Address<SortArrow col="address"/></th>
                  <th onClick={() => handleSort("city")} style={thStyle}>City<SortArrow col="city"/></th>
                  <th onClick={() => handleSort("price")} style={{...thStyle, textAlign: "right"}}>Price<SortArrow col="price"/></th>
                  <th onClick={() => handleSort("status")} style={thStyle}>Status<SortArrow col="status"/></th>
                  <th onClick={() => handleSort("propType")} style={thStyle}>Type<SortArrow col="propType"/></th>
                  <th onClick={() => handleSort("beds")} style={{...thStyle, textAlign: "center"}}>Beds<SortArrow col="beds"/></th>
                  <th onClick={() => handleSort("baths")} style={{...thStyle, textAlign: "center"}}>Baths<SortArrow col="baths"/></th>
                  <th onClick={() => handleSort("heatedArea")} style={{...thStyle, textAlign: "right"}}>SqFt<SortArrow col="heatedArea"/></th>
                  <th onClick={() => handleSort("ppsf")} style={{...thStyle, textAlign: "right"}}>$/SF<SortArrow col="ppsf"/></th>
                  <th onClick={() => handleSort("yearBuilt")} style={{...thStyle, textAlign: "center"}}>Built<SortArrow col="yearBuilt"/></th>
                  <th onClick={() => handleSort("cdom")} style={{...thStyle, textAlign: "center"}}>DOM<SortArrow col="cdom"/></th>
                  <th style={{...thStyle, textAlign: "center", cursor: "default", width: 100}}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(listing => (
                  <tr key={listing.rowIndex} onMouseEnter={() => setHoveredRow(listing.rowIndex)} onMouseLeave={() => setHoveredRow(null)} style={{ borderBottom: "1px solid #f8fafc", background: hoveredRow === listing.rowIndex ? "#fafffe" : "transparent", transition: "background 0.1s" }}>
                    <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{listing.address || "—"}</td>
                    <td style={{ padding: "12px 14px", fontSize: 11, color: "#64748b" }}>{listing.city || "—"}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Mono', monospace", textAlign: "right" }}>{listing.price ? fmt(listing.price) : "—"}</td>
                    <td style={{ padding: "12px 14px" }}><MLSStatusBadge status={listing.status} /></td>
                    <td style={{ padding: "12px 14px", fontSize: 11, color: "#64748b" }}>{listing.propType || "—"}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#64748b", textAlign: "center", fontFamily: "'DM Mono', monospace" }}>{listing.beds || "—"}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#64748b", textAlign: "center", fontFamily: "'DM Mono', monospace" }}>{listing.baths || "—"}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{listing.heatedArea ? fmtNum(listing.heatedArea) : "—"}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{listing.ppsf || "—"}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#64748b", textAlign: "center", fontFamily: "'DM Mono', monospace" }}>{listing.yearBuilt || "—"}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#64748b", textAlign: "center", fontFamily: "'DM Mono', monospace" }}>{listing.cdom || listing.adom || "—"}</td>
                    <td style={{ padding: "12px 14px", textAlign: "center" }}>
                      <button onClick={() => handleAddToPipeline(listing)} disabled={addingId === listing.rowIndex} style={{
                        padding: "5px 12px", borderRadius: 8, border: "1px solid #16a34a22",
                        background: addingId === listing.rowIndex ? "#f0fdf4" : "rgba(22,163,74,0.06)",
                        color: "#16a34a", fontSize: 10, fontWeight: 700, cursor: addingId === listing.rowIndex ? "not-allowed" : "pointer",
                        fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
                      }}>
                        {addingId === listing.rowIndex ? "..." : "+ Pipeline"}
                      </button>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && <tr><td colSpan={12} style={{ padding: "40px 14px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No listings match</td></tr>}
              </tbody>
            </table>
          </div>

        /* ── DASHBOARD VIEW ── */
        ) : activeTab === "dashboard" ? (
          <div>
            {/* Top Stats */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Total Listings", value: totalListings },
                { label: "Avg Price", value: fmt(avgPrice) },
                { label: "Median Price", value: fmt(medianPrice) },
                { label: "Avg $/SF", value: avgPPSF ? "$" + avgPPSF.toFixed(0) : "—" },
              ].map((s, i) => (
                <div key={i} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "16px 18px" }}>
                  <p style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>{s.label}</p>
                  <p style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: "#0f172a", fontFamily: "'DM Mono', monospace", margin: 0, letterSpacing: "-0.02em" }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Status Breakdown */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "18px 20px", marginBottom: 20 }}>
              <h3 style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
                By Status <span style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
              </h3>
              {/* Color bar */}
              <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 10, marginBottom: 14 }}>
                {statuses.map(s => {
                  const pct = (statusCounts[s] / totalListings) * 100;
                  const color = MLS_STATUS_COLORS[s]?.color || "#94a3b8";
                  return <div key={s} style={{ width: pct + "%", background: color, transition: "width 0.3s" }} />;
                })}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {statuses.map(s => {
                  const color = MLS_STATUS_COLORS[s]?.color || "#94a3b8";
                  const pct = ((statusCounts[s] / totalListings) * 100).toFixed(0);
                  return (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "#f8fafc" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>{s}</span>
                      <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>{statusCounts[s]} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Property Type + DOM */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "18px 20px" }}>
                <h3 style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px" }}>By Property Type</h3>
                {propTypes.map(([type, count]) => (
                  <div key={type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f8fafc" }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>{type}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 60, height: 5, background: "#e2e8f0", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ width: ((count / totalListings) * 100) + "%", height: "100%", background: "#16a34a", borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 12, color: "#64748b", fontFamily: "'DM Mono', monospace", minWidth: 28, textAlign: "right" }}>{count}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "18px 20px" }}>
                <h3 style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px" }}>Market Snapshot</h3>
                {[
                  { label: "Avg Days on Market", value: avgDOM ? avgDOM + " days" : "—" },
                  { label: "Active Listings", value: statusCounts["Active"] || 0 },
                  { label: "Pending", value: statusCounts["Pending"] || 0 },
                  { label: "Total Volume", value: prices.length > 0 ? fmt(prices.reduce((s, n) => s + n, 0)) : "—" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < 3 ? "1px solid #f8fafc" : "none" }}>
                    <span style={{ fontSize: 13, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>{item.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Mono', monospace" }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FILE UPLOADER VIEW
   ═══════════════════════════════════════════════════════════ */

function FileUploaderView({ session, isMobile }) {
  const [uploads, setUploads] = useState([]);
  const [uploadsLoading, setUploadsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const fetchUploads = useCallback(async () => {
    setUploadsLoading(true);
    try {
      const { data: rows, error: fetchErr } = await supabase.from("file_uploads").select("*").order("uploaded_at", { ascending: false });
      if (fetchErr) { setUploads([]); return; }
      const parsed = (rows || []).map(r => ({
        rowIndex: r.id,
        filename: r.filename || "",
        link: r.file_link || "",
        date: r.uploaded_at || "",
        user: r.user_email || "",
        status: r.status || "Uploaded",
      })).filter(u => u.filename || u.link);
      setUploads(parsed);
    } catch (err) { console.error("Error fetching uploads:", err); setUploads([]); } finally { setUploadsLoading(false); }
  }, []);

  useEffect(() => { fetchUploads(); }, [fetchUploads]);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      // Read file as base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { error: insertErr } = await supabase.from("file_uploads").insert({
        user_email: session?.user?.email || "",
        filename: file.name,
        mime_type: file.type || "text/csv",
        status: "Uploaded",
      });
      if (insertErr) throw new Error(insertErr.message);

      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchUploads();
    } catch (err) {
      alert("Upload error: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".csv") || file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
      setSelectedFile(file);
    } else {
      alert("Please upload a CSV or Excel file.");
    }
  };

  const onFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) setSelectedFile(file);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f8fafc", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: isMobile ? "16px 16px 14px" : "20px 28px 18px" }}>
        <h1 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0 }}>File Uploader</h1>
        <p style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: "4px 0 0" }}>Upload CSV files to populate MLS Feed data</p>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: isMobile ? 16 : 24 }}>
        {/* Upload Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !selectedFile && fileInputRef.current?.click()}
          style={{
            background: dragOver ? "#f0fdf4" : "#fff",
            border: `2px dashed ${dragOver ? "#16a34a" : selectedFile ? "#16a34a" : "#e2e8f0"}`,
            borderRadius: 16, padding: isMobile ? "32px 20px" : "48px 40px",
            textAlign: "center", cursor: selectedFile ? "default" : "pointer",
            transition: "all 0.2s", marginBottom: 24,
          }}
        >
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={onFileSelect} style={{ display: "none" }} />
          {selectedFile ? (
            <div>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: "0 0 4px" }}>{selectedFile.name}</p>
              <p style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: "0 0 16px" }}>{(selectedFile.size / 1024).toFixed(1)} KB</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} style={{
                  padding: "10px 20px", borderRadius: 10, border: "1px solid #e2e8f0",
                  background: "#fff", color: "#64748b", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}>Cancel</button>
                <button onClick={(e) => { e.stopPropagation(); handleUpload(selectedFile); }} disabled={uploading} style={{
                  padding: "10px 24px", borderRadius: 10, border: "none",
                  background: uploading ? "#86efac" : "linear-gradient(135deg, #16a34a, #15803d)",
                  color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: uploading ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif",
                  boxShadow: "0 2px 10px rgba(22,163,74,0.3)",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  {uploading && <svg width={16} height={16} viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}><circle cx={12} cy={12} r={10} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={3} /><path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" /></svg>}
                  {uploading ? "Uploading..." : "Upload File"}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "#f8fafc", border: "1px solid #e2e8f0", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={1.8}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: "0 0 4px" }}>Drop a file here or click to browse</p>
              <p style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>Accepts CSV and Excel files</p>
            </div>
          )}
        </div>

        {/* Upload History */}
        <div>
          <h3 style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
            Upload History <span style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          </h3>
          {uploadsLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "14px 16px", animation: "pulse 1.5s ease-in-out infinite " + (i * 0.1) + "s" }}>
                  <div style={{ width: "50%", height: 12, background: "#e2e8f0", borderRadius: 4, marginBottom: 6 }} />
                  <div style={{ width: "30%", height: 10, background: "#f1f5f9", borderRadius: 4 }} />
                </div>
              ))}
            </div>
          ) : uploads.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px dashed #e2e8f0", padding: "32px 20px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>No files uploaded yet. Upload your first CSV above.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {uploads.map(u => (
                <div key={u.rowIndex} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: "0 0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.filename || "Untitled"}</p>
                    <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>{u.date ? fmtDate(u.date) : "—"} · {u.user ? fmtUserName(u.user) : "—"}</p>
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, background: u.status === "Processed" ? "rgba(22,163,74,0.08)" : u.status === "Error" ? "rgba(220,38,38,0.08)" : "rgba(100,116,139,0.08)", color: u.status === "Processed" ? "#16a34a" : u.status === "Error" ? "#dc2626" : "#64748b", fontSize: 10, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>
                    {u.status}
                  </span>
                  {u.link && (
                    <a href={u.link} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", flexShrink: 0 }}>
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   INVESTOR PIPELINE VIEW (Session 10)
   ═══════════════════════════════════════════════════════════ */

function InvestorStageBadge({ stage }) {
  const cfg = INVESTOR_STAGE_CONFIG[stage] || INVESTOR_STAGE_CONFIG["Prospect"];
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", background: cfg.bg, color: cfg.color }}>{stage}</span>
  );
}

function InvestorModal({ isOpen, onClose, onSave, saving, isMobile, investor }) {
  const isEdit = !!investor;
  const [form, setForm] = useState({
    investorName: "", investorType: "Individual / HNW", pipelineStage: "Prospect",
    temperature: "Warm", capitalRangeMin: "", capitalRangeMax: "", capitalCommitted: "",
    capitalFunded: "", investmentThesis: "", preferredReturn: "", irrTarget: "",
    holdPeriod: "", assetPreference: "", geographyPreference: "", minDealSize: "",
    equityStructure: "", leadSource: "", notes: "", company: "", nextFollowUp: "",
  });

  useEffect(() => {
    if (investor) {
      setForm({
        investorName: investor.investorName || "", investorType: investor.investorType || "Individual / HNW",
        pipelineStage: investor.pipelineStage || "Prospect", temperature: investor.temperature || "Warm",
        capitalRangeMin: investor.capitalRangeMin || "", capitalRangeMax: investor.capitalRangeMax || "",
        capitalCommitted: investor.capitalCommitted || "", capitalFunded: investor.capitalFunded || "",
        investmentThesis: investor.investmentThesis || "", preferredReturn: investor.preferredReturn || "",
        irrTarget: investor.irrTarget || "", holdPeriod: investor.holdPeriod || "",
        assetPreference: investor.assetPreference || "", geographyPreference: investor.geographyPreference || "",
        minDealSize: investor.minDealSize || "", equityStructure: investor.equityStructure || "",
        leadSource: investor.leadSource || "", notes: investor.notes || "",
        company: investor.company || "", nextFollowUp: investor.nextFollowUp || "",
      });
    } else {
      setForm({ investorName: "", investorType: "Individual / HNW", pipelineStage: "Prospect", temperature: "Warm", capitalRangeMin: "", capitalRangeMax: "", capitalCommitted: "", capitalFunded: "", investmentThesis: "", preferredReturn: "", irrTarget: "", holdPeriod: "", assetPreference: "", geographyPreference: "", minDealSize: "", equityStructure: "", leadSource: "", notes: "", company: "", nextFollowUp: "" });
    }
  }, [investor, isOpen]);

  if (!isOpen) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const lbl = { fontSize: 12, fontWeight: 600, color: "#64748b", fontFamily: "'DM Sans', sans-serif", display: "block", marginBottom: 4 };
  const inpS = { width: "100%", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", color: "#0f172a", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" };
  const selS = { ...inpS, appearance: "none", WebkitAppearance: "none" };
  const row = { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 1000, padding: isMobile ? 0 : 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: isMobile ? "24px 24px 0 0" : 20, padding: isMobile ? "24px 20px 32px" : "28px 32px", width: "100%", maxWidth: 600, maxHeight: isMobile ? "90vh" : "85vh", overflow: "auto", animation: isMobile ? "slideUp 0.3s ease" : "fadeIn 0.2s ease" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: "0 0 20px" }}>{isEdit ? "Edit Investor" : "Add Investor"}</h2>

        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, fontFamily: "'DM Sans', sans-serif" }}>Basic info</div>
        <div style={row}>
          <div><label style={lbl}>Investor name *</label><input style={inpS} value={form.investorName} onChange={e => set("investorName", e.target.value)} placeholder="Meridian Capital Partners" /></div>
          <div><label style={lbl}>Company / entity</label><input style={inpS} value={form.company} onChange={e => set("company", e.target.value)} placeholder="Meridian Capital Partners LLC" /></div>
        </div>
        <div style={row}>
          <div><label style={lbl}>Investor type</label><select style={selS} value={form.investorType} onChange={e => set("investorType", e.target.value)}>{INVESTOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label style={lbl}>Pipeline stage</label><select style={selS} value={form.pipelineStage} onChange={e => set("pipelineStage", e.target.value)}>{INVESTOR_STAGES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        </div>
        <div style={row}>
          <div><label style={lbl}>Temperature</label><select style={selS} value={form.temperature} onChange={e => set("temperature", e.target.value)}>{INVESTOR_TEMPS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label style={lbl}>Lead source</label><input style={inpS} value={form.leadSource} onChange={e => set("leadSource", e.target.value)} placeholder="Referral, conference, etc." /></div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, marginTop: 20, fontFamily: "'DM Sans', sans-serif" }}>Capital</div>
        <div style={row}>
          <div><label style={lbl}>Capital range min ($)</label><input style={inpS} value={form.capitalRangeMin} onChange={e => set("capitalRangeMin", e.target.value)} placeholder="250000" /></div>
          <div><label style={lbl}>Capital range max ($)</label><input style={inpS} value={form.capitalRangeMax} onChange={e => set("capitalRangeMax", e.target.value)} placeholder="1000000" /></div>
        </div>
        <div style={row}>
          <div><label style={lbl}>Capital committed ($)</label><input style={inpS} value={form.capitalCommitted} onChange={e => set("capitalCommitted", e.target.value)} placeholder="500000" /></div>
          <div><label style={lbl}>Capital funded ($)</label><input style={inpS} value={form.capitalFunded} onChange={e => set("capitalFunded", e.target.value)} placeholder="250000" /></div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, marginTop: 20, fontFamily: "'DM Sans', sans-serif" }}>Investment preferences</div>
        <div style={row}>
          <div><label style={lbl}>Preferred return (%)</label><input style={inpS} value={form.preferredReturn} onChange={e => set("preferredReturn", e.target.value)} placeholder="8" /></div>
          <div><label style={lbl}>IRR target (%)</label><input style={inpS} value={form.irrTarget} onChange={e => set("irrTarget", e.target.value)} placeholder="15" /></div>
        </div>
        <div style={row}>
          <div><label style={lbl}>Hold period</label><input style={inpS} value={form.holdPeriod} onChange={e => set("holdPeriod", e.target.value)} placeholder="3-5 years" /></div>
          <div><label style={lbl}>Min deal size ($)</label><input style={inpS} value={form.minDealSize} onChange={e => set("minDealSize", e.target.value)} placeholder="5000000" /></div>
        </div>
        <div style={row}>
          <div><label style={lbl}>Asset preference</label><input style={inpS} value={form.assetPreference} onChange={e => set("assetPreference", e.target.value)} placeholder="Multifamily, Mixed-Use" /></div>
          <div><label style={lbl}>Geography preference</label><input style={inpS} value={form.geographyPreference} onChange={e => set("geographyPreference", e.target.value)} placeholder="FL, TX, GA" /></div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Equity structure</label><input style={inpS} value={form.equityStructure} onChange={e => set("equityStructure", e.target.value)} placeholder="LP – 90/10 split" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Investment thesis</label><textarea style={{ ...inpS, minHeight: 60, resize: "vertical" }} value={form.investmentThesis} onChange={e => set("investmentThesis", e.target.value)} placeholder="Value-add multifamily in Southeast US..." />
        </div>
        <div style={row}>
          <div><label style={lbl}>Next follow-up</label><input style={inpS} type="date" value={form.nextFollowUp} onChange={e => set("nextFollowUp", e.target.value)} /></div>
          <div />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Notes</label><textarea style={{ ...inpS, minHeight: 60, resize: "vertical" }} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Additional notes..." />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.investorName} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: !form.investorName ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", opacity: !form.investorName ? 0.5 : 1, boxShadow: "0 4px 14px rgba(22,163,74,0.25)" }}>{saving ? "Saving..." : isEdit ? "Update Investor" : "Add Investor"}</button>
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}

function ActivityModal({ isOpen, onClose, onSave, saving, isMobile }) {
  const [form, setForm] = useState({ activityType: "Call", description: "", date: new Date().toISOString().split("T")[0] });
  useEffect(() => { if (isOpen) setForm({ activityType: "Call", description: "", date: new Date().toISOString().split("T")[0] }); }, [isOpen]);
  if (!isOpen) return null;
  const lbl = { fontSize: 12, fontWeight: 600, color: "#64748b", fontFamily: "'DM Sans', sans-serif", display: "block", marginBottom: 4 };
  const inpS = { width: "100%", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", color: "#0f172a", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" };
  const types = ["Call", "Email", "Meeting", "Note", "Document Sent", "Follow-Up", "Other"];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 1000, padding: isMobile ? 0 : 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: isMobile ? "24px 24px 0 0" : 20, padding: isMobile ? "24px 20px 32px" : "28px 32px", width: "100%", maxWidth: 480 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: "0 0 20px" }}>Log Activity</h2>
        <div style={{ marginBottom: 12 }}><label style={lbl}>Type</label><select style={{ ...inpS, appearance: "none" }} value={form.activityType} onChange={e => setForm(f => ({ ...f, activityType: e.target.value }))}>{types.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
        <div style={{ marginBottom: 12 }}><label style={lbl}>Date</label><input type="date" style={inpS} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
        <div style={{ marginBottom: 16 }}><label style={lbl}>Description</label><textarea style={{ ...inpS, minHeight: 80, resize: "vertical" }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What happened?" /></div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.description} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: !form.description ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", opacity: !form.description ? 0.5 : 1, boxShadow: "0 4px 14px rgba(22,163,74,0.25)" }}>{saving ? "Saving..." : "Log Activity"}</button>
        </div>
      </div>
    </div>
  );
}

function ContactsTab({ investor, contacts, investorContacts, isMobile }) {
  const [showLinkUI, setShowLinkUI] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [linking, setLinking] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => { if (showLinkUI && searchRef.current) searchRef.current.focus(); }, [showLinkUI]);

  const linkedIds = new Set((investor.contactIds || []).filter(Boolean));
  const availableContacts = contacts.filter(c => !linkedIds.has(c.rowId));
  const searchFiltered = availableContacts.filter(c =>
    (c.name || "").toLowerCase().includes(contactSearch.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(contactSearch.toLowerCase()) ||
    (c.company || "").toLowerCase().includes(contactSearch.toLowerCase())
  );

  const linkContact = async (contactId) => {
    setLinking(true);
    try {
      const newIds = [...(investor.contactIds || []).filter(Boolean), contactId];
      const { error } = await supabase.from("investors").update({ contact_ids: newIds.join("|||") }).eq("id", investor.id);
      if (error) throw error;
      investor.contactIds = newIds;
      setContactSearch("");
      setShowLinkUI(false);
    } catch (err) { alert("Error linking contact: " + err.message); } finally { setLinking(false); }
  };

  const unlinkContact = async (contactId) => {
    if (!window.confirm("Remove this contact from the investor?")) return;
    try {
      const newIds = (investor.contactIds || []).filter(id => id !== contactId);
      const { error } = await supabase.from("investors").update({ contact_ids: newIds.length > 0 ? newIds.join("|||") : null }).eq("id", investor.id);
      if (error) throw error;
      investor.contactIds = newIds;
    } catch (err) { alert("Error unlinking contact: " + err.message); }
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>Linked Contacts ({investorContacts.length})</div>
        <button onClick={() => setShowLinkUI(!showLinkUI)} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: showLinkUI ? "#f1f5f9" : "linear-gradient(135deg, #16a34a, #15803d)", color: showLinkUI ? "#64748b" : "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>{showLinkUI ? "Cancel" : "+ Link contact"}</button>
      </div>

      {showLinkUI && (
        <div style={{ marginBottom: 16, padding: 14, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <input ref={searchRef} value={contactSearch} onChange={e => setContactSearch(e.target.value)} placeholder="Search contacts by name, email, or company..."
            style={{ width: "100%", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", color: "#0f172a", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box", marginBottom: 10 }}
            onFocus={e => e.target.style.borderColor = "#16a34a"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
          <div style={{ maxHeight: 200, overflow: "auto" }}>
            {searchFiltered.length === 0 ? (
              <div style={{ textAlign: "center", padding: 16, color: "#94a3b8", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>{availableContacts.length === 0 ? "All contacts are already linked." : "No contacts match your search."}</div>
            ) : searchFiltered.slice(0, 10).map(c => {
              const ci = (c.name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
              return (
                <button key={c.rowId} onClick={() => linkContact(c.rowId)} disabled={linking}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #f1f5f9", borderRadius: 8, marginBottom: 4, background: "#fff", cursor: "pointer", textAlign: "left", fontFamily: "'DM Sans', sans-serif", transition: "background 0.15s" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(22,163,74,0.08)", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{ci}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[c.email, c.phone, c.company].filter(Boolean).join(" · ")}</div>
                  </div>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2.5}><path d="M12 5v14M5 12h14"/></svg>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {investorContacts.length === 0 && !showLinkUI ? (
        <div style={{ textAlign: "center", padding: "32px 16px" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={1.5}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: "0 0 4px" }}>No contacts linked yet</p>
          <p style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: "0 0 14px" }}>Link people from your Contacts to this investor entity.</p>
          <button onClick={() => setShowLinkUI(true)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 8px rgba(22,163,74,0.3)" }}>+ Link your first contact</button>
        </div>
      ) : investorContacts.map((c, i) => {
        const ci = (c.name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", border: "1px solid #f1f5f9", borderRadius: 10, marginBottom: 8, background: "#fff" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(59,130,246,0.08)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>{ci}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>{c.name}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>
                {c.email && <span>{c.email}</span>}
                {c.phone && <span>{c.email ? " · " : ""}{c.phone}</span>}
                {c.company && <span>{(c.email || c.phone) ? " · " : ""}{c.company}</span>}
              </div>
            </div>
            <button onClick={() => unlinkContact(c.rowId)} title="Remove contact" style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #fee2e2", background: "#fef2f2", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        );
      })}

      {investorContacts.length > 0 && (
        <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "#f8fafc", border: "1px solid #f1f5f9" }}>
          <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: 0, lineHeight: 1.5 }}>
            Contacts linked here represent the people associated with this investor entity. Their email and phone info is used for portal access and notifications.
          </p>
        </div>
      )}
    </>
  );
}

function InvestorDetailView({ investor, activities, onBack, onEdit, onLogActivity, onLinkDeal, deals, isMobile, contacts }) {
  const [activeTab, setActiveTab] = useState("overview");
  const tabs = ["overview", "contacts", "capital", "linked deals", "communications", "documents", "portal access"];
  const [portalEmail, setPortalEmail] = useState(investor.portalEmail || "");
  const [portalSaving, setPortalSaving] = useState(false);
  const [portalSuccess, setPortalSuccess] = useState("");
  const initials = (investor.investorName || "??").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const committed = num(investor.capitalCommitted) || 0;
  const funded = num(investor.capitalFunded) || 0;
  const pctFunded = committed > 0 ? Math.round((funded / committed) * 100) : 0;
  const linkedAddresses = investor.linkedDealAddresses || [];
  const linkedDeals = deals.filter(d => linkedAddresses.includes(d.address));
  const investorContacts = (investor.contactIds || []).filter(id => id).map(id => contacts.find(c => c.rowId === id)).filter(Boolean);
  const investorActivities = activities.filter(a => a.investorId === investor.id);
  const actTypeColors = { "Call": "#16a34a", "Email": "#3b82f6", "Meeting": "#7c3aed", "Note": "#64748b", "Document Sent": "#d97706", "Follow-Up": "#0891b2", "Other": "#94a3b8" };

  return (
    <div style={{ flex: 1, overflow: "auto", background: "#f8fafc", padding: isMobile ? "16px 16px 80px" : "28px 36px" }}>
      <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#64748b", fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", padding: "4px 0", marginBottom: 16 }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Back to investors
      </button>

      {/* Header card */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: isMobile ? "18px 16px" : "24px 28px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg, #16a34a, #15803d)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 18, fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.02em" }}>{investor.investorName}</h1>
            <p style={{ fontSize: 13, color: "#64748b", fontFamily: "'DM Sans', sans-serif", margin: "2px 0 8px" }}>{investor.investorType}{investor.company ? ` · ${investor.company}` : ""}</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <InvestorStageBadge stage={investor.pipelineStage} />
              <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", background: investor.temperature === "Hot" ? "rgba(22,163,74,0.08)" : investor.temperature === "Warm" ? "rgba(217,119,6,0.08)" : "rgba(100,116,135,0.08)", color: TEMP_COLORS[investor.temperature] || "#94a3b8" }}>{investor.temperature || "—"}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onEdit} style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#0f172a", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Edit</button>
            <button onClick={onLogActivity} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 8px rgba(22,163,74,0.3)" }}>Log activity</button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: "14px 18px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>Committed</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif" }}>{committed ? fmt(committed) : "—"}</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 14, padding: "14px 18px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>Funded</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif" }}>{funded ? fmt(funded) : "—"}</div>
          {committed > 0 && <div style={{ height: 5, borderRadius: 3, background: "#f1f5f9", marginTop: 6 }}><div style={{ height: "100%", borderRadius: 3, background: "#16a34a", width: `${pctFunded}%` }} /></div>}
        </div>
        <div style={{ background: "#fff", borderRadius: 14, padding: "14px 18px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>Deals linked</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif" }}>{linkedDeals.length}</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 14, padding: "14px 18px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>IRR target</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif" }}>{investor.irrTarget ? `${investor.irrTarget}%` : "—"}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, background: "#fff", borderRadius: "12px 12px 0 0", border: "1px solid #e2e8f0", borderBottom: "none", padding: isMobile ? "0 8px" : "0 20px", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ background: "transparent", border: "none", borderBottom: activeTab === t ? "2px solid #16a34a" : "2px solid transparent", padding: isMobile ? "12px 12px" : "12px 18px", color: activeTab === t ? "#16a34a" : "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize", whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.15s" }}>{t}</button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ background: "#fff", borderRadius: "0 0 12px 12px", border: "1px solid #e2e8f0", borderTop: "1px solid #e2e8f0", padding: isMobile ? "20px 16px" : "24px 28px" }}>
        {activeTab === "overview" && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 8 }}>Investor profile <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} /></div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "12px 24px", fontSize: 13, marginBottom: 24 }}>
              {[
                ["Investor name", investor.investorName], ["Type", investor.investorType],
                ["Pipeline stage", investor.pipelineStage], ["Temperature", investor.temperature],
                ["Capital range", investor.capitalRangeMin || investor.capitalRangeMax ? `${investor.capitalRangeMin ? fmt(investor.capitalRangeMin) : "—"} – ${investor.capitalRangeMax ? fmt(investor.capitalRangeMax) : "—"}` : "—"],
                ["Investment thesis", investor.investmentThesis || "—"],
                ["Preferred return", investor.preferredReturn ? `${investor.preferredReturn}%` : "—"],
                ["IRR target", investor.irrTarget ? `${investor.irrTarget}%` : "—"],
                ["Hold period", investor.holdPeriod || "—"],
                ["Lead source", investor.leadSource || "—"],
                ["Date added", fmtDate(investor.dateAdded)],
                ["Last contact", fmtDate(investor.dateLastContact)],
                ["Next follow-up", fmtDate(investor.nextFollowUp)],
                ["Company", investor.company || "—"],
              ].map(([label, value], i) => (
                <div key={i}>
                  <div style={{ color: "#94a3b8", fontSize: 12, fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>{label}</div>
                  <div style={{ color: "#0f172a", fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{value || "—"}</div>
                </div>
              ))}
            </div>
            {investor.notes && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 8 }}>Notes <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} /></div>
                <p style={{ fontSize: 13, color: "#475569", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>{investor.notes}</p>
              </>
            )}
          </>
        )}

        {activeTab === "contacts" && (
          <ContactsTab investor={investor} contacts={contacts} investorContacts={investorContacts} isMobile={isMobile} />
        )}

        {activeTab === "capital" && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 8 }}>Capital commitments <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} /></div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
              <div style={{ background: "#f8fafc", borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>Total committed</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif" }}>{committed ? fmt(committed) : "—"}</div>
              </div>
              <div style={{ background: "#f8fafc", borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>Total funded</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif" }}>{funded ? fmt(funded) : "—"}</div>
              </div>
              <div style={{ background: "#f8fafc", borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>Remaining balance</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif" }}>{committed > 0 ? fmt(committed - funded) : "—"}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 8 }}>Fund preferences <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} /></div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "12px 24px", fontSize: 13 }}>
              {[
                ["Asset class", investor.assetPreference], ["Geography", investor.geographyPreference],
                ["Min deal size", investor.minDealSize ? fmt(investor.minDealSize) : "—"],
                ["Return target (IRR)", investor.irrTarget ? `${investor.irrTarget}%+` : "—"],
                ["Preferred return", investor.preferredReturn ? `${investor.preferredReturn}%` : "—"],
                ["Equity structure", investor.equityStructure || "—"],
              ].map(([label, value], i) => (
                <div key={i}>
                  <div style={{ color: "#94a3b8", fontSize: 12, fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>{label}</div>
                  <div style={{ color: "#0f172a", fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{value || "—"}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === "linked deals" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>Linked deals ({linkedDeals.length})</div>
              <button onClick={onLinkDeal} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>+ Link deal</button>
            </div>
            {linkedDeals.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px", color: "#94a3b8", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>No deals linked yet. Click "Link deal" to associate deals with this investor.</div>
            ) : linkedDeals.map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", border: "1px solid #f1f5f9", borderRadius: 10, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>{d.address}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>{d.units ? d.units + " units · " : ""}{d.status || "—"}{d.reapScore ? " · REAP Score: " + Math.round(num(d.reapScore)) : ""}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#16a34a", fontFamily: "'DM Sans', sans-serif" }}>{d.offer ? fmt(d.offer) : "—"}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>deal value</div>
                </div>
              </div>
            ))}
          </>
        )}

        {activeTab === "communications" && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 8 }}>Activity log <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} /></div>
            {investorActivities.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px", color: "#94a3b8", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>No activity logged yet. Click "Log activity" to start tracking communications.</div>
            ) : investorActivities.sort((a, b) => new Date(b.date) - new Date(a.date)).map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid #f8fafc" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: actTypeColors[a.activityType] || "#94a3b8", marginTop: 5, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>{a.description}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>{fmtDate(a.date)}{a.user ? ` · ${fmtUserName(a.user)}` : ""} · {a.activityType}</div>
                </div>
              </div>
            ))}
          </>
        )}

        {activeTab === "documents" && (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={1.5}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            Subscription agreements, PPMs, K-1s, and investor letters will appear here.
          </div>
        )}

        {activeTab === "portal access" && (
          <div>
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: isMobile ? 16 : 24 }}>
              <h2 style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
                Investor Portal Access <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
              </h2>

              {/* Status indicator */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, padding: "12px 16px", borderRadius: 10, background: investor.portalEmail ? "#f0fdf4" : "#f8fafc", border: "1px solid " + (investor.portalEmail ? "#86efac" : "#e2e8f0") }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: investor.portalEmail ? "#16a34a" : "#94a3b8" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: investor.portalEmail ? "#16a34a" : "#64748b", fontFamily: "'DM Sans', sans-serif" }}>
                  {investor.portalEmail ? "Portal Active" : "Not Invited"}
                </span>
                {investor.portalEmail && <span style={{ fontSize: 12, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>· {investor.portalEmail}</span>}
              </div>

              <p style={{ fontSize: 13, color: "#64748b", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, marginBottom: 16 }}>
                Set the email address this investor will use to log into the portal. They'll be able to see their linked deals, property updates, and financial information you post for them.
              </p>

              <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>Portal Login Email</label>
                  <input value={portalEmail} onChange={e => setPortalEmail(e.target.value)} placeholder="investor@email.com" type="email"
                    style={{ width: "100%", padding: "10px 14px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", border: "1.5px solid #e2e8f0", borderRadius: 10, outline: "none", background: "#fff", color: "#0f172a", boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = "#16a34a"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                </div>
                <button onClick={async () => {
                  if (!portalEmail.trim() || !portalEmail.includes("@")) { alert("Please enter a valid email address."); return; }
                  setPortalSaving(true); setPortalSuccess("");
                  try {
                    const { error } = await supabase.from("investors").update({ portal_email: portalEmail.trim().toLowerCase() }).eq("id", investor.id);
                    if (error) throw error;
                    investor.portalEmail = portalEmail.trim().toLowerCase();
                    setPortalSuccess("Portal access saved! The investor can now sign up at app.getreap.ai with this email.");
                  } catch (err) { alert("Error: " + err.message); } finally { setPortalSaving(false); }
                }} disabled={portalSaving} style={{
                  padding: "10px 20px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  background: "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff",
                  boxShadow: "0 2px 10px rgba(22,163,74,0.3)", opacity: portalSaving ? 0.7 : 1,
                  whiteSpace: "nowrap",
                }}>
                  {portalSaving ? "Saving..." : investor.portalEmail ? "Update Portal Email" : "Enable Portal Access"}
                </button>
              </div>

              {portalSuccess && (
                <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #86efac", fontSize: 12, color: "#16a34a", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                  {portalSuccess}
                </div>
              )}

              {/* Notification preferences (read-only from admin) */}
              {investor.portalEmail && (
                <div style={{ marginTop: 20 }}>
                  <h2 style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 8 }}>
                    Notification Preferences <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
                  </h2>
                  {(() => {
                    let prefs = { email: true, sms: true };
                    try { if (investor.notificationPrefs) prefs = JSON.parse(investor.notificationPrefs); } catch {}
                    return (
                      <div style={{ display: "flex", gap: 10 }}>
                        <span style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", background: prefs.email ? "#f0fdf4" : "#fef2f2", color: prefs.email ? "#16a34a" : "#ef4444", border: "1px solid " + (prefs.email ? "#86efac" : "#fecaca") }}>
                          Email: {prefs.email ? "On" : "Off"}
                        </span>
                        <span style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", background: prefs.sms ? "#f0fdf4" : "#fef2f2", color: prefs.sms ? "#16a34a" : "#ef4444", border: "1px solid " + (prefs.sms ? "#86efac" : "#fecaca") }}>
                          SMS: {prefs.sms ? "On" : "Off"}
                        </span>
                      </div>
                    );
                  })()}
                  <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", marginTop: 8, margin: "8px 0 0" }}>Investors manage these preferences from their portal Settings tab.</p>
                </div>
              )}

              <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 10, background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                <p style={{ fontSize: 12, color: "#64748b", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, margin: 0 }}>
                  <strong style={{ color: "#0f172a" }}>How it works:</strong> Once you set a portal email, the investor can sign up at <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#16a34a" }}>app.getreap.ai</span> using that email address and a password. They'll automatically be routed to their investor portal where they can see their deals and any updates you've posted.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LinkDealModal({ isOpen, onClose, deals, linkedAddresses, onLink, isMobile }) {
  const [search, setSearch] = useState("");
  if (!isOpen) return null;
  const available = deals.filter(d => d.address && !linkedAddresses.includes(d.address));
  const filtered = available.filter(d => (d.address || "").toLowerCase().includes(search.toLowerCase()) || (d.city || "").toLowerCase().includes(search.toLowerCase()));
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 1000, padding: isMobile ? 0 : 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: isMobile ? "24px 24px 0 0" : 20, padding: isMobile ? "24px 20px 32px" : "28px 32px", width: "100%", maxWidth: 500, maxHeight: isMobile ? "70vh" : "60vh", display: "flex", flexDirection: "column" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: "0 0 16px" }}>Link Deal to Investor</h2>
        <input placeholder="Search deals..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", color: "#0f172a", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", marginBottom: 12 }} />
        <div style={{ flex: 1, overflow: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: "#94a3b8", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>No available deals to link.</div>
          ) : filtered.map((d, i) => (
            <button key={i} onClick={() => onLink(d.address)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", border: "1px solid #f1f5f9", borderRadius: 10, marginBottom: 6, background: "#fff", cursor: "pointer", textAlign: "left", fontFamily: "'DM Sans', sans-serif" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{d.address}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{d.city}{d.state ? `, ${d.state}` : ""} · {d.status} · {d.offer ? fmt(d.offer) : "—"}</div>
              </div>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2}><path d="M12 5v14M5 12h14"/></svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function InvestorPipelineView({ session, isMobile, teamEmails: teamEmailsProp, deals }) {
  const [investors, setInvestors] = useState([]);
  const [activities, setActivities] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [stageFilter, setStageFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [hoveredRow, setHoveredRow] = useState(null);
  const [selectedInvestor, setSelectedInvestor] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showLinkDealModal, setShowLinkDealModal] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => { if (searchOpen && searchRef.current) searchRef.current.focus(); }, [searchOpen]);

  const userEmail = session?.user?.email || "";

  const fetchInvestors = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: rows, error: fetchErr } = await supabase.from("investors").select("*").order("date_added", { ascending: false });
      if (fetchErr) throw new Error(fetchErr.message);
      const v = (val) => val != null ? String(val) : "";
      const parsed = (rows || []).map(r => ({
        id: r.id, user: r.user_email || "",
        investorName: r.investor_name || "", investorType: r.investor_type || "",
        pipelineStage: r.pipeline_stage || "", temperature: r.temperature || "",
        capitalRangeMin: v(r.capital_range_min), capitalRangeMax: v(r.capital_range_max),
        capitalCommitted: v(r.capital_committed), capitalFunded: v(r.capital_funded),
        investmentThesis: r.investment_thesis || "", preferredReturn: v(r.preferred_return),
        irrTarget: v(r.irr_target), holdPeriod: v(r.hold_period),
        assetPreference: r.asset_preference || "", geographyPreference: r.geography_preference || "",
        minDealSize: v(r.min_deal_size), equityStructure: r.equity_structure || "",
        leadSource: r.lead_source || "",
        contactIds: r.contact_ids ? r.contact_ids.split("|||").filter(Boolean) : [],
        linkedDealAddresses: r.linked_deal_addresses ? r.linked_deal_addresses.split("|||").filter(Boolean) : [],
        notes: r.notes || "", dateAdded: r.date_added || "",
        dateLastContact: r.date_last_contact || "", nextFollowUp: r.next_follow_up || "",
        company: r.company || "", portalEmail: r.portal_email || "", notificationPrefs: r.notification_prefs || "",
      })).filter(inv => inv.investorName && inv.investorName.trim() !== "");
      const teamList = teamEmailsProp && teamEmailsProp.length > 0 ? teamEmailsProp.map(e => e.toLowerCase()) : [];
      const filtered = teamList.length > 0
        ? parsed.filter(inv => { const invUser = (inv.user || "").toLowerCase().trim(); return invUser && teamList.includes(invUser); })
        : parsed;
      setInvestors(filtered);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, [teamEmailsProp]);

  const fetchActivities = useCallback(async () => {
    try {
      const { data: rows, error: fetchErr } = await supabase.from("investor_activities").select("*").order("created_at", { ascending: false });
      if (fetchErr || !rows) { setActivities([]); return; }
      setActivities(rows.map(r => ({
        activityId: r.id, investorId: r.investor_id || "",
        user: r.user_email || "", activityType: r.activity_type || "",
        description: r.description || "", date: r.activity_date || "",
        createdAt: r.created_at || "",
      })));
    } catch { setActivities([]); }
  }, []);

  const fetchContacts = useCallback(async () => {
    try {
      const { data: rows, error: fetchErr } = await supabase.from("contacts").select("id, contact_name, email, phone, company");
      if (fetchErr || !rows) { setContacts([]); return; }
      setContacts(rows.map(r => ({
        rowId: r.id, name: r.contact_name || "",
        email: r.email || "", phone: r.phone || "",
        company: r.company || "",
      })).filter(c => c.name));
    } catch { setContacts([]); }
  }, []);

  useEffect(() => { if (session) { fetchInvestors(); fetchActivities(); fetchContacts(); } }, [session, fetchInvestors, fetchActivities, fetchContacts]);

  const handleSaveInvestor = async (form) => {
    setSaving(true);
    try {
      if (editingInvestor) {
        const updates = {};
        if (form.investorName !== undefined) updates.investor_name = form.investorName;
        if (form.investorType !== undefined) updates.investor_type = form.investorType;
        if (form.pipelineStage !== undefined) updates.pipeline_stage = form.pipelineStage;
        if (form.temperature !== undefined) updates.temperature = form.temperature;
        if (form.capitalRangeMin !== undefined) updates.capital_range_min = parseFloat(form.capitalRangeMin) || null;
        if (form.capitalRangeMax !== undefined) updates.capital_range_max = parseFloat(form.capitalRangeMax) || null;
        if (form.capitalCommitted !== undefined) updates.capital_committed = parseFloat(form.capitalCommitted) || null;
        if (form.notes !== undefined) updates.notes = form.notes;
        if (form.company !== undefined) updates.company = form.company;
        if (form.nextFollowUp !== undefined) updates.next_follow_up = form.nextFollowUp || null;
        if (form.linkedDealAddresses !== undefined) updates.linked_deal_addresses = (form.linkedDealAddresses || []).join("|||");
        const { error } = await supabase.from("investors").update(updates).eq("id", editingInvestor.id);
        if (error) throw new Error(error.message);
        setInvestors(prev => prev.map(inv => inv.id === editingInvestor.id ? { ...inv, ...form } : inv));
        if (selectedInvestor && selectedInvestor.id === editingInvestor.id) setSelectedInvestor(prev => ({ ...prev, ...form }));
      } else {
        const newId = "inv_" + Date.now();
        const { error } = await supabase.from("investors").insert({
          id: newId, user_email: userEmail, investor_name: form.investorName || "",
          investor_type: form.investorType || "", pipeline_stage: form.pipelineStage || "Prospect",
          temperature: form.temperature || "Warm", capital_range_min: parseFloat(form.capitalRangeMin) || null,
          capital_range_max: parseFloat(form.capitalRangeMax) || null, notes: form.notes || "",
          company: form.company || "", date_added: new Date().toISOString(),
        });
        if (error) throw new Error(error.message);
        await fetchInvestors();
      }
      setShowModal(false);
      setEditingInvestor(null);
    } catch (err) { alert("Error saving investor: " + err.message); } finally { setSaving(false); }
  };

  const handleLogActivity = async (form) => {
    if (!selectedInvestor) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("investor_activities").insert({
        investor_id: selectedInvestor.id, user_email: userEmail,
        activity_type: form.activityType || "", description: form.description || "",
        activity_date: form.date || new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      await fetchActivities();
      setSelectedInvestor(prev => ({ ...prev, dateLastContact: new Date().toISOString() }));
      setInvestors(prev => prev.map(inv => inv.id === selectedInvestor.id ? { ...inv, dateLastContact: new Date().toISOString() } : inv));
      setShowActivityModal(false);
    } catch (err) { alert("Error: " + err.message); } finally { setSaving(false); }
  };

  const handleLinkDeal = async (address) => {
    if (!selectedInvestor) return;
    const newAddresses = [...(selectedInvestor.linkedDealAddresses || []), address];
    try {
      const { error } = await supabase.from("investors").update({ linked_deal_addresses: newAddresses.join("|||") }).eq("id", selectedInvestor.id);
      if (error) throw new Error(error.message);
      setSelectedInvestor(prev => ({ ...prev, linkedDealAddresses: newAddresses }));
      setInvestors(prev => prev.map(inv => inv.id === selectedInvestor.id ? { ...inv, linkedDealAddresses: newAddresses } : inv));
      setShowLinkDealModal(false);
    } catch (err) { alert("Error: " + err.message); }
  };

  const handleDeleteInvestor = async (id) => {
    if (!window.confirm("Delete this investor? This cannot be undone.")) return;
    try {
      const { error } = await supabase.from("investors").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setInvestors(prev => prev.filter(inv => inv.id !== id));
      if (selectedInvestor && selectedInvestor.id === id) setSelectedInvestor(null);
    } catch (err) { alert("Error: " + err.message); }
  };

  // Filtering
  const stageFilters = INVESTOR_STAGES.map(s => ({ label: s, match: inv => (inv.pipelineStage || "").trim() === s }));
  const typeFiltered = typeFilter ? investors.filter(inv => (inv.investorType || "").toLowerCase().includes(typeFilter.toLowerCase())) : investors;
  const textFiltered = typeFiltered.filter(inv =>
    (inv.investorName || "").toLowerCase().includes(search.toLowerCase()) ||
    (inv.company || "").toLowerCase().includes(search.toLowerCase()) ||
    (inv.investorType || "").toLowerCase().includes(search.toLowerCase())
  );
  const stageFiltered = stageFilter !== null ? textFiltered.filter(stageFilters[stageFilter].match) : textFiltered;

  // Pipeline stats
  const totalCommitted = investors.reduce((s, inv) => s + (num(inv.capitalCommitted) || 0), 0);
  const totalFunded = investors.reduce((s, inv) => s + (num(inv.capitalFunded) || 0), 0);
  const totalPipeline = investors.reduce((s, inv) => s + (num(inv.capitalRangeMax) || num(inv.capitalCommitted) || 0), 0);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={fetchInvestors} />;

  if (selectedInvestor) {
    return (
      <>
        <InvestorDetailView
          investor={selectedInvestor} activities={activities} deals={deals} contacts={contacts}
          isMobile={isMobile}
          onBack={() => setSelectedInvestor(null)}
          onEdit={() => { setEditingInvestor(selectedInvestor); setShowModal(true); }}
          onLogActivity={() => setShowActivityModal(true)}
          onLinkDeal={() => setShowLinkDealModal(true)}
        />
        <InvestorModal isOpen={showModal} onClose={() => { setShowModal(false); setEditingInvestor(null); }} onSave={handleSaveInvestor} saving={saving} isMobile={isMobile} investor={editingInvestor} />
        <ActivityModal isOpen={showActivityModal} onClose={() => setShowActivityModal(false)} onSave={handleLogActivity} saving={saving} isMobile={isMobile} />
        <LinkDealModal isOpen={showLinkDealModal} onClose={() => setShowLinkDealModal(false)} deals={deals} linkedAddresses={selectedInvestor.linkedDealAddresses || []} onLink={handleLinkDeal} isMobile={isMobile} />
      </>
    );
  }

  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      <InvestorModal isOpen={showModal} onClose={() => { setShowModal(false); setEditingInvestor(null); }} onSave={handleSaveInvestor} saving={saving} isMobile={isMobile} investor={editingInvestor} />

      {/* Header */}
      {isMobile ? (
        <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "14px 16px" }}>
          {searchOpen ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, animation: "fadeIn 0.2s ease" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2}><circle cx={11} cy={11} r={8} /><path d="m21 21-4.35-4.35" /></svg>
                <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search investors..." style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px 10px 32px", color: "#0f172a", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", width: "100%" }} />
              </div>
              <button onClick={() => { setSearchOpen(false); setSearch(""); }} style={{ background: "none", border: "none", color: "#64748b", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", padding: "8px 4px", whiteSpace: "nowrap" }}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h1 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.02em" }}>Investors</h1>
                <p style={{ fontSize: 11, color: "#94a3b8", margin: "3px 0 0", fontFamily: "'DM Sans', sans-serif" }}>{stageFilter !== null ? stageFiltered.length + " " + stageFilters[stageFilter].label.toLowerCase() : investors.length + " investors"}</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setSearchOpen(true)} style={{ width: 36, height: 36, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2}><circle cx={11} cy={11} r={8} /><path d="m21 21-4.35-4.35" /></svg>
                </button>
                <button onClick={() => { setEditingInvestor(null); setShowModal(true); }} style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 8px rgba(22,163,74,0.35)" }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5}><path d="M12 5v14M5 12h14" /></svg>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: "28px 36px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.02em" }}>Investor Pipeline</h1>
              <p style={{ fontSize: 13, color: "#94a3b8", margin: "4px 0 0", fontFamily: "'DM Sans', sans-serif" }}>{investors.length} investor{investors.length !== 1 ? "s" : ""} in pipeline</p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ position: "relative" }}>
                <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2}><circle cx={11} cy={11} r={8} /><path d="m21 21-4.35-4.35" /></svg>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search investors..." style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px 10px 34px", color: "#0f172a", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", width: 240, transition: "border 0.15s" }} />
              </div>
              <button onClick={() => { setEditingInvestor(null); setShowModal(true); }} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 14px rgba(22,163,74,0.25)", display: "flex", alignItems: "center", gap: 6 }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14" /></svg> Add Investor
              </button>
            </div>
          </div>

          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            <div style={{ background: "#fff", borderRadius: 14, padding: "18px 22px", border: "1px solid #e2e8f0", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#16a34a", borderRadius: "14px 14px 0 0" }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>Total investors</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", letterSpacing: "-0.02em" }}>{investors.length}</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 14, padding: "18px 22px", border: "1px solid #e2e8f0", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#3b82f6", borderRadius: "14px 14px 0 0" }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>Pipeline value</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", letterSpacing: "-0.02em" }}>{totalPipeline ? fmt(totalPipeline) : "—"}</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 14, padding: "18px 22px", border: "1px solid #e2e8f0", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#d97706", borderRadius: "14px 14px 0 0" }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>Capital committed</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", letterSpacing: "-0.02em" }}>{totalCommitted ? fmt(totalCommitted) : "—"}</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 14, padding: "18px 22px", border: "1px solid #e2e8f0", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#7c3aed", borderRadius: "14px 14px 0 0" }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>Capital funded</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", letterSpacing: "-0.02em" }}>{totalFunded ? fmt(totalFunded) : "—"}</div>
            </div>
          </div>
        </div>
      )}

      {/* Stage filter chips */}
      <div style={{ padding: isMobile ? "10px 16px" : "0 36px", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ display: "flex", gap: 6, minWidth: "max-content" }}>
          <button onClick={() => setStageFilter(null)} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "1px solid", borderColor: stageFilter === null ? "#16a34a" : "#e2e8f0", background: stageFilter === null ? "#16a34a" : "#fff", color: stageFilter === null ? "#fff" : "#64748b", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>All ({investors.length})</button>
          {stageFilters.map((sf, i) => {
            const count = textFiltered.filter(sf.match).length;
            const cfg = INVESTOR_STAGE_CONFIG[sf.label];
            return (
              <button key={sf.label} onClick={() => setStageFilter(stageFilter === i ? null : i)} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "1px solid", borderColor: stageFilter === i ? cfg.color : "#e2e8f0", background: stageFilter === i ? cfg.bg : "#fff", color: stageFilter === i ? cfg.color : "#64748b", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>{sf.label} ({count})</button>
            );
          })}
        </div>
      </div>

      {/* Table / Cards */}
      <div style={{ flex: 1, overflow: "auto", padding: isMobile ? "12px 16px" : "16px 36px 36px" }}>
        {stageFiltered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(22,163,74,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={1.5}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: "0 0 6px" }}>{investors.length === 0 ? "No investors yet" : "No matching investors"}</h3>
            <p style={{ fontSize: 13, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", marginBottom: 20 }}>{investors.length === 0 ? "Add your first investor to start building your capital pipeline." : "Try adjusting your search or filters."}</p>
            {investors.length === 0 && (
              <button onClick={() => { setEditingInvestor(null); setShowModal(true); }} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 14px rgba(22,163,74,0.25)" }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ verticalAlign: "middle", marginRight: 6 }}><path d="M12 5v14M5 12h14" /></svg>Add Investor
              </button>
            )}
          </div>
        ) : isMobile ? (
          stageFiltered.map((inv, i) => (
            <div key={inv.id || i} onClick={() => setSelectedInvestor(inv)} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "16px", marginBottom: 10, cursor: "pointer", transition: "all 0.15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #16a34a, #15803d)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>{(inv.investorName || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inv.investorName}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>{inv.investorType}</div>
                </div>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth={2}><path d="M9 18l6-6-6-6" /></svg>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                <InvestorStageBadge stage={inv.pipelineStage} />
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: TEMP_COLORS[inv.temperature] || "#94a3b8", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: TEMP_COLORS[inv.temperature] || "#94a3b8" }} />{inv.temperature || "—"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>
                <span>{inv.capitalRangeMin || inv.capitalRangeMax ? `${inv.capitalRangeMin ? fmt(inv.capitalRangeMin) : "—"} – ${inv.capitalRangeMax ? fmt(inv.capitalRangeMax) : "—"}` : "—"}</span>
                <span>{fmtDate(inv.dateLastContact)}</span>
              </div>
            </div>
          ))
        ) : (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                  {["Investor", "Type", "Stage", "Capital range", "Temperature", "Last contact"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stageFiltered.map((inv, i) => (
                  <tr key={inv.id || i} onClick={() => setSelectedInvestor(inv)} onMouseEnter={() => setHoveredRow(i)} onMouseLeave={() => setHoveredRow(null)} style={{ cursor: "pointer", background: hoveredRow === i ? "#f8fafc" : "transparent", transition: "background 0.1s", borderBottom: "1px solid #f8fafc" }}>
                    <td style={{ padding: "14px 16px", fontWeight: 600, color: "#0f172a", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>{inv.investorName}</td>
                    <td style={{ padding: "14px 16px", color: "#64748b", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>{inv.investorType}</td>
                    <td style={{ padding: "14px 16px" }}><InvestorStageBadge stage={inv.pipelineStage} /></td>
                    <td style={{ padding: "14px 16px", color: "#64748b", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>{inv.capitalRangeMin || inv.capitalRangeMax ? `${inv.capitalRangeMin ? fmt(inv.capitalRangeMin) : "—"} – ${inv.capitalRangeMax ? fmt(inv.capitalRangeMax) : "—"}` : "—"}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: TEMP_COLORS[inv.temperature] || "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: TEMP_COLORS[inv.temperature] || "#94a3b8" }} />{inv.temperature || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", color: "#94a3b8", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>{fmtDate(inv.dateLastContact)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReapApp() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [dealTransition, setDealTransition] = useState(false);
  const [activeNav, setActiveNav] = useState("command");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [realEstateTab, setRealEstateTab] = useState("dashboard");
  const [contactsTab, setContactsTab] = useState("contacts");
  const [mlsTab, setMlsTab] = useState("feed");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState(TRIAL_DAYS);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [savingDeal, setSavingDeal] = useState(false);
  const [showEditDeal, setShowEditDeal] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [savingBuyer, setSavingBuyer] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [pendingDealAddress, setPendingDealAddress] = useState(null);
  const [pendingPortfolioId, setPendingPortfolioId] = useState(null);

  // ── Organization / Team state ──
  const [orgData, setOrgData] = useState(null);           // { id, name, owner_email, plan_tier }
  const [teamEmails, setTeamEmails] = useState([]);        // all emails in the user's org
  const [features, setFeatures] = useState({});            // { pipeline: true, portfolio: false, ... }
  const [orgLoading, setOrgLoading] = useState(true);
  const [pendingInvite, setPendingInvite] = useState(null); // invite awaiting acceptance
  const [orgMembers, setOrgMembers] = useState([]);        // all members in the user's org
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [featureFlags, setFeatureFlags] = useState([]);    // raw feature_flags rows

  // ── Investor Portal state ──
  const [isInvestorPortal, setIsInvestorPortal] = useState(false);
  const [investorProfile, setInvestorProfile] = useState(null);

  // --- Hash-based routing ---
  const updateHash = useCallback((hash) => {
    if (window.location.hash !== "#" + hash) {
      window.location.hash = hash;
    }
  }, []);

  // Parse hash on initial load
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    if (hash.startsWith("deal/")) {
      const addr = decodeURIComponent(hash.replace("deal/", ""));
      setActiveNav("realestate"); setRealEstateTab("pipeline");
      setPendingDealAddress(addr);
    } else if (hash.startsWith("portfolio/")) {
      const id = decodeURIComponent(hash.replace("portfolio/", ""));
      setActiveNav("realestate"); setRealEstateTab("portfolios");
      setPendingPortfolioId(id);
    } else if (hash === "profile") {
      setShowProfile(true);
    } else if (["command","realestate","contacts","research","mls"].includes(hash)) {
      setActiveNav(hash);
    }
  }, []);

  // Resolve pending deal once deals are loaded
  useEffect(() => {
    if (pendingDealAddress && deals.length > 0) {
      const deal = deals.find(d => d.address === pendingDealAddress);
      if (deal) {
        setSelectedDeal(deal);
        if (isMobile) setDealTransition(true);
      }
      setPendingDealAddress(null);
    }
  }, [pendingDealAddress, deals, isMobile]);

  // Listen for browser back/forward
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash.startsWith("deal/")) {
        const addr = decodeURIComponent(hash.replace("deal/", ""));
        const deal = deals.find(d => d.address === addr);
        if (deal) {
          setActiveNav("realestate"); setRealEstateTab("pipeline");
          setShowProfile(false);
          setSelectedDeal(deal);
          if (isMobile) setDealTransition(true);
        }
      } else if (hash.startsWith("portfolio/")) {
        setActiveNav("realestate"); setRealEstateTab("portfolios");
        setShowProfile(false);
        setPendingPortfolioId(decodeURIComponent(hash.replace("portfolio/", "")));
      } else if (hash === "profile") {
        setShowProfile(true);
      } else if (["command","realestate","contacts","research","mls"].includes(hash)) {
        setActiveNav(hash);
        setShowProfile(false);
        setSelectedDeal(null);
        if (isMobile) setDealTransition(false);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [deals, isMobile]);

  // Check for payment success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      const email = session?.user?.email;
      if (email) {
        supabase.from("subscriptions").upsert({ user_email: email, status: "active", plan: "starter" }, { onConflict: "user_email" }).then(() => {
          setIsSubscribed(true);
          window.history.replaceState({}, "", window.location.pathname);
        });
      }
    }
  }, [session]);

  // Check subscription + trial status
  useEffect(() => {
    if (session?.user) {
      const email = session.user.email;
      supabase.from("subscriptions").select("status").eq("user_email", email).eq("status", "active").single().then(({ data }) => {
        const subscribed = !!data;
        setIsSubscribed(subscribed);
        const createdAt = new Date(session.user.created_at);
        const now = new Date();
        const daysSinceSignup = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
        const daysLeft = Math.max(0, TRIAL_DAYS - daysSinceSignup);
        setTrialDaysLeft(daysLeft);
        if (daysLeft <= 0 && !subscribed) {
          supabase.from("org_members").select("id").eq("user_email", email.toLowerCase()).eq("status", "active").then(({ data: memberRows }) => {
            if (memberRows && memberRows.length > 0) { setShowPaywall(false); }
            else { setShowPaywall(true); }
          });
        } else {
          setShowPaywall(false);
        }
      });
      // Show onboarding for first-time users
      const onboarded = localStorage.getItem("reap_onboarded");
      if (!onboarded) {
        setShowOnboarding(true);
      }
    }
  }, [session]);

  const handleCheckout = () => {
    const email = session?.user?.email || "";
    window.location.href = "https://buy.stripe.com/fZu9AScIZ9sjc0QbF163K03?prefilled_email=" + encodeURIComponent(email);
  };

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  // Sync hash when nav or profile changes (skip initial render, skip when deal selected)
  const hashInitRef = useRef(false);
  useEffect(() => {
    if (!hashInitRef.current) { hashInitRef.current = true; return; }
    if (showProfile) {
      updateHash("profile");
    } else if (!selectedDeal) {
      updateHash(activeNav);
    }
  }, [activeNav, showProfile, selectedDeal, updateHash]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Investor portal detection ──
  useEffect(() => {
    if (!session?.user?.email) { setIsInvestorPortal(false); setInvestorProfile(null); return; }
    const email = session.user.email.toLowerCase();
    async function checkInvestorPortal() {
      try {
        // First check if portal_email column exists by doing a safe query
        const { data: testRow, error: testErr } = await supabase.from("investors").select("id").limit(1);
        if (testErr) { setIsInvestorPortal(false); setInvestorProfile(null); return; }

        const { data, error } = await supabase.from("investors").select("*").eq("portal_email", email).limit(1);
        if (error) {
          // Column likely doesn't exist yet — fail silently
          console.log("[REAP] portal_email column not found yet, skipping investor portal check");
          setIsInvestorPortal(false);
          setInvestorProfile(null);
          return;
        }
        if (data && data.length > 0) {
          const inv = data[0];
          setIsInvestorPortal(true);
          setInvestorProfile({
            id: inv.id, investorName: inv.investor_name || "",
            company: inv.company || "", investorType: inv.investor_type || "",
            linkedDealAddresses: inv.linked_deal_addresses ? inv.linked_deal_addresses.split("|||").filter(Boolean) : [],
            capitalCommitted: inv.capital_committed || 0,
            email: inv.portal_email || email,
          });
        } else {
          setIsInvestorPortal(false);
          setInvestorProfile(null);
        }
      } catch (err) {
        console.log("[REAP] Not an investor portal user");
        setIsInvestorPortal(false);
        setInvestorProfile(null);
      }
    }
    checkInvestorPortal();
  }, [session]);

  /* ═══════════════════════════════════════════════════════
     ORG / TEAM DATA — loads on session change
     ═══════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!session?.user?.email) { setOrgLoading(false); return; }
    const email = session.user.email.toLowerCase();
    const uid = session.user.id;

    async function loadOrgData() {
      setOrgLoading(true);
      let foundOrgId = null;
      let foundOrg = null;
      let foundRole = null;
      try {
        // 1. Ensure user_profiles row exists
        const { data: existingProfile, error: profileErr } = await supabase
          .from("user_profiles").select("id").eq("id", uid).maybeSingle();
        console.log("[REAP Org] Profile check:", existingProfile ? "exists" : "creating...", profileErr?.message || "");
        if (!existingProfile && !profileErr) {
          await supabase.from("user_profiles").insert({
            id: uid, email: email,
            full_name: session.user.user_metadata?.full_name || "",
            trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
          });
        }

        // 2. Check for pending invites (simple query, no join)
        const { data: invites } = await supabase
          .from("org_members")
          .select("id, org_id, user_email, role, status")
          .eq("user_email", email)
          .eq("status", "invited");
        if (invites && invites.length > 0) {
          // Fetch org name separately
          const { data: inviteOrg } = await supabase
            .from("organizations").select("name").eq("id", invites[0].org_id).maybeSingle();
          setPendingInvite({ ...invites[0], organizations: inviteOrg });
        }

        // 3. Check for active org membership (NO join, NO .single())
        const { data: memberships, error: memberErr } = await supabase
          .from("org_members")
          .select("org_id, role, status")
          .eq("user_email", email)
          .eq("status", "active");
        console.log("[REAP Org] Membership query:", memberships?.length || 0, "results", memberErr?.message || "");

        if (memberships && memberships.length > 0) {
          foundOrgId = memberships[0].org_id;
          foundRole = memberships[0].role;

          // 4. Fetch org details SEPARATELY
          const { data: orgRow, error: orgErr } = await supabase
            .from("organizations")
            .select("id, name, owner_email, plan_tier, slug")
            .eq("id", foundOrgId)
            .maybeSingle();
          console.log("[REAP Org] Org lookup:", orgRow?.name || "not found", orgErr?.message || "");

          if (orgRow) {
            foundOrg = orgRow;
            setOrgData(orgRow);

            // Update user_profiles.org_id
            await supabase.from("user_profiles")
              .update({ org_id: orgRow.id })
              .eq("id", uid);

            // 5. Get all team member emails
            const { data: members } = await supabase
              .from("org_members")
              .select("user_email, role, status, joined_at, created_at")
              .eq("org_id", orgRow.id);
            const activeMembers = (members || []).filter(m => m.status === "active");
            setOrgMembers(members || []);
            setTeamEmails(activeMembers.map(m => m.user_email.toLowerCase()));
            console.log("[REAP Org] Team emails:", activeMembers.length, "active members");
          }
        }

        if (!foundOrg) {
          // Solo user — just their own email
          setOrgData(null);
          setTeamEmails([email]);
          setOrgMembers([]);
          console.log("[REAP Org] Solo user mode");
        }

        // 6. Load feature flags
        const { data: flags } = await supabase.from("feature_flags").select("*");
        setFeatureFlags(flags || []);
        const userTier = foundOrg?.plan_tier || "starter";
        const userRank = getTierRank(userTier);
        console.log("[REAP Org] Feature flags loaded:", flags?.length || 0, "tier:", userTier);

        // Load org overrides if in an org
        let overrides = {};
        if (foundOrgId) {
          const { data: ov } = await supabase
            .from("org_feature_overrides")
            .select("feature_key, enabled")
            .eq("org_id", foundOrgId);
          (ov || []).forEach(o => { overrides[o.feature_key] = o.enabled; });
        }

        // Build features map
        const featureMap = {};
        (flags || []).forEach(f => {
          if (!f.is_active) { featureMap[f.feature_key] = false; return; }
          if (overrides.hasOwnProperty(f.feature_key)) {
            featureMap[f.feature_key] = overrides[f.feature_key];
          } else {
            featureMap[f.feature_key] = userRank >= getTierRank(f.min_tier);
          }
        });
        setFeatures(featureMap);

      } catch (err) {
        console.error("[REAP Org] Error loading org data:", err);
        setTeamEmails([email]);
        setFeatures({ pipeline: true, contacts: true, dashboard: true, market_intel: true, ai_summary: true, portfolio: true, ai_underwriting: true, mls_feed: true, file_uploader: true });
      } finally {
        setOrgLoading(false);
      }
    }

    loadOrgData();
  }, [session]);

  // ── Invite acceptance handler ──
  const handleAcceptInvite = async () => {
    if (!pendingInvite) return;
    try {
      await supabase.from("org_members")
        .update({ status: "active", joined_at: new Date().toISOString() })
        .eq("id", pendingInvite.id);
      setPendingInvite(null);
      // Reload org data
      const email = session.user.email.toLowerCase();
      const { data: membership } = await supabase
        .from("org_members")
        .select("org_id, role, organizations(id, name, owner_email, plan_tier, slug)")
        .eq("user_email", email).eq("status", "active").limit(1).single();
      if (membership?.organizations) {
        setOrgData(membership.organizations);
        const { data: members } = await supabase
          .from("org_members").select("user_email, role, status, joined_at, created_at")
          .eq("org_id", membership.organizations.id);
        const activeMembers = (members || []).filter(m => m.status === "active");
        setOrgMembers(members || []);
        setTeamEmails(activeMembers.map(m => m.user_email.toLowerCase()));
      }
      // Reload deals with new team context
      fetchDeals();
    } catch (err) { console.error("Error accepting invite:", err); }
  };

  const handleDeclineInvite = async () => {
    if (!pendingInvite) return;
    try {
      await supabase.from("org_members").delete().eq("id", pendingInvite.id);
      setPendingInvite(null);
    } catch (err) { console.error("Error declining invite:", err); }
  };

  // ── Invite a team member ──
  const handleInviteMember = async () => {
    if (!inviteEmail || !orgData) return;
    setInviteSaving(true);
    setInviteSuccess("");
    try {
      const { error } = await supabase.from("org_members").insert({
        org_id: orgData.id,
        user_email: inviteEmail.toLowerCase().trim(),
        role: "member",
        status: "invited",
        invited_by: session?.user?.email || "",
      });
      if (error) throw error;
      setInviteSuccess(inviteEmail.trim() + " invited!");
      setInviteEmail("");
      // Reload members
      const { data: members } = await supabase
        .from("org_members").select("user_email, role, status, joined_at, created_at")
        .eq("org_id", orgData.id);
      setOrgMembers(members || []);
    } catch (err) {
      setInviteSuccess("Error: " + (err.message || "Could not send invite"));
    } finally { setInviteSaving(false); }
  };

  // ── Remove a team member ──
  const handleRemoveMember = async (memberEmail) => {
    if (!orgData) return;
    try {
      await supabase.from("org_members")
        .delete()
        .eq("org_id", orgData.id)
        .eq("user_email", memberEmail);
      const { data: members } = await supabase
        .from("org_members").select("user_email, role, status, joined_at, created_at")
        .eq("org_id", orgData.id);
      setOrgMembers(members || []);
      setTeamEmails((members || []).filter(m => m.status === "active").map(m => m.user_email.toLowerCase()));
    } catch (err) { console.error("Error removing member:", err); }
  };

  // ── Toggle a feature override for the org ──
  const handleToggleFeature = async (featureKey, currentlyEnabled) => {
    if (!orgData) return;
    try {
      if (currentlyEnabled) {
        // Disable: upsert override with enabled=false
        await supabase.from("org_feature_overrides").upsert(
          { org_id: orgData.id, feature_key: featureKey, enabled: false, updated_by: session?.user?.email },
          { onConflict: "org_id,feature_key" }
        );
      } else {
        // Enable: remove override (fall back to global default) or set enabled=true
        await supabase.from("org_feature_overrides").upsert(
          { org_id: orgData.id, feature_key: featureKey, enabled: true, updated_by: session?.user?.email },
          { onConflict: "org_id,feature_key" }
        );
      }
      // Update local state
      setFeatures(prev => ({ ...prev, [featureKey]: !currentlyEnabled }));
    } catch (err) { console.error("Error toggling feature:", err); }
  };

  /* ═══════════════════════════════════════════════════════
     FETCH DEALS — from Supabase
     ═══════════════════════════════════════════════════════ */
  const fetchDeals = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: rows, error: fetchErr } = await supabase.from("deals").select("*").order("date_added", { ascending: false });
      if (fetchErr) throw new Error(fetchErr.message);

      const emailsToShow = teamEmails.length > 0 ? teamEmails : [session?.user?.email?.toLowerCase() || ""];
      const v = (val) => val != null ? String(val) : "";

      const parsed = (rows || []).map(r => ({
        _id: r.id,
        user: r.user_email || "",
        date: r.date_added || "",
        status: r.deal_status || "",
        address: r.property_address || "",
        type: r.type || "",
        offer: v(r.our_offer),
        netSqft: v(r.net_sqft_price),
        sqft: v(r.sqft_net),
        units: v(r.units),
        purchasePrice: v(r.purchase_price),
        improvementBudget: v(r.improvement_budget),
        arv: v(r.arv_value),
        profit: v(r.profit),
        roi: v(r.roi),
        ctv: v(r.ctv),
        aar: v(r.aar),
        profitability: v(r.profitability),
        source: r.source || "",
        city: r.city || "",
        state: r.state || "",
        capRate: v(r.cap_rate),
        dscr: v(r.dscr),
        noiAnnual: v(r.noi_annual),
        noiMonthly: v(r.noi_monthly),
        noiPerSF: v(r.noi_per_sf),
        cashFlowMonthly: v(r.cash_flow_monthly),
        proformaRevenueAnnual: v(r.proforma_revenue_annual),
        proformaRevenueMonthly: v(r.proforma_revenue_monthly),
        proformaRentPerSF: v(r.proforma_rent_per_sf),
        proformaExpensesPct: v(r.proforma_expenses_pct),
        proformaExpensesAnnual: v(r.proforma_expenses_annual),
        proformaExpensesMonthly: v(r.proforma_expenses_monthly),
        proformaExpensesPerSF: v(r.proforma_expenses_per_sf),
        proformaVacancy: v(r.proforma_vacancy_pct),
        bridgeLoanTotal: v(r.bridge_loan_total),
        bridgeInterestRate: v(r.bridge_interest_rate),
        bridgeInterestMonthly: v(r.bridge_interest_monthly),
        bridgePoints: v(r.bridge_points_pct),
        bridgeTotalCost: v(r.bridge_total_cost),
        bridgeLTC: v(r.bridge_ltc),
        bridgeLTV: v(r.bridge_ltv),
        equityRequired: v(r.equity_required),
        refiLoanAmount: v(r.refi_loan_amount),
        refiPctARV: v(r.refi_pct_arv),
        refiInterestRate: v(r.refi_interest_rate),
        refiCashFlow: v(r.refi_cash_flow_annual),
        cashOutRefi: v(r.cash_out_refi),
        profitAtRefi: v(r.profit_at_refi),
        equityAfterRefi: v(r.equity_after_refi),
        refiValuation: v(r.refi_valuation),
        reapScore: v(r.reap_score),
        equityMultiple: v(r.equity_multiple),
        askingPrice: v(r.asking_price),
        acqCostToClose: v(r.acq_cost_to_close_pct),
        months: v(r.months),
        dispCostOfSale: v(r.disp_cost_of_sale_pct),
        bridgeAcqPct: v(r.bridge_acq_financed_pct),
        bridgeImprovPct: v(r.bridge_improv_financed_pct),
        refiPoints: v(r.refi_points_pct),
        refiTerm: v(r.refi_term_years),
        lotAcres: v(r.lot_acres),
        yearBuilt: v(r.year_built),
        dealName: r.deal_name || "",
        zip: r.zip_code || "",
        dealClass: r.class || "",
        existingRevenueAnnual: v(r.existing_revenue_annual),
        existingRevenueMonthly: v(r.existing_revenue_monthly),
        existingRevenuePerSF: v(r.existing_revenue_per_sf),
        existingNOI: v(r.existing_noi),
        existingExpensePct: v(r.existing_expense_pct),
        existingExpenses: v(r.existing_expenses),
        existingCapRate: v(r.existing_cap_rate),
        annualTaxes: v(r.annual_taxes),
        insuranceCost: v(r.insurance_cost_annual),
        metadata: r.metadata || {},
      })).filter(d => d.address);

      const userDeals = parsed.filter(d => emailsToShow.includes((d.user || "").toLowerCase()));
      setDeals(userDeals);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (session) fetchDeals(); }, [session]);

  // Keep selectedDeal in sync when deals refresh (e.g. after edit)
  useEffect(() => {
    if (selectedDeal && deals.length > 0) {
      const updated = deals.find(d => d.address === selectedDeal.address);
      if (updated && updated !== selectedDeal) {
        setSelectedDeal(updated);
      }
    }
  }, [deals]);

  /* ═══════════════════════════════════════════════════════
     SAVE NEW DEAL — writes to Supabase
     ═══════════════════════════════════════════════════════ */
  const handleSaveDeal = async (form) => {
    setSavingDeal(true);
    try {
      const today = new Date().toLocaleDateString("en-US");
      const dealData = {
        "Deal / Name": form.dealName,
        "Property / Address": form.address,
        "City": form.city,
        "State": form.state,
        "Zip Code": form.zip,
        "Type": form.type,
        "Class": form.class,
        "SQFT / Net": form.sqft,
        "Units": form.units,
        "Year Built": form.yearBuilt,
        "Asking / Price": form.askingPrice.replace(/[$,]/g, ""),
        "Investment / Our Offer": form.ourOffer.replace(/[$,]/g, ""),
        "Lot / Size Acres": form.lotAcres,
        "Date / Added": today,
        "Deal / Status": "New",
        "User": session?.user?.email || "",
        "Source": "REAP App",
      };

      const { error: insertErr } = await supabase.from("deals").insert({
        user_email: session?.user?.email || "",
        deal_name: form.dealName,
        property_address: form.address,
        city: form.city,
        state: form.state,
        zip_code: form.zip,
        type: form.type,
        deal_status: "New",
        sqft_net: parseFloat(form.sqft) || null,
        units: parseInt(form.units) || null,
        year_built: form.yearBuilt || null,
        asking_price: parseFloat((form.askingPrice || "").replace(/[$,]/g, "")) || null,
        our_offer: parseFloat((form.ourOffer || "").replace(/[$,]/g, "")) || null,
        lot_acres: parseFloat(form.lotAcres) || null,
        class: form.class || null,
        source: "REAP App",
      });
      if (insertErr) throw new Error(insertErr.message);

      // Build a local deal object so we can open it immediately
      const newDeal = {
        user: session?.user?.email || "",
        date: today,
        status: "New",
        address: form.address,
        type: form.type,
        offer: form.ourOffer,
        netSqft: "",
        sqft: form.sqft,
        units: form.units,
        purchasePrice: "",
        improvementBudget: "",
        arv: "",
        profit: "",
        roi: "",
        ctv: "",
        aar: "",
        profitability: "",
        source: "REAP App",
        city: form.city,
        state: form.state,
        askingPrice: form.askingPrice,
      };

      setShowNewDeal(false);

      // Open the new deal immediately for instant gratification
      if (isMobile) {
        setDealTransition(true);
        setTimeout(() => setSelectedDeal(newDeal), 10);
      } else {
        setSelectedDeal(newDeal);
      }

      // Refresh list in background (new deal will be at top after sort)
      fetchDeals();
    } catch (err) {
      alert("Error saving deal: " + err.message);
    } finally {
      setSavingDeal(false);
    }
  };

  /* ═══════════════════════════════════════════════════════
     EDIT DEAL — writes to Supabase
     ═══════════════════════════════════════════════════════ */
  const handleEditDeal = async (form) => {
    setEditSaving(true);
    try {
      const clean = (v) => v ? String(v).replace(/[$,]/g, "") : "";
      const updates = {
        "Deal / Status": form.status,
        "Type": form.type,
        "SQFT / Net": clean(form.sqft),
        "Units": clean(form.units),
        "Year Built": clean(form.yearBuilt),
        "Lot / Size Acres": clean(form.lotAcres),
        "Class": form.class,
        "Asking / Price": clean(form.askingPrice),
        "Investment / Our Offer": clean(form.ourOffer),
        "Purchase Price": clean(form.purchasePrice),
        "Acquisition / Cost to Close %": clean(form.acqCostToClose),
        "Improvement / Budget": clean(form.improvementBudget),
        "ARV / Value": clean(form.arvValue),
        "Months": clean(form.months),
        "Disposition / Cost of Sale (% of ARV)": clean(form.dispCostOfSale),
        "Proforma / Revenue - Annual": clean(form.proformaRevenueAnnual),
        "Proforma / Expenses (%)": clean(form.proformaExpensesPct),
        "Proforma / Vacancy (%)": clean(form.proformaVacancy),
        "Existing Financials / Revenue - Annual": clean(form.existingRevenueAnnual),
        "Existing Financials / Expense Percentage": clean(form.existingExpensePct),
        "Annual Taxes (New)": clean(form.annualTaxes),
        "Insurance / Cost (Annual)": clean(form.insuranceCost),
        "Bridge / Acquisition Financed (%)": clean(form.bridgeAcqPct),
        "Bridge / Improvement Financing (%)": clean(form.bridgeImprovPct),
        "Bridge / Interest Rate (%)": clean(form.bridgeInterestRate),
        "Bridge / Points (%)": clean(form.bridgePoints),
        "Refinance / % of Appraisal (ARV)": clean(form.refiPctARV),
        "Refinance / Interest Rate (%)": clean(form.refiInterestRate),
        "Refinance / Points (%)": clean(form.refiPoints),
        "Refinance / Term (years)": clean(form.refiTerm),
      };

      if (selectedDeal._id) {
        const dbUpdates = {
          deal_status: form.status, type: form.type,
          sqft_net: parseFloat(clean(form.sqft)) || null, units: parseInt(clean(form.units)) || null,
          year_built: clean(form.yearBuilt) || null, lot_acres: parseFloat(clean(form.lotAcres)) || null,
          class: form.class || null, asking_price: parseFloat(clean(form.askingPrice)) || null,
          our_offer: parseFloat(clean(form.ourOffer)) || null, purchase_price: parseFloat(clean(form.purchasePrice)) || null,
          acq_cost_to_close_pct: parseFloat(clean(form.acqCostToClose)) || null,
          improvement_budget: parseFloat(clean(form.improvementBudget)) || null,
          arv_value: parseFloat(clean(form.arvValue)) || null, months: parseInt(clean(form.months)) || null,
          disp_cost_of_sale_pct: parseFloat(clean(form.dispCostOfSale)) || null,
          proforma_revenue_annual: parseFloat(clean(form.proformaRevenueAnnual)) || null,
          proforma_expenses_pct: parseFloat(clean(form.proformaExpensesPct)) || null,
          proforma_vacancy_pct: parseFloat(clean(form.proformaVacancy)) || null,
          existing_revenue_annual: parseFloat(clean(form.existingRevenueAnnual)) || null,
          existing_expense_pct: parseFloat(clean(form.existingExpensePct)) || null,
          annual_taxes: parseFloat(clean(form.annualTaxes)) || null,
          insurance_cost_annual: parseFloat(clean(form.insuranceCost)) || null,
          bridge_acq_financed_pct: parseFloat(clean(form.bridgeAcqPct)) || null,
          bridge_improv_financed_pct: parseFloat(clean(form.bridgeImprovPct)) || null,
          bridge_interest_rate: parseFloat(clean(form.bridgeInterestRate)) || null,
          bridge_points_pct: parseFloat(clean(form.bridgePoints)) || null,
          refi_pct_arv: parseFloat(clean(form.refiPctARV)) || null,
          refi_interest_rate: parseFloat(clean(form.refiInterestRate)) || null,
          refi_points_pct: parseFloat(clean(form.refiPoints)) || null,
          refi_term_years: parseInt(clean(form.refiTerm)) || null,
        };
        const { error: updateErr } = await supabase.from("deals").update(dbUpdates).eq("id", selectedDeal._id);
        if (updateErr) throw new Error(updateErr.message);
      }

      setShowEditDeal(false);
      // Auto-log status change activity
      if (selectedDeal && form.status && form.status !== selectedDeal.status) {
        try {
          await supabase.from("deal_activities").insert({
            deal_id: selectedDeal._id,
            user_email: userEmail,
            activity_type: "Status Change",
            description: `Status changed from "${selectedDeal.status || "—"}" to "${form.status}"`,
            activity_date: new Date().toISOString(),
          });
        } catch (logErr) { console.error("Auto-log failed:", logErr); }
      }
      // Don't null selectedDeal — stay on the deal detail view
      // fetchDeals will refresh the data, and the sync effect below updates selectedDeal
      fetchDeals();
    } catch (err) {
      alert("Error saving: " + err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleSelectDeal = (deal) => {
    if (isMobile) {
      setDealTransition(true);
      setTimeout(() => setSelectedDeal(deal), 10);
    } else {
      setSelectedDeal(deal);
    }
    if (deal.address) updateHash("deal/" + encodeURIComponent(deal.address));
  };

  const handleBack = () => {
    if (isMobile) {
      setDealTransition(false);
      setTimeout(() => setSelectedDeal(null), 300);
    } else {
      setSelectedDeal(null);
    }
    updateHash("pipeline");
  };

  const handleSaveBuyer = async (form) => {
    setSavingBuyer(true);
    try {
      const buyerData = {
        "Contact / Name": form.name,
        "Contact / First Name": form.name.split(" ")[0],
        "Contact / Email": form.email,
        "Contact / Phone": form.phone,
        "Contact / Company": form.company,
        "Contact / Type": "Buyer (Client)",
        "Buyer / Status": form.buyerStatus || "New",
        "Contact / Asset Preference": form.assetPreference,
        "Contact / Temperature": form.temperature,
        "Contact / Manager": form.manager,
        "Contact / Notes": form.notes,
        "Contact / Lead Source": form.leadSource,
        "User": session?.user?.email || "",
        "Date / Added": new Date().toISOString(),
      };

      if (editingBuyer?.rowId) {
        const { error } = await supabase.from("contacts").update({
          contact_name: form.name, first_name: form.name.split(" ")[0],
          email: form.email, phone: form.phone, company: form.company,
          buyer_status: form.buyerStatus || "New", asset_preference: form.assetPreference,
          temperature: form.temperature, manager: form.manager, notes: form.notes,
          lead_source: form.leadSource,
        }).eq("id", editingBuyer.rowId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("contacts").insert({
          user_email: session?.user?.email || "",
          contact_name: form.name, first_name: form.name.split(" ")[0],
          email: form.email, phone: form.phone, company: form.company,
          contact_type: "Buyer (Client)", buyer_status: form.buyerStatus || "New",
          asset_preference: form.assetPreference, temperature: form.temperature,
          manager: form.manager, notes: form.notes, lead_source: form.leadSource,
        });
        if (error) throw new Error(error.message);
      }

      setShowBuyerModal(false);
      setEditingBuyer(null);
      // Force a re-render of BuyerPipelineView by briefly switching nav
      setActiveNav("command");
      setTimeout(() => setActiveNav("contacts"), 50);
    } catch (err) {
      alert("Error saving buyer: " + err.message);
    } finally {
      setSavingBuyer(false);
    }
  };

  // ── Feature-gated navigation ──
  const userEmail = session?.user?.email || "";
  const userName = session?.user?.user_metadata?.full_name || userEmail;
  const initials = userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const FEATURE_NAV_MAP = {
    command: "dashboard", realestate: "pipeline", contacts: "contacts", research: "market_intel"
  };
  const allNavItems = [
    { id: "command", label: "Command Center", featured: true, icon: <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
    { id: "realestate", label: "Real Estate", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
    { id: "contacts", label: "Contacts", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { id: "research", label: "Research", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
  ];
  // Filter nav items by feature flags (fallback: show all if features haven't loaded yet)
  const navItems = Object.keys(features).length === 0
    ? allNavItems
    : allNavItems.filter(item => {
        const featureKey = FEATURE_NAV_MAP[item.id];
        return !featureKey || features[featureKey] !== false;
      });

  const SubTabBar = ({ tabs, active, onChange, title }) => (
    <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 20px", flexShrink: 0 }}>
      {title && <h1 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, padding: "16px 0 8px", letterSpacing: "-0.02em" }}>{title}</h1>}
      <div style={{ display: "flex", gap: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            background: "transparent", border: "none", borderBottom: active === t.id ? "2px solid #16a34a" : "2px solid transparent",
            padding: "10px 18px", color: active === t.id ? "#16a34a" : "#94a3b8", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s", marginBottom: -1
          }}>{t.label}</button>
        ))}
      </div>
    </div>
  );

  if (authLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTop: "3px solid #16a34a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!session) return <AuthScreen onAuth={(user) => setSession({ user })} />;

  // Investor portal — if logged-in user is an investor, show their portal
  if (isInvestorPortal && investorProfile) return <InvestorPortalView investorProfile={investorProfile} onSignOut={() => supabase.auth.signOut()} />;

  const handleFinishOnboarding = (openNewDeal) => {
    localStorage.setItem("reap_onboarded", "true");
    setShowOnboarding(false);
    if (openNewDeal) setShowNewDeal(true);
  };

  if (showOnboarding) {
    const onboardName = session?.user?.user_metadata?.full_name || session?.user?.email || "";
    return (
      <OnboardingScreen
        userName={onboardName}
        onComplete={() => handleFinishOnboarding(false)}
        onCreateDeal={() => handleFinishOnboarding(true)}
      />
    );
  }

  if (showPaywall) return <PricingScreen userEmail={session?.user?.email} daysLeft={trialDaysLeft} onCheckout={handleCheckout} checkoutLoading={checkoutLoading} />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        input::placeholder { color: #94a3b8; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes slideOutLeft { from { transform: translateX(0); } to { transform: translateX(-100%); } }
      `}</style>

      {/* New Deal Modal */}
      <NewDealModal
        isOpen={showNewDeal}
        onClose={() => setShowNewDeal(false)}
        onSave={handleSaveDeal}
        saving={savingDeal}
        isMobile={isMobile}
        userEmail={userEmail}
      />

      <EditDealModal
        isOpen={showEditDeal}
        onClose={() => setShowEditDeal(false)}
        onSave={handleEditDeal}
        saving={editSaving}
        isMobile={isMobile}
        deal={selectedDeal}
      />

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", height: "100vh", background: "#f8fafc", overflow: "hidden" }}>

        {/* Trial Banner */}
        {!isSubscribed && trialDaysLeft > 0 && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
            background: trialDaysLeft <= 3 ? "linear-gradient(135deg, #dc2626, #b91c1c)" : "linear-gradient(135deg, #16a34a, #15803d)",
            color: "#fff", fontSize: 13, fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
            padding: "8px 16px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          }}>
            <span>{trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} left on your free trial</span>
            <button onClick={handleCheckout} style={{
              background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 6, padding: "4px 12px", color: "#fff", fontSize: 12,
              fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              transition: "background 0.2s",
            }}>Upgrade Now</button>
          </div>
        )}
        {/* Desktop Sidebar */}
        {!isMobile && (
          <div style={{ width: 60, background: "#fff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0", gap: 6, flexShrink: 0, marginTop: !isSubscribed && trialDaysLeft > 0 ? 42 : 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #16a34a, #15803d)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, boxShadow: "0 2px 10px rgba(22,163,74,0.3)" }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
            {navItems.map(item => (
              <button key={item.id} onClick={() => { setActiveNav(item.id); setShowProfile(false); }} title={item.label} style={{ width: 40, height: 40, borderRadius: 10, border: "none", background: activeNav === item.id && !showProfile ? (item.featured ? "linear-gradient(135deg, #16a34a, #15803d)" : "#f0fdf4") : "transparent", color: activeNav === item.id && !showProfile ? (item.featured ? "#fff" : "#16a34a") : "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", boxShadow: activeNav === item.id && item.featured && !showProfile ? "0 2px 8px rgba(22,163,74,0.3)" : "none" }}>{item.icon}</button>
            ))}
            <div style={{ flex: 1 }} />
            <button onClick={() => setShowProfile(true)} title="Profile & Settings" style={{ width: 32, height: 32, borderRadius: "50%", background: showProfile ? "linear-gradient(135deg, #16a34a, #15803d)" : "linear-gradient(135deg, #3b82f6, #2563eb)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif", cursor: "pointer", transition: "all 0.15s" }}>{initials}</button>
          </div>
        )}

        {/* Invite Banner */}
        {pendingInvite && (
          <div style={{
            background: "linear-gradient(135deg, #7c3aed, #6d28d9)", padding: "12px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
            position: isMobile ? "fixed" : "relative", top: isMobile ? ((!isSubscribed && trialDaysLeft > 0 ? 42 : 0) + 56) : undefined,
            left: 0, right: 0, zIndex: 90,
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>
              <strong>{pendingInvite.organizations?.name || "A team"}</strong> has invited you to join their organization.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleAcceptInvite} style={{ padding: "6px 16px", background: "#fff", color: "#7c3aed", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Accept</button>
              <button onClick={handleDeclineInvite} style={{ padding: "6px 16px", background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Decline</button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", paddingBottom: isMobile ? 70 : 0, paddingTop: isMobile ? ((!isSubscribed && trialDaysLeft > 0 ? 42 : 0) + 56 + (pendingInvite ? 48 : 0)) : (!isSubscribed && trialDaysLeft > 0 ? 42 : 0), position: "relative" }}>
          {isMobile ? (
            showProfile ? (
              <ProfileView session={session} isMobile={true} isSubscribed={isSubscribed} trialDaysLeft={trialDaysLeft} onCheckout={handleCheckout} onSignOut={() => supabase.auth.signOut()} onClose={() => setShowProfile(false)} orgData={orgData} orgMembers={orgMembers} inviteEmail={inviteEmail} setInviteEmail={setInviteEmail} inviteSaving={inviteSaving} inviteSuccess={inviteSuccess} onInviteMember={handleInviteMember} onRemoveMember={handleRemoveMember} features={features} featureFlags={featureFlags} onToggleFeature={handleToggleFeature} isAdmin={userEmail.toLowerCase() === PLATFORM_ADMIN_EMAIL} />
            ) : activeNav === "command" ? (
              <CommandCenterView deals={deals} loading={loading} onSelectDeal={(deal) => { setActiveNav("realestate"); setRealEstateTab("pipeline"); setTimeout(() => handleSelectDeal(deal), 50); }} isMobile={true} session={session} teamEmails={teamEmails} />
            ) : activeNav === "contacts" ? (
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <SubTabBar tabs={[{ id: "contacts", label: "Contacts" }, { id: "investors", label: "Investors" }]} active={contactsTab} onChange={setContactsTab} title="Contacts" />
                <div style={{ flex: 1, overflow: "auto" }}>
                  {contactsTab === "investors"
                    ? <InvestorPipelineView session={session} isMobile={true} teamEmails={teamEmails} deals={deals} />
                    : <BuyerPipelineView session={session} isMobile={true} teamEmails={teamEmails} showBuyerModal={showBuyerModal} onCloseBuyerModal={() => { setShowBuyerModal(false); setEditingBuyer(null); }} onSaveBuyer={handleSaveBuyer} savingBuyer={savingBuyer} editingBuyer={editingBuyer} onSetEditingBuyer={(b) => { setEditingBuyer(b); setShowBuyerModal(true); }} onNewBuyer={() => { setEditingBuyer(null); setShowBuyerModal(true); }} />
                  }
                </div>
              </div>
            ) : activeNav === "research" ? (
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "16px 20px", flexShrink: 0 }}>
                  <h1 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.02em" }}>Research</h1>
                </div>
                <div style={{ flex: 1, overflow: "auto" }}>
                  <MarketIntelligenceView deals={deals} isMobile={true} session={session} teamEmails={teamEmails} />
                </div>
              </div>
            ) : activeNav === "realestate" ? (
            <>
              {selectedDeal ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <DealDetailView deal={selectedDeal} onBack={handleBack} onEdit={() => setShowEditDeal(true)} isMobile={true} userEmail={userEmail} onUpdateDeal={fetchDeals} />
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  <SubTabBar tabs={[{ id: "dashboard", label: "Dashboard" }, { id: "pipeline", label: "Pipeline" }, { id: "portfolios", label: "Portfolios" }, { id: "mls", label: "MLS Feed" }]} active={realEstateTab} onChange={(tab) => { setRealEstateTab(tab); if (tab === "mls") setMlsTab("feed"); }} title="Real Estate" />
                  <div style={{ flex: 1, overflow: "auto" }}>
                    {realEstateTab === "dashboard"
                      ? <DashboardView deals={deals} loading={loading} onSelectDeal={(deal) => { setRealEstateTab("pipeline"); setTimeout(() => handleSelectDeal(deal), 50); }} isMobile={true} />
                      : realEstateTab === "portfolios"
                      ? <PortfolioView deals={deals} isMobile={true} session={session} teamEmails={teamEmails} onSelectDeal={function(deal) { setRealEstateTab("pipeline"); setTimeout(function() { handleSelectDeal(deal); }, 50); }} pendingPortfolioId={pendingPortfolioId} onClearPendingPortfolio={function() { setPendingPortfolioId(null); }} onHashUpdate={updateHash} />
                      : realEstateTab === "mls"
                      ? (mlsTab === "upload"
                        ? <FileUploaderView session={session} isMobile={true} />
                        : <MLSFeedView session={session} isMobile={true} deals={deals} onAddToPipeline={fetchDeals} onShowUpload={() => setMlsTab("upload")} />)
                      : <PipelineView deals={deals} loading={loading} error={error} onRetry={fetchDeals} onSelectDeal={handleSelectDeal} onNewDeal={() => setShowNewDeal(true)} isMobile={true} />
                    }
                  </div>
                </div>
              )}
            </>
            ) : null
          ) : (
            showProfile
              ? <ProfileView session={session} isMobile={false} isSubscribed={isSubscribed} trialDaysLeft={trialDaysLeft} onCheckout={handleCheckout} onSignOut={() => supabase.auth.signOut()} onClose={() => setShowProfile(false)} orgData={orgData} orgMembers={orgMembers} inviteEmail={inviteEmail} setInviteEmail={setInviteEmail} inviteSaving={inviteSaving} inviteSuccess={inviteSuccess} onInviteMember={handleInviteMember} onRemoveMember={handleRemoveMember} features={features} featureFlags={featureFlags} onToggleFeature={handleToggleFeature} isAdmin={userEmail.toLowerCase() === PLATFORM_ADMIN_EMAIL} />
              : activeNav === "command"
              ? <CommandCenterView deals={deals} loading={loading} onSelectDeal={(deal) => { setActiveNav("realestate"); setRealEstateTab("pipeline"); setTimeout(() => handleSelectDeal(deal), 50); }} isMobile={false} session={session} teamEmails={teamEmails} />
              : activeNav === "realestate" && selectedDeal
              ? <DealDetailView deal={selectedDeal} onBack={handleBack} onEdit={() => setShowEditDeal(true)} isMobile={false} userEmail={userEmail} onUpdateDeal={fetchDeals} />
              : activeNav === "realestate"
              ? <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  <SubTabBar tabs={[{ id: "dashboard", label: "Dashboard" }, { id: "pipeline", label: "Pipeline" }, { id: "portfolios", label: "Portfolios" }, { id: "mls", label: "MLS Feed" }]} active={realEstateTab} onChange={(tab) => { setRealEstateTab(tab); if (tab === "mls") setMlsTab("feed"); }} title="Real Estate" />
                  <div style={{ flex: 1, overflow: "auto" }}>
                    {realEstateTab === "dashboard"
                      ? <DashboardView deals={deals} loading={loading} onSelectDeal={(deal) => { setRealEstateTab("pipeline"); setTimeout(() => handleSelectDeal(deal), 50); }} isMobile={false} />
                      : realEstateTab === "portfolios"
                      ? <PortfolioView deals={deals} isMobile={false} session={session} teamEmails={teamEmails} onSelectDeal={function(deal) { setRealEstateTab("pipeline"); setTimeout(function() { handleSelectDeal(deal); }, 50); }} pendingPortfolioId={pendingPortfolioId} onClearPendingPortfolio={function() { setPendingPortfolioId(null); }} onHashUpdate={updateHash} />
                      : realEstateTab === "mls"
                      ? (mlsTab === "upload"
                        ? <FileUploaderView session={session} isMobile={false} />
                        : <MLSFeedView session={session} isMobile={false} deals={deals} onAddToPipeline={fetchDeals} onShowUpload={() => setMlsTab("upload")} />)
                      : <PipelineView deals={deals} loading={loading} error={error} onRetry={fetchDeals} onSelectDeal={handleSelectDeal} onNewDeal={() => setShowNewDeal(true)} isMobile={false} />
                    }
                  </div>
                </div>
              : activeNav === "contacts"
              ? <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  <SubTabBar tabs={[{ id: "contacts", label: "Contacts" }, { id: "investors", label: "Investors" }]} active={contactsTab} onChange={setContactsTab} title="Contacts" />
                  <div style={{ flex: 1, overflow: "auto" }}>
                    {contactsTab === "investors"
                      ? <InvestorPipelineView session={session} isMobile={false} teamEmails={teamEmails} deals={deals} />
                      : <BuyerPipelineView session={session} isMobile={false} teamEmails={teamEmails} showBuyerModal={showBuyerModal} onCloseBuyerModal={() => { setShowBuyerModal(false); setEditingBuyer(null); }} onSaveBuyer={handleSaveBuyer} savingBuyer={savingBuyer} editingBuyer={editingBuyer} onSetEditingBuyer={(b) => { setEditingBuyer(b); setShowBuyerModal(true); }} onNewBuyer={() => { setEditingBuyer(null); setShowBuyerModal(true); }} />
                    }
                  </div>
                </div>
              : activeNav === "research"
              ? <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "16px 20px", flexShrink: 0 }}>
                    <h1 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.02em" }}>Research</h1>
                  </div>
                  <div style={{ flex: 1, overflow: "auto" }}>
                    <MarketIntelligenceView deals={deals} isMobile={false} session={session} teamEmails={teamEmails} />
                  </div>
                </div>
              : <DashboardView deals={deals} loading={loading} onSelectDeal={(deal) => { setActiveNav("realestate"); setRealEstateTab("pipeline"); setTimeout(() => handleSelectDeal(deal), 50); }} isMobile={false} />
          )}
        </div>

        {/* Mobile Bottom Nav */}
        {isMobile && (
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, height: 70,
            background: "#fff", borderTop: "1px solid #e2e8f0",
            display: "flex", alignItems: "flex-end", justifyContent: "space-around",
            padding: "0 4px 6px", zIndex: 100,
            boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
          }}>
            {(() => { const bottomItems = navItems.filter(item => item.mobileBottom !== false); const nonFeatured = bottomItems.filter(i => !i.featured); const featured = bottomItems.find(i => i.featured); const mid = Math.floor(nonFeatured.length / 2); const mobileOrder = [...nonFeatured.slice(0, mid), ...(featured ? [featured] : []), ...nonFeatured.slice(mid)]; return mobileOrder; })().map(item => {
              const isActive = activeNav === item.id && !showProfile;
              if (item.featured) {
                return (
                  <button key={item.id} onClick={() => { setActiveNav(item.id); setShowProfile(false); }} style={{
                    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                    background: "none", border: "none", cursor: "pointer",
                    padding: "0", marginTop: -18, WebkitTapHighlightColor: "transparent",
                    position: "relative",
                  }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 16,
                      background: isActive ? "linear-gradient(135deg, #16a34a, #15803d)" : "linear-gradient(135deg, #22c55e, #16a34a)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: isActive ? "0 4px 16px rgba(22,163,74,0.45)" : "0 3px 12px rgba(22,163,74,0.3)",
                      transition: "all 0.2s", color: "#fff",
                      transform: isActive ? "scale(1.08)" : "scale(1)",
                      border: "3px solid #fff",
                    }}>
                      {item.icon}
                    </div>
                  </button>
                );
              }
              return (
                <button key={item.id} onClick={() => { setActiveNav(item.id); setShowProfile(false); }} style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  background: "none", border: "none",
                  color: isActive ? "#16a34a" : "#94a3b8",
                  cursor: "pointer", padding: "8px 0",
                  transition: "color 0.2s", WebkitTapHighlightColor: "transparent",
                }}>
                  {item.icon}
                  <span style={{ fontSize: 9, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Mobile Top Header Bar */}
        {isMobile && (
          <div style={{
            position: "fixed", top: !isSubscribed && trialDaysLeft > 0 ? 42 : 0, left: 0, right: 0, height: 56,
            background: "#fff", borderBottom: "1px solid #e2e8f0",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 16px", zIndex: 110,
            boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
          }}>
            <button onClick={() => setShowMobileMenu(true)} style={{
              width: 40, height: 40, borderRadius: 10, border: "none",
              background: "transparent", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
              WebkitTapHighlightColor: "transparent", color: "#0f172a",
            }}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", letterSpacing: "-0.01em" }}>
              {showProfile ? "Profile" : navItems.find(i => i.id === activeNav)?.label || "REAP"}
            </span>
            <div style={{ width: 40 }} />
          </div>
        )}

        {/* Mobile Side Drawer Overlay */}
        {isMobile && showMobileMenu && (
          <div onClick={() => setShowMobileMenu(false)} style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.4)", animation: "fadeIn 0.2s ease",
          }} />
        )}

        {/* Mobile Side Drawer */}
        {isMobile && showMobileMenu && (
          <div style={{
            position: "fixed", top: 0, left: 0, bottom: 0, width: 280,
            background: "#fff", zIndex: 210,
            display: "flex", flexDirection: "column",
            animation: "slideInLeft 0.25s cubic-bezier(0.25, 1, 0.5, 1)",
            boxShadow: "4px 0 24px rgba(0,0,0,0.12)",
          }}>
            {/* Drawer Header */}
            <div style={{
              padding: "20px 20px 16px", display: "flex", alignItems: "center",
              justifyContent: "space-between", borderBottom: "1px solid #f1f5f9",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: "linear-gradient(135deg, #16a34a, #15803d)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(22,163,74,0.3)",
                }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.06em" }}>REAP</span>
              </div>
              <button onClick={() => setShowMobileMenu(false)} style={{
                width: 34, height: 34, borderRadius: 8, border: "none",
                background: "#f8fafc", cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center", color: "#64748b",
              }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Drawer Nav Items */}
            <div style={{ flex: 1, padding: "12px 12px", overflow: "auto" }}>
              {navItems.map(item => {
                const isActive = activeNav === item.id && !showProfile;
                return (
                  <button key={item.id} onClick={() => {
                    setActiveNav(item.id);
                    setShowProfile(false);
                    setShowMobileMenu(false);
                  }} style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 16px", borderRadius: 12, border: "none",
                    background: isActive ? "#f0fdf4" : "transparent",
                    color: isActive ? "#16a34a" : "#475569",
                    cursor: "pointer", transition: "all 0.15s",
                    fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600,
                    WebkitTapHighlightColor: "transparent", marginBottom: 2,
                    borderLeft: isActive ? "3px solid #16a34a" : "3px solid transparent",
                  }}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24 }}>
                      {item.icon}
                    </span>
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Drawer Profile Footer */}
            <div style={{
              padding: "16px 16px", borderTop: "1px solid #f1f5f9",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <button onClick={() => {
                setShowProfile(true);
                setShowMobileMenu(false);
              }} style={{
                flex: 1, display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px", borderRadius: 12, border: "none",
                background: showProfile ? "#f0fdf4" : "#f8fafc",
                cursor: "pointer", WebkitTapHighlightColor: "transparent",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: "#fff",
                  fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
                }}>{initials}</div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", overflow: "hidden" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>{userName}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>{userEmail}</span>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
