#!/usr/bin/env node
// REAP Portfolio Tracker Patcher
// Run: node patch_portfolio.js
// Adds Portfolio Tracker as 4th nav item in REAP app

const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'src', 'App.js');

if (!fs.existsSync(appPath)) {
  console.error('ERROR: src/App.js not found. Run this from your reap-app folder.');
  process.exit(1);
}

let code = fs.readFileSync(appPath, 'utf8');

if (code.includes('PortfolioView')) {
  console.log('Already patched! Portfolio Tracker is already in App.js');
  process.exit(0);
}

// ═══════════════════════════════════════════════════════════
// PATCH 1: Add Portfolio components before ReapApp
// ═══════════════════════════════════════════════════════════

const PORTFOLIO_COMPONENTS = `

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
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: isMobile ? "14px 16px" : "18px 36px" }}>
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

      <div style={{ padding: isMobile ? "20px 16px" : "28px 36px" }}>

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
  var storageKey = "reap_portfolios_" + (session && session.user ? session.user.id : "default");
  var [portfolios, setPortfolios] = useState(function() {
    try { return JSON.parse(localStorage.getItem(storageKey)) || []; } catch(e) { return []; }
  });
  var [selectedPortfolio, setSelectedPortfolio] = useState(null);
  var [showCreateModal, setShowCreateModal] = useState(false);
  var [editingPortfolio, setEditingPortfolio] = useState(null);
  var [hoveredCard, setHoveredCard] = useState(null);

  var savePortfolios = function(updated) {
    setPortfolios(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  var handleCreateSave = function(data) {
    if (editingPortfolio) {
      var updated = portfolios.map(function(p) {
        return p.id === editingPortfolio.id ? Object.assign({}, p, data) : p;
      });
      savePortfolios(updated);
      if (selectedPortfolio && selectedPortfolio.id === editingPortfolio.id) {
        setSelectedPortfolio(Object.assign({}, editingPortfolio, data));
      }
    } else {
      var newP = Object.assign({ id: "p_" + Date.now(), createdAt: new Date().toISOString() }, data);
      savePortfolios(portfolios.concat([newP]));
    }
    setShowCreateModal(false);
    setEditingPortfolio(null);
  };

  var handleDelete = function(id) {
    savePortfolios(portfolios.filter(function(p) { return p.id !== id; }));
    if (selectedPortfolio && selectedPortfolio.id === id) setSelectedPortfolio(null);
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
      <div style={{ padding: isMobile ? "14px 16px" : "20px 36px", background: "#fff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', serif", margin: 0, letterSpacing: "-0.02em" }}>Portfolios</h1>
          <p style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: "2px 0 0" }}>{portfolios.length} portfolio{portfolios.length !== 1 ? "s" : ""}</p>
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
      <div style={{ padding: isMobile ? "16px" : "24px 36px" }}>
        {portfolios.length === 0 ? (
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
                      <button onClick={function(e) { e.stopPropagation(); if (window.confirm("Delete \\"" + p.name + "\\"?")) handleDelete(p.id); }} style={{ width: 30, height: 30, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
}`;

const marker1 = 'export default function ReapApp()';
const idx1 = code.indexOf(marker1);
if (idx1 === -1) {
  console.error('ERROR: Could not find ReapApp function.');
  process.exit(1);
}
code = code.slice(0, idx1) + PORTFOLIO_COMPONENTS + '\n\n' + code.slice(idx1);
console.log('✅ Patch 1: Added Portfolio components');

// ═══════════════════════════════════════════════════════════
// PATCH 2: Add 4th nav item (gem/diamond icon — bold + exciting)
// ═══════════════════════════════════════════════════════════

var oldNavItems = `const navItems = [
    { id: "pipeline", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
    { id: "contacts", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { id: "analytics", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  ];`;

var newNavItems = `const navItems = [
    { id: "pipeline", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
    { id: "contacts", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { id: "portfolios", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/><polyline points="2 15.5 12 8.5 22 15.5"/></svg> },
    { id: "analytics", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  ];`;

if (!code.includes(oldNavItems)) {
  console.error('ERROR: Could not find navItems array.');
  process.exit(1);
}
code = code.replace(oldNavItems, newNavItems);
console.log('✅ Patch 2: Added portfolios nav item (gem/3D icon)');

// ═══════════════════════════════════════════════════════════
// PATCH 3: Add mobile routing for portfolios
// ═══════════════════════════════════════════════════════════

var oldMobileRouting = `activeNav === "contacts" ? (
              <BuyerPipelineView session={session} isMobile={true}`;
var newMobileRouting = `activeNav === "portfolios" ? (
              <PortfolioView deals={deals} isMobile={true} session={session} onSelectDeal={function(deal) { setActiveNav("pipeline"); setTimeout(function() { handleSelectDeal(deal); }, 50); }} />
            ) : activeNav === "contacts" ? (
              <BuyerPipelineView session={session} isMobile={true}`;

if (!code.includes(oldMobileRouting)) {
  console.error('ERROR: Could not find mobile routing.');
  process.exit(1);
}
code = code.replace(oldMobileRouting, newMobileRouting);
console.log('✅ Patch 3: Added mobile routing for portfolios');

// ═══════════════════════════════════════════════════════════
// PATCH 4: Add desktop routing for portfolios
// ═══════════════════════════════════════════════════════════

var oldDesktopRouting = `activeNav === "contacts"
              ? <BuyerPipelineView session={session} isMobile={false}`;
var newDesktopRouting = `activeNav === "portfolios"
              ? <PortfolioView deals={deals} isMobile={false} session={session} onSelectDeal={function(deal) { setActiveNav("pipeline"); setTimeout(function() { handleSelectDeal(deal); }, 50); }} />
              : activeNav === "contacts"
              ? <BuyerPipelineView session={session} isMobile={false}`;

if (!code.includes(oldDesktopRouting)) {
  console.error('ERROR: Could not find desktop routing.');
  process.exit(1);
}
code = code.replace(oldDesktopRouting, newDesktopRouting);
console.log('✅ Patch 4: Added desktop routing for portfolios');

// Write patched file
fs.writeFileSync(appPath, code, 'utf8');
console.log('\n🎉 Done! Portfolio Tracker added as 4th nav item');
console.log('   Portfolios stored in localStorage per-user (Sheets migration Month 2)');
console.log('   Run "npm start" to test, then deploy with:');
console.log('   npm run build && npx gh-pages -d build');