import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { loadStripe } from "@stripe/stripe-js";

const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;
const API_KEY = process.env.REACT_APP_SHEETS_API_KEY;
const SHEET_NAME = "Deals";
const SHEETS_WRITE_URL = process.env.REACT_APP_SHEETS_WRITE_URL;
const CONTACTS_SHEET_NAME = "Contacts";

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);
const TRIAL_DAYS = 14;

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
      <p style={{ color: "#94a3b8", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>Loading deals from Google Sheets...</p>
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

  const Field = ({ label, k, type, placeholder, options }) => (
    <div style={{ marginBottom: 12 }}>
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
            <Field label="Deal Status" k="status" options={["New", "Review", "Underwriting", "Offer", "Under Contract", "Closed", "Dead", "On Hold"]} />
            <Field label="Property Type" k="type" options={["Multifamily", "Single Family", "Mixed Use", "Office", "Retail", "Commercial", "Industrial", "Land"]} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Field label="Sq Ft" k="sqft" type="number" />
            <Field label="Units" k="units" type="number" />
            <Field label="Year Built" k="yearBuilt" type="number" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Lot Size (Acres)" k="lotAcres" />
            <Field label="Class" k="class" options={["", "A", "B", "C", "D"]} />
          </div>

          <p style={sectionStyle}>Acquisition <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} /></p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Asking Price" k="askingPrice" placeholder="$1,200,000" />
            <Field label="Our Offer" k="ourOffer" placeholder="$950,000" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Purchase Price" k="purchasePrice" placeholder="$950,000" />
            <Field label="Cost to Close %" k="acqCostToClose" placeholder="3" />
          </div>

          <p style={sectionStyle}>Improvements & Exit <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} /></p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Field label="Improvement Budget" k="improvementBudget" placeholder="$100,000" />
            <Field label="ARV (As Completed)" k="arvValue" placeholder="$2,500,000" />
            <Field label="Hold Period (Months)" k="months" placeholder="12" />
          </div>
          <Field label="Disposition Cost of Sale (% of ARV)" k="dispCostOfSale" placeholder="5" />

          <p style={sectionStyle}>Current Financials <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} /></p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Field label="Revenue (Annual)" k="existingRevenueAnnual" placeholder="$237,600" />
            <Field label="Expense Ratio %" k="existingExpensePct" placeholder="40" />
            <Field label="Vacancy %" k="existingVacancyPct" placeholder="5" />
          </div>

          <p style={sectionStyle}>Proforma Income <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} /></p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Field label="Revenue (Annual)" k="proformaRevenueAnnual" placeholder="$240,000" />
            <Field label="Expense Ratio %" k="proformaExpensesPct" placeholder="30" />
            <Field label="Vacancy %" k="proformaVacancy" placeholder="5" />
          </div>

          <p style={sectionStyle}>Bridge Loan <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} /></p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Acquisition Financed %" k="bridgeAcqPct" placeholder="75" />
            <Field label="Improvement Financed %" k="bridgeImprovPct" placeholder="100" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Interest Rate %" k="bridgeInterestRate" placeholder="10" />
            <Field label="Points %" k="bridgePoints" placeholder="2" />
          </div>

          <p style={sectionStyle}>Refinance <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} /></p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="% of ARV" k="refiPctARV" placeholder="75" />
            <Field label="Interest Rate %" k="refiInterestRate" placeholder="7" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Points %" k="refiPoints" placeholder="2" />
            <Field label="Term (Years)" k="refiTerm" placeholder="25" />
          </div>

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
                <h1 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.02em" }}>Deal Pipeline</h1>
                <p style={{ fontSize: 11, color: "#94a3b8", margin: "3px 0 0", fontFamily: "'DM Sans', sans-serif" }}>
                  {statusFilter !== null ? filtered.length + " " + statusFilters[statusFilter].label.toLowerCase() : deals.length + " deals"} · {fmt(totalVolume)} total volume
                </p>
              </div>
              <button onClick={() => setSearchOpen(true)} style={{ width: 36, height: 36, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2}><circle cx={11} cy={11} r={8}/><path d="m21 21-4.35-4.35"/></svg>
              </button>
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

      {/* Mobile FAB */}
      {isMobile && (
        <button onClick={onNewDeal} style={{ position: "fixed", bottom: 80, right: 16, zIndex: 99, width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(22,163,74,0.45)", WebkitTapHighlightColor: "transparent" }}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5}><path d="M12 5v14M5 12h14"/></svg>
        </button>
      )}
    </div>
  );
}

function DealDetailView({ deal, onBack, onEdit, isMobile }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef(null);
  const tabs = ["overview", "financials", "ai underwriting", "ai summary", "documents", "activity"];
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [copied, setCopied] = useState(false);

  const generateSummary = async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await fetch(SHEETS_WRITE_URL, {
        method: "POST",
        body: JSON.stringify({ action: "generate_summary", deal }),
      });
      const result = await res.json();
      if (result.success) {
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
        {activeTab === "documents" && (
          <div style={{ color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: 40, textAlign: "center", background: "#fff", borderRadius: 12, border: "1px dashed #e2e8f0" }}>
            Due diligence docs, PSA, and inspection reports will appear here.
          </div>
        )}
        {activeTab === "activity" && (
          <div style={{ color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: 40, textAlign: "center", background: "#fff", borderRadius: 12, border: "1px dashed #e2e8f0" }}>
            Deal history, notes, and team activity feed will appear here.
          </div>
        )}
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

function BuyerPipelineView({ session, isMobile, showBuyerModal, onCloseBuyerModal, onSaveBuyer, savingBuyer, editingBuyer, onSetEditingBuyer, onNewBuyer }) {
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
      const range = `${CONTACTS_SHEET_NAME}!A1:BQ`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${API_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const rows = data.values || [];
      if (rows.length < 2) { setBuyers([]); setLoading(false); return; }
      const headers = rows[0];
      const idx = (name) => headers.findIndex(h => h && h.trim() === name.trim());
      const colRowId = idx("🔒 Row ID"); const colName = idx("Contact / Name"); const colFirstName = idx("Contact / First Name");
      const colEmail = idx("Contact / Email"); const colPhone = idx("Contact / Phone"); const colType = idx("Contact / Type");
      const colBuyerStatus = idx("Buyer / Status"); const colAssetPref = idx("Contact / Asset Preference");
      const colTemperature = idx("Contact / Temperature"); const colManager = idx("Contact / Manager");
      const colNotes = idx("Contact / Notes"); const colLeadSource = idx("Contact / Lead Source");
      const colCompany = idx("Contact / Company"); const colDateAdded = idx("Date / Added");
      const colLastContact = idx("Date / Last Contact"); const colFollowUpNotes = idx("Contact / Follow Up Notes");
      const g = (row, col) => col >= 0 && col < row.length ? row[col] : "";
      const parsed = rows.slice(1).map(row => ({
        rowId: g(row, colRowId), name: g(row, colName), firstName: g(row, colFirstName),
        email: g(row, colEmail), phone: g(row, colPhone), contactType: g(row, colType),
        buyerStatus: g(row, colBuyerStatus), assetPreference: g(row, colAssetPref),
        temperature: g(row, colTemperature), manager: g(row, colManager), notes: g(row, colNotes),
        leadSource: g(row, colLeadSource), company: g(row, colCompany), dateAdded: g(row, colDateAdded),
        lastContact: g(row, colLastContact), followUpNotes: g(row, colFollowUpNotes),
      }));
      const allContacts = parsed.filter(c => c.name && c.name.trim() !== "");
      setBuyers(allContacts);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, []);

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

  var filteredDeals = deals.filter(function(d) {
    if (!searchText) return true;
    var q = searchText.toLowerCase();
    return (d.address && d.address.toLowerCase().includes(q)) || (d.city && d.city.toLowerCase().includes(q));
  });

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
            <label style={labelStyle}>Assign Deals ({selectedDeals.length} selected)</label>
            <input style={{ ...inputStyle, marginBottom: 10 }} value={searchText} onChange={function(e) { setSearchText(e.target.value); }} placeholder="Search deals by address or city..." onFocus={function(e) { e.target.style.borderColor = "#16a34a"; }} onBlur={function(e) { e.target.style.borderColor = "#e2e8f0"; }} />
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
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.address || "—"}</p>
                      <p style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: "1px 0 0" }}>{d.type || ""} · {d.city || ""}{d.state ? ", " + d.state : ""}</p>
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

function PortfolioView({ deals, isMobile, onSelectDeal, session }) {
  var [portfolios, setPortfolios] = useState([]);
  var [portfoliosLoading, setPortfoliosLoading] = useState(true);
  var [selectedPortfolio, setSelectedPortfolio] = useState(null);
  var [showCreateModal, setShowCreateModal] = useState(false);
  var [editingPortfolio, setEditingPortfolio] = useState(null);
  var [hoveredCard, setHoveredCard] = useState(null);

  var userEmail = session && session.user ? session.user.email : "";

  var fetchPortfolios = function() {
    setPortfoliosLoading(true);
    var range = "Portfolios!A1:F";
    var url = "https://sheets.googleapis.com/v4/spreadsheets/" + SPREADSHEET_ID + "/values/" + range + "?key=" + API_KEY;
    fetch(url).then(function(res) { return res.json(); }).then(function(data) {
      var rows = data.values || [];
      if (rows.length < 2) { setPortfolios([]); setPortfoliosLoading(false); return; }
      var parsed = [];
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        if (!row[1] || row[1] !== userEmail) continue;
        parsed.push({
          id: row[0] || "",
          user: row[1] || "",
          name: row[2] || "",
          type: row[3] || "Owned",
          dealAddresses: row[4] ? row[4].split("|||").filter(function(a) { return a; }) : [],
          createdAt: row[5] || "",
        });
      }
      setPortfolios(parsed);
      setPortfoliosLoading(false);
    }).catch(function(err) {
      console.error("Error fetching portfolios:", err);
      setPortfoliosLoading(false);
    });
  };

  useEffect(function() {
    if (userEmail) fetchPortfolios();
  }, [userEmail]);

  var handleCreateSave = function(data) {
    if (editingPortfolio) {
      // Edit existing portfolio via Apps Script
      fetch(SHEETS_WRITE_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "edit_portfolio",
          id: editingPortfolio.id,
          name: data.name,
          type: data.type,
          dealAddresses: data.dealAddresses,
        }),
      }).then(function(res) { return res.json(); }).then(function(result) {
        if (result.success) {
          var updatedP = Object.assign({}, editingPortfolio, data);
          setPortfolios(portfolios.map(function(p) { return p.id === editingPortfolio.id ? updatedP : p; }));
          if (selectedPortfolio && selectedPortfolio.id === editingPortfolio.id) {
            setSelectedPortfolio(updatedP);
          }
        } else {
          console.error("Edit portfolio error:", result.error);
        }
      }).catch(function(err) { console.error("Edit portfolio network error:", err); });
    } else {
      // Create new portfolio via Apps Script
      var newId = "p_" + Date.now();
      var payload = {
        action: "add_portfolio",
        id: newId,
        user: userEmail,
        name: data.name,
        type: data.type,
        dealAddresses: data.dealAddresses,
        createdAt: new Date().toISOString(),
      };
      fetch(SHEETS_WRITE_URL, {
        method: "POST",
        body: JSON.stringify(payload),
      }).then(function(res) { return res.json(); }).then(function(result) {
        if (result.success) {
          setPortfolios(portfolios.concat([result.portfolio || {
            id: newId, user: userEmail, name: data.name, type: data.type,
            dealAddresses: data.dealAddresses, createdAt: payload.createdAt,
          }]));
        } else {
          console.error("Add portfolio error:", result.error);
        }
      }).catch(function(err) { console.error("Add portfolio network error:", err); });
    }
    setShowCreateModal(false);
    setEditingPortfolio(null);
  };

  var handleDelete = function(id) {
    fetch(SHEETS_WRITE_URL, {
      method: "POST",
      body: JSON.stringify({ action: "delete_portfolio", id: id }),
    }).then(function(res) { return res.json(); }).then(function(result) {
      if (result.success) {
        setPortfolios(portfolios.filter(function(p) { return p.id !== id; }));
        if (selectedPortfolio && selectedPortfolio.id === id) setSelectedPortfolio(null);
      } else {
        console.error("Delete portfolio error:", result.error);
      }
    }).catch(function(err) { console.error("Delete portfolio network error:", err); });
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
      <PortfolioDetailView
        portfolio={selectedPortfolio}
        deals={deals}
        onBack={function() { setSelectedPortfolio(null); }}
        onEdit={function() { setEditingPortfolio(selectedPortfolio); setShowCreateModal(true); }}
        onSelectDeal={onSelectDeal}
        isMobile={isMobile}
      />
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
                <div key={p.id} onClick={function() { setSelectedPortfolio(p); }}
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
   Reads from "Markets" tab in Google Sheets
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

function MarketIntelligenceView({ deals, isMobile, session }) {
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

  // Fetch Markets tab from Google Sheets
  useEffect(() => {
    async function fetchMarkets() {
      setMarketsLoading(true);
      try {
        const range = "Markets!A1:J100";
        const url = "https://sheets.googleapis.com/v4/spreadsheets/" + SPREADSHEET_ID + "/values/" + range + "?key=" + API_KEY;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Markets tab not found");
        const data = await res.json();
        const rows = data.values || [];
        if (rows.length < 2) {
          // Fall back to computing from deals
          computeFromDeals();
          return;
        }
        const headers = rows[0];
        const idx = (name) => headers.findIndex(h => h && h.trim().toLowerCase() === name.toLowerCase());
        
        const colMarket = idx("Market");
        const colMedianPPU = idx("Median Price Per Unit");
        const colCapRate = idx("Cap Rate Avg");
        const colRentGrowth = idx("Rent Growth YoY");
        const colPopGrowth = idx("Population Growth");
        const colAiSignal = idx("AI Signal");
        const colRegion = idx("Region");
        const colDealCount = idx("Deal Count");
        const colAvgReapScore = idx("Avg REAP Score");
        const colTotalVolume = idx("Total Volume");

        const g = (row, col) => col >= 0 && col < row.length ? row[col] : "";

        const parsed = rows.slice(1).filter(row => g(row, colMarket)).map(row => ({
          market: g(row, colMarket),
          medianPPU: g(row, colMedianPPU),
          capRateAvg: g(row, colCapRate),
          rentGrowth: g(row, colRentGrowth),
          popGrowth: g(row, colPopGrowth),
          aiSignal: g(row, colAiSignal) || "Neutral",
          region: g(row, colRegion) || "Other",
          dealCount: g(row, colDealCount),
          avgReapScore: g(row, colAvgReapScore),
          totalVolume: g(row, colTotalVolume),
        }));
        setMarkets(parsed);
      } catch (err) {
        console.warn("Markets tab not found, computing from deals:", err);
        computeFromDeals();
      }
      setMarketsLoading(false);
    }

    function computeFromDeals() {
      // Aggregate deal data by city+state as fallback
      const marketMap = {};
      const userEmail = session?.user?.email || "";
      const userDeals = deals.filter(d => d.user === userEmail);
      
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
                <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0" }}>Add markets in your Google Sheets "Markets" tab</p>
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
                    No markets found. Add data to your "Markets" tab in Google Sheets, or add deals with city data.
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

function ProfileView({ session, isMobile, isSubscribed, trialDaysLeft, onCheckout, onSignOut, onClose }) {
  const user = session?.user || {};
  const email = user.email || "—";
  const fullName = user.user_metadata?.full_name || "";
  const displayName = fullName || fmtUserName(email);
  const initials = displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const createdAt = user.created_at ? fmtDate(user.created_at) : "—";
  const provider = user.app_metadata?.provider || "email";

  const SettingRow = ({ icon, label, value, action, actionLabel, danger }) => (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "16px 0", borderBottom: "1px solid #f1f5f9",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: danger ? "#fef2f2" : "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
          <div style={{ fontSize: 12, color: "#64748b", fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
        </div>
      </div>
      {action && (
        <button onClick={action} style={{
          background: danger ? "#fef2f2" : "#f8fafc", border: `1px solid ${danger ? "#fca5a5" : "#e2e8f0"}`,
          borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600,
          color: danger ? "#dc2626" : "#475569", cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", transition: "all 0.15s",
        }}>{actionLabel}</button>
      )}
    </div>
  );

  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      {/* Uniform Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: isMobile ? "14px 16px" : "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.02em" }}>Profile & Settings</h1>
          <p style={{ fontSize: isMobile ? 11 : 12, color: "#94a3b8", margin: "3px 0 0", fontFamily: "'DM Sans', sans-serif" }}>Account information</p>
        </div>
      </div>

      <div style={{ padding: isMobile ? "20px 16px" : "28px 32px", maxWidth: 640 }}>
        {/* Profile Card */}
        <div style={{
          background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0",
          padding: isMobile ? "24px 20px" : "28px 28px", marginBottom: 20,
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(135deg, #16a34a, #15803d)", borderRadius: "16px 16px 0 0" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: "linear-gradient(135deg, #16a34a, #15803d)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif",
              boxShadow: "0 4px 12px rgba(22,163,74,0.3)", flexShrink: 0,
            }}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.02em" }}>{displayName}</h2>
              <p style={{ fontSize: 13, color: "#64748b", fontFamily: "'DM Sans', sans-serif", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</p>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", fontFamily: "'DM Mono', monospace",
                  padding: "3px 8px", borderRadius: 6,
                  background: isSubscribed ? "#f0fdf4" : trialDaysLeft > 3 ? "#f0fdf4" : "#fef2f2",
                  color: isSubscribed ? "#16a34a" : trialDaysLeft > 3 ? "#16a34a" : "#dc2626",
                  border: `1px solid ${isSubscribed ? "#bbf7d0" : trialDaysLeft > 3 ? "#bbf7d0" : "#fca5a5"}`,
                }}>{isSubscribed ? "SUBSCRIBED" : trialDaysLeft > 0 ? trialDaysLeft + " DAYS LEFT" : "TRIAL EXPIRED"}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", fontFamily: "'DM Mono', monospace",
                  padding: "3px 8px", borderRadius: 6,
                  background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0",
                }}>REAP STARTER</span>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Sections */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: isMobile ? "4px 20px" : "4px 28px", marginBottom: 20 }}>
          <SettingRow
            icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
            label="Email"
            value={email}
          />
          <SettingRow
            icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
            label="Sign-in Method"
            value={provider === "google" ? "Google OAuth" : "Email & Password"}
          />
          <SettingRow
            icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
            label="Member Since"
            value={createdAt}
          />
          <SettingRow
            icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
            label="Subscription"
            value={isSubscribed ? "REAP Starter — $99/mo" : trialDaysLeft > 0 ? "Free Trial — " + trialDaysLeft + " days remaining" : "Trial expired"}
            action={!isSubscribed ? onCheckout : undefined}
            actionLabel="Upgrade"
          />
        </div>

        {/* Sign Out */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: isMobile ? "4px 20px" : "4px 28px" }}>
          <SettingRow
            icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>}
            label="Sign Out"
            value="End your current session"
            action={onSignOut}
            actionLabel="Sign Out"
            danger
          />
        </div>
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
  const [activeNav, setActiveNav] = useState("pipeline");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
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

  // Check for payment success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      localStorage.setItem("reap_subscribed", "true");
      setIsSubscribed(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Check subscription + trial status
  useEffect(() => {
    if (session?.user) {
      const subscribed = localStorage.getItem("reap_subscribed") === "true";
      setIsSubscribed(subscribed);
      const createdAt = new Date(session.user.created_at);
      const now = new Date();
      const daysSinceSignup = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
      const daysLeft = Math.max(0, TRIAL_DAYS - daysSinceSignup);
      setTrialDaysLeft(daysLeft);
      if (daysLeft <= 0 && !subscribed) {
        setShowPaywall(true);
      } else {
        setShowPaywall(false);
      }
      // Show onboarding for first-time users
      const onboarded = localStorage.getItem("reap_onboarded");
      if (!onboarded) {
        setShowOnboarding(true);
      }
    }
  }, [session]);

  const handleCheckout = () => {
    const email = session?.user?.email || "";
    window.location.href = "https://buy.stripe.com/test_dRm3cubEVgUL5CsdN963K00?prefilled_email=" + encodeURIComponent(email);
  };

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

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

  /* ═══════════════════════════════════════════════════════
     FETCH DEALS — expanded range for all financial columns
     ═══════════════════════════════════════════════════════ */
  const fetchDeals = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch ALL columns (267 columns = roughly A:JK)
      const range = `${SHEET_NAME}!A1:KZ`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${API_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const rows = data.values || [];
      if (rows.length < 2) { setDeals([]); setLoading(false); return; }

      const headers = rows[0];
      const idx = (name) => headers.findIndex(h => h && h.trim() === name.trim());

      // Core fields
      const colUser = idx("User");
      const colDate = idx("Date / Added");
      const colStatus = idx("Deal / Status");
      const colAddress = idx("Property / Address");
      const colType = idx("Type");
      const colOffer = idx("Investment / Our Offer");
      const colNetSqft = idx("Investment / Our Offer $ per SFT");
      const colSqft = idx("SQFT / Net");
      const colUnits = idx("Units");
      const colPurchase = idx("Purchase Price");
      const colImprovement = idx("Improvement / Budget");
      const colARV = idx("ARV / Value");
      const colProfit = idx("Profit");
      const colROI = idx("Investment / ROI");
      const colCTV = idx("Cost to Value / Percent (CTV)");
      const colAAR = idx("AAR");
      const colProfitability = idx("Profitability");
      const colSource = idx("Source");
      const colCity = idx("City");
      const colState = idx("State");

      // Financial fields (Step 27)
      const colCapRate = idx("Asking / Cap Rate");
      const colDSCR = idx("DSCR");
      const colNOIAnnual = idx("Proforma / Net Operating Income - Annual(NOI)");
      const colNOIMonthly = idx("Proforma / Net Operating Income - Monthly");
      const colNOIPerSF = idx("Proforma / Net Operating Income  $ per SQFT (NOI)");
      const colCashFlowMonthly = idx("Cash Flow Pre Tax (Monthly)");
      const colProformaRevenueAnnual = idx("Proforma / Revenue - Annual");
      const colProformaRevenueMonthly = idx("Proforma / Revenue - Monthly");
      const colProformaRentPerSF = idx("Proforma / Rent per SF");
      const colProformaExpensesPct = idx("Proforma / Expenses (%)");
      const colProformaExpensesAnnual = idx("Proforma / Expenses - Annual ($)");
      const colProformaExpensesMonthly = idx("Proforma / Expenses - Monthly ($)");
      const colProformaExpensesPerSF = idx("Proforma / Expenses $ per SFT");
      const colProformaVacancy = idx("Proforma / Vacancy (%)");
      const colBridgeLoanTotal = idx("Bridge / Loan Total");
      const colBridgeInterestRate = idx("Bridge / Interest Rate (%)");
      const colBridgeInterestMonthly = idx("Bridge / Interest Cost (Monthly)");
      const colBridgePoints = idx("Bridge / Points (%)");
      const colBridgeTotalCost = idx("Bridge / Total Cost");
      const colBridgeLTC = idx("Bridge / Loan to Cost (LTC)");
      const colBridgeLTV = idx("Bridge / Loan to Value (LTV)");
      const colEquityRequired = idx("Equity / Required");
      const colRefiLoanAmount = idx("Refinance / Loan Amount");
      const colRefiPctARV = idx("Refinance / % of Appraisal (ARV)");
      const colRefiInterestRate = idx("Refinance / Interest Rate (%)");
      const colRefiCashFlow = idx("Refinance / Cash Flow (Annual)");
      const colCashOutRefi = idx("Cash Out at Refi");
      const colProfitAtRefi = idx("Profit at Refi");
      const colEquityAfterRefi = idx("Equity / Left in the Deal after Refi ");
      const colRefiValuation = idx("Refinance Valuation");
      const colReapScore = idx("REAP / Score");
      // Existing Financials
      const colExistingRevenueAnnual = idx("Existing Financials / Revenue - Annual");
      const colExistingRevenueMonthly = idx("Existing Financials / Revenue - Monthly");
      const colExistingRevenuePerSF = idx("Existing Financials / Revenue Per SQFT");
      const colExistingNOI = idx("Existing Financials / Net Income (NOI)");
      const colExistingExpensePct = idx("Existing Financials / Expense Percentage");
      const colExistingExpenses = idx("Existing Expenses ($)");
      const colExistingCapRate = idx("Investment / Existing Financials / Our Offer Cap Rate");
      const colAnnualTaxes = idx("Annual Taxes (New)");
      const colInsuranceCost = idx("Insurance / Cost (Annual)");
      const colEquityMultiple = idx("Equity Multiple");
      // Edit-related fields
      const colAskingPrice = idx("Asking / Price");
      const colAcqCostToClose = idx("Acquisition / Cost to Close %");
      const colMonths = idx("Months");
      const colDispCostOfSale = idx("Disposition / Cost of Sale (% of ARV)");
      const colBridgeAcqPct = idx("Bridge / Acquisition Financed (%)");
      const colBridgeImprovPct = idx("Bridge / Improvement Financing (%)");
      const colRefiPoints = idx("Refinance / Points (%)");
      const colRefiTerm = idx("Refinance / Term (years)");
      const colLotAcres = idx("Lot / Size Acres");
      const colYearBuilt = idx("Year Built");
      const colDealName = idx("Deal / Name");
      const colZip = idx("Zip Code");
      const colClass = idx("Class");

      const g = (row, col) => col >= 0 && col < row.length ? row[col] : "";

      const parsed = rows.slice(1).map(row => ({
        // Core
        user: g(row, colUser),
        date: g(row, colDate),
        status: g(row, colStatus),
        address: g(row, colAddress),
        type: g(row, colType),
        offer: g(row, colOffer),
        netSqft: g(row, colNetSqft),
        sqft: g(row, colSqft),
        units: g(row, colUnits),
        purchasePrice: g(row, colPurchase),
        improvementBudget: g(row, colImprovement),
        arv: g(row, colARV),
        profit: g(row, colProfit),
        roi: g(row, colROI),
        ctv: g(row, colCTV),
        aar: g(row, colAAR),
        profitability: g(row, colProfitability),
        source: g(row, colSource),
        city: g(row, colCity),
        state: g(row, colState),
        // Financials
        capRate: g(row, colCapRate),
        dscr: g(row, colDSCR),
        noiAnnual: g(row, colNOIAnnual),
        noiMonthly: g(row, colNOIMonthly),
        noiPerSF: g(row, colNOIPerSF),
        cashFlowMonthly: g(row, colCashFlowMonthly),
        proformaRevenueAnnual: g(row, colProformaRevenueAnnual),
        proformaRevenueMonthly: g(row, colProformaRevenueMonthly),
        proformaRentPerSF: g(row, colProformaRentPerSF),
        proformaExpensesPct: g(row, colProformaExpensesPct),
        proformaExpensesAnnual: g(row, colProformaExpensesAnnual),
        proformaExpensesMonthly: g(row, colProformaExpensesMonthly),
        proformaExpensesPerSF: g(row, colProformaExpensesPerSF),
        proformaVacancy: g(row, colProformaVacancy),
        bridgeLoanTotal: g(row, colBridgeLoanTotal),
        bridgeInterestRate: g(row, colBridgeInterestRate),
        bridgeInterestMonthly: g(row, colBridgeInterestMonthly),
        bridgePoints: g(row, colBridgePoints),
        bridgeTotalCost: g(row, colBridgeTotalCost),
        bridgeLTC: g(row, colBridgeLTC),
        bridgeLTV: g(row, colBridgeLTV),
        equityRequired: g(row, colEquityRequired),
        refiLoanAmount: g(row, colRefiLoanAmount),
        refiPctARV: g(row, colRefiPctARV),
        refiInterestRate: g(row, colRefiInterestRate),
        refiCashFlow: g(row, colRefiCashFlow),
        cashOutRefi: g(row, colCashOutRefi),
        profitAtRefi: g(row, colProfitAtRefi),
        equityAfterRefi: g(row, colEquityAfterRefi),
        refiValuation: g(row, colRefiValuation),
        reapScore: g(row, colReapScore),
        equityMultiple: g(row, colEquityMultiple),
        // Edit-related fields
        askingPrice: g(row, colAskingPrice),
        acqCostToClose: g(row, colAcqCostToClose),
        months: g(row, colMonths),
        dispCostOfSale: g(row, colDispCostOfSale),
        bridgeAcqPct: g(row, colBridgeAcqPct),
        bridgeImprovPct: g(row, colBridgeImprovPct),
        refiPoints: g(row, colRefiPoints),
        refiTerm: g(row, colRefiTerm),
        lotAcres: g(row, colLotAcres),
        yearBuilt: g(row, colYearBuilt),
        dealName: g(row, colDealName),
        zip: g(row, colZip),
        dealClass: g(row, colClass),
        // Existing Financials
        existingRevenueAnnual: g(row, colExistingRevenueAnnual),
        existingRevenueMonthly: g(row, colExistingRevenueMonthly),
        existingRevenuePerSF: g(row, colExistingRevenuePerSF),
        existingNOI: g(row, colExistingNOI),
        existingExpensePct: g(row, colExistingExpensePct),
        existingExpenses: g(row, colExistingExpenses),
        existingCapRate: g(row, colExistingCapRate),
        annualTaxes: g(row, colAnnualTaxes),
        insuranceCost: g(row, colInsuranceCost),
      })).filter(d => d.address);

      // Filter to current user's deals only
      const currentEmail = session?.user?.email?.toLowerCase() || "";
      const userDeals = currentEmail
        ? parsed.filter(d => (d.user || "").toLowerCase() === currentEmail)
        : parsed;

      // Sort newest first
      userDeals.sort((a, b) => {
        const da = new Date(a.date);
        const db = new Date(b.date);
        if (isNaN(da.getTime()) && isNaN(db.getTime())) return 0;
        if (isNaN(da.getTime())) return 1;
        if (isNaN(db.getTime())) return -1;
        return db - da;
      });

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
     SAVE NEW DEAL — Step 24 (writes via Google Apps Script)
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

      if (SHEETS_WRITE_URL) {
        const res = await fetch(SHEETS_WRITE_URL, {
          method: "POST",
          body: JSON.stringify(dealData),
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error || "Write failed");
      } else {
        // Fallback: alert user to set up write URL
        alert("Deal saved locally. To write to Google Sheets, deploy the Apps Script and add REACT_APP_SHEETS_WRITE_URL to your .env file. See google-apps-script.js for instructions.");
      }

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
     EDIT DEAL — Step 28 (writes via Google Apps Script)
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

      if (SHEETS_WRITE_URL) {
        const res = await fetch(SHEETS_WRITE_URL, {
          method: "POST",
          body: JSON.stringify({ action: "edit_deal", address: selectedDeal.address, updates }),
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error || "Edit failed");
      }

      setShowEditDeal(false);
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
  };

  const handleBack = () => {
    if (isMobile) {
      setDealTransition(false);
      setTimeout(() => setSelectedDeal(null), 300);
    } else {
      setSelectedDeal(null);
    }
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

      if (SHEETS_WRITE_URL) {
        const payload = editingBuyer?.rowId
          ? { action: "edit_contact", rowId: editingBuyer.rowId, updates: buyerData }
          : { action: "add_contact", ...buyerData };
        const res = await fetch(SHEETS_WRITE_URL, { method: "POST", body: JSON.stringify(payload) });
        const result = await res.json();
        if (!result.success) throw new Error(result.error || "Write failed");
      }

      setShowBuyerModal(false);
      setEditingBuyer(null);
      // Force a re-render of BuyerPipelineView by briefly switching nav
      setActiveNav("pipeline");
      setTimeout(() => setActiveNav("contacts"), 50);
    } catch (err) {
      alert("Error saving buyer: " + err.message);
    } finally {
      setSavingBuyer(false);
    }
  };

  const navItems = [
    { id: "pipeline", label: "Deals", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
    { id: "contacts", label: "Contacts", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { id: "analytics", label: "Dashboard", featured: true, icon: <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
    { id: "portfolios", label: "Portfolios", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/><polyline points="2 15.5 12 8.5 22 15.5"/></svg> },
    { id: "markets", label: "Markets", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
  ];

  if (authLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTop: "3px solid #16a34a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!session) return <AuthScreen onAuth={(user) => setSession({ user })} />;

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

  const userEmail = session?.user?.email || "";
  const userName = session?.user?.user_metadata?.full_name || userEmail;
  const initials = userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

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

        {/* Main Content */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", paddingBottom: isMobile ? 70 : 0, paddingTop: !isSubscribed && trialDaysLeft > 0 ? 42 : 0, position: "relative" }}>
          {isMobile ? (
            showProfile ? (
              <ProfileView session={session} isMobile={true} isSubscribed={isSubscribed} trialDaysLeft={trialDaysLeft} onCheckout={handleCheckout} onSignOut={() => supabase.auth.signOut()} onClose={() => setShowProfile(false)} />
            ) : activeNav === "portfolios" ? (
              <PortfolioView deals={deals} isMobile={true} session={session} onSelectDeal={function(deal) { setActiveNav("pipeline"); setTimeout(function() { handleSelectDeal(deal); }, 50); }} />
            ) : activeNav === "contacts" ? (
              <BuyerPipelineView session={session} isMobile={true} showBuyerModal={showBuyerModal} onCloseBuyerModal={() => { setShowBuyerModal(false); setEditingBuyer(null); }} onSaveBuyer={handleSaveBuyer} savingBuyer={savingBuyer} editingBuyer={editingBuyer} onSetEditingBuyer={(b) => { setEditingBuyer(b); setShowBuyerModal(true); }} onNewBuyer={() => { setEditingBuyer(null); setShowBuyerModal(true); }} />
            ) : activeNav === "analytics" ? (
              <DashboardView deals={deals} loading={loading} onSelectDeal={(deal) => { setActiveNav("pipeline"); setTimeout(() => handleSelectDeal(deal), 50); }} isMobile={true} />
            ) : activeNav === "markets" ? (
              <MarketIntelligenceView deals={deals} isMobile={true} session={session} />
            ) : (
            <>
              <div style={{
                position: "absolute", inset: 0, paddingBottom: 70,
                transform: selectedDeal ? "translateX(-30%)" : "translateX(0)",
                opacity: selectedDeal ? 0 : 1,
                transition: "all 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
                pointerEvents: selectedDeal ? "none" : "auto",
                display: "flex", flexDirection: "column",
              }}>
                <PipelineView deals={deals} loading={loading} error={error} onRetry={fetchDeals} onSelectDeal={handleSelectDeal} onNewDeal={() => setShowNewDeal(true)} isMobile={true} />
              </div>
              <div style={{
                position: "absolute", inset: 0, paddingBottom: 70,
                transform: dealTransition && selectedDeal ? "translateX(0)" : "translateX(100%)",
                transition: "transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
                display: "flex", flexDirection: "column", background: "#f8fafc",
              }}>
                {selectedDeal && <DealDetailView deal={selectedDeal} onBack={handleBack} onEdit={() => setShowEditDeal(true)} isMobile={true} />}
              </div>
            </>
            )
          ) : (
            showProfile
              ? <ProfileView session={session} isMobile={false} isSubscribed={isSubscribed} trialDaysLeft={trialDaysLeft} onCheckout={handleCheckout} onSignOut={() => supabase.auth.signOut()} onClose={() => setShowProfile(false)} />
              : activeNav === "portfolios"
              ? <PortfolioView deals={deals} isMobile={false} session={session} onSelectDeal={function(deal) { setActiveNav("pipeline"); setTimeout(function() { handleSelectDeal(deal); }, 50); }} />
              : activeNav === "contacts"
              ? <BuyerPipelineView session={session} isMobile={false} showBuyerModal={showBuyerModal} onCloseBuyerModal={() => { setShowBuyerModal(false); setEditingBuyer(null); }} onSaveBuyer={handleSaveBuyer} savingBuyer={savingBuyer} editingBuyer={editingBuyer} onSetEditingBuyer={(b) => { setEditingBuyer(b); setShowBuyerModal(true); }} onNewBuyer={() => { setEditingBuyer(null); setShowBuyerModal(true); }} />
              : activeNav === "analytics"
                ? <DashboardView deals={deals} loading={loading} onSelectDeal={(deal) => { setActiveNav("pipeline"); setTimeout(() => handleSelectDeal(deal), 50); }} isMobile={false} />
                : activeNav === "markets"
                ? <MarketIntelligenceView deals={deals} isMobile={false} session={session} />
                : selectedDeal
                ? <DealDetailView deal={selectedDeal} onBack={handleBack} onEdit={() => setShowEditDeal(true)} isMobile={false} />
                : <PipelineView deals={deals} loading={loading} error={error} onRetry={fetchDeals} onSelectDeal={handleSelectDeal} onNewDeal={() => setShowNewDeal(true)} isMobile={false} />
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
            {navItems.map(item => {
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
                    <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", color: isActive ? "#16a34a" : "#16a34a", letterSpacing: "0.02em" }}>{item.label}</span>
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
            <button onClick={() => setShowProfile(true)} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              background: "none", border: "none", color: showProfile ? "#16a34a" : "#94a3b8",
              cursor: "pointer", padding: "8px 0", WebkitTapHighlightColor: "transparent",
            }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: showProfile ? "linear-gradient(135deg, #16a34a, #15803d)" : "linear-gradient(135deg, #3b82f6, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s" }}>{initials}</div>
              <span style={{ fontSize: 9, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>Profile</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
