"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateInstantAgent } from "@/lib/actions/instant-generator";
import { trackEvent } from "@/lib/analytics";
import { captureUtm } from "@/lib/analytics/utm";
import { ArrowRight, Loader2 } from "lucide-react";

export function StartForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    captureUtm();
    trackEvent("signup_started", { source: "ad_landing" });
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      setError("Please enter your website address.");
      return;
    }

    let normalized = cleanUrl;
    if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
      normalized = `https://${normalized}`;
    }

    try {
      const parsed = new URL(normalized);
      if (!parsed.hostname || !parsed.hostname.includes(".")) {
        setError("Please enter a valid website address.");
        return;
      }
    } catch {
      setError("Please enter a valid website address.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const response = await generateInstantAgent({ websiteUrl: cleanUrl });
        if (response.success) {
          trackEvent("preview_built", { source: "ad_landing" });
          router.push(response.previewUrl);
        } else {
          setError(response.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not build your agent. Please try again.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-lg mx-auto space-y-3">
      <input
        type="text"
        value={url}
        onChange={(event) => {
          setUrl(event.target.value);
          if (error) setError(null);
        }}
        disabled={isPending}
        placeholder="Paste your website address"
        aria-label="Paste your website address"
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={isPending || !url.trim()}
        className="w-full rounded-xl bg-slate-900 px-6 py-3.5 text-base font-semibold text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Building your agent...
          </>
        ) : (
          <>
            Build my agent
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
