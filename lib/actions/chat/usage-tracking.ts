import { createServiceClient } from "@/utils/supabase/service";
import { checkUsageLimit, incrementUsage } from "@/lib/billing/usage";
import { sendTransactionalEmail } from "@/lib/email/send-email";
import { UsageWarningEmail } from "@/lib/email/templates/usage-warning-email";

export async function processUsageTracking({
  businessId,
  conversationId,
  source,
  usageType,
  cachedAnswer,
  businessName,
}: {
  businessId: string;
  conversationId: string;
  source: string;
  usageType: "widget_chat" | "message";
  cachedAnswer: boolean;
  businessName: string;
}) {
  const supabase = createServiceClient();

  await incrementUsage(businessId, usageType, 1, {
    conversation_id: conversationId,
    source,
    cached: cachedAnswer,
  });

  // Check for 80% usage threshold warning
  const finalCheck = await checkUsageLimit(businessId, usageType);
  const limit = finalCheck.limit;
  const used = finalCheck.used;
  const percentage = limit > 0 ? (used / limit) * 100 : 0;

  if (percentage >= 80) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();

    if (sub) {
      const now = new Date();
      const periodStartStr = sub.current_period_start || sub.created_at;
      const periodStart = new Date(periodStartStr);
      const warningSent80AtStr = sub.metadata?.warning_sent_80_message;
      let hasSent80 = false;
      if (warningSent80AtStr && new Date(warningSent80AtStr) >= periodStart) {
        hasSent80 = true;
      }

      if (!hasSent80) {
        const updatedMetadata = {
          ...(sub.metadata || {}),
          warning_sent_80_message: now.toISOString(),
        };
        await supabase
          .from("subscriptions")
          .update({ metadata: updatedMetadata })
          .eq("id", sub.id);

        sendTransactionalEmail({
          businessId,
          subject: "You’re nearing your Agentify usage limit",
          templateName: "usage-warning-email",
          react: UsageWarningEmail({
            businessName,
            usageType: "AI messages",
            percentage: Math.round(percentage),
            billingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://agentifyhq.vercel.app"}/dashboard/billing`,
          }),
        }).catch(err => console.error("Error sending 80% warning email:", err));
      }
    }
  }
}
