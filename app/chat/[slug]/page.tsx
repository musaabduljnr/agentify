import { notFound } from "next/navigation";
import { createServiceClient } from "@/utils/supabase/service";
import { HostedChatClient } from "@/components/hosted-chat/hosted-chat-client";

export const dynamic = "force-dynamic";

const slugPattern = /^[a-z0-9-]{3,}$/;

function UnavailablePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-extrabold text-slate-950">Chat is unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          This business has turned off its hosted chat page. Please contact them through another channel.
        </p>
        <p className="mt-8 text-xs font-bold uppercase tracking-widest text-slate-400">Powered by Agentify</p>
      </div>
    </main>
  );
}

import { getConfig } from "@/lib/config/platform-config";

export default async function HostedChatPage({ params }: { params: Promise<{ slug: string }> }) {
  const hostedChatEnabled = await getConfig("feature_flags", "enable_hosted_chat");
  if (hostedChatEnabled === "false") {
    return <UnavailablePage />;
  }

  const { slug } = await params;
  const normalizedSlug = slug.toLowerCase();

  if (!slugPattern.test(normalizedSlug)) {
    notFound();
  }

  const supabase = createServiceClient();

  const { data: config, error: configError } = await supabase
    .from("widget_configs")
    .select("business_id, primary_color, welcome_text, suggested_questions, hosted_chat_enabled, hosted_chat_title, hosted_chat_description")
    .eq("hosted_chat_slug", normalizedSlug)
    .maybeSingle();

  if (configError || !config) {
    notFound();
  }

  if (config.hosted_chat_enabled === false) {
    return <UnavailablePage />;
  }

  const [{ data: business }, { data: assistant }] = await Promise.all([
    supabase
      .from("businesses")
      .select("id, name, slug")
      .eq("id", config.business_id)
      .maybeSingle(),
    supabase
      .from("assistants")
      .select("name, welcome_message")
      .eq("business_id", config.business_id)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (!business || !assistant) {
    notFound();
  }

  const suggestedQuestions = Array.isArray(config.suggested_questions)
    ? config.suggested_questions.filter((item: unknown) => typeof item === "string")
    : [];

  const welcomeText =
    config.welcome_text || assistant.welcome_message || `Hi, welcome to ${business.name}. How can we help?`;

  return (
    <HostedChatClient
      businessId={business.id}
      businessName={business.name}
      assistantName={assistant.name || "AI Assistant"}
      welcomeText={welcomeText}
      title={config.hosted_chat_title || `Chat with ${business.name}`}
      description={
        config.hosted_chat_description ||
        "Ask a question, request support, or leave your details and the team will follow up."
      }
      primaryColor={config.primary_color || "#4F46E5"}
      suggestedQuestions={suggestedQuestions}
    />
  );
}
