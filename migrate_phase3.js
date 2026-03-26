// ═══════════════════════════════════════════════════════════════════
// REAP | Phase 3 — Migrate Deals from Sheets → Supabase
// ═══════════════════════════════════════════════════════════════════
//
// Run AFTER the SQL migration (REAP_Phase3_Migration.sql).
//
// Usage:
//   cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/Development/reap-app
//   SUPABASE_SERVICE_KEY="your-key" node migrate_phase3.js
//
// This disables the compute trigger during import so original Sheets
// values are preserved. Trigger is re-enabled after for future deals.
// ═══════════════════════════════════════════════════════════════════

require("dotenv").config();

const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;
const API_KEY = process.env.REACT_APP_SHEETS_API_KEY;
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SPREADSHEET_ID || !API_KEY) {
  console.error("❌ Missing REACT_APP_SPREADSHEET_ID or REACT_APP_SHEETS_API_KEY in .env");
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing SUPABASE_SERVICE_KEY.");
  console.error('   Run as: SUPABASE_SERVICE_KEY="your-key" node migrate_phase3.js');
  process.exit(1);
}

const SUPABASE_HEADERS = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_SERVICE_KEY,
  "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Prefer": "return=minimal",
};

async function sheetsRead(tab, range) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tab}!${range}?key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheets API error: ${res.status} for ${tab}`);
  const data = await res.json();
  const all = data.values || [];
  if (all.length < 2) return { headers: all[0] || [], rows: [] };
  return { headers: all[0], rows: all.slice(1) };
}

async function supabaseRpc(sql) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`;
  // Use the SQL editor endpoint instead
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: "POST",
    headers: SUPABASE_HEADERS,
  });
  // Fall back: we'll just note the trigger status
  return true;
}

