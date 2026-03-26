// ═══════════════════════════════════════════════════════════════════
// REAP | Session 11 — Re-migrate Deals with Original Computed Values
// ═══════════════════════════════════════════════════════════════════
//
// The first migration only imported INPUT fields and let the trigger
// recompute everything. The trigger's formulas don't exactly match
// the 200+ Sheets formulas, so values drifted.
//
// This script:
//   1. Disables the compute trigger
//   2. Deletes all existing deals
//   3. Re-imports deals with BOTH inputs AND original computed values
//   4. Re-enables the trigger (for future deals/edits only)
//
// Usage:
//   SUPABASE_SERVICE_KEY="your-key" node reimport_deals.js
// ═══════════════════════════════════════════════════════════════════

require("dotenv").config();

const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;
const API_KEY = process.env.REACT_APP_SHEETS_API_KEY;
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SPREADSHEET_ID || !API_KEY) { console.error("❌ Need Sheets env vars"); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) { console.error("❌ Need SUPABASE_SERVICE_KEY"); process.exit(1); }

const HEADERS = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_SERVICE_KEY,
  "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Prefer": "return=minimal",
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

async function supabasePost(endpoint, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    method: "POST", headers: HEADERS, body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase POST ${endpoint}: ${res.status} — ${err}`);
  }
}

async function supabaseDelete(table) {
  // Delete all rows (neq filter on id that matches everything)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=neq.00000000-0000-0000-0000-000000000000`, {
    method: "DELETE", headers: HEADERS,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase DELETE ${table}: ${res.status} — ${err}`);
  }
}

async function supabaseRpc(fnName, params = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: "POST", headers: HEADERS, body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase RPC ${fnName}: ${res.status} — ${err}`);
  }
  return res;
}

async function insertBatch(table, rows) {
  const BATCH = 50;
  let count = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await supabasePost(table, batch);
    count += batch.length;
    console.log(`   ... ${count}/${rows.length}`);
  }
  return count;
}

