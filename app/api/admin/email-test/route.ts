import { requireAdmin } from "@/lib/admin/require-admin";
import { sendTransactionalEmail } from "@/lib/email/resend";
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
  const templateConfig =
    template === "welcome"
      ? { type: "welcome" as const, props: { name: admin.full_name || "Admin" } }
      : template === "lead-notification"
        ? {
            type: "lead-notification" as const,
            props: {
              businessName: "Agentify Test Workspace",
              leadName: "Test Lead",
              leadEmail: "lead@example.com",
              leadPhone: "+234 000 000 0000",
              interest: "Demo request",
            },
          }
        : template === "booking-support"
          ? {
              type: "booking-support" as const,
              props: {
                businessName: "Agentify Test Workspace",
                visitorName: "Test Visitor",
                visitorEmail: "visitor@example.com",
                message: "I need help booking a consultation.",
              },
            }
          : template === "payment"
            ? {
                type: "payment" as const,
                props: {
                  planName: "Starter",
                  status: "success" as const,
                  amount: "NGN 5,000",
                },
              }
            : {
                type: "usage-warning" as const,
                props: {
                  label: "AI messages",
                  used: 900,
                  limit: 1000,
                },
              };

  const result = await sendTransactionalEmail({
    to,
    subject: `Agentify ${template} email test`,
    template: templateConfig,
    userId: admin.id,
    metadata: { test: true },
  });

  return NextResponse.json({ success: result.sent, result });
}
