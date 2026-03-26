// ═══════════════════════════════════════════════════════════════════
// REAP | dataService.js — Data Access Abstraction Layer
// ═══════════════════════════════════════════════════════════════════
//
// This file centralizes ALL data access.
// App.js never touches a database or API directly.
//
// Phase 0: ✅ Abstraction layer created
// Phase 1: ✅ Portfolios + Markets → Supabase
// Phase 2: Contacts → Supabase (pending)
// Phase 3: Deals → Supabase (pending)
// ═══════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

// ── Supabase client (used by Portfolios, Markets) ────────────────
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// ── Google Sheets (still used by Deals, Contacts, MLS, Uploads, Investors) ──
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
// DEALS — Supabase (Phase 3)
// ═══════════════════════════════════════════════════════════════════

export async function getDeals(teamEmails) {
  const emailsLower = teamEmails.map(e => e.toLowerCase());

  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .in("user_email", emailsLower)
    .order("date_added", { ascending: false });

  if (error) throw new Error("Failed to load deals: " + error.message);

  // Map Supabase columns to the shape App.js expects
  return (data || []).map(row => ({
    user: row.user_email || "",
    date: row.date_added || "",
    status: row.deal_status || "",
    address: row.property_address || "",
    type: row.type || "",
    offer: row.our_offer != null ? String(row.our_offer) : "",
    netSqft: row.net_sqft_price != null ? String(row.net_sqft_price) : "",
    sqft: row.sqft_net != null ? String(row.sqft_net) : "",
    units: row.units != null ? String(row.units) : "",
    purchasePrice: row.purchase_price != null ? String(row.purchase_price) : "",
    improvementBudget: row.improvement_budget != null ? String(row.improvement_budget) : "",
    arv: row.arv_value != null ? String(row.arv_value) : "",
    profit: row.profit != null ? String(row.profit) : "",
    roi: row.roi != null ? String(row.roi) : "",
    ctv: row.ctv != null ? String(row.ctv) : "",
    aar: row.aar != null ? String(row.aar) : "",
    profitability: row.profitability || "",
    source: row.source || "",
    city: row.city || "",
    state: row.state || "",
    // Financials
    capRate: row.cap_rate != null ? String(row.cap_rate) : "",
    dscr: row.dscr != null ? String(row.dscr) : "",
    noiAnnual: row.noi_annual != null ? String(row.noi_annual) : "",
    noiMonthly: row.noi_monthly != null ? String(row.noi_monthly) : "",
    noiPerSF: row.noi_per_sf != null ? String(row.noi_per_sf) : "",
    cashFlowMonthly: row.cash_flow_monthly != null ? String(row.cash_flow_monthly) : "",
    proformaRevenueAnnual: row.proforma_revenue_annual != null ? String(row.proforma_revenue_annual) : "",
    proformaRevenueMonthly: row.proforma_revenue_monthly != null ? String(row.proforma_revenue_monthly) : "",
    proformaRentPerSF: row.proforma_rent_per_sf != null ? String(row.proforma_rent_per_sf) : "",
    proformaExpensesPct: row.proforma_expenses_pct != null ? String(row.proforma_expenses_pct) : "",
    proformaExpensesAnnual: row.proforma_expenses_annual != null ? String(row.proforma_expenses_annual) : "",
    proformaExpensesMonthly: row.proforma_expenses_monthly != null ? String(row.proforma_expenses_monthly) : "",
    proformaExpensesPerSF: row.proforma_expenses_per_sf != null ? String(row.proforma_expenses_per_sf) : "",
    proformaVacancy: row.proforma_vacancy_pct != null ? String(row.proforma_vacancy_pct) : "",
    bridgeLoanTotal: row.bridge_loan_total != null ? String(row.bridge_loan_total) : "",
    bridgeInterestRate: row.bridge_interest_rate != null ? String(row.bridge_interest_rate) : "",
    bridgeInterestMonthly: row.bridge_interest_monthly != null ? String(row.bridge_interest_monthly) : "",
    bridgePoints: row.bridge_points_pct != null ? String(row.bridge_points_pct) : "",
    bridgeTotalCost: row.bridge_total_cost != null ? String(row.bridge_total_cost) : "",
    bridgeLTC: row.bridge_ltc != null ? String(row.bridge_ltc) : "",
    bridgeLTV: row.bridge_ltv != null ? String(row.bridge_ltv) : "",
    equityRequired: row.equity_required != null ? String(row.equity_required) : "",
    refiLoanAmount: row.refi_loan_amount != null ? String(row.refi_loan_amount) : "",
    refiPctARV: row.refi_pct_arv != null ? String(row.refi_pct_arv) : "",
    refiInterestRate: row.refi_interest_rate != null ? String(row.refi_interest_rate) : "",
    refiCashFlow: row.refi_cash_flow_annual != null ? String(row.refi_cash_flow_annual) : "",
    cashOutRefi: row.cash_out_refi != null ? String(row.cash_out_refi) : "",
    profitAtRefi: row.profit_at_refi != null ? String(row.profit_at_refi) : "",
    equityAfterRefi: row.equity_after_refi != null ? String(row.equity_after_refi) : "",
    refiValuation: row.refi_valuation != null ? String(row.refi_valuation) : "",
    reapScore: row.reap_score != null ? String(row.reap_score) : "",
    equityMultiple: row.equity_multiple != null ? String(row.equity_multiple) : "",
    // Edit-related fields (inputs)
    askingPrice: row.asking_price != null ? String(row.asking_price) : "",
    acqCostToClose: row.acq_cost_to_close_pct != null ? String(row.acq_cost_to_close_pct) : "",
    months: row.months != null ? String(row.months) : "",
    dispCostOfSale: row.disp_cost_of_sale_pct != null ? String(row.disp_cost_of_sale_pct) : "",
    bridgeAcqPct: row.bridge_acq_financed_pct != null ? String(row.bridge_acq_financed_pct) : "",
    bridgeImprovPct: row.bridge_improv_financed_pct != null ? String(row.bridge_improv_financed_pct) : "",
    refiPoints: row.refi_points_pct != null ? String(row.refi_points_pct) : "",
    refiTerm: row.refi_term_years != null ? String(row.refi_term_years) : "",
    lotAcres: row.lot_acres != null ? String(row.lot_acres) : "",
    yearBuilt: row.year_built != null ? String(row.year_built) : "",
    dealName: row.deal_name || "",
    zip: row.zip_code || "",
    dealClass: row.class || "",
    // Existing Financials
    existingRevenueAnnual: row.existing_revenue_annual != null ? String(row.existing_revenue_annual) : "",
    existingRevenueMonthly: row.existing_revenue_monthly != null ? String(row.existing_revenue_monthly) : "",
    existingRevenuePerSF: row.existing_revenue_per_sf != null ? String(row.existing_revenue_per_sf) : "",
    existingNOI: row.existing_noi != null ? String(row.existing_noi) : "",
    existingExpensePct: row.existing_expense_pct != null ? String(row.existing_expense_pct) : "",
    existingExpenses: row.existing_expenses != null ? String(row.existing_expenses) : "",
    existingCapRate: row.existing_cap_rate != null ? String(row.existing_cap_rate) : "",
    annualTaxes: row.annual_taxes != null ? String(row.annual_taxes) : "",
    insuranceCost: row.insurance_cost_annual != null ? String(row.insurance_cost_annual) : "",
    // Supabase ID (for editing by ID instead of address)
    _id: row.id,
  }));
}

