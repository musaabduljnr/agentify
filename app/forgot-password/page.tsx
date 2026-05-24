"use client";

import Link from "next/link";
import { useState } from "react";
import { Bot, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setMessage("Password reset link sent. Check your inbox and follow the secure link.");
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-10 shadow-xl">
        <div className="mb-10 text-center">
          <Link href="/" className="mb-6 inline-flex items-center gap-2">
            <Bot className="h-10 w-10 text-indigo-600" />
            <span className="text-2xl font-extrabold text-slate-900">Agentify</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
          <p className="mt-1 text-sm text-slate-500">We’ll send a secure reset link to your email.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {message && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
              <MailCheck className="mb-2 h-5 w-5 text-emerald-600" />
              {message}
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          <label className="block space-y-2">
            <span className="ml-1 text-sm font-semibold text-slate-700">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </label>

          <Button disabled={loading} className="h-12 w-full rounded-2xl bg-indigo-600 text-lg font-bold text-white hover:bg-indigo-700">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send Reset Link"}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-500">
          Remembered it?{" "}
          <Link href="/login" className="font-bold text-indigo-600 hover:text-indigo-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
