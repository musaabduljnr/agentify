"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { verifyPaymentReference } from "@/lib/actions/payments";
import { Loader2, CheckCircle2, XCircle, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const reference = searchParams.get("reference") || searchParams.get("trxref");
  
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your payment transaction...");
  const [plan, setPlan] = useState("");

  useEffect(() => {
    if (!reference) {
      setStatus("error");
      setMessage("No transaction reference was provided in the callback.");
      return;
    }

    let isMounted = true;

    async function verify() {
      try {
        const result = await verifyPaymentReference(reference!);
        
        if (!isMounted) return;

        if (result.success) {
          setStatus("success");
          setPlan(result.plan || "Paid");
          setMessage("Your subscription has been upgraded successfully!");
          
          // Auto redirect after 3 seconds
          setTimeout(() => {
            router.push("/dashboard/billing?success=true");
          }, 3000);
        } else {
          setStatus("error");
          setMessage(result.error || "Failed to verify transaction payment.");
        }
      } catch (err: any) {
        if (!isMounted) return;
        setStatus("error");
        setMessage(err.message || "An unexpected error occurred during verification.");
      }
    }

    verify();

    return () => {
      isMounted = false;
    };
  }, [reference, router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white max-w-md w-full rounded-3xl border border-slate-200 shadow-xl p-8 text-center relative overflow-hidden">
        {/* Decorative ambient blobs */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-50 rounded-full -ml-12 -mb-12 blur-2xl"></div>

        <div className="relative z-10 flex flex-col items-center">
          {status === "loading" && (
            <>
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 border border-indigo-100">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Verifying Payment</h2>
              <p className="text-slate-500 text-sm leading-relaxed">{message}</p>
              <div className="mt-8 text-xs text-slate-400 font-medium bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 truncate max-w-full">
                Ref: {reference || "None"}
              </div>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 border border-emerald-100 animate-bounce">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Payment Successful!</h2>
              <p className="text-slate-500 text-sm mb-2 leading-relaxed">{message}</p>
              <p className="text-xs text-slate-400 mb-8 font-semibold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full uppercase tracking-wider">
                Upgraded to {plan}
              </p>
              <Button asChild className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-12 font-bold flex items-center justify-center gap-2">
                <Link href="/dashboard/billing">
                  Go to Billing <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6 border border-red-100">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Verification Failed</h2>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">{message}</p>
              
              <div className="flex flex-col gap-3 w-full">
                <Button onClick={() => window.location.reload()} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-12 font-bold flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Retry Verification
                </Button>
                <Button asChild variant="outline" className="w-full rounded-2xl h-12 border-2 border-slate-100 font-bold hover:bg-slate-50">
                  <Link href="/dashboard/billing">
                    Return to Billing
                  </Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