export async function saveDeal(dealForm, userEmail) {
  const clean = (v) => {
    if (!v) return null;
    const n = parseFloat(String(v).replace(/[$,]/g, ""));
    return isNaN(n) ? null : n;
  };

  const row = {
    user_email: userEmail.toLowerCase(),
    date_added: new Date().toISOString(),
    deal_status: "New",
    property_address: dealForm.address,
    deal_name: dealForm.dealName || null,
    type: dealForm.type || null,
    city: dealForm.city || null,
    state: dealForm.state || null,
    zip_code: dealForm.zip || null,
    class: dealForm.class || null,
    sqft_net: clean(dealForm.sqft),
    units: dealForm.units ? parseInt(dealForm.units, 10) || null : null,
    year_built: dealForm.yearBuilt ? parseInt(dealForm.yearBuilt, 10) || null : null,
    lot_acres: clean(dealForm.lotAcres),
    asking_price: clean(dealForm.askingPrice),
    our_offer: clean(dealForm.ourOffer),
    source: "REAP App",
  };

  // Look up org_id
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("org_id")
    .eq("email", userEmail.toLowerCase())
    .maybeSingle();
  if (profile?.org_id) row.org_id = profile.org_id;

  const { data, error } = await supabase
    .from("deals")
    .insert(row)
    .select()
    .single();

  if (error) throw new Error("Failed to save deal: " + error.message);

  // Return local deal object for immediate UI update
  // The trigger will have computed the financial fields
  return {
    user: userEmail,
    date: row.date_added,
    status: "New",
    address: dealForm.address,
    type: dealForm.type || "",
    offer: dealForm.ourOffer || "",
    netSqft: "",
    sqft: dealForm.sqft || "",
    units: dealForm.units || "",
    purchasePrice: "",
    improvementBudget: "",
    arv: "",
    profit: data?.profit != null ? String(data.profit) : "",
    roi: data?.roi != null ? String(data.roi) : "",
    ctv: "",
    aar: "",
    profitability: "",
    source: "REAP App",
    city: dealForm.city || "",
    state: dealForm.state || "",
    askingPrice: dealForm.askingPrice || "",
    _id: data?.id,
  };
}

