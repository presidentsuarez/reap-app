// ═══════════════════════════════════════════════════════════════════
// REAP | Phase 3B — Migrate MLS + File Uploads + Investors → Supabase
// ═══════════════════════════════════════════════════════════════════
//
// Usage:
//   SUPABASE_SERVICE_KEY="your-key" node migrate_phase3b.js
// ═══════════════════════════════════════════════════════════════════

require("dotenv").config();

const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;
const API_KEY = process.env.REACT_APP_SHEETS_API_KEY;
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SPREADSHEET_ID || !API_KEY) { console.error("❌ Missing Sheets env vars"); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_KEY. Run as: SUPABASE_SERVICE_KEY="your-key" node migrate_phase3b.js');
  process.exit(1);
}

const HEADERS = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_SERVICE_KEY,
  "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Prefer": "return=minimal",
};

async function sheetsRead(tab, range) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tab}!${range}?key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 400) return { headers: [], rows: [] }; // tab doesn't exist
    throw new Error(`Sheets API error: ${res.status} for ${tab}`);
  }
  const data = await res.json();
  const all = data.values || [];
  if (all.length < 2) return { headers: all[0] || [], rows: [] };
  return { headers: all[0], rows: all.slice(1) };
}

async function insertBatch(table, rows) {
  const BATCH = 100;
  let count = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST", headers: HEADERS, body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`${table} batch ${Math.floor(i/BATCH)+1}: ${res.status} — ${err}`);
    }
    count += batch.length;
    if (rows.length > BATCH) console.log(`   ... ${count}/${rows.length}`);
  }
  return count;
}

const parseNum = (v) => { if (!v) return null; const n = parseFloat(String(v).replace(/[$,%]/g,"")); return isNaN(n) ? null : n; };
const parseDate = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString(); };

async function getOrgId() {
  const url = `${SUPABASE_URL}/rest/v1/organizations?owner_email=eq.javier@thesuarezcapital.com&select=id&limit=1`;
  const res = await fetch(url, { headers: HEADERS });
  const orgs = await res.json();
  return orgs.length > 0 ? orgs[0].id : null;
}


// ─── MLS LISTINGS ────────────────────────────────────────────────

async function migrateMLS() {
  console.log("\n🏠 Migrating MLS Listings...");
  const { headers, rows } = await sheetsRead("MLS Feed", "A1:W");
  if (rows.length === 0) { console.log("   No MLS data found. Skipping."); return 0; }
  console.log(`   Found ${rows.length} listings`);

  const idx = (name) => headers.findIndex(h => h && h.trim().toLowerCase() === name.toLowerCase());
  const g = (row, col) => col >= 0 && col < row.length ? (row[col] || "").trim() : "";

  const colMls = idx("ml number") >= 0 ? idx("ml number") : idx("mls number") >= 0 ? idx("mls number") : idx("mls #");
  const colStatus = idx("status");
  const colAdom = idx("adom");
  const colCdom = idx("cdom");
  const colPrice = idx("current price") >= 0 ? idx("current price") : idx("price");
  const colAddr = idx("address");
  const colCity = idx("city");
  const colCounty = idx("county");
  const colZip = idx("zip");
  const colOwnership = idx("ownership");
  const colPropType = idx("prop type") >= 0 ? idx("prop type") : idx("property type");
  const colStyle = idx("property style");
  const colUnits = idx("total units");
  const colHeated = idx("heated area");
  const colLotAcres = idx("lot size acres");
  const colBeds = idx("beds");
  const colBaths = idx("bathrooms total") >= 0 ? idx("bathrooms total") : idx("baths");
  const colYearBuilt = idx("year built");
  const colPpsf = idx("$/sqft");
  const colSqftTotal = idx("sqft total");
  const colAgent = idx("list agent");
  const colPublic = idx("public remarks");
  const colRealtor = idx("realtor only remarks");

  const listings = rows
    .filter(row => g(row, colAddr) || g(row, colMls))
    .map(row => ({
      mls_number: g(row, colMls) || null,
      status: g(row, colStatus) || null,
      adom: g(row, colAdom) || null,
      cdom: g(row, colCdom) || null,
      price: parseNum(g(row, colPrice)),
      address: g(row, colAddr) || null,
      city: g(row, colCity) || null,
      county: g(row, colCounty) || null,
      zip: g(row, colZip) || null,
      ownership: g(row, colOwnership) || null,
      prop_type: g(row, colPropType) || null,
      style: g(row, colStyle) || null,
      units: g(row, colUnits) || null,
      heated_area: parseNum(g(row, colHeated)),
      lot_acres: parseNum(g(row, colLotAcres)),
      beds: g(row, colBeds) || null,
      baths: g(row, colBaths) || null,
      year_built: g(row, colYearBuilt) || null,
      ppsf: g(row, colPpsf) || null,
      sqft_total: parseNum(g(row, colSqftTotal)),
      agent: g(row, colAgent) || null,
      public_remarks: g(row, colPublic) || null,
      realtor_remarks: g(row, colRealtor) || null,
    }));

  const count = await insertBatch("mls_listings", listings);
  console.log(`   ✅ Inserted ${count} MLS listings`);
  return count;
}


