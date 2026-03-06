import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SPREADSHEET_ID = "1GclfTHS19k1yyUYucyHBKbwWk4NarxybcA5zQEr6o8Y";
const API_KEY = "AIzaSyBOauOqljEA4HpUmSjwAxKe79OsUldNBS8";
const SHEET_NAME = "Deals";

const supabase = createClient(
  "https://cpgwnrpaflaftlxrzlar.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZ3ducnBhZmxhZnRseHJ6bGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTY3MzIsImV4cCI6MjA4ODMzMjczMn0.VHU2LCWEIwsLMc7JOeNCLOfIgrzM1b9brfesk9NFFP0"
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

function PipelineView({ deals, loading, error, onRetry, onSelectDeal }) {
  const [search, setSearch] = useState("");
  const [hoveredRow, setHoveredRow] = useState(null);

  const filtered = deals.filter(d =>
    (d.address || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.user || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.status || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.type || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalVolume = deals.reduce((s, d) => {
    const n = parseFloat(String(d.offer || "0").replace(/[$,]/g, ""));
    return s + (isNaN(n) ? 0 : n);
  }, 0);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.02em" }}>Deal Pipeline</h1>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "3px 0 0", fontFamily: "'DM Sans', sans-serif" }}>
            {deals.length} deals · {fmt(totalVolume)} total volume
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2}><circle cx={11} cy={11} r={8}/><path d="m21 21-4.35-4.35"/></svg>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search deals..."
              style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px 8px 32px", color: "#0f172a", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", width: 210 }}
            />
          </div>
          <button style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", borderRadius: 8, padding: "9px 18px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 10px rgba(22,163,74,0.35)" }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14"/></svg>
            New Deal
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f1f5f9", padding: "12px 32px", display: "flex", gap: 32 }}>
        {[
          { label: "Active", value: deals.filter(d => (d.status || "").includes("Underwriting")).length },
          { label: "Under Review", value: deals.filter(d => d.status === "Underwriting | Review").length },
          { label: "New Leads", value: deals.filter(d => d.status === "New").length },
          { label: "Lost", value: deals.filter(d => (d.status || "").includes("Lost")).length },
        ].map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Mono', monospace" }}>{s.value}</span>
            <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 32px" }}>
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
                <tr
                  key={i}
                  onClick={() => onSelectDeal(deal)}
                  onMouseEnter={() => setHoveredRow(i)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{ borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none", background: hoveredRow === i ? "#f8fafc" : "#fff", cursor: "pointer", transition: "background 0.1s" }}
                >
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ fontSize: 12, color: "#475569", fontFamily: "'DM Sans', sans-serif", background: "#f1f5f9", padding: "3px 8px", borderRadius: 6, fontWeight: 500 }}>{deal.user || "—"}</span>
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 12, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>{deal.date || "—"}</td>
                  <td style={{ padding: "13px 16px" }}><StatusBadge status={deal.status} /></td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: "#0f172a", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{deal.address || "—"}</td>
                  <td style={{ padding: "13px 16px", fontSize: 12, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>{deal.type || "—"}</td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: "#0f172a", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{fmt(deal.offer)}</td>
                  <td style={{ padding: "13px 16px", fontSize: 12, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>{deal.netSqft ? `$${deal.netSqft}` : "—"}</td>
                  <td style={{ padding: "13px 16px", fontSize: 12, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>{fmtNum(deal.sqft)}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ fontSize: 11, color: "#16a34a", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>{deal.source || "Manual"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DealDetailView({ deal, onBack }) {
  const [activeTab, setActiveTab] = useState("overview");
  const tabs = ["overview", "financials", "documents", "activity"];

  return (
    <div style={{ flex: 1, overflow: "auto", background: "#f8fafc" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "18px 36px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 5, marginBottom: 14, padding: 0, fontWeight: 500 }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back to Pipeline
        </button>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 11, color: "#16a34a", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.08em", fontWeight: 700, textTransform: "uppercase", margin: "0 0 6px" }}>{deal.type || "Property"} · {deal.city || ""} {deal.state || ""}</p>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: "0 0 10px", letterSpacing: "-0.02em" }}>{deal.address || "—"}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <StatusBadge status={deal.status} />
              {deal.user && <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>Assigned to {deal.user}</span>}
            </div>
          </div>
          <button style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", borderRadius: 8, padding: "10px 22px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 10px rgba(22,163,74,0.35)" }}>Submit Offer</button>
        </div>
      </div>

      <div style={{ padding: "28px 36px" }}>
        {/* Google Street View */}
        <div style={{ width: "100%", height: 220, borderRadius: 14, overflow: "hidden", marginBottom: 28, position: "relative", background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
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
        <div style={{ display: "flex", gap: 0, marginBottom: 28, borderBottom: "1px solid #e2e8f0" }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ background: "transparent", border: "none", borderBottom: activeTab === t ? "2px solid #16a34a" : "2px solid transparent", padding: "10px 20px", color: activeTab === t ? "#16a34a" : "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize", transition: "all 0.15s", marginBottom: -1 }}>{t}</button>
          ))}
        </div>

        {activeTab === "overview" && (
          <>
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
                Deal Overview <span style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                <MetricCard label="Purchase Price" value={fmt(deal.purchasePrice)} />
                <MetricCard label="Improvement Budget" value={fmt(deal.improvementBudget)} />
                <MetricCard label="As Completed Value" value={fmt(deal.arv)} />
                <MetricCard label="Projected Profit" value={fmt(deal.profit)} highlight />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
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
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .auth-input:focus { border-color: #16a34a !important; box-shadow: 0 0 0 3px rgba(22,163,74,0.12) !important; outline: none; }
        input::placeholder { color: #94a3b8; }
      `}</style>
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #f0fdf4 0%, #f8fafc 50%, #dcfce7 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #16a34a, #15803d)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", boxShadow: "0 4px 14px rgba(22,163,74,0.35)" }}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", letterSpacing: "-0.02em" }}>REAP | Ai</h1>
            <p style={{ fontSize: 13, color: "#64748b", fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>
              {mode === "login" ? "Sign in to your account" : mode === "signup" ? "Create your account" : "Reset your password"}
            </p>
          </div>
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0" }}>
            {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#dc2626", fontFamily: "'DM Sans', sans-serif" }}>{error}</div>}
            {success && <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#15803d", fontFamily: "'DM Sans', sans-serif" }}>{success}</div>}
            {mode === "signup" && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", fontFamily: "'DM Sans', sans-serif", display: "block", marginBottom: 6 }}>Full Name</label>
                <input className="auth-input" value={name} onChange={e => setName(e.target.value)} placeholder="Javier Suarez" style={{ width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: "#0f172a", transition: "all 0.15s" }} />
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", fontFamily: "'DM Sans', sans-serif", display: "block", marginBottom: 6 }}>Email</label>
              <input className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={{ width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: "#0f172a", transition: "all 0.15s" }} />
            </div>
            {mode !== "forgot" && (
              <div style={{ marginBottom: mode === "login" ? 8 : 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", fontFamily: "'DM Sans', sans-serif", display: "block", marginBottom: 6 }}>Password</label>
                <input className="auth-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && mode === "login" && handleLogin()} style={{ width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: "#0f172a", transition: "all 0.15s" }} />
              </div>
            )}
            {mode === "login" && (
              <div style={{ textAlign: "right", marginBottom: 20 }}>
                <button onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }} style={{ background: "none", border: "none", color: "#16a34a", fontSize: 12, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", fontWeight: 600 }}>Forgot password?</button>
              </div>
            )}
            <button onClick={mode === "login" ? handleLogin : mode === "signup" ? handleSignup : handleForgot} disabled={loading} style={{ width: "100%", background: loading ? "#86efac" : "linear-gradient(135deg, #16a34a, #15803d)", border: "none", borderRadius: 8, padding: "11px 0", color: "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 10px rgba(22,163,74,0.3)", marginBottom: 20 }}>
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Email"}
            </button>
            <div style={{ textAlign: "center", fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: "#64748b" }}>
              {mode === "login" && <>Don't have an account?{" "}<button onClick={() => { setMode("signup"); setError(""); setSuccess(""); }} style={{ background: "none", border: "none", color: "#16a34a", fontWeight: 600, cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>Sign up</button></>}
              {mode === "signup" && <>Already have an account?{" "}<button onClick={() => { setMode("login"); setError(""); setSuccess(""); }} style={{ background: "none", border: "none", color: "#16a34a", fontWeight: 600, cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>Sign in</button></>}
              {mode === "forgot" && <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }} style={{ background: "none", border: "none", color: "#16a34a", fontWeight: 600, cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>Back to sign in</button>}
            </div>
          </div>
          <p style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>© 2026 REAP | Ai · Suarez Global</p>
        </div>
      </div>
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
  const [activeNav, setActiveNav] = useState("pipeline");

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
      `}</style>
      <div style={{ display: "flex", height: "100vh", background: "#f8fafc", overflow: "hidden" }}>
        {/* Sidebar */}
        <div style={{ width: 60, background: "#fff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0", gap: 6, flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #16a34a, #15803d)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, boxShadow: "0 2px 10px rgba(22,163,74,0.3)" }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveNav(item.id)} style={{ width: 40, height: 40, borderRadius: 10, border: "none", background: activeNav === item.id ? "#f0fdf4" : "transparent", color: activeNav === item.id ? "#16a34a" : "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>{item.icon}</button>
          ))}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => supabase.auth.signOut()}
            title="Sign out"
            style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #2563eb)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}
          >{initials}</button>
        </div>

        {/* Main */}
        {selectedDeal
          ? <DealDetailView deal={selectedDeal} onBack={() => setSelectedDeal(null)} />
          : <PipelineView deals={deals} loading={loading} error={error} onRetry={fetchDeals} onSelectDeal={setSelectedDeal} />
        }
      </div>
    </>
  );
}
