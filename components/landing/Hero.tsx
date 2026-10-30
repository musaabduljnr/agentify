"use client";

import { InstantAgentForm } from "@/components/landing/InstantAgentForm";
import { 
  Star, 
  ShieldCheck, 
  Bot, 
  CheckCircle2, 
  RefreshCw,
  Sparkles
} from "lucide-react";

export function Hero() {
  return (
    <section className="relative w-full overflow-hidden pt-28 pb-20 px-6 lg:px-12 bg-[#f7f9fd]">
      {/* Atmospheric Ambient Glows from Stitch */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[850px] h-[340px] bg-gradient-to-b from-[#dbe1ff]/50 via-[#f2f4f8]/30 to-transparent blur-3xl pointer-events-none -z-10 rounded-full" />

      <div className="max-w-6xl mx-auto flex flex-col items-center text-center">
        
        {/* Social Proof Rating Chip */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ffffff] border border-[#eceef2] shadow-sm mb-8 transition-transform hover:scale-[1.02]">
          <div className="flex items-center text-amber-400">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
            ))}
          </div>
          <span className="text-[13px] font-semibold text-[#181c1f]">4.9 rating</span>
          <span className="w-1 h-1 rounded-full bg-[#c4c6d5]"></span>
          <span className="text-[13px] text-[#575f6a]">50k+ conversations handled</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-[#181c1f] tracking-tight max-w-4xl mb-6 leading-[1.12]">
          Your business deserves an AI assistant.
        </h1>

        {/* Subheadline */}
        <p className="text-base sm:text-lg text-[#575f6a] max-w-2xl mb-10 leading-relaxed">
          Answer customer questions, capture qualified leads, and provide instant support around the clock with an intelligent agent trained specifically on your business.
        </p>

        {/* Instant URL Generator Interaction Bar */}
        <div className="w-full max-w-xl mx-auto mb-4">
          <InstantAgentForm />
        </div>

        {/* Trust Microcopy */}
        <div className="flex items-center justify-center gap-2 text-[#575f6a] text-xs sm:text-[13px] mb-16">
          <ShieldCheck className="w-4 h-4 text-[#2a54c0] shrink-0" />
          <span>No technical setup required. See your agent in action instantly.</span>
        </div>

        {/* 3-Panel Interactive Showcase from Stitch */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch text-left">
          
          {/* Left Panel: Floating Customer Inquiry Card */}
          <div className="lg:col-span-3 bg-[#f2f4f8]/80 border border-[#eceef2] rounded-xl p-5 flex flex-col justify-between shadow-xs relative group overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2a54c0] animate-pulse"></span>
                  <span className="text-[11px] font-semibold text-[#575f6a] uppercase tracking-wider">
                    Inbound Visitor
                  </span>
                </div>
                <span className="text-[11px] text-[#747684]">Just now</span>
              </div>

              {/* Customer Message Bubble */}
              <div className="bg-[#ffffff] p-4 rounded-xl border border-[#eceef2] shadow-xs mb-4">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-7 h-7 rounded-full bg-[#dce3f1] flex items-center justify-center text-[#151c26] text-xs font-bold">
                    MR
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#181c1f]">Marcus Reed</p>
                    <p className="text-[11px] text-[#747684]">Verified Buyer</p>
                  </div>
                </div>
                <p className="text-[13px] text-[#181c1f] leading-snug">
                  &ldquo;Do you offer international enterprise shipping and same-day pickup for this item?&rdquo;
                </p>
              </div>
            </div>

            {/* Processing State Banner */}
            <div className="bg-[#dbe1ff]/60 border border-[#b4c5ff] p-3 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#013daa]">
                <RefreshCw className="w-4 h-4 animate-spin text-[#2a54c0]" />
                <span className="text-xs font-medium">Neural Synapse Processing...</span>
              </div>
              <span className="text-[11px] text-[#013daa] font-mono">14ms</span>
            </div>
          </div>

          {/* Center Panel: Agentify Dashboard Insights Preview */}
          <div className="lg:col-span-6 bg-[#ffffff] border border-[#eceef2] rounded-xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              {/* Dashboard Card Top Bar */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#eceef2]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#f2f4f8] border border-[#eceef2] flex items-center justify-center text-[#2a54c0]">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#181c1f]">Live Autonomous Overview</h3>
                    <p className="text-xs text-[#575f6a]">
                      Active Agents: <span className="font-semibold text-[#181c1f]">Support & Growth-01</span>
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ECFDF3] text-[#027A48] text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#027A48] animate-ping" />
                  99.98% Autonomous
                </span>
              </div>

              {/* Key Numbers Split */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-[#f2f4f8] p-3.5 rounded-lg border border-[#eceef2]/60">
                  <span className="text-[11px] font-semibold text-[#575f6a] uppercase tracking-wider block mb-1">
                    Total Handled
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-[#181c1f]">18,420</span>
                    <span className="text-xs font-semibold text-[#027A48]">+24.8%</span>
                  </div>
                </div>
                <div className="bg-[#f2f4f8] p-3.5 rounded-lg border border-[#eceef2]/60">
                  <span className="text-[11px] font-semibold text-[#575f6a] uppercase tracking-wider block mb-1">
                    Lead Conversion
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-[#181c1f]">34.2%</span>
                    <span className="text-xs font-semibold text-[#027A48]">+4.1%</span>
                  </div>
                </div>
              </div>

              {/* Multi-layer SVG Graphic from Stitch */}
              <div className="w-full mb-4">
                <div className="flex items-center justify-between text-[#575f6a] text-xs mb-2">
                  <span>Inquiries Autonomous Resolution (Last 7 Days)</span>
                  <span className="font-mono text-[11px]">Avg Latency: 1.2s</span>
                </div>
                <svg className="w-full h-32 overflow-visible" preserveAspectRatio="none" viewBox="0 0 500 120">
                  <defs>
                    <linearGradient id="primaryGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#2a54c0" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#2a54c0" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="secondaryGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#476edb" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#476edb" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  {/* Baseline Grid */}
                  <line stroke="#eceef2" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="500" y1="20" y2="20" />
                  <line stroke="#eceef2" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="500" y1="60" y2="60" />
                  <line stroke="#eceef2" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="500" y1="100" y2="100" />
                  {/* Background Volume Area */}
                  <path d="M0,95 Q75,70 150,85 T300,50 T420,30 T500,25 L500,120 L0,120 Z" fill="url(#primaryGrad)" />
                  <path d="M0,95 Q75,70 150,85 T300,50 T420,30 T500,25" fill="none" stroke="#2a54c0" strokeLinecap="round" strokeWidth="2.5" />
                  {/* Lead Capture Accent Curve */}
                  <path d="M0,110 Q90,95 180,90 T320,70 T440,55 T500,45 L500,120 L0,120 Z" fill="url(#secondaryGrad)" />
                  <path d="M0,110 Q90,95 180,90 T320,70 T440,55 T500,45" fill="none" stroke="#476edb" strokeLinecap="round" strokeWidth="2" />
                  {/* Focus Node */}
                  <circle cx="420" cy="30" fill="#2a54c0" r="4.5" stroke="#ffffff" strokeWidth="2" />
                </svg>
              </div>
            </div>

            {/* Bottom Micro Sandbox Trigger */}
            <div className="bg-[#f2f4f8] p-2.5 rounded-lg border border-[#eceef2] flex flex-col sm:flex-row items-start sm:items-center justify-between text-[#575f6a] gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#2a54c0] shrink-0" />
                <span className="text-xs text-[#181c1f]">
                  Auto-trained on: <strong className="font-semibold">help-center, catalog-api, pricing.pdf</strong>
                </span>
              </div>
              <span className="text-xs text-[#2a54c0] font-semibold cursor-pointer hover:underline shrink-0">
                Live Knowledge Synapse
              </span>
            </div>
          </div>

          {/* Right Panel: AI Live Response Preview */}
          <div className="lg:col-span-3 bg-[#f2f4f8]/80 border border-[#eceef2] rounded-xl p-5 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#2a54c0] flex items-center justify-center text-white text-[12px]">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[13px] font-semibold text-[#181c1f]">Agentify AI</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#ffffff] border border-[#eceef2] text-[11px] text-[#575f6a] font-mono">
                  99.4% confidence
                </span>
              </div>

              {/* Agent Generated Response Card */}
              <div className="bg-[#ffffff] p-4 rounded-xl border border-[#eceef2] shadow-xs mb-4">
                <p className="text-[13px] text-[#181c1f] mb-3 leading-relaxed">
                  &ldquo;Yes! International shipping is available to 45+ countries with expedited tracking. Same-day pickup is available at our flagship downtown hub.&rdquo;
                </p>
                <div className="p-2.5 rounded-lg bg-[#f2f4f8] flex items-center gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-[#2a54c0] shrink-0" />
                  <span className="text-[#575f6a]">
                    Referenced: <span className="text-[#181c1f] font-semibold">Shipping Policy §4.2</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Lead Capture Action Card */}
            <div className="bg-[#ffffff] p-3.5 rounded-xl border border-[#eceef2] shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-[#575f6a] uppercase tracking-wider">
                  Automated Conversion
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-[#027A48] font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  CRM Synced
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#dce3f1] flex items-center justify-center text-[#151c26] text-xs font-bold">
                  SJ
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-[#181c1f] truncate">Sarah Jenkins</p>
                  <p className="text-[11px] text-[#747684] truncate">sarah@lumina.io</p>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