// ─── FILE UPLOADS ────────────────────────────────────────────────

async function migrateUploads() {
  console.log("\n📄 Migrating File Uploads...");
  const { headers, rows } = await sheetsRead("File Uploads", "A1:E");
  if (rows.length === 0) { console.log("   No uploads found. Skipping."); return 0; }
  console.log(`   Found ${rows.length} uploads`);

  const idx = (name) => headers.findIndex(h => h && h.trim().toLowerCase() === name.toLowerCase());
  const g = (row, col) => col >= 0 && col < row.length ? (row[col] || "").trim() : "";

  const colFilename = idx("filename") >= 0 ? idx("filename") : 0;
  const colLink = idx("file link") >= 0 ? idx("file link") : idx("link") >= 0 ? idx("link") : 1;
  const colDate = idx("uploaded at") >= 0 ? idx("uploaded at") : idx("date") >= 0 ? idx("date") : 2;
  const colUser = idx("user") >= 0 ? idx("user") : 3;
  const colStatus = idx("status") >= 0 ? idx("status") : 4;

  const orgId = await getOrgId();

  const uploads = rows
    .filter(row => g(row, colFilename) || g(row, colLink))
    .map(row => ({
      user_email: (g(row, colUser) || "javier@thesuarezcapital.com").toLowerCase().trim(),
      org_id: orgId,
      filename: g(row, colFilename) || "unknown",
      file_link: g(row, colLink) || null,
      status: g(row, colStatus) || "Uploaded",
      uploaded_at: parseDate(g(row, colDate)) || new Date().toISOString(),
    }));

  const count = await insertBatch("file_uploads", uploads);
  console.log(`   ✅ Inserted ${count} file uploads`);
  return count;
}


// ─── INVESTORS ───────────────────────────────────────────────────