export async function editDeal(address, form) {
  const clean = (v) => {
    if (!v && v !== 0) return null;
    const n = parseFloat(String(v).replace(/[$,]/g, ""));
    return isNaN(n) ? null : n;
  };

  const updates = {
    deal_status: form.status,
    type: form.type,
    sqft_net: clean(form.sqft),
    units: form.units ? parseInt(String(form.units).replace(/,/g, ""), 10) || null : null,
    year_built: form.yearBuilt ? parseInt(String(form.yearBuilt).replace(/,/g, ""), 10) || null : null,
    lot_acres: clean(form.lotAcres),
    class: form.class,
    asking_price: clean(form.askingPrice),
    our_offer: clean(form.ourOffer),
    purchase_price: clean(form.purchasePrice),
    acq_cost_to_close_pct: clean(form.acqCostToClose),
    improvement_budget: clean(form.improvementBudget),
    arv_value: clean(form.arvValue),
    months: clean(form.months),
    disp_cost_of_sale_pct: clean(form.dispCostOfSale),
    proforma_revenue_annual: clean(form.proformaRevenueAnnual),
    proforma_expenses_pct: clean(form.proformaExpensesPct),
    proforma_vacancy_pct: clean(form.proformaVacancy),
    existing_revenue_annual: clean(form.existingRevenueAnnual),
    existing_expense_pct: clean(form.existingExpensePct),
    annual_taxes: clean(form.annualTaxes),
    insurance_cost_annual: clean(form.insuranceCost),
    bridge_acq_financed_pct: clean(form.bridgeAcqPct),
    bridge_improv_financed_pct: clean(form.bridgeImprovPct),
    bridge_interest_rate: clean(form.bridgeInterestRate),
    bridge_points_pct: clean(form.bridgePoints),
    refi_pct_arv: clean(form.refiPctARV),
    refi_interest_rate: clean(form.refiInterestRate),
    refi_points_pct: clean(form.refiPoints),
    refi_term_years: clean(form.refiTerm),
    updated_at: new Date().toISOString(),
  };

  // Edit by address (matching current behavior)
  const { error } = await supabase
    .from("deals")
    .update(updates)
    .eq("property_address", address);

  if (error) throw new Error("Failed to edit deal: " + error.message);
}

