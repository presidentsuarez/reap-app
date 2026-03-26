// supabase/functions/generate-summary/index.ts
// ═══════════════════════════════════════════════════════════════════
// REAP | AI Summary Edge Function — Replaces Apps Script
// ═══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY")
    if (!CLAUDE_API_KEY) {
      throw new Error("CLAUDE_API_KEY not configured. Run: supabase secrets set CLAUDE_API_KEY=sk-ant-...")
    }

    const { deal } = await req.json()
    if (!deal) {
      throw new Error("Missing deal data in request body")
    }

    // Build the same prompt that was in Apps Script
    const prompt = `You are an expert real estate investment analyst at REAP Analytics. Generate a professional Executive Summary for the following investment opportunity.

DEAL DATA:
- Property: ${deal.address || "N/A"}
- City/State: ${deal.city || ""}, ${deal.state || ""}
- Type: ${deal.type || "Multifamily"}
- Units: ${deal.units || "N/A"}
- Square Footage: ${deal.sqft || "N/A"}
- Asking Price: ${deal.askingPrice || "N/A"}
- Our Offer / Purchase Price: ${deal.offer || deal.purchasePrice || "N/A"}
- Improvement Budget: ${deal.improvementBudget || "N/A"}
- ARV (As Completed Value): ${deal.arv || "N/A"}
- Projected Profit: ${deal.profit || "N/A"}
- ROI: ${deal.roi || "N/A"}
- Cap Rate: ${deal.capRate || "N/A"}
- DSCR: ${deal.dscr || "N/A"}
- NOI (Annual): ${deal.noiAnnual || "N/A"}
- Cash Flow (Monthly): ${deal.cashFlowMonthly || "N/A"}
- Proforma Revenue (Annual): ${deal.proformaRevenueAnnual || "N/A"}
- Proforma Expenses (Annual): ${deal.proformaExpensesAnnual || "N/A"}
- Bridge Loan Total: ${deal.bridgeLoanTotal || "N/A"}
- Bridge Interest Rate: ${deal.bridgeInterestRate || "N/A"}
- LTV: ${deal.bridgeLTV || "N/A"}
- Equity Required: ${deal.equityRequired || "N/A"}
- REAP Score: ${deal.reapScore || "N/A"}
- Equity Multiple: ${deal.equityMultiple || "N/A"}
- Profitability: ${deal.profitability || "N/A"}
- Cost to Value: ${deal.ctv || "N/A"}

FORMAT YOUR RESPONSE WITH THESE EXACT SECTIONS:

**Executive Summary**
[2-3 sentence compelling overview of the investment opportunity, location, and thesis]

**Property Overview**
[Description of the property, unit mix, location advantages, market dynamics]

**Project Highlights & Value-Add Plan**
[Improvement strategy, renovation budget, expected impact on rents and value]

**Financial Overview**
[Purchase price, total project cost, projected value, income, NOI, cash flow — use actual numbers from the data]

**Key Investment Metrics**
[Cap Rate, DSCR, LTV, ROI, Equity Multiple, REAP Score — use actual numbers]

**Strategic Rationale**
[Why this deal makes sense, market timing, risk mitigation, expected outcomes]

Write in a confident, institutional-quality tone. Use specific numbers from the deal data. If a value is "N/A" or missing, omit it rather than writing N/A. Keep total length to approximately 400-600 words.`

    // Call Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    const result = await response.json()

    if (result.content && result.content.length > 0) {
      const summary = result.content[0].text
      return new Response(
        JSON.stringify({ success: true, summary }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    } else if (result.error) {
      throw new Error(result.error.message || "Claude API error")
    } else {
      throw new Error("Unexpected API response")
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
