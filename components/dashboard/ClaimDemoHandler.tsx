"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { claimDemoAssistant } from "@/lib/actions/demo-generator";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ClaimDemoHandlerProps {
  userId: string;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax; Secure`;
}

export function ClaimDemoHandler({ userId }: ClaimDemoHandlerProps) {
  const router = useRouter();
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimSlug, setClaimSlug] = useState<string | null>(null);

  useEffect(() => {
    const slug = getCookie("agentify_claim_demo");
    if (slug) {
      setClaimSlug(slug);
      handleClaim(slug);
    }
  }, []);

  const handleClaim = async (slug: string) => {
    setIsClaiming(true);
    toast.loading("Transferring your AI assistant config...");

    try {
      const res = await claimDemoAssistant(slug, userId);
      
      // Cleanup cookie immediately to prevent infinite loop
      deleteCookie("agentify_claim_demo");
      
      if (res.error) {
        toast.dismiss();
        toast.error(res.error);
      } else {
        toast.dismiss();
        toast.success("AI Assistant claimed successfully! Welcome aboard.");
        
        // Refresh and redirect to reload the setup check list
        router.push("/dashboard");
        router.refresh();
        
        // Wait a tiny bit and force a window reload to ensure all layout servers re-mount the new business
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (err) {
      deleteCookie("agentify_claim_demo");
      toast.dismiss();
      toast.error("Failed to claim the assistant. Please contact support.");
      console.error(err);
    } finally {
      setIsClaiming(false);
      setClaimSlug(null);
    }
  };

  if (!isClaiming || !claimSlug) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 max-w-md w-full text-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
        
        <div className="w-16 h-16 bg-indigo-600/20 text-indigo-400 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-indigo-500/20 animate-pulse">
          <Sparkles className="w-8 h-8" />
        </div>
        
        <h3 className="text-xl font-extrabold text-white mb-2">Claiming Your AI Assistant</h3>
        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
          Please wait while we transfer the scraped knowledge base, vector embeddings, chatbot settings, and custom branding to your new account.
        </p>
        
        <div className="flex items-center justify-center gap-3 text-xs font-bold text-indigo-400 uppercase tracking-widest">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Configuring Workspace...</span>
        </div>
      </div>
    </div>
  );
}
