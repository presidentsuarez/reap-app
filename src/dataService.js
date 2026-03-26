// ═══════════════════════════════════════════════════════════════════
// REAP | dataService.js — Data Access Abstraction Layer
// ═══════════════════════════════════════════════════════════════════
//
// This file centralizes ALL data access. Every read from Google Sheets
// and every write through Apps Script goes through here.
//
// When we migrate to Supabase, we change ONLY this file.
// App.js never touches a database or API directly.
//
// Phase 0: Google Sheets implementation (current)
// Phase 1-3: Swap internals to Supabase, one table at a time
// ═══════════════════════════════════════════════════════════════════

const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;
const API_KEY = process.env.REACT_APP_SHEETS_API_KEY;
const SHEETS_WRITE_URL = process.env.REACT_APP_SHEETS_WRITE_URL;

// ── Helpers ──────────────────────────────────────────────────────

function sheetsReadUrl(tab, range) {
  return `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tab}!${range}?key=${API_KEY}`;
}

async function sheetsRead(tab, range) {
  const res = await fetch(sheetsReadUrl(tab, range));
  if (!res.ok) {
    if (res.status === 400) return { headers: [], rows: [] };
    throw new Error(`Sheets API error: ${res.status}`);
  }
  const data = await res.json();
  const all = data.values || [];
  if (all.length < 2) return { headers: all[0] || [], rows: [] };
  return { headers: all[0], rows: all.slice(1) };
}

