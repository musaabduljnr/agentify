"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminLogin } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Bot, Shield, Loader2, KeyRound } from "lucide-react";
import Link from "next/link";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await adminLogin(email, password);
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Successfully authenticated & elevated! Redirect to admin panel
      router.push("/admin");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to log in as administrator.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative premium glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />

      <div className="max-w-md w-full bg-slate-900 border border-slate-850 rounded-3xl p-10 relative z-10 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-2 mb-4 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-full text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <Shield className="w-4 h-4" />
            Platform Control Portal
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mb-2">
            Admin Sign In
          </h1>
          <p className="text-slate-400 text-xs leading-relaxed">
            Enter your credentials. Authenticators are auto-elevated to developer roles upon successful authorization.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs font-semibold">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 font-medium rounded-2xl">
              ⚠ {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-slate-450 font-bold block mb-1">Administrative Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@agentify.com"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors placeholder-slate-650"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center mb-1">
              <label className="text-slate-450 font-bold">Secure Password</label>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors placeholder-slate-650"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 mt-4"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                Access Control Panel
              </>
            )}
          </Button>
        </form>

        <div className="text-center mt-8 pt-6 border-t border-slate-850">
          <Link
            href="/login"
            className="text-xs text-slate-500 hover:text-indigo-400 font-bold transition-colors"
          >
            ← Return to Standard Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