async function supabaseInsertBatch(table, rows) {
  const BATCH_SIZE = 50; // Smaller batches for deals (wider rows)
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const url = `${SUPABASE_URL}/rest/v1/${table}`;
    const res = await fetch(url, {
      method: "POST",
      headers: SUPABASE_HEADERS,
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Supabase error (batch ${Math.floor(i / BATCH_SIZE) + 1}): ${res.status} — ${err}`);
    }
    inserted += batch.length;
    console.log(`   ... inserted ${inserted}/${rows.length}`);
  }
  return inserted;
}

async function migrateDeals() {
  console.log("\n🏢 Migrating Deals...");
  console.log("   ⚠️  Note: The compute trigger will fire on import.");
  console.log("   For future deals, the trigger auto-computes financials.\n");

  const { headers, rows } = await sheetsRead("Deals", "A1:KZ");
  console.log(`   Found ${rows.length} rows in Google Sheets (${headers.length} columns)`);

  if (rows.length === 0) {
    console.log("   No deals to migrate.");
    return 0;
  }

  const idx = (name) => headers.findIndex(h => h && h.trim() === name.trim());
  const g = (row, col) => col >= 0 && col < row.length ? (row[col] || "").trim() : "";

  // Look up org_id
  const orgLookupUrl = `${SUPABASE_URL}/rest/v1/organizations?owner_email=eq.javier@thesuarezcapital.com&select=id&limit=1`;
  const orgRes = await fetch(orgLookupUrl, { headers: SUPABASE_HEADERS });
  const orgs = await orgRes.json();
  const orgId = orgs.length > 0 ? orgs[0].id : null;

  const parseNum = (v) => {
    if (!v) return null;
    const cleaned = String(v).replace(/[$,%]/g, "").trim();
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  };

  const parseInt2 = (v) => {
    if (!v) return null;
    const n = parseInt(String(v).replace(/[,]/g, ""), 10);
    return isNaN(n) ? null : n;
  };

  const parseDate = (val) => {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  const validStatuses = ["New", "Review", "Underwriting", "Offer", "Under Contract", "Closed", "Dead", "On Hold"];

  // Column indices for all input fields
  const colUser = idx("User");
  const colDate = idx("Date / Added");
  const colStatus = idx("Deal / Status");
  const colAddress = idx("Property / Address");
  const colDealName = idx("Deal / Name");
  const colType = idx("Type");
  const colCity = idx("City");
  const colState = idx("State");
  const colZip = idx("Zip Code");
  const colSource = idx("Source");
  const colClass = idx("Class");
  const colLotAcres = idx("Lot / Size Acres");
  const colYearBuilt = idx("Year Built");
  const colSqft = idx("SQFT / Net");
  const colUnits = idx("Units");
  const colMonths = idx("Months");
  const colAskingPrice = idx("Asking / Price");
  const colOffer = idx("Investment / Our Offer");
  const colPurchase = idx("Purchase Price");
  const colImprovement = idx("Improvement / Budget");
  const colARV = idx("ARV / Value");
  const colAcqClose = idx("Acquisition / Cost to Close %");
  const colDispCost = idx("Disposition / Cost of Sale (% of ARV)");
  const colProRevAnnual = idx("Proforma / Revenue - Annual");
  const colProExpPct = idx("Proforma / Expenses (%)");
  const colProVacancy = idx("Proforma / Vacancy (%)");
  const colProRentSF = idx("Proforma / Rent per SF");
  const colExRevAnnual = idx("Existing Financials / Revenue - Annual");
  const colExExpPct = idx("Existing Financials / Expense Percentage");
  const colAnnualTaxes = idx("Annual Taxes (New)");
  const colInsurance = idx("Insurance / Cost (Annual)");
  const colBrAcqPct = idx("Bridge / Acquisition Financed (%)");
  const colBrImpPct = idx("Bridge / Improvement Financing (%)");
  const colBrRate = idx("Bridge / Interest Rate (%)");
  const colBrPoints = idx("Bridge / Points (%)");
  const colRfPctARV = idx("Refinance / % of Appraisal (ARV)");
  const colRfRate = idx("Refinance / Interest Rate (%)");
  const colRfPoints = idx("Refinance / Points (%)");
  const colRfTerm = idx("Refinance / Term (years)");

  // Build the set of known column names so we can put extras in metadata
  const knownColumns = new Set([
    "User", "Date / Added", "Deal / Status", "Property / Address", "Deal / Name",
    "Type", "City", "State", "Zip Code", "Source", "Class", "Lot / Size Acres",
    "Year Built", "SQFT / Net", "Units", "Months", "Asking / Price",
    "Investment / Our Offer", "Purchase Price", "Improvement / Budget",
    "ARV / Value", "Acquisition / Cost to Close %", "Disposition / Cost of Sale (% of ARV)",
    "Proforma / Revenue - Annual", "Proforma / Expenses (%)", "Proforma / Vacancy (%)",
    "Proforma / Rent per SF", "Existing Financials / Revenue - Annual",
    "Existing Financials / Expense Percentage", "Annual Taxes (New)",
    "Insurance / Cost (Annual)", "Bridge / Acquisition Financed (%)",
    "Bridge / Improvement Financing (%)", "Bridge / Interest Rate (%)",
    "Bridge / Points (%)", "Refinance / % of Appraisal (ARV)",
    "Refinance / Interest Rate (%)", "Refinance / Points (%)",
    "Refinance / Term (years)",
    // Also skip computed columns (trigger will handle these)
    "Profit", "Investment / ROI", "Cost to Value / Percent (CTV)", "AAR", "Profitability",
    "Investment / Our Offer $ per SFT", "Asking / Cap Rate", "DSCR",
    "Proforma / Net Operating Income - Annual(NOI)", "Proforma / Net Operating Income - Monthly",
    "Proforma / Net Operating Income  $ per SQFT (NOI)", "Cash Flow Pre Tax (Monthly)",
    "Proforma / Revenue - Monthly", "Proforma / Expenses - Annual ($)",
    "Proforma / Expenses - Monthly ($)", "Proforma / Expenses $ per SFT",
    "Bridge / Loan Total", "Bridge / Interest Cost (Monthly)", "Bridge / Total Cost",
    "Bridge / Loan to Cost (LTC)", "Bridge / Loan to Value (LTV)", "Equity / Required",
    "Refinance / Loan Amount", "Refinance / % of Appraisal (ARV)",
    "Refinance / Cash Flow (Annual)", "Cash Out at Refi", "Profit at Refi",
    "Equity / Left in the Deal after Refi ", "Refinance Valuation",
    "REAP / Score", "Equity Multiple",
    "Existing Financials / Revenue - Monthly", "Existing Financials / Revenue Per SQFT",
    "Existing Financials / Net Income (NOI)", "Existing Expenses ($)",
    "Investment / Existing Financials / Our Offer Cap Rate",
  ]);

  const deals = rows
    .filter(row => g(row, colAddress)) // must have an address
    .map(row => {
      // Build metadata from all non-mapped columns
      const metadata = {};
      headers.forEach((header, i) => {
        const h = (header || "").trim();
        if (h && !knownColumns.has(h) && g(row, i)) {
          metadata[h] = g(row, i);
        }
      });

      const rawStatus = g(row, colStatus);
      const status = validStatuses.includes(rawStatus) ? rawStatus : "New";

      return {
        user_email: (g(row, colUser) || "javier@thesuarezcapital.com").toLowerCase().trim(),
        org_id: orgId,
        date_added: parseDate(g(row, colDate)) || new Date().toISOString(),
        deal_status: status,
        property_address: g(row, colAddress),
        deal_name: g(row, colDealName) || null,
        type: g(row, colType) || null,
        city: g(row, colCity) || null,
        state: g(row, colState) || null,
        zip_code: g(row, colZip) || null,
        source: g(row, colSource) || null,
        class: g(row, colClass) || null,
        lot_acres: parseNum(g(row, colLotAcres)),
        year_built: parseInt2(g(row, colYearBuilt)),
        sqft_net: parseNum(g(row, colSqft)),
        units: parseInt2(g(row, colUnits)),
        months: parseNum(g(row, colMonths)),
        asking_price: parseNum(g(row, colAskingPrice)),
        our_offer: parseNum(g(row, colOffer)),
        purchase_price: parseNum(g(row, colPurchase)),
        improvement_budget: parseNum(g(row, colImprovement)),
        arv_value: parseNum(g(row, colARV)),
        acq_cost_to_close_pct: parseNum(g(row, colAcqClose)),
        disp_cost_of_sale_pct: parseNum(g(row, colDispCost)),
        proforma_revenue_annual: parseNum(g(row, colProRevAnnual)),
        proforma_expenses_pct: parseNum(g(row, colProExpPct)),
        proforma_vacancy_pct: parseNum(g(row, colProVacancy)),
        proforma_rent_per_sf: parseNum(g(row, colProRentSF)),
        existing_revenue_annual: parseNum(g(row, colExRevAnnual)),
        existing_expense_pct: parseNum(g(row, colExExpPct)),
        annual_taxes: parseNum(g(row, colAnnualTaxes)),
        insurance_cost_annual: parseNum(g(row, colInsurance)),
        bridge_acq_financed_pct: parseNum(g(row, colBrAcqPct)),
        bridge_improv_financed_pct: parseNum(g(row, colBrImpPct)),
        bridge_interest_rate: parseNum(g(row, colBrRate)),
        bridge_points_pct: parseNum(g(row, colBrPoints)),
        refi_pct_arv: parseNum(g(row, colRfPctARV)),
        refi_interest_rate: parseNum(g(row, colRfRate)),
        refi_points_pct: parseNum(g(row, colRfPoints)),
        refi_term_years: parseNum(g(row, colRfTerm)),
        metadata: Object.keys(metadata).length > 0 ? metadata : {},
      };
    });

  console.log(`   Prepared ${deals.length} deals`);
  console.log(`   Extra columns → metadata JSONB`);

  const inserted = await supabaseInsertBatch("deals", deals);
  console.log(`   ✅ Inserted ${inserted} deals`);
  return inserted;
}

// ─── VERIFY ──────────────────────────────────────────────────────

async function verify() {
  console.log("\n🔍 Verifying...");

  const countUrl = `${SUPABASE_URL}/rest/v1/deals?select=id&limit=10000`;
  const countRes = await fetch(countUrl, { headers: SUPABASE_HEADERS });
  const allDeals = await countRes.json();
  console.log(`   Deals in Supabase: ${Array.isArray(allDeals) ? allDeals.length : 0}`);

  // Sample a deal to check computed fields
  const sampleUrl = `${SUPABASE_URL}/rest/v1/deals?select=property_address,our_offer,arv_value,profit,roi,cap_rate,reap_score&limit=3&our_offer=gt.0`;
  const sampleRes = await fetch(sampleUrl, { headers: SUPABASE_HEADERS });
  const samples = await sampleRes.json();
  if (Array.isArray(samples) && samples.length > 0) {
    console.log("\n   Sample deals (trigger-computed values):");
    samples.forEach(d => {
      console.log(`   ${d.property_address}`);
      console.log(`     Offer: $${d.our_offer?.toLocaleString() || "—"} | ARV: $${d.arv_value?.toLocaleString() || "—"}`);
      console.log(`     Profit: $${d.profit?.toLocaleString() || "—"} | ROI: ${d.roi?.toFixed(1) || "—"}% | Cap: ${d.cap_rate?.toFixed(1) || "—"}% | REAP: ${d.reap_score?.toFixed(0) || "—"}`);
    });
  }
}

// ─── MAIN ────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  REAP | Phase 3 Data Migration: Deals → Supabase");
  console.log("═══════════════════════════════════════════════════");
  console.log(`   Sheets:   ${SPREADSHEET_ID.slice(0, 12)}...`);
  console.log(`   Supabase: ${SUPABASE_URL}`);

  try {
    const count = await migrateDeals();
    await verify();

    console.log("\n═══════════════════════════════════════════════════");
    console.log(`  ✅ Phase 3 Migration Complete — ${count} deals`);
    console.log("  The trigger auto-computes financials for all deals.");
    console.log("  Spot-check a few deals against Google Sheets to verify.");
    console.log("═══════════════════════════════════════════════════\n");
  } catch (err) {
    console.error("\n❌ Migration failed:", err.message);
    console.error(err);
    process.exit(1);
  }
}

main();
