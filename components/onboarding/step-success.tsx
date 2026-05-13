"use client";

import { CheckCircle2, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function StepSuccess() {
  return (
    <div className="text-center py-10 animate-in zoom-in duration-500">
      <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8">
        <CheckCircle2 className="w-12 h-12 text-green-500" />
      </div>
      
      <h2 className="text-3xl font-extrabold text-slate-900 mb-4 flex items-center justify-center gap-3">
        You&apos;re all set! <PartyPopper className="w-8 h-8 text-indigo-600" />
      </h2>
      
      <p className="text-slate-500 mb-10 max-w-md mx-auto">
        Your business profile and AI assistant have been created successfully. You can now access your dashboard to start training your assistant.
      </p>

      <Link href="/dashboard">
        <Button className="h-14 px-10 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-lg shadow-xl shadow-indigo-200">
          Go to Dashboard
        </Button>
      </Link>
    </div>
  );
}
