"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowUpRight, Sparkles } from "lucide-react";

interface UpgradeButtonProps {
  planId: "starter" | "growth";
  label?: string;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link";
}

export function UpgradeButton({
  planId,
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
        body: JSON.stringify({ plan: planId }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to initialize Bachs checkout.");
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("No checkout URL was returned.");
      }
    } catch (err: any) {
      console.error("Upgrade checkout error:", err);
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
        className={`w-full font-medium transition-all ${className}`}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Connecting to Checkout...
          </>
        ) : (
          <div className="flex items-center justify-center gap-1.5 w-full">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{label}</span>
            <ArrowUpRight className="w-3.5 h-3.5 opacity-70" />
          </div>
        )}
      </Button>
      {error && (
        <p className="mt-2 text-xs text-red-600 text-center font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
