import { Metadata } from "next";
import { AssistantEditor } from "@/components/dashboard/assistant/assistant-editor";
import { getCurrentBusiness, getAssistants } from "@/lib/actions/chat";
import { getBusinessSubscription } from "@/lib/billing/subscription";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "AI Assistant | Agentify",
  description: "Customize how your assistant speaks and behaves.",
};

export default async function AssistantPage() {
  const business = await getCurrentBusiness();
  if (!business) {
    redirect("/login");
  }

  const [assistants, subscription] = await Promise.all([
    getAssistants(),
    getBusinessSubscription(business.id),
  ]);

  return (
    <AssistantEditor 
      initialBusiness={business}
      initialAssistants={assistants || []}
      subscription={subscription}
    />
  );
}
