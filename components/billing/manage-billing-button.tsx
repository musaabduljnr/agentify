"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, Settings } from "lucide-react";

interface ManageBillingButtonProps {
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  label?: string;
}

export function ManageBillingButton({
  className = "",
  variant = "outline",
  size = "default",
  label = "Manage Billing",
}: ManageBillingButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenPortal = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to open customer portal.");
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No portal URL was returned.");
      }
    } catch (err: any) {
      console.error("Manage Billing error:", err);
      setError(err.message || "Could not launch portal. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start">
      <Button
        variant={variant}
        size={size}
        onClick={handleOpenPortal}
        disabled={loading}
        className={`font-semibold rounded-2xl gap-2 transition-all ${className}`}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Opening Portal...</span>
          </>
        ) : (
          <>
            <Settings className="w-4 h-4 text-slate-500" />
            <span>{label}</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </>
        )}
      </Button>
      {error && (
        <span className="text-xs text-red-600 mt-1.5 font-medium">
          {error}
        </span>
      )}
    </div>
  );
}
