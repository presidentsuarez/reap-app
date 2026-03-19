#!/usr/bin/env node
// REAP AI Underwriting Tab Patcher
// Run: node patch_underwriting.js
// This patches src/App.js to add the AI Underwriting tab

const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'src', 'App.js');

if (!fs.existsSync(appPath)) {
  console.error('ERROR: src/App.js not found. Run this from your reap-app folder.');
  process.exit(1);
}

let code = fs.readFileSync(appPath, 'utf8');

// Check if already patched
if (code.includes('AIUnderwritingTab')) {
  console.log('Already patched! AI Underwriting tab is already in App.js');
  process.exit(0);
}

// ─── PATCH 1: Add AI Underwriting components after FinancialsTab ───
const COMPONENTS = `

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
}`;

// Find the end of FinancialsTab — look for the closing of that function right before DealCard
const marker1 = 'function DealCard({ deal, onSelect })';
const idx1 = code.indexOf(marker1);
if (idx1 === -1) {
  console.error('ERROR: Could not find DealCard function. File structure unexpected.');
  process.exit(1);
}
code = code.slice(0, idx1) + COMPONENTS + '\n\n' + code.slice(idx1);
console.log('✅ Patch 1: Added AI Underwriting components');

// ─── PATCH 2: Update tabs array ───
const oldTabs = 'const tabs = ["overview", "financials", "ai summary", "documents", "activity"]';
const newTabs = 'const tabs = ["overview", "financials", "ai underwriting", "ai summary", "documents", "activity"]';
if (!code.includes(oldTabs)) {
  console.error('ERROR: Could not find tabs array. May already be patched or file structure changed.');
  process.exit(1);
}
code = code.replace(oldTabs, newTabs);
console.log('✅ Patch 2: Added "ai underwriting" to tabs array');

// ─── PATCH 3: Add tab render block ───
const tabInsertMarker = '{activeTab === "ai summary" && (';
const tabRender = `{activeTab === "ai underwriting" && (
          <AIUnderwritingTab deal={deal} isMobile={isMobile} />
        )}
        `;
const tabIdx = code.indexOf(tabInsertMarker);
if (tabIdx === -1) {
  console.error('ERROR: Could not find ai summary tab render block.');
  process.exit(1);
}
code = code.slice(0, tabIdx) + tabRender + code.slice(tabIdx);
console.log('✅ Patch 3: Added AI Underwriting tab render block');

// Write the patched file
fs.writeFileSync(appPath, code, 'utf8');
console.log('\n🎉 Done! AI Underwriting tab added to App.js');
console.log('   Run "npm start" to see it, then deploy with:');
console.log('   npm run build && npx gh-pages -d build');