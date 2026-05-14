import { Metadata } from "next";
import { AssistantEditor } from "@/components/dashboard/assistant/assistant-editor";
import { getCurrentBusiness, getAssistant } from "@/lib/actions/chat";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "AI Assistant | Agentify",
  description: "Customize how your assistant speaks and behaves.",
};

export default async function AssistantPage() {
  const business = await getCurrentBusiness();
  const assistant = business ? await getAssistant(business.id) : null;

  return (
    <AssistantEditor 
      initialBusiness={business}
      initialAssistant={assistant}
    />
  );
}
