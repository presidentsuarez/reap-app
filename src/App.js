import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;
const API_KEY = process.env.REACT_APP_SHEETS_API_KEY;
const SHEET_NAME = "Deals";

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const STATUS_CONFIG = {
  "New":                          { color: "#16a34a", bg: "rgba(22,163,74,0.08)",   dot: "#16a34a" },
  "Data Validation":              { color: "#d97706", bg: "rgba(217,119,6,0.08)",   dot: "#d97706" },
  "Underwriting | Review":        { color: "#2563eb", bg: "rgba(37,99,235,0.08)",   dot: "#2563eb" },
  "Underwriting | Active":        { color: "#7c3aed", bg: "rgba(124,58,237,0.08)",  dot: "#7c3aed" },
  "Offer Lost / Terminated / Dead": { color: "#dc2626", bg: "rgba(220,38,38,0.07)", dot: "#dc2626" },
  "Dead / Not Moving Forward":    { color: "#dc2626", bg: "rgba(220,38,38,0.07)",   dot: "#dc2626" },
  "Declined":                     { color: "#ef4444", bg: "rgba(239,68,68,0.07)",   dot: "#ef4444" },
  "Terminated / Walked":          { color: "#dc2626", bg: "rgba(220,38,38,0.07)",   dot: "#dc2626" },
  "Sideline":                     { color: "#64748b", bg: "rgba(100,116,135,0.08)", dot: "#94a3b8" },
  "UC Not With US":               { color: "#64748b", bg: "rgba(100,116,135,0.08)", dot: "#94a3b8" },
  "Offer Prep":                   { color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  dot: "#f59e0b" },
  "Offer Submission":             { color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  dot: "#f59e0b" },
  "Under Contract / Financing":   { color: "#0891b2", bg: "rgba(8,145,178,0.08)",   dot: "#0891b2" },
  "Closed / Acquired":            { color: "#15803d", bg: "rgba(21,128,61,0.08)",   dot: "#15803d" },
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

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG["Sideline"];
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

function MetricCard({ label, value, sub, highlight, good }) {
  return (
    <div style={{
      background: highlight ? "linear-gradient(135deg, #f0fdf4, #dcfce7)" : "#ffffff",
      border: `1px solid ${highlight ? "#86efac" : "#e2e8f0"}`,
      borderRadius: 12, padding: "18px 20px",
      display: "flex", flexDirection: "column", gap: 5,
      boxShadow: highlight ? "0 2px 12px rgba(22,163,74,0.1)" : "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.07em", textTransform: "uppercase", fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, color: highlight ? "#15803d" : "#0f172a", fontFamily: "'DM Mono', monospace", letterSpacing: "-0.02em" }}>{value || "—"}</span>
      {sub && <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>{sub}</span>}
      {good !== undefined && value && value !== "—" && (
        <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 3 }}>
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="18 15 12 9 6 15"/></svg>
          Strong
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
          <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: "2px 0 0" }}>{deal.type || "—"} · {deal.date || "—"}</p>
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

function PipelineView({ deals, loading, error, onRetry, onSelectDeal, isMobile }) {
  const [search, setSearch] = useState("");
  const [hoveredRow, setHoveredRow] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus();
  }, [searchOpen]);

  const statusFilters = [
    { label: "Active", match: d => (d.status || "").includes("Underwriting") },
    { label: "Under Review", match: d => d.status === "Underwriting | Review" },
    { label: "New Leads", match: d => d.status === "New" },
    { label: "Lost", match: d => (d.status || "").includes("Lost") || (d.status || "").includes("Dead") || (d.status || "").includes("Terminated") || (d.status || "").includes("Declined") },
  ];

  const textFiltered = deals.filter(d =>
    (d.address || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.user || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.status || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.type || "").toLowerCase().includes(search.toLowerCase())
  );

  const filtered = statusFilter !== null
    ? textFiltered.filter(statusFilters[statusFilter].match)
    : textFiltered;

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
            <button style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", borderRadius: 8, padding: "9px 18px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 10px rgba(22,163,74,0.35)", whiteSpace: "nowrap" }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14"/></svg>
              New Deal
            </button>
          </div>
        </div>
      )}

      {/* Summary Strip — tappable to filter on mobile */}
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
                    <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>No deals found</td></tr>
                ) : filtered.map((deal, i) => (
                  <tr key={i} onClick={() => onSelectDeal(deal)} onMouseEnter={() => setHoveredRow(i)} onMouseLeave={() => setHoveredRow(null)} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none", background: hoveredRow === i ? "#f8fafc" : "#fff", cursor: "pointer", transition: "background 0.1s" }}>
                    <td style={{ padding: "13px 16px" }}><span style={{ fontSize: 12, color: "#475569", fontFamily: "'DM Sans', sans-serif", background: "#f1f5f9", padding: "3px 8px", borderRadius: 6, fontWeight: 500 }}>{deal.user || "—"}</span></td>
                    <td style={{ padding: "13px 16px", fontSize: 12, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>{deal.date || "—"}</td>
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
        <button style={{ position: "fixed", bottom: 80, right: 16, zIndex: 99, width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(22,163,74,0.45)", WebkitTapHighlightColor: "transparent" }}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5}><path d="M12 5v14M5 12h14"/></svg>
        </button>
      )}
    </div>
  );
}

function DealDetailView({ deal, onBack, isMobile }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef(null);
  const tabs = ["overview", "financials", "documents", "activity"];

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
      {/* Sticky collapsed header — mobile only, appears on scroll */}
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
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: isMobile ? "14px 16px" : "18px 36px" }}>
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
              {deal.user && <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>Assigned to {deal.user}</span>}
            </div>
          </div>
          <button style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", borderRadius: 8, padding: isMobile ? "10px 18px" : "10px 22px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 10px rgba(22,163,74,0.35)", whiteSpace: "nowrap", alignSelf: isMobile ? "stretch" : "auto", textAlign: "center" }}>Submit Offer</button>
        </div>
      </div>

      <div style={{ padding: isMobile ? "20px 16px" : "28px 36px" }}>
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
                <MetricCard label="Projected Profit" value={fmt(deal.profit)} highlight />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
                <MetricCard label="ROI" value={deal.roi ? `${deal.roi}%` : "—"} good highlight />
                <MetricCard label="Cost / Value" value={deal.ctv ? `${deal.ctv}%` : "—"} good />
                <MetricCard label="Avg Annual Return" value={deal.aar ? `${deal.aar}%` : "—"} good />
                <MetricCard label="Profitability" value={deal.profitability ? `${deal.profitability}%` : "—"} good />
              </div>
            </section>
          </>
        )}

        {activeTab === "financials" && (
          <div style={{ color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: 40, textAlign: "center", background: "#fff", borderRadius: 12, border: "1px dashed #e2e8f0" }}>
            Cash flow model, rent rolls, and pro forma will appear here.
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
          {/* Orbs */}
          <div style={{ position: "fixed", top: -80, right: -60, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 65%)", pointerEvents: "none", animation: "float1 8s ease-in-out infinite" }} />
          <div style={{ position: "fixed", bottom: -40, left: -40, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 65%)", pointerEvents: "none", animation: "float2 10s ease-in-out infinite" }} />

          {/* Grid pattern */}
          <div style={{ position: "fixed", inset: 0, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.02) 1px, transparent 0)", backgroundSize: "24px 24px", pointerEvents: "none" }} />

          {/* Top branding section */}
          <div style={{ position: "relative", zIndex: 1, padding: "48px 28px 0", textAlign: "center",
            opacity: pageLoaded ? 1 : 0, transform: pageLoaded ? "translateY(0)" : "translateY(16px)",
            transition: "all 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
          }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", animation: "pulseGlow 3s ease-in-out infinite" }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
              </div>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>REAP</span>
            </div>

            {/* Headline */}
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 600, color: "#fff", lineHeight: 1.15, margin: "0 auto", letterSpacing: "-0.02em", maxWidth: 300 }}>
              Smarter real estate decisions, powered <span style={{ color: "#22C55E" }}>by AI</span>
            </h1>

            {/* Mini stats */}
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

          {/* Form card */}
          <div style={{
            position: "relative", zIndex: 1,
            margin: "28px 20px 0", padding: "28px 24px 32px",
            background: "#fff", borderRadius: 20,
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            opacity: pageLoaded ? 1 : 0,
            transform: pageLoaded ? "translateY(0)" : "translateY(24px)",
            transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s",
          }}>
            {/* Form header */}
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

          {/* Mobile footer */}
          <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "center", gap: 20, marginTop: 28, fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif" }}>
            <span>© 2026 REAP Analytics</span>
            <a href="https://getreap.ai" style={{ color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>Privacy</a>
            <a href="https://getreap.ai" style={{ color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>Terms</a>
          </div>
        </div>

      ) : (
        /* ─── DESKTOP LAYOUT ─── */
        <div style={{ display: "flex", minHeight: "100vh", height: "100vh", fontFamily: "'DM Sans', sans-serif", background: "#F8FAF9", overflow: "hidden" }}>

          {/* ─── LEFT PANEL ─── */}
          <div style={{
            flex: "0 0 50%", position: "relative", overflow: "hidden",
            background: "linear-gradient(160deg, #051E15 0%, #0B3D2C 35%, #0E4D37 70%, #0A3425 100%)",
            backgroundSize: "200% 200%", animation: "gradientShift 12s ease infinite",
            display: "flex", flexDirection: "column", justifyContent: "space-between",
            padding: "48px 56px",
          }}>
            {/* Animated gradient orbs */}
            <div style={{ position: "absolute", top: -100, right: -60, width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,197,94,0.18) 0%, transparent 65%)", pointerEvents: "none", animation: "float1 8s ease-in-out infinite" }} />
            <div style={{ position: "absolute", bottom: -60, left: -40, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,197,94,0.1) 0%, transparent 65%)", pointerEvents: "none", animation: "float2 10s ease-in-out infinite" }} />
            <div style={{ position: "absolute", top: "40%", left: "50%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 65%)", pointerEvents: "none", animation: "float3 7s ease-in-out infinite" }} />

            {/* Grid pattern */}
            <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.025) 1px, transparent 0)", backgroundSize: "28px 28px", pointerEvents: "none" }} />

            {/* Top: Logo */}
            <div style={{ position: "relative", zIndex: 1, opacity: pageLoaded ? 1 : 0, transform: pageLoaded ? "translateY(0)" : "translateY(-12px)", transition: "all 0.6s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", animation: "pulseGlow 3s ease-in-out infinite" }}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                </div>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>REAP</span>
              </div>
            </div>

            {/* Middle: Headline + Stats */}
            <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ opacity: pageLoaded ? 1 : 0, transform: pageLoaded ? "translateY(0)" : "translateY(20px)", transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s" }}>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 42, fontWeight: 600, color: "#fff", lineHeight: 1.12, margin: 0, letterSpacing: "-0.025em" }}>
                  Smarter real estate<br />decisions, powered<br /><span style={{ color: "#22C55E" }}>by AI</span>
                </h1>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.65, margin: "18px 0 0 0", maxWidth: 380 }}>
                  Underwrite deals in minutes, track portfolios in real-time, and uncover opportunities others miss.
                </p>
              </div>

              {/* Stat cards */}
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
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>{stat.label}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 24, fontWeight: 500, color: stat.accent ? "#22C55E" : "#fff", letterSpacing: "-0.02em" }}>{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom: Trust bar */}
            <div style={{ position: "relative", zIndex: 1, opacity: pageLoaded ? 1 : 0, transition: "opacity 1s ease 1.2s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex" }}>
                  {["JT", "MK", "AS", "RD"].map((initials, i) => (
                    <div key={i} style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: ["rgba(34,197,94,0.35)", "rgba(59,130,246,0.35)", "rgba(168,85,247,0.35)", "rgba(249,115,22,0.35)"][i],
                      border: "2px solid rgba(11,61,44,0.8)", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.85)",
                      fontFamily: "'DM Sans', sans-serif", marginLeft: i > 0 ? -7 : 0,
                    }}>{initials}</div>
                  ))}
                </div>
                <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif" }}>
                  <strong style={{ color: "rgba(255,255,255,0.65)" }}>2,500+</strong> investors already growing with REAP
                </span>
              </div>
            </div>
          </div>

          {/* ─── RIGHT PANEL ─── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "40px 56px", position: "relative", overflow: "auto" }}>
            <div style={{
              width: "100%", maxWidth: 400,
              opacity: pageLoaded ? 1 : 0,
              transform: pageLoaded ? "translateX(0)" : "translateX(24px)",
              transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.35s",
            }}>
              {/* Header */}
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 600, color: "#1A2E22", margin: 0, letterSpacing: "-0.02em" }}>
                  {mode === "login" && "Welcome back"}
                  {mode === "signup" && "Create your account"}
                  {mode === "forgot" && "Reset your password"}
                </h2>
                <p style={{ fontSize: 14.5, color: "#8A9B91", margin: "8px 0 0 0", lineHeight: 1.5 }}>
                  {mode === "login" && "Sign in to access your deal pipeline and analytics."}
                  {mode === "signup" && "Start analyzing deals in under 3 minutes."}
                  {mode === "forgot" && "Enter your email and we'll send you a reset link."}
                </p>
              </div>
              {formContent}
            </div>

            {/* Desktop footer */}
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

  const fetchDeals = async () => {
    setLoading(true);
    setError(null);
    try {
      const range = `${SHEET_NAME}!A:Z`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${API_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const rows = data.values || [];
      if (rows.length < 2) { setDeals([]); setLoading(false); return; }

      const headers = rows[0];
      const idx = (name) => headers.findIndex(h => h && h.trim() === name.trim());

      // Map column indices
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

      const parsed = rows.slice(1).map(row => ({
        user: row[colUser] || "",
        date: row[colDate] || "",
        status: row[colStatus] || "",
        address: row[colAddress] || "",
        type: row[colType] || "",
        offer: row[colOffer] || "",
        netSqft: row[colNetSqft] || "",
        sqft: row[colSqft] || "",
        units: row[colUnits] || "",
        purchasePrice: row[colPurchase] || "",
        improvementBudget: row[colImprovement] || "",
        arv: row[colARV] || "",
        profit: row[colProfit] || "",
        roi: row[colROI] || "",
        ctv: row[colCTV] || "",
        aar: row[colAAR] || "",
        profitability: row[colProfitability] || "",
        source: row[colSource] || "",
        city: row[colCity] || "",
        state: row[colState] || "",
      })).filter(d => d.address);

      setDeals(parsed);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDeals(); }, []);

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

  const navItems = [
    { id: "pipeline", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
    { id: "analytics", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
    { id: "team", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  ];

  if (authLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTop: "3px solid #16a34a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!session) return <AuthScreen onAuth={(user) => setSession({ user })} />;

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
      `}</style>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", height: "100vh", background: "#f8fafc", overflow: "hidden" }}>
        {/* Desktop Sidebar */}
        {!isMobile && (
          <div style={{ width: 60, background: "#fff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0", gap: 6, flexShrink: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #16a34a, #15803d)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, boxShadow: "0 2px 10px rgba(22,163,74,0.3)" }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
            {navItems.map(item => (
              <button key={item.id} onClick={() => setActiveNav(item.id)} style={{ width: 40, height: 40, borderRadius: 10, border: "none", background: activeNav === item.id ? "#f0fdf4" : "transparent", color: activeNav === item.id ? "#16a34a" : "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>{item.icon}</button>
            ))}
            <div style={{ flex: 1 }} />
            <button onClick={() => supabase.auth.signOut()} title="Sign out" style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #2563eb)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>{initials}</button>
          </div>
        )}

        {/* Main Content */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", paddingBottom: isMobile ? 64 : 0, position: "relative" }}>
          {isMobile ? (
            <>
              {/* Pipeline — slides left when deal selected */}
              <div style={{
                position: "absolute", inset: 0, paddingBottom: 64,
                transform: selectedDeal ? "translateX(-30%)" : "translateX(0)",
                opacity: selectedDeal ? 0 : 1,
                transition: "all 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
                pointerEvents: selectedDeal ? "none" : "auto",
                display: "flex", flexDirection: "column",
              }}>
                <PipelineView deals={deals} loading={loading} error={error} onRetry={fetchDeals} onSelectDeal={handleSelectDeal} isMobile={true} />
              </div>
              {/* Deal Detail — slides in from right */}
              <div style={{
                position: "absolute", inset: 0, paddingBottom: 64,
                transform: dealTransition && selectedDeal ? "translateX(0)" : "translateX(100%)",
                transition: "transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
                display: "flex", flexDirection: "column", background: "#f8fafc",
              }}>
                {selectedDeal && <DealDetailView deal={selectedDeal} onBack={handleBack} isMobile={true} />}
              </div>
            </>
          ) : (
            selectedDeal
              ? <DealDetailView deal={selectedDeal} onBack={handleBack} isMobile={false} />
              : <PipelineView deals={deals} loading={loading} error={error} onRetry={fetchDeals} onSelectDeal={handleSelectDeal} isMobile={false} />
          )}
        </div>

        {/* Mobile Bottom Nav with sliding indicator */}
        {isMobile && (
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, height: 64,
            background: "#fff", borderTop: "1px solid #e2e8f0",
            display: "flex", alignItems: "center", justifyContent: "space-around",
            padding: "0 8px", zIndex: 100,
            boxShadow: "0 -2px 12px rgba(0,0,0,0.04)",
          }}>
            <div style={{
              position: "absolute", top: 0, left: 0, height: 2,
              width: (100 / (navItems.length + 1)) + "%",
              background: "#16a34a", borderRadius: "0 0 2px 2px",
              transform: "translateX(" + (navItems.findIndex(n => n.id === activeNav) * 100) + "%)",
              transition: "transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
            }} />
            {navItems.map(item => (
              <button key={item.id} onClick={() => setActiveNav(item.id)} style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                background: "none", border: "none",
                color: activeNav === item.id ? "#16a34a" : "#94a3b8",
                cursor: "pointer", padding: "8px 0",
                transition: "color 0.2s", WebkitTapHighlightColor: "transparent",
              }}>
                {item.icon}
                <span style={{ fontSize: 9, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize" }}>{item.id}</span>
              </button>
            ))}
            <button onClick={() => supabase.auth.signOut()} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              background: "none", border: "none", color: "#94a3b8",
              cursor: "pointer", padding: "8px 0", WebkitTapHighlightColor: "transparent",
            }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>{initials}</div>
              <span style={{ fontSize: 9, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>Account</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
