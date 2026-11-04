import { createServiceClient } from "@/utils/supabase/service";
import { 
  detectLeadIntent, 
  extractLeadInfo, 
  detectConversationIntent 
} from "@/lib/ai/lead-detection";
import {
  completeUsageQuota,
  releaseUsageQuota,
  reserveUsageQuota,
} from "@/lib/billing/usage";
import { sendTransactionalEmail } from "@/lib/email/send-email";
import { NewLeadEmail } from "@/lib/email/templates/new-lead-email";
import { BookingRequestEmail } from "@/lib/email/templates/booking-request-email";
import { SupportRequestEmail } from "@/lib/email/templates/support-request-email";
import { createBusinessNotification } from "@/lib/notifications/service";

export async function processLeadHandling({
  message,
  businessId,
  conversationId,
  visitorId,
  source,
  isDemo,
  demoBusinessId,
  businessName,
  conversation,
}: {
  message: string;
  businessId: string;
  conversationId: string;
  visitorId?: string;
  source: string;
  isDemo: boolean;
  demoBusinessId?: string;
  businessName: string;
  conversation: any;
}) {
  const supabase = createServiceClient();
  const metadata = (conversation?.metadata as any) || {};
  const hasBuyingIntent = detectLeadIntent(message);
  const { intentType, requestedAction } = detectConversationIntent(message);
  const extractedInfo = extractLeadInfo(message);

  let contactRequested = metadata.contact_requested || false;
  let contactCaptured = metadata.contact_captured || false;

  if (intentType !== "general_inquiry") {
    metadata.intent_type = intentType;
    metadata.requested_action = requestedAction;
  }

  const conversationUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://agentifyhq.vercel.app"}/dashboard/conversations?id=${conversationId}`;

  // Emails for high intent (non-demo only)
  if (!isDemo) {
    if (intentType === "booking" && !metadata.booking_email_sent) {
      metadata.booking_email_sent = true;
      const notification = await createBusinessNotification({
        businessId,
        eventKey: `booking:${conversationId}`,
        category: "booking",
        title: "New booking request",
        message: "A visitor requested an appointment or scheduling slot.",
        href: `/dashboard/conversations?id=${conversationId}`,
        severity: "success",
        metadata: { conversationId },
      }).catch((error) => {
        console.error("Failed to create booking notification:", error);
        return null;
      });
      sendTransactionalEmail({
        businessId,
        notificationId: notification?.ownerNotificationId || undefined,
        subject: "New booking request from your AI assistant",
        templateName: "booking-request-email",
        react: BookingRequestEmail({
          businessName,
          leadName: extractedInfo.name || conversation?.visitor_name,
          leadEmail: extractedInfo.email || conversation?.visitor_email,
          leadPhone: extractedInfo.phone || conversation?.visitor_phone,
          requestedAction,
          conversationUrl,
        }),
      }).catch(err => console.error("Error triggering booking email:", err));
    }

    if (intentType === "support_ticket" && !metadata.support_email_sent) {
      metadata.support_email_sent = true;
      const notification = await createBusinessNotification({
        businessId,
        eventKey: `support:${conversationId}`,
        category: "support",
        title: "New support request",
        message: "A visitor submitted a technical issue or support request.",
        href: `/dashboard/conversations?id=${conversationId}`,
        severity: "warning",
        metadata: { conversationId },
      }).catch((error) => {
        console.error("Failed to create support notification:", error);
        return null;
      });
      sendTransactionalEmail({
        businessId,
        notificationId: notification?.ownerNotificationId || undefined,
        subject: "New support request from your AI assistant",
        templateName: "support-request-email",
        react: SupportRequestEmail({
          businessName,
          leadName: extractedInfo.name || conversation?.visitor_name,
          leadEmail: extractedInfo.email || conversation?.visitor_email,
          issueSummary: message,
          conversationUrl,
        }),
      }).catch(err => console.error("Error triggering support email:", err));
    }
  }

  // Lead insertion/updates
  if (extractedInfo.email || extractedInfo.phone || extractedInfo.name) {
    if (isDemo && demoBusinessId) {
      const { data: existingLead } = await supabase
        .from("demo_leads")
        .select("id")
        .eq("conversation_id", conversationId)
        .maybeSingle();

      const leadData: Record<string, any> = {
        demo_business_id: demoBusinessId,
        conversation_id: conversationId,
        interest: requestedAction || "Demo Interaction",
      };
      if (extractedInfo.name) leadData.name = extractedInfo.name;
      if (extractedInfo.email) leadData.email = extractedInfo.email;
      if (extractedInfo.phone) leadData.phone = extractedInfo.phone;

      if (existingLead) {
        await supabase.from("demo_leads").update(leadData).eq("id", existingLead.id);
      } else {
        await supabase.from("demo_leads").insert(leadData);

        await supabase.rpc("increment_demo_lead_count", {
          p_demo_id: demoBusinessId,
        });

        await supabase.from("demo_events").insert({
          demo_business_id: demoBusinessId,
          visitor_id: visitorId,
          event_type: "lead_captured",
          metadata: { conversation_id: conversationId, lead_info: extractedInfo },
        });

        await supabase
          .from("demo_conversations")
          .update({ lead_captured: true })
          .eq("id", conversationId);
      }
    } else {
      const leadUpdate: any = {
        business_id: businessId,
        conversation_id: conversationId,
        source: source,
      };
      if (extractedInfo.email) leadUpdate.email = extractedInfo.email;
      if (extractedInfo.phone) leadUpdate.phone = extractedInfo.phone;
      if (extractedInfo.name) leadUpdate.name = extractedInfo.name;
      if (intentType !== "general_inquiry") leadUpdate.interest = requestedAction;

      const { data: existingLead } = await supabase
        .from("leads")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (existingLead) {
        await supabase.from("leads").update(leadUpdate).eq("id", existingLead.id);
      } else {
        const { reservation } = await reserveUsageQuota(businessId, "lead", 1, {
          conversation_id: conversationId,
        });
        if (!reservation) {
          metadata.lead_limit_reached = true;
        } else {
          const { error: leadInsertError } = await supabase.from("leads").insert(leadUpdate);
          if (!leadInsertError) {
            await completeUsageQuota(reservation);
            const notification = await createBusinessNotification({
              businessId,
              eventKey: `lead:${conversationId}`,
              category: "leads",
              title: "New lead captured",
              message: `${extractedInfo.name || extractedInfo.email || extractedInfo.phone || "A visitor"} shared contact information.`,
              href: `/dashboard/leads`,
              severity: "success",
              metadata: { conversationId },
            }).catch((error) => {
              console.error("Failed to create new-lead notification:", error);
              return null;
            });
            await sendTransactionalEmail({
              businessId,
              notificationId: notification?.ownerNotificationId || undefined,
              subject: "New lead captured by Agentify",
              templateName: "new-lead-email",
              react: NewLeadEmail({
                businessName,
                leadName: extractedInfo.name,
                leadEmail: extractedInfo.email,
                leadPhone: extractedInfo.phone,
                interest: intentType !== "general_inquiry" ? requestedAction : null,
                intentType,
                conversationUrl,
              }),
            });
          } else {
            await releaseUsageQuota(reservation);
          }
        }
      }
    }

    if (extractedInfo.email || extractedInfo.phone) {
      contactCaptured = true;
      metadata.contact_captured = true;
      metadata.email_collected_early = true;
      
      const convUpdate: any = { lead_captured: true };
      if (extractedInfo.email) convUpdate.visitor_email = extractedInfo.email;
      if (extractedInfo.name) convUpdate.visitor_name = extractedInfo.name;
      if (extractedInfo.phone) convUpdate.visitor_phone = extractedInfo.phone;
      
      await supabase
        .from("conversations")
        .update(convUpdate)
        .eq("id", conversationId);
    }
  }

  if (!contactRequested && !contactCaptured) {
    metadata.contact_requested = true;
  }

  return { metadata, hasBuyingIntent, intentType, requestedAction, extractedInfo };
}
