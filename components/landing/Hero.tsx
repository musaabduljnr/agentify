"use client";

import Link from "next/link";
import { InstantAgentForm } from "@/components/landing/InstantAgentForm";
import { Sparkles, Zap, Shield, Star, ArrowRight, CheckCircle2 } from "lucide-react";

const SOCIAL_PROOF_LOGOS = [
  { label: "Shopify", abbr: "SH" },
  { label: "WordPress", abbr: "WP" },
  { label: "Webflow", abbr: "WF" },
  { label: "Wix", abbr: "WX" },
  { label: "Squarespace", abbr: "SS" },
];

const TRUST_ITEMS = [
  { icon: CheckCircle2, label: "No credit card" },
  { icon: Zap, label: "Ready in ~10 seconds" },
  { icon: Shield, label: "Secure & private" },
];

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#0a0a0f] pt-24 pb-16 px-4">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Radial glow blob – center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none" />

      {/* Top-left accent */}
      <div className="absolute top-0 left-0 w-96 h-96 rounded-full bg-violet-700/10 blur-[90px] pointer-events-none" />

      {/* Bottom-right accent */}
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-blue-600/10 blur-[90px] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-4xl mx-auto text-center flex flex-col items-center gap-8">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs sm:text-sm font-semibold tracking-wide backdrop-blur-sm">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>AI-Powered Business Assistant Generator</span>
          <span className="inline-flex items-center gap-1 ml-1 text-emerald-400">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Live
          </span>
        </div>

        {/* Heading */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.08] tracking-tight">
            Your website URL.{" "}
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-blue-400 bg-clip-text text-transparent">
              Your AI sales agent.
            </span>
            <br className="hidden sm:block" />
            In 10 seconds.
          </h1>
          <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
            Paste any website URL and watch Agentify crawl it, train an AI agent on your content,
            and give you an interactive chat preview — instantly, for free.
          </p>
        </div>

        {/* THE FORM — hero centerpiece */}
        <div className="w-full max-w-2xl">
          {/* Form card */}
          <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-1 shadow-2xl shadow-indigo-500/10">
            {/* Inner shimmer border */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-transparent to-violet-500/20 pointer-events-none" />
            <div className="relative z-10 p-4 sm:p-6 space-y-5">
              {/* Label */}
              <div className="text-left">
                <p className="text-sm font-bold text-white/70 uppercase tracking-widest mb-1">
                  🚀 Instant AI Agent Generator
                </p>
                <p className="text-white/40 text-xs">
                  Crawls your site → Extracts your brand → Trains a custom AI → Live demo ready
                </p>
              </div>

              {/* Steps flow (visual indicator) */}
              <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {["1. Enter URL", "2. AI Crawls & Trains", "3. Test Your Agent"].map((step, i) => (
                  <div key={step} className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full ${i === 0 ? "bg-indigo-600/30 text-indigo-300" : "bg-white/5 text-slate-500"}`}>
                      {step}
                    </span>
                    {i < 2 && <ArrowRight className="w-3 h-3 text-slate-600" />}
                  </div>
                ))}
              </div>

              {/* The Instant Agent Form */}
              <InstantAgentForm dark />
            </div>
          </div>

          {/* Trust bar */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500 font-medium">
            {TRUST_ITEMS.map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 text-emerald-500" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Social proof: user count */}
        <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-slate-500">
          {/* Avatar stack */}
          <div className="flex items-center -space-x-2.5">
            {["#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#10b981"].map((color, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full border-2 border-[#0a0a0f] flex items-center justify-center text-[10px] font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {String.fromCharCode(65 + i)}
              </div>
            ))}
          </div>
          <div className="text-center sm:text-left">
            <span className="text-white font-bold">1,200+</span>
            <span className="text-slate-500"> businesses already using Agentify</span>
          </div>
          {/* Star rating */}
          <div className="flex items-center gap-1 text-amber-400 text-xs font-semibold">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
            ))}
            <span className="text-slate-500 ml-1">4.9/5</span>
          </div>
        </div>

        {/* Divider text */}
        <div className="flex items-center gap-4 text-xs text-slate-700 font-semibold uppercase tracking-widest">
          <div className="flex-1 h-px bg-white/5" />
          Works seamlessly with
          <div className="flex-1 h-px bg-white/5" />
        </div>

        {/* Platform compatibility logos */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {SOCIAL_PROOF_LOGOS.map(({ label, abbr }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/8 bg-white/4 text-slate-400 hover:text-slate-200 hover:border-white/15 transition-all duration-200 text-sm font-semibold backdrop-blur-sm"
            >
              <span className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-[9px] font-extrabold text-slate-300">
                {abbr}
              </span>
              {label}
            </div>
          ))}
        </div>

        {/* Secondary links */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-600">
          <Link
            href="/signup"
            className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors underline underline-offset-4"
          >
            Sign up for full account
          </Link>
          <span className="text-slate-800">•</span>
          <Link
            href="/demo"
            className="text-slate-500 hover:text-slate-300 font-medium transition-colors"
          >
            View sample demo
          </Link>
          <span className="text-slate-800">•</span>
          <Link
            href="#pricing"
            className="text-slate-500 hover:text-slate-300 font-medium transition-colors"
          >
            See pricing
          </Link>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-slate-700 text-[10px] font-semibold uppercase tracking-widest animate-bounce">
        <span>Scroll</span>
        <div className="w-px h-6 bg-gradient-to-b from-slate-700 to-transparent" />
      </div>
    </section>
  );
}
