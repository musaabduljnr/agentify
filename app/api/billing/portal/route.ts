import { NextResponse } from "next/server";
import { createPortalSession } from "@/lib/actions/payments";
import { getUserFriendlyError, logErrorSync } from "@/lib/monitoring/log-error";

export async function POST() {
  try {
    const result = await createPortalSession();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ url: result.url });
  } catch (error) {
    logErrorSync(error, "billing-portal-route");
    return NextResponse.json(
      { error: getUserFriendlyError("billing-portal-route") },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const result = await createPortalSession();
    if (result.error || !result.url) {
      return NextResponse.redirect(new URL("/dashboard/billing?error=portal_failed", process.env.APP_URL || "http://localhost:3000"));
    }

    return NextResponse.redirect(result.url, 303);
  } catch (error) {
    logErrorSync(error, "billing-portal-route-get");
    return NextResponse.redirect(new URL("/dashboard/billing?error=portal_failed", process.env.APP_URL || "http://localhost:3000"));
  }
}
