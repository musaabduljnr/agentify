import { NextRequest } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { corsHeaders, jsonWithCors } from "@/lib/http/cors";
import { z } from "zod";

const trackSchema = z.object({
  demoBusinessId: z.string().uuid(),
  visitorId: z.string().trim(),
  eventType: z.string().trim(),
  metadata: z.any().optional().default({}),
});

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const parsed = trackSchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonWithCors({ error: "Invalid tracking payload" }, { status: 400 });
    }

    const { demoBusinessId, visitorId, eventType, metadata } = parsed.data;

    const supabase = createServiceClient();

    // Verify demo business exists
    const { data: demo, error: demoErr } = await supabase
      .from("demo_businesses")
      .select("id, page_view_count, unique_visitor_count")
      .eq("id", demoBusinessId)
      .single();

    if (demoErr || !demo) {
      return jsonWithCors({ error: "Demo not found" }, { status: 404 });
    }

    // Process counters atomically via RPC
    let visitorInc = 0;
    let pageViewInc = 0;
    if (eventType === "unique_visitor") {
      visitorInc = 1;
      pageViewInc = 1;
    } else if (eventType === "page_viewed") {
      pageViewInc = 1;
    }

    if (visitorInc > 0 || pageViewInc > 0) {
      await supabase.rpc("increment_demo_visitor_stats", {
        p_demo_id: demoBusinessId,
        p_visitor_inc: visitorInc,
        p_page_view_inc: pageViewInc,
      });
    }

    // Insert event
    const { error: insertErr } = await supabase
      .from("demo_events")
      .insert({
        demo_business_id: demoBusinessId,
        visitor_id: visitorId,
        event_type: eventType === "unique_visitor" ? "page_viewed" : eventType,
        metadata,
      });

    if (insertErr) throw insertErr;

    return jsonWithCors({ success: true });
  } catch (error: any) {
    console.error("Tracking failed:", error);
    return jsonWithCors({ error: error.message || "Failed to log event" }, { status: 500 });
  }
}