async function appsScriptPost(payload) {
  if (!SHEETS_WRITE_URL) {
    throw new Error("SHEETS_WRITE_URL not configured. Set REACT_APP_SHEETS_WRITE_URL in .env");
  }
  const res = await fetch(SHEETS_WRITE_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const result = await res.json();
  if (!result.success) throw new Error(result.error || "Write failed");
  return result;
}

function makeIdx(headers) {
  return (name) => headers.findIndex(h => h && h.trim() === name.trim());
}

function makeIdxCI(headers) {
  return (name) => headers.findIndex(h => h && h.trim().toLowerCase() === name.toLowerCase());
}

function g(row, col) {
  return col >= 0 && col < row.length ? row[col] : "";
}


// ═══════════════════════════════════════════════════════════════════
// DEALS
// ═══════════════════════════════════════════════════════════════════

export async function getDeals(teamEmails) {
  const { headers, rows } = await sheetsRead("Deals", "A1:KZ");
  if (rows.length === 0) return [];

  const idx = makeIdx(headers);

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

  // Financial fields
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
  const colEquityMultiple = idx("Equity Multiple");

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

  const parsed = rows.map(row => ({
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

  // Filter to team's deals
  const emailsLower = teamEmails.map(e => e.toLowerCase());
  const userDeals = parsed.filter(d => emailsLower.includes((d.user || "").toLowerCase()));

  // Sort newest first
  userDeals.sort((a, b) => {
    const da = new Date(a.date);
    const db = new Date(b.date);
    if (isNaN(da.getTime()) && isNaN(db.getTime())) return 0;
    if (isNaN(da.getTime())) return 1;
    if (isNaN(db.getTime())) return -1;
    return db - da;
  });

  return userDeals;
}

export async function saveDeal(dealForm, userEmail) {
  const today = new Date().toLocaleDateString("en-US");
  const dealData = {
    "Deal / Name": dealForm.dealName,
    "Property / Address": dealForm.address,
    "City": dealForm.city,
    "State": dealForm.state,
    "Zip Code": dealForm.zip,
    "Type": dealForm.type,
    "Class": dealForm.class,
    "SQFT / Net": dealForm.sqft,
    "Units": dealForm.units,
    "Year Built": dealForm.yearBuilt,
    "Asking / Price": (dealForm.askingPrice || "").replace(/[$,]/g, ""),
    "Investment / Our Offer": (dealForm.ourOffer || "").replace(/[$,]/g, ""),
    "Lot / Size Acres": dealForm.lotAcres,
    "Date / Added": today,
    "Deal / Status": "New",
    "User": userEmail,
    "Source": "REAP App",
  };

  await appsScriptPost(dealData);

  // Return a local deal object for immediate UI update
  return {
    user: userEmail,
    date: today,
    status: "New",
    address: dealForm.address,
    type: dealForm.type,
    offer: dealForm.ourOffer,
    netSqft: "",
    sqft: dealForm.sqft,
    units: dealForm.units,
    purchasePrice: "",
    improvementBudget: "",
    arv: "",
    profit: "",
    roi: "",
    ctv: "",
    aar: "",
    profitability: "",
    source: "REAP App",
    city: dealForm.city,
    state: dealForm.state,
    askingPrice: dealForm.askingPrice,
  };
}

export async function editDeal(address, form) {
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

  await appsScriptPost({ action: "edit_deal", address, updates });
}

export async function generateAISummary(deal) {
  const result = await appsScriptPost({ action: "generate_summary", deal });
  return result.summary;
}


// ═══════════════════════════════════════════════════════════════════
// CONTACTS / BUYERS
// ═══════════════════════════════════════════════════════════════════

export async function getBuyers(teamEmails) {
  const { headers, rows } = await sheetsRead("Contacts", "A1:BQ");
  if (rows.length === 0) return [];

  const idx = makeIdx(headers);
  const colRowId = idx("🔒 Row ID");
  const colName = idx("Contact / Name");
  const colFirstName = idx("Contact / First Name");
  const colEmail = idx("Contact / Email");
  const colPhone = idx("Contact / Phone");
  const colType = idx("Contact / Type");
  const colBuyerStatus = idx("Buyer / Status");
  const colAssetPref = idx("Contact / Asset Preference");
  const colTemperature = idx("Contact / Temperature");
  const colManager = idx("Contact / Manager");
  const colNotes = idx("Contact / Notes");
  const colLeadSource = idx("Contact / Lead Source");
  const colCompany = idx("Contact / Company");
  const colDateAdded = idx("Date / Added");
  const colLastContact = idx("Date / Last Contact");
  const colFollowUpNotes = idx("Contact / Follow Up Notes");
  const colUser = idx("User");

  const parsed = rows.map(row => ({
    rowId: g(row, colRowId),
    name: g(row, colName),
    firstName: g(row, colFirstName),
    email: g(row, colEmail),
    phone: g(row, colPhone),
    contactType: g(row, colType),
    buyerStatus: g(row, colBuyerStatus),
    assetPreference: g(row, colAssetPref),
    temperature: g(row, colTemperature),
    manager: g(row, colManager),
    notes: g(row, colNotes),
    leadSource: g(row, colLeadSource),
    company: g(row, colCompany),
    dateAdded: g(row, colDateAdded),
    lastContact: g(row, colLastContact),
    followUpNotes: g(row, colFollowUpNotes),
    user: g(row, colUser),
  })).filter(c => c.name && c.name.trim() !== "");

  // Team filtering
  const teamList = teamEmails.map(e => e.toLowerCase());
  if (teamList.length > 0) {
    return parsed.filter(c => {
      const contactUser = (c.user || "").toLowerCase().trim();
      return contactUser && teamList.includes(contactUser);
    });
  }
  return parsed;
}

export async function saveBuyer(form, userEmail, editingRowId = null) {
  const buyerData = {
    "Contact / Name": form.name,
    "Contact / First Name": (form.name || "").split(" ")[0],
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
    "User": userEmail,
    "Date / Added": new Date().toISOString(),
  };

  const payload = editingRowId
    ? { action: "edit_contact", rowId: editingRowId, updates: buyerData }
    : { action: "add_contact", ...buyerData };

  await appsScriptPost(payload);
}

// Slim contacts list (used by InvestorPipelineView for linking)
export async function getContactsList() {
  const { headers, rows } = await sheetsRead("Contacts", "A1:BQ");
  if (rows.length === 0) return [];

  const idx = makeIdx(headers);
  return rows.map(row => ({
    rowId: g(row, idx("🔒 Row ID")),
    name: g(row, idx("Contact / Name")),
    email: g(row, idx("Contact / Email")),
    phone: g(row, idx("Contact / Phone")),
    company: g(row, idx("Contact / Company")),
  })).filter(c => c.name);
}


// ═══════════════════════════════════════════════════════════════════
// PORTFOLIOS
// ═══════════════════════════════════════════════════════════════════

export async function getPortfolios(teamEmails) {
  const { rows } = await sheetsRead("Portfolios", "A1:F");
  if (rows.length === 0) return [];

  const emailsLower = teamEmails.map(e => e.toLowerCase());
  const parsed = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row[1] || !emailsLower.includes(row[1].toLowerCase())) continue;
    parsed.push({
      id: row[0] || "",
      user: row[1] || "",
      name: row[2] || "",
      type: row[3] || "Owned",
      dealAddresses: row[4] ? row[4].split("|||").filter(a => a) : [],
      createdAt: row[5] || "",
    });
  }
  return parsed;
}

export async function savePortfolio(data, userEmail) {
  const newId = "p_" + Date.now();
  const payload = {
    action: "add_portfolio",
    id: newId,
    user: userEmail,
    name: data.name,
    type: data.type,
    dealAddresses: data.dealAddresses,
    createdAt: new Date().toISOString(),
  };
  const result = await appsScriptPost(payload);
  return result.portfolio || {
    id: newId,
    user: userEmail,
    name: data.name,
    type: data.type,
    dealAddresses: data.dealAddresses,
    createdAt: payload.createdAt,
  };
}

export async function editPortfolio(id, data) {
  await appsScriptPost({
    action: "edit_portfolio",
    id,
    name: data.name,
    type: data.type,
    dealAddresses: data.dealAddresses,
  });
}

export async function deletePortfolio(id) {
  await appsScriptPost({ action: "delete_portfolio", id });
}


// ═══════════════════════════════════════════════════════════════════
// MARKETS
// ═══════════════════════════════════════════════════════════════════

export async function getMarkets() {
  const { headers, rows } = await sheetsRead("Markets", "A1:J100");
  if (rows.length === 0) return null; // null signals "fall back to deal-based computation"

  const idx = makeIdxCI(headers);
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

  return rows.filter(row => g(row, colMarket)).map(row => ({
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
}


// ═══════════════════════════════════════════════════════════════════
// MLS FEED
// ═══════════════════════════════════════════════════════════════════

export async function getListings() {
  const { headers, rows } = await sheetsRead("MLS Feed", "A1:W");
  if (rows.length === 0) return [];

  const idx = makeIdxCI(headers);
  const col = {
    mlsNumber: idx("ml number") >= 0 ? idx("ml number") : idx("mls number") >= 0 ? idx("mls number") : idx("mls #"),
    status: idx("status"),
    adom: idx("adom"),
    cdom: idx("cdom"),
    price: idx("current price") >= 0 ? idx("current price") : idx("price"),
    address: idx("address"),
    city: idx("city"),
    county: idx("county"),
    ownership: idx("ownership"),
    propType: idx("prop type") >= 0 ? idx("prop type") : idx("property type"),
    style: idx("property style"),
    units: idx("total units"),
    heatedArea: idx("heated area"),
    lotAcres: idx("lot size acres"),
    beds: idx("beds"),
    baths: idx("bathrooms total") >= 0 ? idx("bathrooms total") : idx("baths"),
    yearBuilt: idx("year built"),
    ppsf: idx("$/sqft"),
    agent: idx("list agent"),
    publicRemarks: idx("public remarks"),
    realtorRemarks: idx("realtor only remarks"),
    zip: idx("zip"),
    sqftTotal: idx("sqft total"),
  };

  const gt = (row, c) => c >= 0 && c < row.length ? (row[c] || "").trim() : "";
  return rows.map((row, i) => ({
    rowIndex: i + 2,
    mlsNumber: gt(row, col.mlsNumber),
    status: gt(row, col.status),
    adom: gt(row, col.adom),
    cdom: gt(row, col.cdom),
    price: gt(row, col.price),
    address: gt(row, col.address),
    city: gt(row, col.city),
    county: gt(row, col.county),
    ownership: gt(row, col.ownership),
    propType: gt(row, col.propType),
    style: gt(row, col.style),
    units: gt(row, col.units),
    heatedArea: gt(row, col.heatedArea),
    lotAcres: gt(row, col.lotAcres),
    beds: gt(row, col.beds),
    baths: gt(row, col.baths),
    yearBuilt: gt(row, col.yearBuilt),
    ppsf: gt(row, col.ppsf),
    agent: gt(row, col.agent),
    publicRemarks: gt(row, col.publicRemarks),
    realtorRemarks: gt(row, col.realtorRemarks),
    zip: gt(row, col.zip),
    sqftTotal: gt(row, col.sqftTotal),
  })).filter(l => l.address || l.mlsNumber);
}

export async function addListingToPipeline(listing, userEmail) {
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
    "User": userEmail,
    "Date / Added": new Date().toLocaleDateString("en-US"),
    "Source": "MLS Feed",
    "MLS Number": listing.mlsNumber,
  };
  await appsScriptPost(dealData);
}


// ═══════════════════════════════════════════════════════════════════
// FILE UPLOADS
// ═══════════════════════════════════════════════════════════════════

export async function getUploads() {
  const { headers, rows } = await sheetsRead("File Uploads", "A1:E");
  if (rows.length === 0) return [];

  const idx = makeIdxCI(headers);
  const colFilename = idx("filename") >= 0 ? idx("filename") : 0;
  const colLink = idx("file link") >= 0 ? idx("file link") : idx("link") >= 0 ? idx("link") : 1;
  const colDate = idx("uploaded at") >= 0 ? idx("uploaded at") : idx("date") >= 0 ? idx("date") : 2;
  const colUser = idx("user") >= 0 ? idx("user") : 3;
  const colStatus = idx("status") >= 0 ? idx("status") : 4;

  const gt = (row, col) => col >= 0 && col < row.length ? (row[col] || "").trim() : "";
  return rows.map((row, i) => ({
    rowIndex: i + 2,
    filename: gt(row, colFilename),
    link: gt(row, colLink),
    date: gt(row, colDate),
    user: gt(row, colUser),
    status: gt(row, colStatus) || "Uploaded",
  })).filter(u => u.filename || u.link).reverse();
}

export async function uploadFile(file, userEmail) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  await appsScriptPost({
    action: "upload_file",
    filename: file.name,
    mimeType: file.type || "text/csv",
    base64,
    user: userEmail,
    uploadedAt: new Date().toISOString(),
  });
}


// ═══════════════════════════════════════════════════════════════════
// INVESTORS
// ═══════════════════════════════════════════════════════════════════

export async function getInvestors(teamEmails) {
  const { headers, rows } = await sheetsRead("Investors", "A1:Z");
  if (rows.length === 0) return [];

  const idx = makeIdx(headers);
  const parsed = rows.map(row => ({
    id: g(row, idx("Investor ID")),
    user: g(row, idx("User")),
    investorName: g(row, idx("Investor Name")),
    investorType: g(row, idx("Investor Type")),
    pipelineStage: g(row, idx("Pipeline Stage")),
    temperature: g(row, idx("Temperature")),
    capitalRangeMin: g(row, idx("Capital Range Min")),
    capitalRangeMax: g(row, idx("Capital Range Max")),
    capitalCommitted: g(row, idx("Capital Committed")),
    capitalFunded: g(row, idx("Capital Funded")),
    investmentThesis: g(row, idx("Investment Thesis")),
    preferredReturn: g(row, idx("Preferred Return")),
    irrTarget: g(row, idx("IRR Target")),
    holdPeriod: g(row, idx("Hold Period")),
    assetPreference: g(row, idx("Asset Preference")),
    geographyPreference: g(row, idx("Geography Preference")),
    minDealSize: g(row, idx("Min Deal Size")),
    equityStructure: g(row, idx("Equity Structure")),
    leadSource: g(row, idx("Lead Source")),
    contactIds: g(row, idx("Contact IDs")) ? g(row, idx("Contact IDs")).split("|||").filter(Boolean) : [],
    linkedDealAddresses: g(row, idx("Linked Deal Addresses")) ? g(row, idx("Linked Deal Addresses")).split("|||").filter(Boolean) : [],
    notes: g(row, idx("Notes")),
    dateAdded: g(row, idx("Date Added")),
    dateLastContact: g(row, idx("Date Last Contact")),
    nextFollowUp: g(row, idx("Next Follow-Up")),
    company: g(row, idx("Company / Entity")),
  })).filter(inv => inv.investorName && inv.investorName.trim() !== "");

  // Team filtering
  const teamList = teamEmails.map(e => e.toLowerCase());
  if (teamList.length > 0) {
    return parsed.filter(inv => {
      const invUser = (inv.user || "").toLowerCase().trim();
      return invUser && teamList.includes(invUser);
    });
  }
  return parsed;
}

export async function saveInvestor(form, userEmail) {
  const payload = { action: "add_investor", ...form, user: userEmail };
  const result = await appsScriptPost(payload);
  return result.investor || null;
}

export async function editInvestor(id, updates) {
  await appsScriptPost({ action: "edit_investor", id, updates });
}

export async function deleteInvestor(id) {
  await appsScriptPost({ action: "delete_investor", id });
}

export async function getInvestorActivities() {
  const { headers, rows } = await sheetsRead("Investor Activity", "A1:G");
  if (rows.length === 0) return [];

  const idx = makeIdx(headers);
  return rows.map(row => ({
    activityId: g(row, idx("Activity ID")),
    investorId: g(row, idx("Investor ID")),
    user: g(row, idx("User")),
    activityType: g(row, idx("Activity Type")),
    description: g(row, idx("Description")),
    date: g(row, idx("Date")),
    createdAt: g(row, idx("Created At")),
  }));
}

export async function logInvestorActivity(investorId, userEmail, form) {
  const payload = {
    action: "add_investor_activity",
    investorId,
    user: userEmail,
    ...form,
  };
  const result = await appsScriptPost(payload);
  return result.activity || null;
}
