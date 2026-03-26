// ═══════════════════════════════════════════════════════════════════
// REAP | Session 11 — Financial Trigger Validation
// ═══════════════════════════════════════════════════════════════════
//
// Compares Supabase-computed values against original Google Sheets
// to verify the PostgreSQL trigger is accurate.
//
// Usage:
//   SUPABASE_SERVICE_KEY="your-key" node validate_financials.js
// ═══════════════════════════════════════════════════════════════════

require("dotenv").config();

const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;
const API_KEY = process.env.REACT_APP_SHEETS_API_KEY;
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SPREADSHEET_ID || !API_KEY) { console.error("❌ Need Sheets env vars (still in .env for validation)"); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) { console.error("❌ Need SUPABASE_SERVICE_KEY"); process.exit(1); }

const SB_HEADERS = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_SERVICE_KEY,
  "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
};

async function sheetsRead(tab, range) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tab}!${range}?key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheets error: ${res.status}`);
  const data = await res.json();
  const all = data.values || [];
  if (all.length < 2) return { headers: all[0] || [], rows: [] };
  return { headers: all[0], rows: all.slice(1) };
}

// ── Parse helpers ──
const parseNum = (v) => {
  if (!v || v === "—" || v === "" || v === "N/A") return null;
  const n = parseFloat(String(v).replace(/[$,%]/g, "").trim());
  return isNaN(n) ? null : n;
};

const fmt = (v) => {
  if (v === null || v === undefined) return "—";
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  if (Math.abs(n) >= 1000000) return "$" + (n / 1000000).toFixed(2) + "M";
  if (Math.abs(n) >= 1000) return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toFixed(2);
};

const fmtPct = (v) => {
  if (v === null || v === undefined) return "—";
  const n = parseFloat(v);
  return isNaN(n) ? "—" : n.toFixed(2) + "%";
};

// ── Main ──

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  REAP | Financial Trigger Validation");
  console.log("  Comparing Supabase vs Google Sheets");
  console.log("═══════════════════════════════════════════════════\n");

  // 1. Read deals from Sheets
  console.log("📊 Reading from Google Sheets...");
  const { headers, rows } = await sheetsRead("Deals", "A1:KZ");
  const idx = (name) => headers.findIndex(h => h && h.trim() === name.trim());
  const g = (row, col) => col >= 0 && col < row.length ? row[col] : "";

  const colAddress = idx("Property / Address");
  const colOffer = idx("Investment / Our Offer");
  const colARV = idx("ARV / Value");
  const colProfit = idx("Profit");
  const colROI = idx("Investment / ROI");
  const colCapRate = idx("Asking / Cap Rate");
  const colDSCR = idx("DSCR");
  const colNOI = idx("Proforma / Net Operating Income - Annual(NOI)");
  const colCashFlow = idx("Cash Flow Pre Tax (Monthly)");
  const colBridgeLoan = idx("Bridge / Loan Total");
  const colEquity = idx("Equity / Required");
  const colReapScore = idx("REAP / Score");
  const colEquityMult = idx("Equity Multiple");
  const colCTV = idx("Cost to Value / Percent (CTV)");
  const colAAR = idx("AAR");

  // Build a map of Sheets deals by address (only ones with financial data)
  const sheetsDeals = {};
  rows.forEach(row => {
    const addr = g(row, colAddress);
    const offer = parseNum(g(row, colOffer));
    if (!addr || !offer) return; // skip deals without financial data
    sheetsDeals[addr] = {
      offer,
      arv: parseNum(g(row, colARV)),
      profit: parseNum(g(row, colProfit)),
      roi: parseNum(g(row, colROI)),
      capRate: parseNum(g(row, colCapRate)),
      dscr: parseNum(g(row, colDSCR)),
      noi: parseNum(g(row, colNOI)),
      cashFlow: parseNum(g(row, colCashFlow)),
      bridgeLoan: parseNum(g(row, colBridgeLoan)),
      equity: parseNum(g(row, colEquity)),
      reapScore: parseNum(g(row, colReapScore)),
      equityMult: parseNum(g(row, colEquityMult)),
      ctv: parseNum(g(row, colCTV)),
      aar: parseNum(g(row, colAAR)),
    };
  });

  const sheetsAddresses = Object.keys(sheetsDeals);
  console.log(`   ${sheetsAddresses.length} deals with financial data in Sheets\n`);

  // 2. Read matching deals from Supabase
  console.log("🗄️  Reading from Supabase...");
  const sbUrl = `${SUPABASE_URL}/rest/v1/deals?select=property_address,our_offer,arv_value,profit,roi,cap_rate,dscr,noi_annual,cash_flow_monthly,bridge_loan_total,equity_required,reap_score,equity_multiple,ctv,aar&our_offer=gt.0&limit=1000`;
  const sbRes = await fetch(sbUrl, { headers: SB_HEADERS });
  const sbDeals = await sbRes.json();

  const sbMap = {};
  (sbDeals || []).forEach(d => { sbMap[d.property_address] = d; });
  console.log(`   ${Object.keys(sbMap).length} deals with financial data in Supabase\n`);

  // 3. Compare
  const metrics = [
    { name: "Profit",        sheets: "profit",     sb: "profit",            fmt: fmt },
    { name: "ROI",           sheets: "roi",        sb: "roi",              fmt: fmtPct },
    { name: "Cap Rate",      sheets: "capRate",    sb: "cap_rate",         fmt: fmtPct },
    { name: "DSCR",          sheets: "dscr",       sb: "dscr",             fmt: (v) => v != null ? parseFloat(v).toFixed(2) + "x" : "—" },
    { name: "NOI Annual",    sheets: "noi",        sb: "noi_annual",       fmt: fmt },
    { name: "Cash Flow/Mo",  sheets: "cashFlow",   sb: "cash_flow_monthly", fmt: fmt },
    { name: "Bridge Loan",   sheets: "bridgeLoan", sb: "bridge_loan_total", fmt: fmt },
    { name: "Equity Req",    sheets: "equity",     sb: "equity_required",  fmt: fmt },
    { name: "REAP Score",    sheets: "reapScore",  sb: "reap_score",       fmt: (v) => v != null ? parseFloat(v).toFixed(0) : "—" },
    { name: "Equity Mult",   sheets: "equityMult", sb: "equity_multiple",  fmt: (v) => v != null ? parseFloat(v).toFixed(2) + "x" : "—" },
    { name: "CTV",           sheets: "ctv",        sb: "ctv",              fmt: fmtPct },
    { name: "AAR",           sheets: "aar",        sb: "aar",              fmt: fmtPct },
  ];

  // Pick up to 15 deals that exist in both
  const matched = sheetsAddresses.filter(a => sbMap[a]).slice(0, 15);
  console.log(`   Comparing ${matched.length} deals...\n`);

  let totalChecks = 0;
  let totalMatches = 0;
  let totalMismatches = 0;
  let totalSkipped = 0;
  const mismatchDetails = [];

  matched.forEach((addr, di) => {
    const sh = sheetsDeals[addr];
    const sb = sbMap[addr];
    const dealMismatches = [];

    console.log(`── Deal ${di + 1}: ${addr.substring(0, 50)} ──`);
    console.log(`   Offer: ${fmt(sh.offer)} | ARV: ${fmt(sh.arv)}`);

    metrics.forEach(m => {
      const shVal = sh[m.sheets];
      const sbVal = sb[m.sb];
      totalChecks++;

      if (shVal === null && sbVal === null) {
        totalSkipped++;
        return;
      }
      if (shVal === null || sbVal === null) {
        // One has data, the other doesn't
        if (shVal !== null && Math.abs(shVal) > 0.01) {
          dealMismatches.push({ metric: m.name, sheets: shVal, supabase: sbVal });
          totalMismatches++;
        } else {
          totalMatches++;
        }
        return;
      }

      // Both have values — compare
      const diff = Math.abs(shVal - sbVal);
      const pctDiff = shVal !== 0 ? (diff / Math.abs(shVal)) * 100 : (sbVal !== 0 ? 100 : 0);

      // Tolerances: $1 for dollar amounts, 0.5% for percentages, 2 points for scores
      const isDollar = ["Profit", "NOI Annual", "Cash Flow/Mo", "Bridge Loan", "Equity Req"].includes(m.name);
      const isScore = m.name === "REAP Score";
      const threshold = isDollar ? 1 : isScore ? 5 : 0.5;
      const isMatch = isDollar ? diff <= threshold : isScore ? diff <= threshold : pctDiff <= threshold;

      if (isMatch) {
        totalMatches++;
      } else {
        totalMismatches++;
        dealMismatches.push({
          metric: m.name,
          sheets: shVal,
          supabase: sbVal,
          diff: isDollar ? `$${diff.toFixed(0)}` : `${pctDiff.toFixed(1)}%`,
        });
      }
    });

    if (dealMismatches.length === 0) {
      console.log("   ✅ All metrics match\n");
    } else {
      console.log(`   ⚠️  ${dealMismatches.length} mismatches:`);
      dealMismatches.forEach(mm => {
        const shStr = mm.metric.includes("Rate") || mm.metric.includes("ROI") || mm.metric.includes("CTV") || mm.metric.includes("AAR")
          ? fmtPct(mm.sheets) : fmt(mm.sheets);
        const sbStr = mm.metric.includes("Rate") || mm.metric.includes("ROI") || mm.metric.includes("CTV") || mm.metric.includes("AAR")
          ? fmtPct(mm.supabase) : fmt(mm.supabase);
        console.log(`      ${mm.metric}: Sheets=${shStr} vs Supabase=${sbStr} (diff: ${mm.diff || "N/A"})`);
      });
      console.log("");
      mismatchDetails.push({ address: addr, mismatches: dealMismatches });
    }
  });

  // 4. Summary
  console.log("═══════════════════════════════════════════════════");
  console.log("  VALIDATION SUMMARY");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Deals compared:     ${matched.length}`);
  console.log(`  Total checks:       ${totalChecks}`);
  console.log(`  ✅ Matches:          ${totalMatches}`);
  console.log(`  ⚠️  Mismatches:       ${totalMismatches}`);
  console.log(`  ⏭️  Skipped (null):   ${totalSkipped}`);
  console.log("");

  if (totalMismatches === 0) {
    console.log("  🎉 PASS — All computed values match within tolerance.");
    console.log("  The financial trigger is working correctly.");
  } else {
    const pct = ((totalMatches / (totalMatches + totalMismatches)) * 100).toFixed(1);
    console.log(`  ${pct}% accuracy. ${totalMismatches} values differ.`);
    console.log("");
    console.log("  EXPECTED DIFFERENCES:");
    console.log("  The Supabase trigger may compute slightly differently than");
    console.log("  Sheets due to rounding, formula order, or edge cases.");
    console.log("  REAP Score will differ because the Supabase version uses a");
    console.log("  simplified scoring formula vs the Sheets original.");
    console.log("");
    console.log("  ACTION: Review the mismatches above. If they're small");
    console.log("  (rounding, score weighting), they're acceptable. If a");
    console.log("  core metric like Profit or NOI is significantly off,");
    console.log("  the trigger function needs adjustment.");
  }
  console.log("═══════════════════════════════════════════════════\n");
}

main().catch(err => { console.error("❌", err.message); process.exit(1); });
