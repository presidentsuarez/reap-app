// ═══════════════════════════════════════════════════════════════════
// REAP | Phase 2 — Migrate Contacts from Sheets → Supabase
// ═══════════════════════════════════════════════════════════════════
//
// Run AFTER the SQL migration (REAP_Phase2_Migration.sql).
//
// Usage:
//   cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/Development/reap-app
//   SUPABASE_SERVICE_KEY="your-key" node migrate_phase2.js
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
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY.");
  console.error('   Run as: SUPABASE_SERVICE_KEY="your-key" node migrate_phase2.js');
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

async function supabaseInsertBatch(table, rows) {
  // Insert in batches of 100 to avoid payload limits
  const BATCH_SIZE = 100;
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
      throw new Error(`Supabase error for ${table} (batch ${Math.floor(i / BATCH_SIZE) + 1}): ${res.status} — ${err}`);
    }
    inserted += batch.length;
    if (rows.length > BATCH_SIZE) {
      console.log(`   ... inserted ${inserted}/${rows.length}`);
    }
  }
  return inserted;
}

// ── The 16 active field column names in Google Sheets ──
const ACTIVE_FIELDS = [
  "🔒 Row ID",
  "Contact / Name",
  "Contact / First Name",
  "Contact / Email",
  "Contact / Phone",
  "Contact / Type",
  "Contact / Company",
  "Buyer / Status",
  "Contact / Asset Preference",
  "Contact / Temperature",
  "Contact / Manager",
  "Contact / Notes",
  "Contact / Lead Source",
  "Date / Added",
  "Date / Last Contact",
  "Contact / Follow Up Notes",
  "User",
];

async function migrateContacts() {
  console.log("\n👤 Migrating Contacts...");

  const { headers, rows } = await sheetsRead("Contacts", "A1:BQ");
  console.log(`   Found ${rows.length} rows in Google Sheets (${headers.length} columns)`);

  if (rows.length === 0) {
    console.log("   No contacts to migrate.");
    return 0;
  }

  const idx = (name) => headers.findIndex(h => h && h.trim() === name.trim());
  const g = (row, col) => col >= 0 && col < row.length ? (row[col] || "").trim() : "";

  // Column indices for active fields
  const colRowId = idx("🔒 Row ID");
  const colName = idx("Contact / Name");
  const colFirstName = idx("Contact / First Name");
  const colEmail = idx("Contact / Email");
  const colPhone = idx("Contact / Phone");
  const colType = idx("Contact / Type");
  const colCompany = idx("Contact / Company");
  const colBuyerStatus = idx("Buyer / Status");
  const colAssetPref = idx("Contact / Asset Preference");
  const colTemperature = idx("Contact / Temperature");
  const colManager = idx("Contact / Manager");
  const colNotes = idx("Contact / Notes");
  const colLeadSource = idx("Contact / Lead Source");
  const colDateAdded = idx("Date / Added");
  const colLastContact = idx("Date / Last Contact");
  const colFollowUpNotes = idx("Contact / Follow Up Notes");
  const colUser = idx("User");

  // Build set of active column indices to know which ones go to metadata
  const activeIndices = new Set(ACTIVE_FIELDS.map(f => idx(f)).filter(i => i >= 0));

  // Look up org_id
  const orgLookupUrl = `${SUPABASE_URL}/rest/v1/organizations?owner_email=eq.javier@thesuarezcapital.com&select=id&limit=1`;
  const orgRes = await fetch(orgLookupUrl, { headers: SUPABASE_HEADERS });
  const orgs = await orgRes.json();
  const orgId = orgs.length > 0 ? orgs[0].id : null;

  const parseDate = (val) => {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  const contacts = rows
    .filter(row => g(row, colName)) // must have a name
    .map(row => {
      // Build metadata from all non-active columns that have data
      const metadata = {};
      headers.forEach((header, i) => {
        if (!activeIndices.has(i) && g(row, i)) {
          // Use the header name as the key, cleaned up
          const key = (header || `col_${i}`).trim();
          metadata[key] = g(row, i);
        }
      });

      return {
        user_email: (g(row, colUser) || "javier@thesuarezcapital.com").toLowerCase().trim(),
        org_id: orgId,
        contact_name: g(row, colName),
        first_name: g(row, colFirstName) || (g(row, colName) || "").split(" ")[0],
        email: g(row, colEmail),
        phone: g(row, colPhone),
        contact_type: g(row, colType),
        company: g(row, colCompany),
        buyer_status: g(row, colBuyerStatus),
        asset_preference: g(row, colAssetPref),
        temperature: g(row, colTemperature),
        manager: g(row, colManager),
        notes: g(row, colNotes),
        lead_source: g(row, colLeadSource),
        date_added: parseDate(g(row, colDateAdded)) || new Date().toISOString(),
        last_contact: parseDate(g(row, colLastContact)),
        follow_up_notes: g(row, colFollowUpNotes),
        metadata: Object.keys(metadata).length > 0 ? metadata : {},
      };
    });

  console.log(`   Prepared ${contacts.length} contacts (${headers.length - ACTIVE_FIELDS.length} extra columns → metadata JSONB)`);

  const inserted = await supabaseInsertBatch("contacts", contacts);
  console.log(`   ✅ Inserted ${inserted} contacts`);
  return inserted;
}

// ─── VERIFY ──────────────────────────────────────────────────────

async function verify() {
  console.log("\n🔍 Verifying...");
  const url = `${SUPABASE_URL}/rest/v1/contacts?select=id&limit=10000`;
  const res = await fetch(url, { headers: SUPABASE_HEADERS });
  const data = await res.json();
  console.log(`   Contacts in Supabase: ${Array.isArray(data) ? data.length : 0}`);

  // Sample one contact to show metadata works
  const sampleUrl = `${SUPABASE_URL}/rest/v1/contacts?select=contact_name,email,contact_type,metadata&limit=1`;
  const sampleRes = await fetch(sampleUrl, { headers: SUPABASE_HEADERS });
  const sample = await sampleRes.json();
  if (sample.length > 0) {
    const metaKeys = Object.keys(sample[0].metadata || {});
    console.log(`   Sample: "${sample[0].contact_name}" (${sample[0].email || "no email"})`);
    console.log(`   Metadata fields preserved: ${metaKeys.length} extra columns`);
  }
}

// ─── MAIN ────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  REAP | Phase 2 Data Migration: Contacts → Supabase");
  console.log("═══════════════════════════════════════════════════");
  console.log(`   Sheets:   ${SPREADSHEET_ID.slice(0, 12)}...`);
  console.log(`   Supabase: ${SUPABASE_URL}`);

  try {
    const count = await migrateContacts();
    await verify();

    console.log("\n═══════════════════════════════════════════════════");
    console.log(`  ✅ Phase 2 Migration Complete — ${count} contacts`);
    console.log("═══════════════════════════════════════════════════\n");
  } catch (err) {
    console.error("\n❌ Migration failed:", err.message);
    console.error(err);
    process.exit(1);
  }
}

main();
