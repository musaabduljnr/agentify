import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { getBachsCheckoutSession } from "@/lib/payments/bachs";
import { activateSubscriptionPlan } from "@/lib/billing/upgrade";

/**
 * Debug endpoint: POST /api/debug/reconcile
 * Body: { checkout_id: string }
 * 
 * Tests the full reconciliation flow and returns detailed step-by-step
 * logs so we can see exactly where it fails in production.
 * 
 * REMOVE THIS ENDPOINT AFTER DEBUGGING IS COMPLETE.
 */
export async function POST(req: NextRequest) {
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log("[reconcile-debug]", msg);
    logs.push(msg);
  };

  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized", logs }, { status: 401 });
    }
    log(`✅ Auth OK — user: ${user.id}`);

    const body = await req.json();
    const checkoutId: string = body.checkout_id;
    if (!checkoutId) {
      return NextResponse.json({ error: "checkout_id required", logs }, { status: 400 });
    }
    log(`🔍 Testing checkout_id: ${checkoutId}`);

    // Step 1: Fetch from Bachs API
    log("Step 1: Fetching session from Bachs API...");
    let session: any;
    try {
      session = await getBachsCheckoutSession(checkoutId);
      log(`✅ Bachs session fetched — status: ${session?.status}, payment_status: ${session?.payment_status}`);
      log(`   metadata: ${JSON.stringify(session?.metadata)}`);
      log(`   customer: ${JSON.stringify(session?.customer)}`);
      log(`   subscription: ${JSON.stringify(session?.subscription)}`);
      log(`   product_cart: ${JSON.stringify(session?.product_cart)}`);
      log(`   amount: ${session?.amount}`);
    } catch (e: any) {
      log(`❌ Bachs API error: ${e.message}`);
      return NextResponse.json({ error: e.message, logs }, { status: 500 });
    }

    const isPaid =
      session.payment_status === "paid" ||
      session.payment_status === "succeeded" ||
      session.status === "completed";
    log(`   isPaid: ${isPaid}`);

    if (!isPaid) {
      return NextResponse.json({ 
        message: "Session not paid yet", 
        status: session.status, 
        payment_status: session.payment_status,
        logs 
      });
    }

    // Step 2: Check what's in payment_transactions for this checkout_id
    log("Step 2: Looking up payment_transaction by checkout_id...");
    const serviceClient = createServiceClient();
    const { data: tx, error: txErr } = await serviceClient
      .from("payment_transactions")
      .select("*")
      .eq("checkout_id", checkoutId)
      .maybeSingle();
    
    if (txErr) log(`❌ payment_transactions lookup error: ${JSON.stringify(txErr)}`);
    else if (tx) log(`✅ Found transaction: id=${tx.id}, business_id=${tx.business_id}, plan=${tx.plan}, status=${tx.status}`);
    else log(`⚠️ No transaction found for checkout_id=${checkoutId}`);

    // Step 3: Check business for authenticated user
    log("Step 3: Looking up business for user...");
    const { data: business, error: bizErr } = await serviceClient
      .from("businesses")
      .select("id, name")
      .eq("owner_id", user.id)
      .maybeSingle();
    
    if (bizErr) log(`❌ Business lookup error: ${JSON.stringify(bizErr)}`);
    else if (business) log(`✅ Found business: id=${business.id}, name=${business.name}`);
    else log(`❌ No business found for user ${user.id}`);

    // Step 4: Check current subscription
    if (business) {
      log("Step 4: Checking current subscription...");
      const { data: sub, error: subErr } = await serviceClient
        .from("subscriptions")
        .select("*")
        .eq("business_id", business.id)
        .maybeSingle();
      
      if (subErr) log(`❌ Subscription lookup error: ${JSON.stringify(subErr)}`);
      else if (sub) {
        log(`✅ Current subscription: plan=${sub.plan}, status=${sub.status}, payment_provider=${sub.payment_provider}`);
        log(`   bachs_customer_id: ${sub.bachs_customer_id}, updated_at: ${sub.updated_at}`);
      } else log(`⚠️ No subscription record found`);
    }

    // Step 5: Run full activateSubscriptionPlan
    log("Step 5: Running activateSubscriptionPlan...");
    const metadata = (session.metadata as Record<string, any>) || {};
    const customerId =
      (session.customer as any)?.id ||
      (session.customer as any)?.customer_id ||
      (typeof session.customer === "string" ? session.customer : null);
    const subscriptionId =
      typeof (session as any).subscription === "string"
        ? (session as any).subscription
        : ((session as any).subscription?.id || null);
    const productId = (session as any).product_cart?.[0]?.product_id || null;
    const plan = metadata.plan || (productId === process.env.BACHS_GROWTH_PRODUCT_ID ? "growth" : "starter");

    log(`   Resolved: businessId=${metadata.business_id}, userId=${metadata.user_id || user.id}`);
    log(`   plan=${plan}, productId=${productId}, customerId=${customerId}, subscriptionId=${subscriptionId}`);
    log(`   BACHS_GROWTH_PRODUCT_ID env=${process.env.BACHS_GROWTH_PRODUCT_ID}`);
    log(`   BACHS_STARTER_PRODUCT_ID env=${process.env.BACHS_STARTER_PRODUCT_ID}`);

    let result: any;
    try {
      result = await activateSubscriptionPlan({
        businessId: metadata.business_id || null,
        userId: metadata.user_id || user.id,
        plan,
        productId,
        checkoutId,
        customerId,
        subscriptionId,
        amount: Number(session.amount) || (plan === "growth" ? 10.0 : 2.0),
        reference: (session.reference as string) || null,
        sourceEvent: "debug_reconciliation",
      });
      log(`✅ activateSubscriptionPlan result: ${JSON.stringify(result)}`);
    } catch (e: any) {
      log(`❌ activateSubscriptionPlan threw: ${e.message}`);
      return NextResponse.json({ error: e.message, logs }, { status: 500 });
    }

    return NextResponse.json({ success: result.success, result, logs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, logs }, { status: 500 });
  }
}
