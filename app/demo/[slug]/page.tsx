import { notFound } from "next/navigation";
import { createServiceClient } from "@/utils/supabase/service";
import { DemoChatClient } from "@/components/hosted-chat/demo-chat-client";
import { Bot, Sparkles, RefreshCw } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

type DemoPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ contact?: string }>;
};

function DemoInactivePage({ status, businessName }: { status: string; businessName: string }) {
  let title = "Demo Unavailable";
  let description = "This demo assistant is currently inactive. Please contact the administrator for more information.";
  
  if (status === "expired") {
    title = "Demo Assistant Expired";
    description = `The 14-day preview period for the ${businessName} AI assistant has expired.`;
  } else if (status === "paused") {
    title = "Demo Assistant Paused";
    description = `The preview for the ${businessName} AI assistant has been temporarily paused by the administrator.`;
  } else if (status === "archived") {
    title = "Demo Assistant Archived";
    description = `The preview for the ${businessName} AI assistant has been archived.`;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/80 px-4">
      <div className="w-full max-w-md rounded-[2.5rem] border border-slate-800 bg-slate-950 p-10 text-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
        <div className="w-16 h-16 bg-slate-900 border border-slate-800 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Bot className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-extrabold text-white">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          {description}
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link href="/signup">
            <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-900/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]">
              Create Your Own AI Assistant Free
            </button>
          </Link>
          <Link href="/">
            <button className="w-full py-3 bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 rounded-xl text-xs font-bold transition-all">
              Learn More About Agentify
            </button>
          </Link>
        </div>
        <p className="mt-10 text-[9px] font-extrabold uppercase tracking-widest text-slate-650">Powered by Agentify</p>
      </div>
    </main>
  );
}

export default async function HostedDemoPage({ params, searchParams }: DemoPageProps) {
  const { slug } = await params;
  const { contact } = await searchParams;
  const normalizedSlug = slug.toLowerCase();

  const supabase = createServiceClient();

  // 1. Fetch demo business details
  const { data: demo, error: demoErr } = await supabase
    .from("demo_businesses")
    .select("*")
    .eq("demo_slug", normalizedSlug)
    .maybeSingle();

  if (demoErr || !demo) {
    notFound();
  }

  // 2. Expiry check (Soft-expiry validation)
  const isExpired = new Date(demo.expires_at) < new Date();
  if (isExpired && demo.status === "active") {
    // Automatically transition to expired
    await supabase
      .from("demo_businesses")
      .update({ status: "expired" })
      .eq("id", demo.id);
    demo.status = "expired";
  }

  // If status is not active, render inactive page
  if (demo.status !== "active") {
    return <DemoInactivePage status={demo.status} businessName={demo.business_name} />;
  }

  // 3. Fetch placeholder business config details
  const [{ data: assistant }, { data: widgetConfig }] = await Promise.all([
    supabase
      .from("assistants")
      .select("*")
      .eq("business_id", demo.placeholder_business_id)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("widget_configs")
      .select("*")
      .eq("business_id", demo.placeholder_business_id)
      .maybeSingle(),
  ]);

  if (!assistant || !widgetConfig) {
    notFound();
  }

  const suggestedQuestions = Array.isArray(widgetConfig.suggested_questions)
    ? widgetConfig.suggested_questions.filter((item: unknown) => typeof item === "string")
    : [];

  const welcomeText =
    assistant.welcome_message || `Hi, welcome to ${demo.business_name}. How can we help you today?`;

  return (
    <DemoChatClient
      demoBusinessId={demo.id}
      demoBusinessName={demo.business_name}
      demoSlug={demo.demo_slug}
      assistantName={assistant.name || "AI Assistant"}
      welcomeText={welcomeText}
      primaryColor={widgetConfig.primary_color || "#4F46E5"}
      suggestedQuestions={suggestedQuestions}
      contactParam={contact || null}
      websiteUrl={demo.website_url}
    />
  );
}