// AI Summary — still uses Apps Script (server-side Claude API call)
// Will migrate to Supabase Edge Function in a future phase
export async function generateAISummary(deal) {
  const result = await appsScriptPost({ action: "generate_summary", deal });
  return result.summary;
}


// ═══════════════════════════════════════════════════════════════════
// CONTACTS / BUYERS — Supabase (Phase 2)
// ═══════════════════════════════════════════════════════════════════

export async function getBuyers(teamEmails) {
  const emailsLower = teamEmails.map(e => e.toLowerCase());

  let query = supabase
    .from("contacts")
    .select("*")
    .order("date_added", { ascending: false });

  // Team filtering via RLS handles org-level access,
  // but we also filter by teamEmails for explicit team scoping
  if (emailsLower.length > 0) {
    query = query.in("user_email", emailsLower);
  }

  const { data, error } = await query;
  if (error) throw new Error("Failed to load contacts: " + error.message);

  // Map Supabase columns back to the shape App.js expects
  return (data || []).map(row => ({
    rowId: row.id,
    name: row.contact_name || "",
    firstName: row.first_name || "",
    email: row.email || "",
    phone: row.phone || "",
    contactType: row.contact_type || "",
    buyerStatus: row.buyer_status || "",
    assetPreference: row.asset_preference || "",
    temperature: row.temperature || "",
    manager: row.manager || "",
    notes: row.notes || "",
    leadSource: row.lead_source || "",
    company: row.company || "",
    dateAdded: row.date_added || "",
    lastContact: row.last_contact || "",
    followUpNotes: row.follow_up_notes || "",
    user: row.user_email || "",
  }));
}

export async function saveBuyer(form, userEmail, editingRowId = null) {
  const row = {
    user_email: userEmail.toLowerCase(),
    contact_name: form.name,
    first_name: (form.name || "").split(" ")[0],
    email: form.email,
    phone: form.phone,
    company: form.company,
    contact_type: form.contactType || "Buyer (Client)",
    buyer_status: form.buyerStatus || "New",
    asset_preference: form.assetPreference,
    temperature: form.temperature,
    manager: form.manager,
    notes: form.notes,
    lead_source: form.leadSource,
    updated_at: new Date().toISOString(),
  };

  if (editingRowId) {
    // Edit existing contact
    const { error } = await supabase
      .from("contacts")
      .update(row)
      .eq("id", editingRowId);
    if (error) throw new Error("Failed to edit contact: " + error.message);
  } else {
    // New contact
    row.date_added = new Date().toISOString();

    // Look up org_id for team sharing
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("org_id")
      .eq("email", userEmail.toLowerCase())
      .maybeSingle();
    if (profile?.org_id) row.org_id = profile.org_id;

    const { error } = await supabase.from("contacts").insert(row);
    if (error) throw new Error("Failed to save contact: " + error.message);
  }
}

// Slim contacts list (used by InvestorPipelineView for linking)
export async function getContactsList() {
  const { data, error } = await supabase
    .from("contacts")
    .select("id, contact_name, email, phone, company")
    .order("contact_name", { ascending: true });

  if (error) throw new Error("Failed to load contacts list: " + error.message);

  return (data || []).map(row => ({
    rowId: row.id,
    name: row.contact_name || "",
    email: row.email || "",
    phone: row.phone || "",
    company: row.company || "",
  }));
}


// ═══════════════════════════════════════════════════════════════════
// PORTFOLIOS — Supabase (Phase 1)
// ═══════════════════════════════════════════════════════════════════

export async function getPortfolios(teamEmails) {
  const emailsLower = teamEmails.map(e => e.toLowerCase());
  const { data, error } = await supabase
    .from("portfolios")
    .select("*")
    .in("user_email", emailsLower)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Failed to load portfolios: " + error.message);

  // Map Supabase columns back to the shape App.js expects
  return (data || []).map(row => ({
    id: row.id,
    user: row.user_email,
    name: row.name,
    type: row.type || "Owned",
    dealAddresses: row.deal_addresses ? row.deal_addresses.split("|||").filter(a => a) : [],
    createdAt: row.created_at || "",
  }));
}

