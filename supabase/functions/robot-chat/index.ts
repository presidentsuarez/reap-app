import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_ITERATIONS = 10;

// Tool definitions for Phase 1
const tools = [
  {
    name: "assign_task",
    description: "Create a task for the user or assign it to a robot. Use when the user asks to create a to-do, reminder, task, or action item.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short task name" },
        description: { type: "string", description: "Detailed description" },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Task priority" },
        due_date: { type: "string", description: "Due date in ISO format (optional)" },
      },
      required: ["name"],
    },
  },
  {
    name: "query_deals",
    description: "Query the user's real estate deals from REAP. Use to look up deal pipeline, property details, financials, REAP scores, or answer questions about specific properties.",
    input_schema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Search by address, city, or deal name" },
        status: { type: "string", description: "Filter by deal status: New, Underwriting, Offer, Under Contract, Closed, Dead, On Hold" },
        sort_by: { type: "string", enum: ["reap_score", "asking_price", "arv_value", "date_added"], description: "Sort field" },
        limit: { type: "number", description: "Max results (default 10)" },
      },
    },
  },
  {
    name: "query_contacts",
    description: "Query the user's contacts from REAP CRM. Use to look up lenders, buyers, investors, wholesalers, or any contact by name, email, or type.",
    input_schema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Search by name, email, company, or phone" },
        contact_type: { type: "string", description: "Filter: Lender, Buyer, Wholesaler, Investor, Agent, etc." },
        limit: { type: "number", description: "Max results (default 10)" },
      },
    },
  },
  {
    name: "get_pipeline_summary",
    description: "Get a summary of the user's deal pipeline — counts by status, total pipeline value, average REAP score, top deals. Use when user asks about their pipeline, overview, or summary.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
];

