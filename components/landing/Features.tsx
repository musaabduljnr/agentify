"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  ArrowRight, 
  Terminal, 
  Copy, 
  Check, 
  Smartphone, 
  Users, 
  Database, 
  Headphones, 
  FileText, 
  Cloud, 
  Layers 
} from "lucide-react";

export function Features() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText('<script src="https://agentify.ai/v1.js"></script>');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="capabilities" className="w-full py-20 px-6 lg:px-12 bg-[#f2f4f8]">
      <div className="max-w-6xl mx-auto">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#2a54c0] font-semibold block mb-2">
              Engineered For Performance
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#181c1f] tracking-tight">
              Built to handle complex enterprise conversations
            </h2>
          </div>
          <Link
            href="/demo"
            className="inline-flex items-center gap-1.5 text-[#2a54c0] text-sm font-semibold hover:underline"
          >
            <span>Explore all technical capabilities</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* 4 Bento Grid Cards from Stitch Section 4 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Bento 1: Dual Deployment (7 Cols) */}
          <div className="md:col-span-7 bg-[#ffffff] p-8 rounded-xl border border-[#eceef2] shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full bg-[#dce3f1] text-[#151c26] text-xs font-semibold">
                  Versatile Distribution
                </span>
                <Smartphone className="w-5 h-5 text-[#575f6a]" />
              </div>
              <h3 className="text-xl font-bold text-[#181c1f] mb-2">
                Dual Deployment: Embed or Hosted Chat Links
              </h3>
              <p className="text-sm text-[#575f6a] mb-6 leading-relaxed">
                Launch a branded chat bubble on any web app with customizable accent colors, or share independent full-screen chat URLs ideal for marketing campaigns, outbound cold emails, and QR code menus.
              </p>
            </div>
            <div className="p-4 bg-[#f2f4f8] rounded-xl border border-[#eceef2] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-[#ffffff] border border-[#eceef2] flex items-center justify-center shadow-xs shrink-0 text-[#2a54c0]">
                  <Terminal className="w-5 h-5" />
                </div>
                <div className="text-left font-mono text-xs min-w-0">
                  <p className="text-[#181c1f] font-semibold truncate">
                    &lt;script src=&quot;https://agentify.ai/v1.js&quot;&gt;&lt;/script&gt;
                  </p>
                  <p className="text-[#747684]">Async • Zero impact on page load latency</p>
                </div>
              </div>
              <button 
                onClick={handleCopy}
                className="px-3 py-1.5 bg-[#ffffff] rounded-md text-xs font-semibold text-[#181c1f] shadow-xs border border-[#eceef2] hover:bg-[#eceef2] transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#027A48]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          {/* Bento 2: Real-time Lead Enrichment (5 Cols) */}
          <div className="md:col-span-5 bg-[#ffffff] p-8 rounded-xl border border-[#eceef2] shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full bg-[#dbe1ff] text-[#013daa] text-xs font-semibold">
                  Pipeline Generation
                </span>
                <Users className="w-5 h-5 text-[#2a54c0]" />
              </div>
              <h3 className="text-xl font-bold text-[#181c1f] mb-2">
                Intelligent Lead Capture & Routing
              </h3>
              <p className="text-sm text-[#575f6a] leading-relaxed mb-6">
                Agents qualify prospects conversationally, extract intent, company size, and budget, then push directly to Salesforce, HubSpot, or webhook endpoints.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#f2f4f8] border border-[#eceef2] text-xs">
                <span className="text-[#181c1f] font-medium">Intent: Enterprise Upgrade</span>
                <span className="px-2 py-0.5 rounded bg-[#dbe1ff] text-[#00174c] font-mono font-semibold">
                  High Intent
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#f2f4f8] border border-[#eceef2] text-xs">
                <span className="text-[#181c1f] font-medium">CRM Destination: HubSpot</span>
                <span className="text-[#027A48] font-mono font-semibold">Synced in 0.8s</span>
              </div>
            </div>
          </div>

          {/* Bento 3: Multi-Source Knowledge Synapse (5 Cols) */}
          <div className="md:col-span-5 bg-[#ffffff] p-8 rounded-xl border border-[#eceef2] shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full bg-[#f2f4f8] border border-[#eceef2] text-[#575f6a] text-xs font-semibold">
                  Continuous Ingestion
                </span>
                <Database className="w-5 h-5 text-[#575f6a]" />
              </div>
              <h3 className="text-xl font-bold text-[#181c1f] mb-2">
                Multi-Source Knowledge Synapse
              </h3>
              <p className="text-sm text-[#575f6a] leading-relaxed mb-6">
                Keep answers accurate with automated periodic crawlers. Sync with Notion, Google Docs, CSV catalogs, and technical API docs seamlessly.
              </p>
            </div>
            <div className="flex items-center justify-around py-3 bg-[#f2f4f8] rounded-xl border border-[#eceef2] text-[#575f6a]">
              <span className="flex items-center gap-1.5 text-xs font-medium" title="Notion & Docs">
                <FileText className="w-4 h-4 text-[#2a54c0]" /> Docs
              </span>
              <span className="flex items-center gap-1.5 text-xs font-medium" title="Cloud Sync">
                <Cloud className="w-4 h-4 text-[#2a54c0]" /> Cloud
              </span>
              <span className="flex items-center gap-1.5 text-xs font-medium" title="Vector Database">
                <Layers className="w-4 h-4 text-[#2a54c0]" /> Vector
              </span>
            </div>
          </div>

          {/* Bento 4: Seamless Human Takeover (7 Cols) */}
          <div className="md:col-span-7 bg-[#ffffff] p-8 rounded-xl border border-[#eceef2] shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full bg-[#ffdad6] text-[#ba1a1a] text-xs font-semibold">
                  Safety & Compliance
                </span>
                <Headphones className="w-5 h-5 text-[#575f6a]" />
              </div>
              <h3 className="text-xl font-bold text-[#181c1f] mb-2">
                Frictionless Human Takeover & Escapes
              </h3>
              <p className="text-sm text-[#575f6a] mb-6 leading-relaxed">
                When a request exceeds an agent&apos;s confidence threshold or requires sensitive escalation, Agentify immediately alerts your team via Slack or live inbox with complete conversation context.
              </p>
            </div>
            <div className="p-3 bg-[#f2f4f8] rounded-lg border border-[#eceef2] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-[#027A48]"></div>
                <span className="text-xs text-[#181c1f] font-medium">
                  Auto-detected Sentiment: Escalated Question
                </span>
              </div>
              <span className="text-xs text-[#2a54c0] font-semibold">
                Notified #support-tier2
              </span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
