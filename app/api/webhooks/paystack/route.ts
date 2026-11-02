import { NextResponse } from "next/server";

/**
 * Legacy Paystack Webhook Route
 * Decommissioned: Agentify has fully migrated to Bachs USD billing.
 * Returning HTTP 410 Gone signals to Paystack and consumers that this endpoint is permanently retired.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Gone",
      message: "Paystack webhook endpoint has been decommissioned. Agentify uses Bachs for USD subscriptions.",
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      error: "Gone",
      message: "Paystack webhook endpoint has been decommissioned.",
    },
    { status: 410 }
  );
}