// Execute a tool call
async function executeTool(toolName: string, toolInput: any, userId: string, robotId: string, supabase: any) {
  try {
    switch (toolName) {
      case "assign_task": {
        const { data, error } = await supabase.from("robot_tasks").insert({
          user_id: userId,
          robot_id: robotId,
          name: toolInput.name,
          description: toolInput.description || null,
          priority: toolInput.priority || "medium",
          due_date: toolInput.due_date || null,
          status: "open",
        }).select().single();
        if (error) return { error: error.message };
        return { success: true, task: { id: data.id, name: data.name, priority: data.priority, status: "open" } };
      }

      case "query_deals": {
        let query = supabase.from("deals").select("id, deal_name, property_address, city, state, type, deal_status, asking_price, our_offer, arv_value, improvement_budget, sqft_net, units, reap_score, noi_annual, cap_rate, roi, cash_flow_monthly, source, date_added, owner_email, assignee_email")
          .or(`user_email.eq.${userId},owner_email.eq.${userId}`)
          .order("date_added", { ascending: false });

        // We need to filter by the user's email, not user_id for deals
        // Let's get the user's email first
        const { data: userProfile } = await supabase.from("auth.users").select("email").eq("id", userId).single();
        const userEmail = userProfile?.email;

        if (userEmail) {
          query = supabase.from("deals").select("id, deal_name, property_address, city, state, type, deal_status, asking_price, our_offer, arv_value, improvement_budget, sqft_net, units, reap_score, noi_annual, cap_rate, roi, cash_flow_monthly, source, date_added, owner_email, assignee_email")
            .order("date_added", { ascending: false });
        }

        if (toolInput.status) query = query.eq("deal_status", toolInput.status);
        if (toolInput.search) query = query.or(`property_address.ilike.%${toolInput.search}%,city.ilike.%${toolInput.search}%,deal_name.ilike.%${toolInput.search}%`);
        if (toolInput.sort_by) {
          const colMap: Record<string, string> = { reap_score: "reap_score", asking_price: "asking_price", arv_value: "arv_value", date_added: "date_added" };
          query = query.order(colMap[toolInput.sort_by] || "date_added", { ascending: false });
        }
        query = query.limit(toolInput.limit || 10);

        const { data, error } = await query;
        if (error) return { error: error.message };
        return { deals: data, count: data?.length || 0 };
      }

      case "query_contacts": {
        let query = supabase.from("contacts").select("id, contact_name, company, email, phone, contact_type, temperature, notes")
          .order("contact_name");

        if (toolInput.search) query = query.or(`contact_name.ilike.%${toolInput.search}%,email.ilike.%${toolInput.search}%,company.ilike.%${toolInput.search}%`);
        if (toolInput.contact_type) query = query.ilike("contact_type", `%${toolInput.contact_type}%`);
        query = query.limit(toolInput.limit || 10);

        const { data, error } = await query;
        if (error) return { error: error.message };
        return { contacts: data, count: data?.length || 0 };
      }

      case "get_pipeline_summary": {
        const { data: deals } = await supabase.from("deals").select("deal_status, asking_price, our_offer, arv_value, reap_score, noi_annual, source");

        if (!deals) return { error: "Could not fetch deals" };

        const active = deals.filter((d: any) => !["Dead", "Closed"].includes(d.deal_status));
        const statusCounts: Record<string, number> = {};
        deals.forEach((d: any) => { statusCounts[d.deal_status || "Unknown"] = (statusCounts[d.deal_status || "Unknown"] || 0) + 1; });

        const totalValue = active.reduce((s: number, d: any) => s + (parseFloat(d.our_offer) || 0), 0);
        const scored = active.filter((d: any) => d.reap_score && parseFloat(d.reap_score) > 0);
        const avgScore = scored.length > 0 ? scored.reduce((s: number, d: any) => s + parseFloat(d.reap_score), 0) / scored.length : 0;
        const totalNOI = active.reduce((s: number, d: any) => s + (parseFloat(d.noi_annual) || 0), 0);
        const mlsCount = deals.filter((d: any) => d.source === "MLS Feed").length;
        const manualCount = deals.filter((d: any) => d.source === "REAP App").length;

        return {
          total_deals: deals.length,
          active_deals: active.length,
          status_breakdown: statusCounts,
          total_pipeline_value: totalValue,
          avg_reap_score: Math.round(avgScore),
          total_noi_annual: totalNOI,
          source_breakdown: { mls_feed: mlsCount, manual: manualCount, other: deals.length - mlsCount - manualCount },
        };
      }

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (e) {
    return { error: `Tool execution error: ${e.message}` };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { robot_id, user_id, message, history } = await req.json();

    if (!robot_id || !user_id || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load robot config
    const { data: robot } = await supabase.from("robots").select("*").eq("id", robot_id).single();
    if (!robot) {
      return new Response(JSON.stringify({ error: "Robot not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build system prompt
    const systemPrompt = [
      `You are ${robot.name}, a ${robot.role}.`,
      robot.personality || "",
      robot.description || "",
      "",
      "You work for Javier Suarez at REAP (Real Estate Analytics Platform) and Tampa Development Group.",
      `Today is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`,
      "",
      "OPERATING RULES:",
      "- Be concise and actionable. No fluff.",
      "- When asked about deals, pipeline, or contacts, ALWAYS use the appropriate tool to get real data. Never make up numbers.",
      "- When creating tasks, confirm what was created.",
      "- Format currency as $X,XXX. Format percentages as X.X%.",
      "- If you don't have enough info, ask a clarifying question.",
    ].filter(Boolean).join("\n");

    // Build messages array
    const apiMessages = [
      ...(history || []).slice(-20),
      { role: "user", content: message },
    ];

    let finalText = "";
    const allToolCalls: any[] = [];
    const allArtifacts: any[] = [];
    let totalTokensIn = 0;
    let totalTokensOut = 0;

    // Agentic loop
    let messages_for_api = apiMessages;
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: robot.model || "claude-sonnet-4-6",
          max_tokens: 2048,
          system: systemPrompt,
          tools: tools,
          messages: messages_for_api,
        }),
      });

      if (!anthropicResp.ok) {
        const errText = await anthropicResp.text();
        throw new Error(`Anthropic API error ${anthropicResp.status}: ${errText}`);
      }

      const result = await anthropicResp.json();
      totalTokensIn += result.usage?.input_tokens || 0;
      totalTokensOut += result.usage?.output_tokens || 0;

      if (result.stop_reason === "end_turn") {
        finalText = result.content
          .filter((c: any) => c.type === "text")
          .map((c: any) => c.text)
          .join("");
        break;
      }

      if (result.stop_reason === "tool_use") {
        const toolResults: any[] = [];

        for (const block of result.content) {
          if (block.type === "tool_use") {
            const toolResult = await executeTool(block.name, block.input, user_id, robot_id, supabase);
            allToolCalls.push({ tool: block.name, input: block.input, result: toolResult });

            // Check for artifacts
            if (block.name === "assign_task" && toolResult.success) {
              allArtifacts.push({
                type: "task",
                title: toolResult.task.name,
                id: toolResult.task.id,
              });
            }

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(toolResult),
            });
          }
        }

        // Continue the loop with tool results
        messages_for_api = [
          ...messages_for_api,
          { role: "assistant", content: result.content },
          { role: "user", content: toolResults },
        ];
        continue;
      }

      // Unexpected stop reason
      finalText = result.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("") || "I completed the request.";
      break;
    }

    // Log usage
    const costEstimate = (totalTokensIn / 1_000_000 * 3) + (totalTokensOut / 1_000_000 * 15);
    try {
      await supabase.from("api_usage_log").insert({
        service: "Anthropic",
        endpoint: "robot_chat",
        user_email: null,
        cost_estimate: costEstimate,
      });
    } catch (_) {}

    // Persist conversation
    try {
      const newTurn = {
        timestamp: new Date().toISOString(),
        user_message: message,
        assistant_response: finalText,
        tool_calls: allToolCalls,
        artifacts: allArtifacts,
      };

      const { data: existingConvo } = await supabase.from("robot_conversations")
        .select("id, messages")
        .eq("user_id", user_id)
        .eq("robot_id", robot_id)
        .eq("channel_type", "workspace")
        .maybeSingle();

      if (existingConvo) {
        const updatedMsgs = [...(existingConvo.messages || []), newTurn];
        await supabase.from("robot_conversations").update({
          messages: updatedMsgs,
          updated_at: new Date().toISOString(),
        }).eq("id", existingConvo.id);
      } else {
        await supabase.from("robot_conversations").insert({
          user_id: user_id,
          robot_id: robot_id,
          channel_type: "workspace",
          messages: [newTurn],
        });
      }
    } catch (e) {
      console.error("Failed to persist conversation:", e);
    }

    return new Response(JSON.stringify({
      response: finalText,
      tool_calls: allToolCalls,
      artifacts: allArtifacts,
      tokens: { input: totalTokensIn, output: totalTokensOut, cost: costEstimate },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("robot-chat error:", e);
    return new Response(JSON.stringify({
      response: "I encountered an error processing your request. Please try again.",
      error: e.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
