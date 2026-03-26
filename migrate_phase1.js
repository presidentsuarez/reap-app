#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// REAP | Phase 1 — Data Migration: Sheets → Supabase
// ═══════════════════════════════════════════════════════════════════
//
// BEFORE RUNNING:
//   1. Run REAP_Phase1_Tables.sql in Supabase SQL Editor
//   2. Get your Service Role Key from Supabase Dashboard:
//      Settings → API → service_role key (the secret one)
//   3. Run from reap-app folder:
//      export $(cat .env | xargs) && SUPABASE_SERVICE_KEY="your-key-here" node migrate_phase1.js
//
// ═══════════════════════════════════════════════════════════════════

const SPREADSHEET_ID = "1GclfTHS19k1yyUYucyHBKbwWk4NarxybcA5zQEr6o8Y";
const SHEETS_API_KEY = process.env.REACT_APP_SHEETS_API_KEY;
const SUPABASE_URL = "https://cpgwnrpaflaftlxrzlar.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("\n❌ Missing SUPABASE_SERVICE_KEY.");
  console.error("   Get it from: Supabase Dashboard → Settings → API → service_role key");
  console.error("   Run as: SUPABASE_SERVICE_KEY=\"your-key\" node migrate_phase1.js\n");
  process.exit(1);
}

if (!SHEETS_API_KEY) {
  console.error("\n❌ Missing REACT_APP_SHEETS_API_KEY.");
  console.error("   Run: export $(cat .env | xargs) && SUPABASE_SERVICE_KEY=\"your-key\" node migrate_phase1.js\n");
  process.exit(1);
}

async function sheetsRead(tab, range) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tab}!${range}?key=${SHEETS_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheets API error ${res.status} for ${tab}`);
  const data = await res.json();
  const rows = data.values || [];
  if (rows.length < 2) return { headers: rows[0] || [], rows: [] };
  return { headers: rows[0], rows: rows.slice(1) };
}

async function supabaseInsert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Prefer": "return=representation",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase insert error for ${table}: ${res.status} - ${err}`);
  }
  return await res.json();
}

async function supabaseLookupOrgId(email) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_profiles?email=eq.${encodeURIComponent(email)}&select=org_id`,
    {
      headers: {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.[0]?.org_id || null;
}

async function migratePortfolios() {
  console.log("\n📁 Migrating Portfolios...");
  const { rows } = await sheetsRead("Portfolios", "A1:F");
  if (rows.length === 0) { console.log("   No portfolios found. Skipping."); return 0; }
  console.log(`   Found ${rows.length} rows in Google Sheets`);

  const orgCache = {};
  const supabaseRows = [];

  for (const row of rows) {
    const id = row[0] || "";
    const userEmail = (row[1] || "").toLowerCase();
    const name = row[2] || "";
    const type = row[3] || "Owned";
    const dealAddresses = row[4] || "";
    const createdAt = row[5] || new Date().toISOString();

    if (!id || !userEmail || !name) continue;

    if (!(userEmail in orgCache)) {
      orgCache[userEmail] = await supabaseLookupOrgId(userEmail);
    }

    supabaseRows.push({
      id,
      user_email: userEmail,
      org_id: orgCache[userEmail],
      name,
      type: ["Owned", "Acquisition", "Watch List"].includes(type) ? type : "Owned",
      deal_addresses: dealAddresses,
      created_at: createdAt,
    });
  }

  if (supabaseRows.length === 0) { console.log("   No valid rows. Skipping."); return 0; }

  const result = await supabaseInsert("portfolios", supabaseRows);
  console.log(`   ✅ Inserted ${result.length} portfolios`);
  return result.length;
}

async function migrateMarkets() {
  console.log("\n🌍 Migrating Markets...");
  const { headers, rows } = await sheetsRead("Markets", "A1:J100");
  if (rows.length === 0) { console.log("   No markets found. Skipping."); return 0; }
  console.log(`   Found ${rows.length} rows in Google Sheets`);

  const idx = (name) => headers.findIndex(h => h && h.trim().toLowerCase() === name.toLowerCase());
  const g = (row, col) => col >= 0 && col < row.length ? row[col] : "";
  const parseNum = (v) => { if (!v) return null; const n = parseFloat(String(v).replace(/[$,%]/g, "")); return isNaN(n) ? null : n; };

  const colMarket = idx("Market"), colRegion = idx("Region");
  const colMedianPPU = idx("Median Price Per Unit"), colCapRate = idx("Cap Rate Avg");
  const colRentGrowth = idx("Rent Growth YoY"), colPopGrowth = idx("Population Growth");
  const colAiSignal = idx("AI Signal"), colDealCount = idx("Deal Count");
  const colAvgReapScore = idx("Avg REAP Score"), colTotalVolume = idx("Total Volume");

  const ownerEmail = "javier@thesuarezcapital.com";
  const orgId = await supabaseLookupOrgId(ownerEmail);

  const supabaseRows = rows.filter(row => g(row, colMarket)).map(row => {
    const signal = g(row, colAiSignal) || "Neutral";
    return {
      user_email: ownerEmail,
      org_id: orgId,
      market_name: g(row, colMarket),
      region: g(row, colRegion) || "Other",
      median_price_per_unit: parseNum(g(row, colMedianPPU)),
      cap_rate_avg: parseNum(g(row, colCapRate)),
      rent_growth_yoy: parseNum(g(row, colRentGrowth)),
      population_growth: parseNum(g(row, colPopGrowth)),
      ai_signal: ["Hot", "Warm", "Neutral", "Cooling"].includes(signal) ? signal : "Neutral",
      deal_count: parseInt(g(row, colDealCount)) || 0,
      avg_reap_score: parseNum(g(row, colAvgReapScore)),
      total_volume: parseNum(g(row, colTotalVolume)),
    };
  });

  if (supabaseRows.length === 0) { console.log("   No valid rows. Skipping."); return 0; }

  const result = await supabaseInsert("markets", supabaseRows);
  console.log(`   ✅ Inserted ${result.length} markets`);
  return result.length;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  REAP | Phase 1 Data Migration: Sheets → Supabase");
  console.log("═══════════════════════════════════════════════════════");

  try {
    const p = await migratePortfolios();
    const m = await migrateMarkets();

    console.log("\n═══════════════════════════════════════════════════════");
    console.log(`  ✅ Done! Portfolios: ${p} | Markets: ${m}`);
    console.log("═══════════════════════════════════════════════════════");
    console.log("\n  Next: replace src/dataService.js → test → deploy\n");
  } catch (err) {
    console.error("\n❌ Failed:", err.message);
    process.exit(1);
  }
}

main();