async function migrateInvestors() {
  console.log("\n💰 Migrating Investors...");
  const { headers, rows } = await sheetsRead("Investors", "A1:Z");
  if (rows.length === 0) { console.log("   No investors found. Skipping."); return 0; }
  console.log(`   Found ${rows.length} investors`);

  const idx = (name) => headers.findIndex(h => h && h.trim() === name.trim());
  const g = (row, col) => col >= 0 && col < row.length ? (row[col] || "").trim() : "";
  const orgId = await getOrgId();

  const investors = rows
    .filter(row => g(row, idx("Investor Name")))
    .map(row => ({
      id: g(row, idx("Investor ID")) || "inv_" + Date.now() + "_" + Math.random().toString(36).slice(2,6),
      user_email: (g(row, idx("User")) || "javier@thesuarezcapital.com").toLowerCase().trim(),
      org_id: orgId,
      investor_name: g(row, idx("Investor Name")),
      investor_type: g(row, idx("Investor Type")) || null,
      pipeline_stage: g(row, idx("Pipeline Stage")) || null,
      temperature: g(row, idx("Temperature")) || null,
      capital_range_min: parseNum(g(row, idx("Capital Range Min"))),
      capital_range_max: parseNum(g(row, idx("Capital Range Max"))),
      capital_committed: parseNum(g(row, idx("Capital Committed"))),
      capital_funded: parseNum(g(row, idx("Capital Funded"))),
      investment_thesis: g(row, idx("Investment Thesis")) || null,
      preferred_return: g(row, idx("Preferred Return")) || null,
      irr_target: g(row, idx("IRR Target")) || null,
      hold_period: g(row, idx("Hold Period")) || null,
      asset_preference: g(row, idx("Asset Preference")) || null,
      geography_preference: g(row, idx("Geography Preference")) || null,
      min_deal_size: parseNum(g(row, idx("Min Deal Size"))),
      equity_structure: g(row, idx("Equity Structure")) || null,
      lead_source: g(row, idx("Lead Source")) || null,
      contact_ids: g(row, idx("Contact IDs")) || "",
      linked_deal_addresses: g(row, idx("Linked Deal Addresses")) || "",
      notes: g(row, idx("Notes")) || null,
      company: g(row, idx("Company / Entity")) || null,
      date_added: parseDate(g(row, idx("Date Added"))) || new Date().toISOString(),
      date_last_contact: parseDate(g(row, idx("Date Last Contact"))),
      next_follow_up: parseDate(g(row, idx("Next Follow-Up"))),
    }));

  const count = await insertBatch("investors", investors);
  console.log(`   ✅ Inserted ${count} investors`);
  return count;
}


// ─── INVESTOR ACTIVITIES ─────────────────────────────────────────

async function migrateActivities() {
  console.log("\n📋 Migrating Investor Activities...");
  const { headers, rows } = await sheetsRead("Investor Activity", "A1:G");
  if (rows.length === 0) { console.log("   No activities found. Skipping."); return 0; }
  console.log(`   Found ${rows.length} activities`);

  const idx = (name) => headers.findIndex(h => h && h.trim() === name.trim());
  const g = (row, col) => col >= 0 && col < row.length ? (row[col] || "").trim() : "";

  const activities = rows
    .filter(row => g(row, idx("Investor ID")))
    .map(row => ({
      investor_id: g(row, idx("Investor ID")),
      user_email: (g(row, idx("User")) || "javier@thesuarezcapital.com").toLowerCase().trim(),
      activity_type: g(row, idx("Activity Type")) || null,
      description: g(row, idx("Description")) || null,
      activity_date: parseDate(g(row, idx("Date"))) || new Date().toISOString(),
      created_at: parseDate(g(row, idx("Created At"))) || new Date().toISOString(),
    }));

  const count = await insertBatch("investor_activities", activities);
  console.log(`   ✅ Inserted ${count} investor activities`);
  return count;
}


// ─── MAIN ────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  REAP | Phase 3B: MLS + Uploads + Investors → Supabase");
  console.log("═══════════════════════════════════════════════════");

  try {
    const mls = await migrateMLS();
    const uploads = await migrateUploads();
    const investors = await migrateInvestors();
    const activities = await migrateActivities();

    console.log("\n═══════════════════════════════════════════════════");
    console.log(`  ✅ Phase 3B Complete`);
    console.log(`     MLS: ${mls} | Uploads: ${uploads} | Investors: ${investors} | Activities: ${activities}`);
    console.log("═══════════════════════════════════════════════════\n");
  } catch (err) {
    console.error("\n❌ Migration failed:", err.message);
    console.error(err);
    process.exit(1);
  }
}

main();
