import { requireAdmin } from "@/lib/admin/require-admin";
import { sendTransactionalEmail } from "@/lib/email/send-email";
import { WelcomeEmail } from "@/lib/email/templates/welcome-email";
import { NewLeadEmail } from "@/lib/email/templates/new-lead-email";
import { BookingRequestEmail } from "@/lib/email/templates/booking-request-email";
import { PaymentSuccessEmail } from "@/lib/email/templates/payment-success-email";
import { UsageWarningEmail } from "@/lib/email/templates/usage-warning-email";
import { NextResponse } from "next/server";
import { z } from "zod";

const emailTestSchema = z.object({
  to: z.string().email(),
  template: z.enum(["welcome", "lead-notification", "booking-support", "payment", "usage-warning"]),
});

export async function POST(request: Request) {
  const admin = await requireAdmin();
  const parsed = emailTestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid email test payload." }, { status: 400 });
  }

  const { to, template } = parsed.data;
  let subject = `Agentify ${template} email test`;
  let reactElement: React.ReactElement;
  let templateName = "";

  if (template === "welcome") {
    reactElement = WelcomeEmail({
      businessName: "Test Workspace",
    });
    templateName = "welcome-email";
  } else if (template === "lead-notification") {
    reactElement = NewLeadEmail({
      businessName: "Test Workspace",
      leadName: "Test Lead",
      leadEmail: "lead@example.com",
      leadPhone: "+234 000 000 0000",
      interest: "Demo request",
      intentType: "sales",
      conversationUrl: "https://agentifyhq.vercel.app/dashboard/leads",
    });
    templateName = "new-lead-email";
  } else if (template === "booking-support") {
    reactElement = BookingRequestEmail({
      businessName: "Test Workspace",
      leadName: "Test Visitor",
      leadEmail: "visitor@example.com",
      leadPhone: "+234 111 222 3333",
      requestedAction: "Schedule appointment",
      conversationUrl: "https://agentifyhq.vercel.app/dashboard/conversations",
    });
    templateName = "booking-request-email";
  } else if (template === "payment") {
    reactElement = PaymentSuccessEmail({
      businessName: "Test Workspace",
      plan: "starter",
      amount: "NGN 5,000",
      billingUrl: "https://agentifyhq.vercel.app/dashboard/billing",
    });
    templateName = "payment-success-email";
  } else {
    reactElement = UsageWarningEmail({
      businessName: "Test Workspace",
      usageType: "AI messages",
      percentage: 90,
      billingUrl: "https://agentifyhq.vercel.app/dashboard/billing",
    });
    templateName = "usage-warning-email";
  }

  const result = await sendTransactionalEmail({
    to,
    subject,
    templateName,
    react: reactElement,
  });

  return NextResponse.json({ success: result.success, result });
}
