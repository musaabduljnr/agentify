"use client";

import { InstantAgentForm } from "@/components/landing/InstantAgentForm";
import { 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  Star, 
  ArrowRight, 
  CheckCircle2, 
  Bot,
  Globe,
  Cpu
} from "lucide-react";

const SOCIAL_PROOF_LOGOS = [
  { label: "Shopify", abbr: "SH" },
  { label: "WordPress", abbr: "WP" },
  { label: "Webflow", abbr: "WF" },
  { label: "Wix", abbr: "WX" },
  { label: "Squarespace", abbr: "SS" },
  { label: "Custom HTML", abbr: "JS" },
];

const TRUST_ITEMS = [
  { icon: CheckCircle2, label: "No credit card required" },
  { icon: Zap, label: "Trained in ~10 seconds" },
  { icon: ShieldCheck, label: "Enterprise-grade privacy" },
];

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#07080c] pt-28 pb-20 px-4">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Radial glow blobs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[500px] rounded-full bg-indigo-600/15 blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 -translate-x-1/2 w-[420px] h-[420px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[360px] h-[360px] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-4xl mx-auto text-center flex flex-col items-center gap-8">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-slate-300 text-xs sm:text-sm font-medium tracking-wide backdrop-blur-md shadow-inner">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-white font-semibold">Agentify 2.0</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400">Autonomous Business AI Engine</span>
        </div>

        {/* Heading */}
        <div className="space-y-5 max-w-3xl">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-white tracking-tight leading-[1.08]">
            <span className="text-slate-400 font-normal">Train an AI agent on</span>{" "}
            <br className="hidden sm:block" />
            <span className="text-white">your entire business.</span>{" "}
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-300 to-indigo-200 bg-clip-text text-transparent">
              In under 10 seconds.
            </span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-normal">
            Enter your website URL. Agentify instantly crawls your pages, learns your products, policies, and tone, and generates a live customer sales agent.
          </p>
        </div>

        {/* THE FORM — Hero Centerpiece */}
        <div className="w-full max-w-2xl">
          <div className="relative rounded-2xl border border-white/10 bg-[#0d0f17]/80 backdrop-blur-xl p-1 shadow-2xl shadow-black/80">
            {/* Subtle inner highlight glow */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
            
            <div className="relative z-10 p-4 sm:p-6 space-y-4">
              {/* Form Title Header (100% icons, zero emojis) */}
              <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Instant AI Agent Generator
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Globe className="w-3 h-3 text-indigo-400" /> Crawl
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-600" />
                  <span className="flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-violet-400" /> Index
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-600" />
                  <span className="flex items-center gap-1">
                    <Bot className="w-3 h-3 text-emerald-400" /> Live Demo
                  </span>
                </div>
              </div>

              {/* The Instant Agent Form Component */}
              <InstantAgentForm dark />
            </div>
          </div>

          {/* Trust Points */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400 font-medium">
            {TRUST_ITEMS.map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>{label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Social Proof metrics */}
        <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-slate-400 pt-2">
          {/* Avatar stack */}
          <div className="flex items-center -space-x-2">
            {["#4f46e5", "#7c3aed", "#2563eb", "#059669", "#d97706"].map((color, i) => (
              <div
                key={i}
                className="w-7 h-7 rounded-full border-2 border-[#07080c] flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                style={{ backgroundColor: color }}
              >
                {String.fromCharCode(65 + i)}
              </div>
            ))}
          </div>
          
          <div className="text-center sm:text-left flex items-center gap-1.5">
            <span className="text-white font-bold">1,200+</span>
            <span className="text-slate-400">businesses deployed</span>
          </div>

          <span className="hidden sm:inline text-slate-700">•</span>

          {/* Rating */}
          <div className="flex items-center gap-1.5 text-xs">
            <div className="flex items-center gap-0.5 text-amber-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="text-slate-300 font-semibold">4.9/5</span>
            <span className="text-slate-500">(500+ reviews)</span>
          </div>
        </div>

        {/* Integration Platforms */}
        <div className="w-full pt-4 space-y-3">
          <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            Embeds natively on any stack in 60 seconds
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {SOCIAL_PROOF_LOGOS.map(({ label, abbr }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-white/[0.07] bg-white/[0.02] text-slate-400 hover:text-white hover:border-white/15 transition-all text-xs font-medium"
              >
                <span className="w-5 h-5 rounded-md bg-white/[0.06] flex items-center justify-center text-[9px] font-bold text-indigo-300">
                  {abbr}
                </span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
