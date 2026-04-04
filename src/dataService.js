// ═══════════════════════════════════════════════════════════════════
// REAP | dataService.js — Data Access Abstraction Layer
// ═══════════════════════════════════════════════════════════════════
//
// ALL data flows through this file. App.js never touches a DB directly.
//
// Phase 0: ✅ Abstraction layer created
// Phase 1: ✅ Portfolios + Markets → Supabase
// Phase 2: ✅ Contacts → Supabase
// Phase 3: ✅ Deals → Supabase (with financial trigger)
// Phase 3B: ✅ MLS Feed + File Uploads + Investors → Supabase
//
// Google Sheets: FULLY RETIRED (no reads or writes)
// ALL Google dependencies: ELIMINATED
//
// Supabase tables: deals, contacts, portfolios, markets,
//   mls_listings, file_uploads, investors, investor_activities
// ═══════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

// ── Supabase client (used by Portfolios, Markets) ────────────────
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);


// ── Helpers ──────────────────────────────────────────────────────



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
    // Metadata (e.g. MLS number reference)
    metadata: row.metadata || {},
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

// AI Summary — Supabase Edge Function (Session 12)
export async function generateAISummary(deal) {
  const { data, error } = await supabase.functions.invoke("generate-summary", {
    body: { deal },
  });

  if (error) throw new Error("AI Summary error: " + error.message);
  if (!data?.success) throw new Error(data?.error || "Failed to generate summary");
  return data.summary;
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
// MLS FEED — Supabase (Phase 3B)
// ═══════════════════════════════════════════════════════════════════

export async function getListings() {
  const { data, error } = await supabase
    .from("mls_listings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error("Failed to load MLS listings: " + error.message);

  return (data || []).map((row, i) => ({
    rowIndex: i + 2,
    mlsNumber: row.mls_number || "",
    status: row.status || "",
    adom: row.adom || "",
    cdom: row.cdom || "",
    price: row.price != null ? String(row.price) : "",
    address: row.address || "",
    city: row.city || "",
    county: row.county || "",
    ownership: row.ownership || "",
    propType: row.prop_type || "",
    style: row.style || "",
    units: row.units || "",
    heatedArea: row.heated_area != null ? String(row.heated_area) : "",
    lotAcres: row.lot_acres != null ? String(row.lot_acres) : "",
    beds: row.beds || "",
    baths: row.baths || "",
    yearBuilt: row.year_built || "",
    ppsf: row.ppsf || "",
    agent: row.agent || "",
    publicRemarks: row.public_remarks || "",
    realtorRemarks: row.realtor_remarks || "",
    zip: row.zip || "",
    sqftTotal: row.sqft_total != null ? String(row.sqft_total) : "",
  }));
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
// FILE UPLOADS — Supabase (Phase 3B)
// ═══════════════════════════════════════════════════════════════════

export async function getUploads() {
  const { data, error } = await supabase
    .from("file_uploads")
    .select("*")
    .order("uploaded_at", { ascending: false });

  if (error) throw new Error("Failed to load uploads: " + error.message);

  return (data || []).map(row => ({
    rowIndex: row.id,
    filename: row.filename || "",
    link: row.file_link || "",
    date: row.uploaded_at || "",
    user: row.user_email || "",
    status: row.status || "Uploaded",
  }));
}

export async function uploadFile(file, userEmail) {
  // For now, store file metadata in the table
  // Full Supabase Storage integration can come later
  const row = {
    user_email: userEmail.toLowerCase(),
    filename: file.name,
    mime_type: file.type || "application/octet-stream",
    file_size: file.size,
    status: "Uploaded",
    uploaded_at: new Date().toISOString(),
  };

  // Look up org_id
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("org_id")
    .eq("email", userEmail.toLowerCase())
    .maybeSingle();
  if (profile?.org_id) row.org_id = profile.org_id;

  const { error } = await supabase.from("file_uploads").insert(row);
  if (error) throw new Error("Failed to save upload record: " + error.message);
}


// ═══════════════════════════════════════════════════════════════════
// INVESTORS — Supabase (Phase 3B)
// ═══════════════════════════════════════════════════════════════════

export async function getInvestors(teamEmails) {
  const emailsLower = teamEmails.map(e => e.toLowerCase());

  let query = supabase
    .from("investors")
    .select("*")
    .order("date_added", { ascending: false });

  if (emailsLower.length > 0) {
    query = query.in("user_email", emailsLower);
  }

  const { data, error } = await query;
  if (error) throw new Error("Failed to load investors: " + error.message);

  return (data || []).map(row => ({
    id: row.id,
    user: row.user_email || "",
    investorName: row.investor_name || "",
    investorType: row.investor_type || "",
    pipelineStage: row.pipeline_stage || "",
    temperature: row.temperature || "",
    capitalRangeMin: row.capital_range_min != null ? String(row.capital_range_min) : "",
    capitalRangeMax: row.capital_range_max != null ? String(row.capital_range_max) : "",
    capitalCommitted: row.capital_committed != null ? String(row.capital_committed) : "",
    capitalFunded: row.capital_funded != null ? String(row.capital_funded) : "",
    investmentThesis: row.investment_thesis || "",
    preferredReturn: row.preferred_return || "",
    irrTarget: row.irr_target || "",
    holdPeriod: row.hold_period || "",
    assetPreference: row.asset_preference || "",
    geographyPreference: row.geography_preference || "",
    minDealSize: row.min_deal_size != null ? String(row.min_deal_size) : "",
    equityStructure: row.equity_structure || "",
    leadSource: row.lead_source || "",
    contactIds: row.contact_ids ? row.contact_ids.split("|||").filter(Boolean) : [],
    linkedDealAddresses: row.linked_deal_addresses ? row.linked_deal_addresses.split("|||").filter(Boolean) : [],
    notes: row.notes || "",
    dateAdded: row.date_added || "",
    dateLastContact: row.date_last_contact || "",
    nextFollowUp: row.next_follow_up || "",
    company: row.company || "",
  }));
}

export async function saveInvestor(form, userEmail) {
  const newId = "inv_" + Date.now();
  const row = {
    id: newId,
    user_email: userEmail.toLowerCase(),
    investor_name: form.investorName,
    investor_type: form.investorType || null,
    pipeline_stage: form.pipelineStage || null,
    temperature: form.temperature || null,
    capital_range_min: form.capitalRangeMin ? parseFloat(String(form.capitalRangeMin).replace(/[$,]/g, "")) || null : null,
    capital_range_max: form.capitalRangeMax ? parseFloat(String(form.capitalRangeMax).replace(/[$,]/g, "")) || null : null,
    investment_thesis: form.investmentThesis || null,
    preferred_return: form.preferredReturn || null,
    irr_target: form.irrTarget || null,
    hold_period: form.holdPeriod || null,
    asset_preference: form.assetPreference || null,
    geography_preference: form.geographyPreference || null,
    min_deal_size: form.minDealSize ? parseFloat(String(form.minDealSize).replace(/[$,]/g, "")) || null : null,
    equity_structure: form.equityStructure || null,
    lead_source: form.leadSource || null,
    notes: form.notes || null,
    company: form.company || null,
    date_added: new Date().toISOString(),
  };

  // Look up org_id
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("org_id")
    .eq("email", userEmail.toLowerCase())
    .maybeSingle();
  if (profile?.org_id) row.org_id = profile.org_id;

  const { data, error } = await supabase
    .from("investors")
    .insert(row)
    .select()
    .single();

  if (error) throw new Error("Failed to save investor: " + error.message);

  // Return in the shape App.js expects
  return {
    id: data.id,
    user: data.user_email,
    investorName: data.investor_name,
    investorType: data.investor_type || "",
    pipelineStage: data.pipeline_stage || "",
    temperature: data.temperature || "",
    dateAdded: data.date_added || "",
    company: data.company || "",
  };
}

export async function editInvestor(id, updates) {
  // Map App.js field names to Supabase column names
  const row = {};
  if (updates.investorName !== undefined) row.investor_name = updates.investorName;
  if (updates.investorType !== undefined) row.investor_type = updates.investorType;
  if (updates.pipelineStage !== undefined) row.pipeline_stage = updates.pipelineStage;
  if (updates.temperature !== undefined) row.temperature = updates.temperature;
  if (updates.capitalRangeMin !== undefined) row.capital_range_min = parseFloat(String(updates.capitalRangeMin).replace(/[$,]/g, "")) || null;
  if (updates.capitalRangeMax !== undefined) row.capital_range_max = parseFloat(String(updates.capitalRangeMax).replace(/[$,]/g, "")) || null;
  if (updates.capitalCommitted !== undefined) row.capital_committed = parseFloat(String(updates.capitalCommitted).replace(/[$,]/g, "")) || null;
  if (updates.capitalFunded !== undefined) row.capital_funded = parseFloat(String(updates.capitalFunded).replace(/[$,]/g, "")) || null;
  if (updates.investmentThesis !== undefined) row.investment_thesis = updates.investmentThesis;
  if (updates.preferredReturn !== undefined) row.preferred_return = updates.preferredReturn;
  if (updates.irrTarget !== undefined) row.irr_target = updates.irrTarget;
  if (updates.holdPeriod !== undefined) row.hold_period = updates.holdPeriod;
  if (updates.assetPreference !== undefined) row.asset_preference = updates.assetPreference;
  if (updates.geographyPreference !== undefined) row.geography_preference = updates.geographyPreference;
  if (updates.minDealSize !== undefined) row.min_deal_size = parseFloat(String(updates.minDealSize).replace(/[$,]/g, "")) || null;
  if (updates.equityStructure !== undefined) row.equity_structure = updates.equityStructure;
  if (updates.leadSource !== undefined) row.lead_source = updates.leadSource;
  if (updates.notes !== undefined) row.notes = updates.notes;
  if (updates.company !== undefined) row.company = updates.company;
  if (updates.linkedDealAddresses !== undefined) row.linked_deal_addresses = (updates.linkedDealAddresses || []).join("|||");
  if (updates.contactIds !== undefined) row.contact_ids = (updates.contactIds || []).join("|||");
  if (updates.dateLastContact !== undefined) row.date_last_contact = updates.dateLastContact;
  if (updates.nextFollowUp !== undefined) row.next_follow_up = updates.nextFollowUp;

  row.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("investors")
    .update(row)
    .eq("id", id);

  if (error) throw new Error("Failed to edit investor: " + error.message);
}

export async function deleteInvestor(id) {
  const { error } = await supabase
    .from("investors")
    .delete()
    .eq("id", id);

  if (error) throw new Error("Failed to delete investor: " + error.message);
}

export async function getInvestorActivities() {
  const { data, error } = await supabase
    .from("investor_activities")
    .select("*")
    .order("activity_date", { ascending: false });

  if (error) throw new Error("Failed to load activities: " + error.message);

  return (data || []).map(row => ({
    activityId: row.id,
    investorId: row.investor_id || "",
    user: row.user_email || "",
    activityType: row.activity_type || "",
    description: row.description || "",
    date: row.activity_date || "",
    createdAt: row.created_at || "",
  }));
}

export async function logInvestorActivity(investorId, userEmail, form) {
  const row = {
    investor_id: investorId,
    user_email: userEmail.toLowerCase(),
    activity_type: form.activityType || form.type || null,
    description: form.description || null,
    activity_date: form.date || new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("investor_activities")
    .insert(row)
    .select()
    .single();

  if (error) throw new Error("Failed to log activity: " + error.message);

  return {
    activityId: data.id,
    investorId: data.investor_id,
    user: data.user_email,
    activityType: data.activity_type || "",
    description: data.description || "",
    date: data.activity_date || "",
    createdAt: data.created_at || "",
  };
}
