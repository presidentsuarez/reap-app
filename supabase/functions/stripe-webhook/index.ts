// supabase/functions/stripe-webhook/index.ts
// REAP — Stripe Webhook Handler
// Handles: checkout.session.completed, customer.subscription.updated,
//          customer.subscription.deleted, invoice.payment_failed

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Map Stripe price IDs to plan names
const PRICE_TO_PLAN: Record<string, string> = {
  "price_1TB45GCPBlmmKk8H7q4DdBDz": "starter",  // $99/mo
  // Add Team price ID here when created:
  // "price_XXXXX": "team",
};

function getPlanFromPriceId(priceId: string): string {
  return PRICE_TO_PLAN[priceId] || "starter";
}

async function upsertSubscription(data: {
  userEmail: string;
  status: string;
  plan: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}) {
  const { error } = await supabase
    .from("subscriptions")
    .upsert(
      {
        user_email: data.userEmail,
        status: data.status,
        plan: data.plan,
        stripe_customer_id: data.stripeCustomerId || null,
        stripe_subscription_id: data.stripeSubscriptionId || null,
        current_period_start: data.currentPeriodStart || null,
        current_period_end: data.currentPeriodEnd || null,
        cancel_at_period_end: data.cancelAtPeriodEnd || false,
      },
      { onConflict: "user_email" }
    );

  if (error) {
    console.error("Supabase upsert error:", error);
    throw error;
  }

  // Also update user_profiles if the table exists
  await supabase
    .from("user_profiles")
    .update({
      is_subscribed: data.status === "active",
      plan_tier: data.plan,
      stripe_customer_id: data.stripeCustomerId || null,
    })
    .eq("email", data.userEmail);
}

Deno.serve(async (req) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  // Verify webhook signature
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log(`Received event: ${event.type}`);

  try {
    switch (event.type) {
      // ── New checkout completed ──
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const email = session.customer_email || session.customer_details?.email;
        if (!email) {
          console.error("No email in checkout session");
          break;
        }

        // Retrieve subscription details
        let plan = "starter";
        let subId = session.subscription as string;
        let periodStart: string | undefined;
        let periodEnd: string | undefined;

        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          const priceId = sub.items.data[0]?.price?.id;
          if (priceId) plan = getPlanFromPriceId(priceId);
          periodStart = new Date(sub.current_period_start * 1000).toISOString();
          periodEnd = new Date(sub.current_period_end * 1000).toISOString();
        }

        await upsertSubscription({
          userEmail: email.toLowerCase(),
          status: "active",
          plan,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subId,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        });

        console.log(`✅ Subscription activated for ${email} (${plan})`);
        break;
      }

      // ── Subscription updated (upgrade, downgrade, renewal) ──
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        // Look up email from Stripe customer
        const customer = await stripe.customers.retrieve(customerId);
        const email = (customer as Stripe.Customer).email;
        if (!email) {
          console.error("No email for customer:", customerId);
          break;
        }

        const priceId = sub.items.data[0]?.price?.id;
        const plan = priceId ? getPlanFromPriceId(priceId) : "starter";

        const statusMap: Record<string, string> = {
          active: "active",
          past_due: "past_due",
          canceled: "canceled",
          unpaid: "past_due",
          trialing: "trialing",
          incomplete: "inactive",
          incomplete_expired: "inactive",
          paused: "inactive",
        };

        await upsertSubscription({
          userEmail: email.toLowerCase(),
          status: statusMap[sub.status] || sub.status,
          plan,
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });

        console.log(`✅ Subscription updated for ${email}: ${sub.status} (${plan})`);
        break;
      }

      // ── Subscription canceled ──
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const customer = await stripe.customers.retrieve(customerId);
        const email = (customer as Stripe.Customer).email;
        if (!email) break;

        await upsertSubscription({
          userEmail: email.toLowerCase(),
          status: "canceled",
          plan: "starter",
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          cancelAtPeriodEnd: false,
        });

        console.log(`✅ Subscription canceled for ${email}`);
        break;
      }

      // ── Payment failed ──
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const email = invoice.customer_email;
        if (!email) break;

        // Mark as past_due but don't cancel yet
        const { data: existing } = await supabase
          .from("subscriptions")
          .select("plan, stripe_customer_id, stripe_subscription_id")
          .eq("user_email", email.toLowerCase())
          .single();

        if (existing) {
          await upsertSubscription({
            userEmail: email.toLowerCase(),
            status: "past_due",
            plan: existing.plan || "starter",
            stripeCustomerId: existing.stripe_customer_id,
            stripeSubscriptionId: existing.stripe_subscription_id,
          });
        }

        console.log(`⚠️ Payment failed for ${email}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("Error processing webhook:", err);
    return new Response(`Processing error: ${err.message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