export async function savePortfolio(data, userEmail) {
  const newId = "p_" + Date.now();
  const row = {
    id: newId,
    user_email: userEmail.toLowerCase(),
    name: data.name,
    type: data.type,
    deal_addresses: (data.dealAddresses || []).join("|||"),
    created_at: new Date().toISOString(),
  };

  // Try to look up org_id for team sharing
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("org_id")
    .eq("email", userEmail.toLowerCase())
    .maybeSingle();
  if (profile?.org_id) row.org_id = profile.org_id;

  const { error } = await supabase.from("portfolios").insert(row);
  if (error) throw new Error("Failed to save portfolio: " + error.message);

  return {
    id: newId,
    user: userEmail,
    name: data.name,
    type: data.type,
    dealAddresses: data.dealAddresses || [],
    createdAt: row.created_at,
  };
}

export async function editPortfolio(id, data) {
  const updates = {
    name: data.name,
    type: data.type,
    deal_addresses: (data.dealAddresses || []).join("|||"),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("portfolios")
    .update(updates)
    .eq("id", id);

  if (error) throw new Error("Failed to edit portfolio: " + error.message);
}

export async function deletePortfolio(id) {
  const { error } = await supabase
    .from("portfolios")
    .delete()
    .eq("id", id);

  if (error) throw new Error("Failed to delete portfolio: " + error.message);
}


// ═══════════════════════════════════════════════════════════════════
// MARKETS — Supabase (Phase 1)
// ═══════════════════════════════════════════════════════════════════

export async function getMarkets() {
  const { data, error } = await supabase
    .from("markets")
    .select("*")
    .order("market_name", { ascending: true });

  if (error) throw new Error("Failed to load markets: " + error.message);
  if (!data || data.length === 0) return null; // null signals "fall back to deal-based computation"

  // Map Supabase columns back to the shape App.js expects
  return data.map(row => ({
    market: row.market_name,
    medianPPU: row.median_price_per_unit != null ? String(row.median_price_per_unit) : "",
    capRateAvg: row.cap_rate_avg != null ? String(row.cap_rate_avg) : "",
    rentGrowth: row.rent_growth_yoy != null ? String(row.rent_growth_yoy) : "",
    popGrowth: row.population_growth != null ? String(row.population_growth) : "",
    aiSignal: row.ai_signal || "Neutral",
    region: row.region || "Other",
    dealCount: row.deal_count != null ? String(row.deal_count) : "",
    avgReapScore: row.avg_reap_score != null ? String(row.avg_reap_score) : "",
    totalVolume: row.total_volume != null ? String(row.total_volume) : "",
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
  const clean = (v) => {
    if (!v) return null;
    const n = parseFloat(String(v).replace(/[$,]/g, ""));
    return isNaN(n) ? null : n;
  };

  const row = {
    user_email: userEmail.toLowerCase(),
    date_added: new Date().toISOString(),
    deal_status: "New",
    property_address: listing.address,
    deal_name: listing.address || "MLS " + listing.mlsNumber,
    city: listing.city || null,
    zip_code: listing.zip || null,
    type: listing.propType || null,
    asking_price: clean(listing.price),
    sqft_net: clean(listing.heatedArea || listing.sqftTotal),
    units: listing.units ? parseInt(listing.units, 10) || null : null,
    lot_acres: clean(listing.lotAcres),
    year_built: listing.yearBuilt ? parseInt(listing.yearBuilt, 10) || null : null,
    source: "MLS Feed",
    metadata: listing.mlsNumber ? { mls_number: listing.mlsNumber } : {},
  };

  // Look up org_id
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("org_id")
    .eq("email", userEmail.toLowerCase())
    .maybeSingle();
  if (profile?.org_id) row.org_id = profile.org_id;

  const { error } = await supabase.from("deals").insert(row);
  if (error) throw new Error("Failed to add listing to pipeline: " + error.message);
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
