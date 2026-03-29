// Supabase Edge Function: send-investor-notifications
// Sends branded email notifications via Resend and SMS via Quo API
// Deploy: supabase functions deploy send-investor-notifications

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { updateId } = await req.json();
    if (!updateId) {
      return new Response(JSON.stringify({ error: "updateId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Init Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // API keys from secrets
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    const quoApiKey = Deno.env.get("QUO_API_KEY") || "";
    const quoPhoneNumber = Deno.env.get("QUO_FROM_NUMBER") || "";
    const fromEmail = Deno.env.get("FROM_EMAIL") || "updates@getreap.ai";
    const fromName = Deno.env.get("FROM_NAME") || "Suarez Global";

    // 1. Fetch the update
    const { data: update, error: updateErr } = await supabase
      .from("investor_updates")
      .select("*")
      .eq("id", updateId)
      .single();

    if (updateErr || !update) {
      return new Response(JSON.stringify({ error: "Update not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch pending notifications for this update
    const { data: notifications } = await supabase
      .from("investor_notifications")
      .select("*")
      .eq("update_id", updateId)
      .eq("status", "pending");

    if (!notifications || notifications.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending notifications", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Fetch the deal for context
    const { data: deal } = await supabase
      .from("deals")
      .select("address, city, state, status")
      .eq("id", update.deal_id)
      .single();

    const dealName = deal?.address || "Investment Property";
    const dealLocation = [deal?.city, deal?.state].filter(Boolean).join(", ");

    // 4. Check investor notification preferences
    const investorIds = [...new Set(notifications.map((n: any) => n.investor_id))];
    const { data: investors } = await supabase
      .from("investors")
      .select("id, notification_prefs")
      .in("id", investorIds);

    const investorPrefs: Record<string, any> = {};
    (investors || []).forEach((inv: any) => {
      try {
        investorPrefs[inv.id] = inv.notification_prefs
          ? JSON.parse(inv.notification_prefs)
          : { email: true, sms: true };
      } catch {
        investorPrefs[inv.id] = { email: true, sms: true };
      }
    });

    // 5. Fetch poster/company info
    const postedByEmail = update.posted_by || "";
    let postedByName = postedByEmail.split("@")[0] || "Team";
    let companyName = fromName; // fallback to env var
    // Try to get poster's display name from contacts
    if (postedByEmail) {
      const { data: posterContact } = await supabase.from("contacts").select("contact_name, company").eq("email", postedByEmail).limit(1);
      if (posterContact && posterContact[0]) {
        postedByName = posterContact[0].contact_name || postedByName;
        if (posterContact[0].company) companyName = posterContact[0].company;
      }
    }

    // Type color mapping
    const typeColors: Record<string, string> = {
      "Construction Progress": "#EA580C",
      "Financial Update": "#2563EB",
      "Status Change": "#16A34A",
      "General Announcement": "#7C3AED",
    };
    const typeColor = typeColors[update.update_type] || "#16a34a";

    // 5. Send notifications
    let sentCount = 0;
    let failCount = 0;
    const results: any[] = [];

    for (const notif of notifications) {
      const prefs = investorPrefs[notif.investor_id] || { email: true, sms: true };

      // --- EMAIL ---
      if (notif.notification_type === "email" && notif.contact_email && resendApiKey) {
        if (!prefs.email) {
          // Investor opted out of email
          await supabase
            .from("investor_notifications")
            .update({ status: "skipped", sent_at: new Date().toISOString() })
            .eq("id", notif.id);
          results.push({ id: notif.id, type: "email", status: "skipped", reason: "opted_out" });
          continue;
        }

        const emailHtml = buildEmailHtml({
          investorName: notif.contact_name || "Investor",
          updateType: update.update_type,
          typeColor,
          title: update.title,
          body: update.body,
          dealName,
          dealLocation,
          postedAt: update.created_at,
          portalUrl: "https://app.getreap.ai",
          companyName,
          postedByName,
        });

        try {
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: `${fromName} <${fromEmail}>`,
              to: [notif.contact_email],
              subject: `${update.update_type}: ${update.title} — ${dealName}`,
              html: emailHtml,
            }),
          });

          if (emailRes.ok) {
            await supabase
              .from("investor_notifications")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("id", notif.id);
            sentCount++;
            results.push({ id: notif.id, type: "email", status: "sent" });
          } else {
            const errBody = await emailRes.text();
            await supabase
              .from("investor_notifications")
              .update({ status: "failed", error_message: errBody })
              .eq("id", notif.id);
            failCount++;
            results.push({ id: notif.id, type: "email", status: "failed", error: errBody });
          }
        } catch (err: any) {
          await supabase
            .from("investor_notifications")
            .update({ status: "failed", error_message: err.message })
            .eq("id", notif.id);
          failCount++;
          results.push({ id: notif.id, type: "email", status: "failed", error: err.message });
        }
      }

      // --- SMS ---
      if (notif.notification_type === "sms" && notif.contact_phone && quoApiKey && quoPhoneNumber) {
        if (!prefs.sms) {
          await supabase
            .from("investor_notifications")
            .update({ status: "skipped", sent_at: new Date().toISOString() })
            .eq("id", notif.id);
          results.push({ id: notif.id, type: "sms", status: "skipped", reason: "opted_out" });
          continue;
        }

        const smsBody = `${companyName} Update\n\n${update.update_type}: ${update.title}\n\n${dealName}${dealLocation ? " — " + dealLocation : ""}\n\n${update.body.substring(0, 300)}${update.body.length > 300 ? "..." : ""}\n\nPosted by ${postedByName}\nView details: https://app.getreap.ai`;

        try {
          const smsRes = await fetch("https://api.quo.io/v1/messages", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${quoApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: quoPhoneNumber,
              to: notif.contact_phone,
              body: smsBody,
            }),
          });

          if (smsRes.ok) {
            await supabase
              .from("investor_notifications")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("id", notif.id);
            sentCount++;
            results.push({ id: notif.id, type: "sms", status: "sent" });
          } else {
            const errBody = await smsRes.text();
            await supabase
              .from("investor_notifications")
              .update({ status: "failed", error_message: errBody })
              .eq("id", notif.id);
            failCount++;
            results.push({ id: notif.id, type: "sms", status: "failed", error: errBody });
          }
        } catch (err: any) {
          await supabase
            .from("investor_notifications")
            .update({ status: "failed", error_message: err.message })
            .eq("id", notif.id);
          failCount++;
          results.push({ id: notif.id, type: "sms", status: "failed", error: err.message });
        }
      }
    }

    return new Response(
      JSON.stringify({ sent: sentCount, failed: failCount, total: notifications.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Branded email HTML builder ───
function buildEmailHtml(params: {
  investorName: string;
  updateType: string;
  typeColor: string;
  title: string;
  body: string;
  dealName: string;
  dealLocation: string;
  postedAt: string;
  portalUrl: string;
  companyName: string;
  postedByName: string;
}): string {
  const date = new Date(params.postedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const typeBgColors: Record<string, string> = {
    "Construction Progress": "#FFF7ED",
    "Financial Update": "#EFF6FF",
    "Status Change": "#F0FDF4",
    "General Announcement": "#F5F3FF",
  };
  const typeBg = typeBgColors[params.updateType] || "#f8fafc";
  const companyInitials = params.companyName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:0;">

    <!-- Company header on dark background -->
    <div style="background:#0f172a;padding:32px 32px 24px;text-align:center;">
      <div style="display:inline-block;width:48px;height:48px;background:#16a34a;border-radius:12px;text-align:center;line-height:48px;margin-bottom:12px;">
        <span style="color:#fff;font-size:18px;font-weight:800;">${companyInitials}</span>
      </div>
      <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.03em;">${params.companyName}</h1>
      <p style="margin:6px 0 0;font-size:11px;color:#64748b;letter-spacing:0.12em;text-transform:uppercase;font-weight:600;">Investor Update</p>
    </div>

    <!-- White content card -->
    <div style="background:#ffffff;border-radius:20px 20px 0 0;padding:0;overflow:hidden;">
      <div style="height:4px;background:${params.typeColor};"></div>
      <div style="padding:32px 32px 28px;">

        <!-- Type + date row -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;">
          <tr>
            <td><span style="display:inline-block;padding:5px 14px;border-radius:8px;font-size:11px;font-weight:700;color:${params.typeColor};background:${typeBg};letter-spacing:0.02em;">${params.updateType.toUpperCase()}</span></td>
            <td style="text-align:right;"><span style="font-size:12px;color:#94a3b8;font-weight:500;">${date}</span></td>
          </tr>
        </table>

        <!-- Property -->
        <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #f1f5f9;">
          <p style="margin:0 0 2px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Property</p>
          <p style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">${params.dealName}</p>
          ${params.dealLocation ? `<p style="margin:4px 0 0;font-size:13px;color:#64748b;">${params.dealLocation}</p>` : ""}
        </div>

        <!-- Greeting -->
        <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 20px;">Hi ${params.investorName},</p>

        <!-- Update card -->
        <div style="background:#f8fafc;border-radius:14px;padding:24px;border-left:4px solid ${params.typeColor};margin-bottom:20px;">
          <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#0f172a;line-height:1.3;">${params.title}</h2>
          <div style="width:40px;height:3px;background:${params.typeColor};border-radius:2px;margin-bottom:14px;opacity:0.4;"></div>
          <p style="margin:0;font-size:14px;color:#475569;line-height:1.8;white-space:pre-wrap;">${params.body}</p>
        </div>

        <!-- Posted by -->
        <p style="margin:0 0 24px;font-size:12px;color:#94a3b8;">Posted by <strong style="color:#334155;">${params.postedByName}</strong> · ${params.companyName}</p>

        <!-- CTA -->
        <div style="text-align:center;padding:4px 0 8px;">
          <a href="${params.portalUrl}" style="display:inline-block;padding:14px 40px;background:#16a34a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:12px;letter-spacing:0.01em;">View Full Update in Portal</a>
          <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">or visit <a href="${params.portalUrl}" style="color:#16a34a;text-decoration:none;font-weight:600;">app.getreap.ai</a></p>
        </div>
      </div>
    </div>

    <!-- Footer: Powered by Reap -->
    <div style="background:#0f172a;padding:28px 32px 36px;text-align:center;">
      <p style="margin:0 0 4px;font-size:12px;color:#64748b;font-weight:600;">${params.companyName} · Investor Relations</p>
      <p style="margin:0 0 16px;font-size:11px;color:#475569;line-height:1.5;">You're receiving this because you're an investor with ${params.companyName}.<br/>To change your notification preferences, visit your <a href="${params.portalUrl}" style="color:#16a34a;text-decoration:none;font-weight:600;">investor portal</a>.</p>
      <div style="width:60px;height:1px;background:#1e293b;margin:0 auto 16px;"></div>
      <p style="margin:0;font-size:11px;color:#475569;">Powered by <strong style="color:#16a34a;">Reap</strong> · Real Estate Analytics Platform</p>
      <p style="margin:4px 0 0;font-size:10px;color:#334155;">getreap.ai</p>
    </div>

  </div>
</body>
</html>`;
}
