import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { Bot } from "lucide-react";
import Link from "next/link";

export default function OnboardingPage() {
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

        <OnboardingForm />
        
        <p className="text-center mt-12 text-sm font-bold text-slate-400 uppercase tracking-widest">
          Need help? <Link href="#" className="text-indigo-600 hover:underline">Contact Support</Link>
        </p>
      </div>
    </div>
  );
}