const parseNum = (v) => {
  if (!v || v === "—" || v === "" || v === "N/A" || v === "#N/A" || v === "#REF!" || v === "#VALUE!" || v === "#DIV/0!") return null;
  const n = parseFloat(String(v).replace(/[$,%]/g, "").trim());
  return isNaN(n) ? null : n;
};
const parseInt2 = (v) => { if (!v) return null; const n = parseInt(String(v).replace(/[,]/g, ""), 10); return isNaN(n) ? null : n; };
const parseDate = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString(); };

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  REAP | Re-import Deals with Original Values");
  console.log("═══════════════════════════════════════════════════\n");

  // Step 1: Disable trigger
  console.log("1️⃣  Disabling compute trigger...");
  // We can't directly run ALTER TABLE via REST API, so we'll use a workaround:
  // Create a temporary RPC function to disable/enable the trigger
  const disableSQL = `
    CREATE OR REPLACE FUNCTION disable_deal_trigger() RETURNS void AS $$
    BEGIN
      ALTER TABLE deals DISABLE TRIGGER deal_compute_financials;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  const enableSQL = `
    CREATE OR REPLACE FUNCTION enable_deal_trigger() RETURNS void AS $$
    BEGIN
      ALTER TABLE deals ENABLE TRIGGER deal_compute_financials;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  // We need to run these via SQL editor first — let's try RPC
  try {
    await supabaseRpc("disable_deal_trigger");
    console.log("   ✅ Trigger disabled via RPC");
  } catch (err) {
    console.log("   ⚠️  Could not disable trigger via RPC.");
    console.log("   Please run this in Supabase SQL Editor FIRST:");
    console.log("");
    console.log("   -- Run this BEFORE the migration script:");
    console.log("   CREATE OR REPLACE FUNCTION disable_deal_trigger() RETURNS void AS $$");
    console.log("   BEGIN ALTER TABLE deals DISABLE TRIGGER deal_compute_financials; END;");
    console.log("   $$ LANGUAGE plpgsql SECURITY DEFINER;");
    console.log("");
    console.log("   CREATE OR REPLACE FUNCTION enable_deal_trigger() RETURNS void AS $$");
    console.log("   BEGIN ALTER TABLE deals ENABLE TRIGGER deal_compute_financials; END;");
    console.log("   $$ LANGUAGE plpgsql SECURITY DEFINER;");
    console.log("");
    console.log("   SELECT disable_deal_trigger();");
    console.log("");
    console.log("   Then re-run this script.");
    process.exit(1);
  }

  // Step 2: Delete existing deals
  console.log("\n2️⃣  Clearing existing deals from Supabase...");
  await supabaseDelete("deals");
  console.log("   ✅ All deals deleted");

  // Step 3: Read from Sheets with ALL columns
  console.log("\n3️⃣  Reading all deals from Google Sheets...");
  const { headers, rows } = await sheetsRead("Deals", "A1:KZ");
  console.log(`   Found ${rows.length} rows (${headers.length} columns)`);

  const idx = (name) => headers.findIndex(h => h && h.trim() === name.trim());
  const g = (row, col) => col >= 0 && col < row.length ? (row[col] || "").trim() : "";

  // Look up org_id
  const orgRes = await fetch(`${SUPABASE_URL}/rest/v1/organizations?owner_email=eq.javier@thesuarezcapital.com&select=id&limit=1`, { headers: HEADERS });
  const orgs = await orgRes.json();
  const orgId = orgs.length > 0 ? orgs[0].id : null;

  const validStatuses = ["New", "Review", "Underwriting", "Offer", "Under Contract", "Closed", "Dead", "On Hold"];

  // Map ALL columns — both inputs AND computed
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
  // Pricing inputs
  const colAskingPrice = idx("Asking / Price");
  const colOffer = idx("Investment / Our Offer");
  const colPurchase = idx("Purchase Price");
  const colImprovement = idx("Improvement / Budget");
  const colARV = idx("ARV / Value");
  const colAcqClose = idx("Acquisition / Cost to Close %");
  const colDispCost = idx("Disposition / Cost of Sale (% of ARV)");
  // Proforma inputs
  const colProRevAnnual = idx("Proforma / Revenue - Annual");
  const colProExpPct = idx("Proforma / Expenses (%)");
  const colProVacancy = idx("Proforma / Vacancy (%)");
  const colProRentSF = idx("Proforma / Rent per SF");
  // Existing financials inputs
  const colExRevAnnual = idx("Existing Financials / Revenue - Annual");
  const colExExpPct = idx("Existing Financials / Expense Percentage");
  const colAnnualTaxes = idx("Annual Taxes (New)");
  const colInsurance = idx("Insurance / Cost (Annual)");
  // Bridge inputs
  const colBrAcqPct = idx("Bridge / Acquisition Financed (%)");
  const colBrImpPct = idx("Bridge / Improvement Financing (%)");
  const colBrRate = idx("Bridge / Interest Rate (%)");
  const colBrPoints = idx("Bridge / Points (%)");
  // Refi inputs
  const colRfPctARV = idx("Refinance / % of Appraisal (ARV)");
  const colRfRate = idx("Refinance / Interest Rate (%)");
  const colRfPoints = idx("Refinance / Points (%)");
  const colRfTerm = idx("Refinance / Term (years)");

  // ── COMPUTED columns (preserving original Sheets values) ──
  const colProfit = idx("Profit");
  const colROI = idx("Investment / ROI");
  const colCTV = idx("Cost to Value / Percent (CTV)");
  const colAAR = idx("AAR");
  const colProfitability = idx("Profitability");
  const colNetSqftPrice = idx("Investment / Our Offer $ per SFT");
  const colCapRate = idx("Asking / Cap Rate");
  const colDSCR = idx("DSCR");
  const colNOIAnnual = idx("Proforma / Net Operating Income - Annual(NOI)");
  const colNOIMonthly = idx("Proforma / Net Operating Income - Monthly");
  const colNOIPerSF = idx("Proforma / Net Operating Income  $ per SQFT (NOI)");
  const colCashFlowMonthly = idx("Cash Flow Pre Tax (Monthly)");
  const colProRevMonthly = idx("Proforma / Revenue - Monthly");
  const colProExpAnnual = idx("Proforma / Expenses - Annual ($)");
  const colProExpMonthly = idx("Proforma / Expenses - Monthly ($)");
  const colProExpPerSF = idx("Proforma / Expenses $ per SFT");
  const colBridgeLoanTotal = idx("Bridge / Loan Total");
  const colBridgeInterestMonthly = idx("Bridge / Interest Cost (Monthly)");
  const colBridgeTotalCost = idx("Bridge / Total Cost");
  const colBridgeLTC = idx("Bridge / Loan to Cost (LTC)");
  const colBridgeLTV = idx("Bridge / Loan to Value (LTV)");
  const colEquityRequired = idx("Equity / Required");
  const colRefiLoanAmount = idx("Refinance / Loan Amount");
  const colRefiCashFlow = idx("Refinance / Cash Flow (Annual)");
  const colCashOutRefi = idx("Cash Out at Refi");
  const colProfitAtRefi = idx("Profit at Refi");
  const colEquityAfterRefi = idx("Equity / Left in the Deal after Refi ");
  const colRefiValuation = idx("Refinance Valuation");
  const colReapScore = idx("REAP / Score");
  const colEquityMultiple = idx("Equity Multiple");
  const colExRevMonthly = idx("Existing Financials / Revenue - Monthly");
  const colExRevPerSF = idx("Existing Financials / Revenue Per SQFT");
  const colExNOI = idx("Existing Financials / Net Income (NOI)");
  const colExExpenses = idx("Existing Expenses ($)");
  const colExCapRate = idx("Investment / Existing Financials / Our Offer Cap Rate");

  // Build known columns set for metadata
  const knownCols = new Set();
  [colUser,colDate,colStatus,colAddress,colDealName,colType,colCity,colState,colZip,colSource,colClass,
   colLotAcres,colYearBuilt,colSqft,colUnits,colMonths,colAskingPrice,colOffer,colPurchase,colImprovement,
   colARV,colAcqClose,colDispCost,colProRevAnnual,colProExpPct,colProVacancy,colProRentSF,
   colExRevAnnual,colExExpPct,colAnnualTaxes,colInsurance,colBrAcqPct,colBrImpPct,colBrRate,colBrPoints,
   colRfPctARV,colRfRate,colRfPoints,colRfTerm,
   colProfit,colROI,colCTV,colAAR,colProfitability,colNetSqftPrice,colCapRate,colDSCR,
   colNOIAnnual,colNOIMonthly,colNOIPerSF,colCashFlowMonthly,colProRevMonthly,
   colProExpAnnual,colProExpMonthly,colProExpPerSF,colBridgeLoanTotal,colBridgeInterestMonthly,
   colBridgeTotalCost,colBridgeLTC,colBridgeLTV,colEquityRequired,colRefiLoanAmount,colRefiCashFlow,
   colCashOutRefi,colProfitAtRefi,colEquityAfterRefi,colRefiValuation,colReapScore,colEquityMultiple,
   colExRevMonthly,colExRevPerSF,colExNOI,colExExpenses,colExCapRate
  ].forEach(c => { if (c >= 0) knownCols.add(c); });

  const deals = rows
    .filter(row => g(row, colAddress))
    .map(row => {
      // Metadata for extra columns
      const metadata = {};
      headers.forEach((header, i) => {
        const h = (header || "").trim();
        if (h && !knownCols.has(i) && g(row, i)) {
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
        // Pricing inputs
        asking_price: parseNum(g(row, colAskingPrice)),
        our_offer: parseNum(g(row, colOffer)),
        purchase_price: parseNum(g(row, colPurchase)),
        improvement_budget: parseNum(g(row, colImprovement)),
        arv_value: parseNum(g(row, colARV)),
        acq_cost_to_close_pct: parseNum(g(row, colAcqClose)),
        disp_cost_of_sale_pct: parseNum(g(row, colDispCost)),
        // Proforma inputs
        proforma_revenue_annual: parseNum(g(row, colProRevAnnual)),
        proforma_expenses_pct: parseNum(g(row, colProExpPct)),
        proforma_vacancy_pct: parseNum(g(row, colProVacancy)),
        proforma_rent_per_sf: parseNum(g(row, colProRentSF)),
        // Existing financials inputs
        existing_revenue_annual: parseNum(g(row, colExRevAnnual)),
        existing_expense_pct: parseNum(g(row, colExExpPct)),
        annual_taxes: parseNum(g(row, colAnnualTaxes)),
        insurance_cost_annual: parseNum(g(row, colInsurance)),
        // Bridge inputs
        bridge_acq_financed_pct: parseNum(g(row, colBrAcqPct)),
        bridge_improv_financed_pct: parseNum(g(row, colBrImpPct)),
        bridge_interest_rate: parseNum(g(row, colBrRate)),
        bridge_points_pct: parseNum(g(row, colBrPoints)),
        // Refi inputs
        refi_pct_arv: parseNum(g(row, colRfPctARV)),
        refi_interest_rate: parseNum(g(row, colRfRate)),
        refi_points_pct: parseNum(g(row, colRfPoints)),
        refi_term_years: parseNum(g(row, colRfTerm)),

        // ── COMPUTED VALUES (preserved from Sheets) ──
        profit: parseNum(g(row, colProfit)),
        roi: parseNum(g(row, colROI)),
        ctv: parseNum(g(row, colCTV)),
        aar: parseNum(g(row, colAAR)),
        profitability: g(row, colProfitability) || null,
        net_sqft_price: parseNum(g(row, colNetSqftPrice)),
        cap_rate: parseNum(g(row, colCapRate)),
        dscr: parseNum(g(row, colDSCR)),
        noi_annual: parseNum(g(row, colNOIAnnual)),
        noi_monthly: parseNum(g(row, colNOIMonthly)),
        noi_per_sf: parseNum(g(row, colNOIPerSF)),
        cash_flow_monthly: parseNum(g(row, colCashFlowMonthly)),
        proforma_revenue_monthly: parseNum(g(row, colProRevMonthly)),
        proforma_expenses_annual: parseNum(g(row, colProExpAnnual)),
        proforma_expenses_monthly: parseNum(g(row, colProExpMonthly)),
        proforma_expenses_per_sf: parseNum(g(row, colProExpPerSF)),
        bridge_loan_total: parseNum(g(row, colBridgeLoanTotal)),
        bridge_interest_monthly: parseNum(g(row, colBridgeInterestMonthly)),
        bridge_total_cost: parseNum(g(row, colBridgeTotalCost)),
        bridge_ltc: parseNum(g(row, colBridgeLTC)),
        bridge_ltv: parseNum(g(row, colBridgeLTV)),
        equity_required: parseNum(g(row, colEquityRequired)),
        refi_loan_amount: parseNum(g(row, colRefiLoanAmount)),
        refi_cash_flow_annual: parseNum(g(row, colRefiCashFlow)),
        cash_out_refi: parseNum(g(row, colCashOutRefi)),
        profit_at_refi: parseNum(g(row, colProfitAtRefi)),
        equity_after_refi: parseNum(g(row, colEquityAfterRefi)),
        refi_valuation: parseNum(g(row, colRefiValuation)),
        reap_score: parseNum(g(row, colReapScore)),
        equity_multiple: parseNum(g(row, colEquityMultiple)),
        existing_revenue_monthly: parseNum(g(row, colExRevMonthly)),
        existing_revenue_per_sf: parseNum(g(row, colExRevPerSF)),
        existing_noi: parseNum(g(row, colExNOI)),
        existing_expenses: parseNum(g(row, colExExpenses)),
        existing_cap_rate: parseNum(g(row, colExCapRate)),

        metadata: Object.keys(metadata).length > 0 ? metadata : {},
      };
    });

  console.log(`   Prepared ${deals.length} deals (inputs + computed values preserved)\n`);

  // Step 4: Insert
  console.log("4️⃣  Inserting deals...");
  const inserted = await insertBatch("deals", deals);
  console.log(`   ✅ Inserted ${inserted} deals\n`);

  // Step 5: Re-enable trigger
  console.log("5️⃣  Re-enabling compute trigger...");
  try {
    await supabaseRpc("enable_deal_trigger");
    console.log("   ✅ Trigger re-enabled (fires on future inserts/updates only)");
  } catch (err) {
    console.log("   ⚠️  Run in SQL Editor: SELECT enable_deal_trigger();");
  }

  // Step 6: Quick verify
  console.log("\n6️⃣  Verifying...");
  const countRes = await fetch(`${SUPABASE_URL}/rest/v1/deals?select=id&limit=10000`, { headers: HEADERS });
  const allDeals = await countRes.json();
  console.log(`   Deals in Supabase: ${Array.isArray(allDeals) ? allDeals.length : 0}`);

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  ✅ Re-import Complete — ${inserted} deals`);
  console.log("  Original Sheets values preserved.");
  console.log("  Trigger re-enabled for future deals.");
  console.log("  Run validate_financials.js again to confirm.");
  console.log("═══════════════════════════════════════════════════\n");
}

main().catch(err => { console.error("❌", err.message); process.exit(1); });
