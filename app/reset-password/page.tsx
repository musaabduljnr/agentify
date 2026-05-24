"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => router.push("/login"), 1800);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-10 shadow-xl">
        <div className="mb-10 text-center">
          <Link href="/" className="mb-6 inline-flex items-center gap-2">
            <Bot className="h-10 w-10 text-indigo-600" />
            <span className="text-2xl font-extrabold text-slate-900">Agentify</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Create a new password</h1>
          <p className="mt-1 text-sm text-slate-500">Choose a secure password for your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {success && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="mb-2 h-5 w-5 text-emerald-600" />
              Password updated. Redirecting to login...
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          <label className="block space-y-2">
            <span className="ml-1 text-sm font-semibold text-slate-700">New Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </label>

          <label className="block space-y-2">
            <span className="ml-1 text-sm font-semibold text-slate-700">Confirm Password</span>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </label>

          <Button disabled={loading || success} className="h-12 w-full rounded-2xl bg-indigo-600 text-lg font-bold text-white hover:bg-indigo-700">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
