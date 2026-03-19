#!/usr/bin/env node
// REAP Portfolio → Google Sheets Migration Patcher
// Run: node patch_portfolio_sheets.js
// Replaces localStorage portfolio storage with Google Sheets read/write

const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'src', 'App.js');

if (!fs.existsSync(appPath)) {
  console.error('ERROR: src/App.js not found. Run this from your reap-app folder.');
  process.exit(1);
}

let code = fs.readFileSync(appPath, 'utf8');

if (!code.includes('PortfolioView')) {
  console.error('ERROR: PortfolioView not found. Run patch_portfolio.js first.');
  process.exit(1);
}

if (code.includes('fetchPortfolios')) {
  console.log('Already patched! Portfolios are already using Google Sheets.');
  process.exit(0);
}

// ═══════════════════════════════════════════════════════════
// PATCH 1: Replace PortfolioView localStorage logic with Sheets
// ═══════════════════════════════════════════════════════════

const OLD_PORTFOLIO_STATE = `function PortfolioView({ deals, isMobile, onSelectDeal, session }) {
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
  };`;

const NEW_PORTFOLIO_STATE = `function PortfolioView({ deals, isMobile, onSelectDeal, session }) {
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
  };`;

if (!code.includes(OLD_PORTFOLIO_STATE)) {
  console.error('ERROR: Could not find PortfolioView localStorage code block. File may have been modified.');
  process.exit(1);
}

code = code.replace(OLD_PORTFOLIO_STATE, NEW_PORTFOLIO_STATE);
console.log('✅ Patch 1: Replaced localStorage with Google Sheets fetch/write');

// ═══════════════════════════════════════════════════════════
// PATCH 2: Add loading state to portfolio grid
// ═══════════════════════════════════════════════════════════

const OLD_EMPTY_STATE = `{portfolios.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px dashed #e2e8f0"`;

const NEW_EMPTY_STATE = `{portfoliosLoading ? (
          <div style={{ padding: 60, textAlign: "center" }}>
            <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTop: "3px solid #16a34a", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
            <p style={{ fontSize: 13, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>Loading portfolios...</p>
          </div>
        ) : portfolios.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px dashed #e2e8f0"`;

if (!code.includes(OLD_EMPTY_STATE)) {
  console.error('ERROR: Could not find portfolio empty state.');
  process.exit(1);
}

code = code.replace(OLD_EMPTY_STATE, NEW_EMPTY_STATE);
console.log('✅ Patch 2: Added loading spinner for portfolio fetch');

// Write
fs.writeFileSync(appPath, code, 'utf8');
console.log('\n🎉 Done! Portfolios now read/write to Google Sheets');
console.log('');
console.log('   IMPORTANT — You still need to:');
console.log('   1. Open your Google Sheet → Extensions → Apps Script');
console.log('   2. Paste the 3 new functions into Code.gs');
console.log('   3. Add the 3 action cases to your doPost function');
console.log('   4. Deploy → Manage deployments → Edit → New version → Deploy');
console.log('');
console.log('   Then test locally with "npm start" and deploy with:');
console.log('   npm run build && npx gh-pages -d build');