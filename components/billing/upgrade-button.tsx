"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowUpRight, Sparkles } from "lucide-react";

interface UpgradeButtonProps {
  planId: "starter" | "growth";
  provider?: "paystack" | "flutterwave";
  label?: string;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link";
}

export function UpgradeButton({
  planId,
  provider = "paystack",
  label = "Upgrade",
  className = "",
  variant = "default",
}: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: planId, provider }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to initialize checkout.");
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("No checkout URL was returned.");
      }
    } catch (err: any) {
      console.error("Upgrade trigger error:", err);
      setError(err.message || "An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      <Button
        onClick={handleUpgrade}
        disabled={loading}
        variant={variant}
        className={`w-full rounded-2xl h-11 font-bold transition-all shadow-sm whitespace-nowrap ${className}`}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Initializing...
          </>
        ) : (
          <>
            {label}
            <ArrowUpRight className="w-4 h-4 ml-1.5" />
          </>
        )}
      </Button>
      {error && (
        <span className="text-[10px] text-red-500 font-medium mt-1 text-center leading-tight">
          ⚠ {error}
        </span>
      )}
    </div>
  );
}
