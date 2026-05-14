import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { Bot, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getCurrentBusinessSetup } from "@/lib/queries/business";
import { Button } from "@/components/ui/button";

export default async function OnboardingPage() {
  const setup = await getCurrentBusinessSetup();

  // If already complete, allow going to dashboard
  if (setup.isComplete) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl p-12 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-50 text-green-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Bot className="w-12 h-12" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">Setup Complete!</h1>
          <p className="text-slate-500 mb-8 font-medium">
            Your business and AI assistant are already configured and ready to go.
          </p>
          <Button asChild className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-lg shadow-lg shadow-indigo-100">
            <Link href="/dashboard" className="flex items-center justify-center gap-2">
              Go to Dashboard
              <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
          <Link href="/onboarding?edit=true" className="block mt-6 text-sm font-bold text-indigo-600 hover:underline uppercase tracking-widest">
            Edit Setup Anyway
          </Link>
        </div>
      </div>
    );
  }

  // Pre-fill data if partial records exist
  const initialData = {
    businessName: setup.business?.name || "",
    industry: setup.business?.industry || "",
    websiteUrl: setup.business?.website_url || "",
    description: setup.business?.description || "",
    contactEmail: setup.business?.contact_email || setup.user?.email || "",
    phone: setup.business?.phone || "",
    whatsapp: setup.business?.whatsapp || "",
    address: setup.business?.address || "",
    assistantName: setup.assistant?.name || (setup.business?.name ? `${setup.business.name} Assistant` : ""),
    assistantTone: setup.assistant?.tone || "Friendly",
    welcomeMessage: setup.assistant?.welcome_message || "Hello! I'm your AI assistant. How can I help you today?",
    primaryColor: setup.widgetConfig?.primary_color || "#4f46e5",
    position: setup.widgetConfig?.position || "bottom-right",
    suggestedQuestions: setup.widgetConfig?.suggested_questions || ["How much does it cost?", "What are your hours?"],
  };

  return (
    <div className="min-h-screen bg-slate-50 py-20 px-4">
      <div className="container mx-auto">
        <div className="flex flex-col items-center mb-12">
          <Link href="/" className="flex items-center gap-2 mb-4">
            <Bot className="w-12 h-12 text-indigo-600" />
            <span className="text-3xl font-black text-slate-900 tracking-tight">Agentify</span>
          </Link>
          <div className="h-1 w-20 bg-indigo-600 rounded-full" />
        </div>

        <OnboardingForm initialData={initialData} />
        
        <p className="text-center mt-12 text-sm font-bold text-slate-400 uppercase tracking-widest">
          Need help? <Link href="#" className="text-indigo-600 hover:underline">Contact Support</Link>
        </p>
      </div>
    </div>
  );
}
