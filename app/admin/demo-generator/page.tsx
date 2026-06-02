"use client";

import { useState, useTransition, useEffect } from "react";
import { createDemoBusiness, getAdminDemoAnalytics } from "@/lib/actions/demo-generator";
import { Sparkles, Globe, User, Mail, Phone, ChevronRight, BarChart3, TrendingUp, KeyRound, AlertTriangle, ShieldCheck, Copy, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface AnalyticsData {
  total: number;
  active: number;
  expired: number;
  converted: number;
  conversionRate: number;
  totalVisits: number;
  totalConvs: number;
  totalLeads: number;
  totalMessages: number;
  needFollowUp: number;
}

export default function DemoGeneratorPage() {
  const [isPending, startTransition] = useTransition();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [createdDemo, setCreatedDemo] = useState<{ url: string; slug: string } | null>(null);

  // Form states
  const [businessName, setBusinessName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Loading phase states for scraper status visualization
  const [scrapingPhase, setScrapingPhase] = useState<string>("");

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const data = await getAdminDemoAnalytics();
      setAnalytics(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName || !websiteUrl) {
      toast.error("Please fill in business name and website URL.");
      return;
    }

    setCreatedDemo(null);
    setScrapingPhase("1. Connecting & scraping business website...");

    startTransition(async () => {
      // Simulate status updates for UX wow factor
      const timer1 = setTimeout(() => {
        setScrapingPhase("2. Extracting business profile, tone, and common queries...");
      }, 5000);
      
      const timer2 = setTimeout(() => {
        setScrapingPhase("3. Training AI model and generating vector embeddings...");
      }, 10000);

      const timer3 = setTimeout(() => {
        setScrapingPhase("4. Setting up custom widget styling, chat pages, and tracking CRM...");
      }, 16000);

      try {
        const res = await createDemoBusiness({
          businessName,
          websiteUrl,
          contactName,
          contactEmail,
          contactPhone,
        });

        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);

        if (res.error) {
          toast.error(res.error);
          setScrapingPhase("");
        } else if (res.demoUrl) {
          toast.success("AI Demo Assistant created successfully!");
          
          // Formulate full absolute URL
          const absoluteUrl = `${window.location.origin}${res.demoUrl}`;
          setCreatedDemo({ url: absoluteUrl, slug: res.slug });
          setScrapingPhase("");
          
          // Clear inputs
          setBusinessName("");
          setWebsiteUrl("");
          setContactName("");
          setContactEmail("");
          setContactPhone("");
          
          // Reload metrics
          loadAnalytics();
        }
      } catch (err: any) {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        toast.error(err.message || "An unexpected error occurred.");
        setScrapingPhase("");
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Demo link copied to clipboard!");
  };

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white mb-2">Instant Demo Generator</h1>
          <p className="text-slate-400 text-sm">
            Spin up fully-trained AI business assistants for prospects in seconds using their website URL.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/demos">
            <button className="px-5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-900 text-sm font-bold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              View CRM Pipeline
            </button>
          </Link>
        </div>
      </div>

      {/* Analytics Summary */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "Total Demos", value: analytics.total, icon: <Sparkles className="w-4 h-4 text-indigo-400" /> },
            { label: "Active Demos", value: analytics.active, icon: <TrendingUp className="w-4 h-4 text-emerald-400" /> },
            { label: "Expired Demos", value: analytics.expired, icon: <AlertTriangle className="w-4 h-4 text-amber-400" /> },
            { label: "Converted", value: analytics.converted, icon: <ShieldCheck className="w-4 h-4 text-purple-400" /> },
            { label: "Conversion Rate", value: `${analytics.conversionRate}%`, icon: <TrendingUp className="w-4 h-4 text-pink-400" /> },
          ].map((stat, i) => (
            <div key={i} className="bg-slate-950/65 border border-slate-850 p-5 rounded-2xl relative overflow-hidden">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</span>
                {stat.icon}
              </div>
              <div className="text-2xl font-black text-white mt-1">{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Main Creation Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Input parameters */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-950/65 border border-slate-850 p-8 rounded-[2rem] space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
              <Globe className="w-5 h-5 text-indigo-400" />
              Prospect Information
            </h3>
            
            <form onSubmit={handleGenerate} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Business Name</label>
                  <input
                    type="text"
                    required
                    disabled={isPending}
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Glow Haven"
                    className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-all disabled:opacity-50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Website URL</label>
                  <input
                    type="url"
                    required
                    disabled={isPending}
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://glowhaven.com"
                    className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="border-t border-slate-900 pt-5 space-y-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Optional Contact Info (Sales CRM)</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-500" /> Owner Name
                    </label>
                    <input
                      type="text"
                      disabled={isPending}
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500 transition-all disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-500" /> Owner Email
                    </label>
                    <input
                      type="email"
                      disabled={isPending}
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="john@glowhaven.com"
                      className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500 transition-all disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-500" /> Phone Number
                    </label>
                    <input
                      type="tel"
                      disabled={isPending}
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+1 (555) 019-2834"
                      className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500 transition-all disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full h-12 bg-indigo-650 hover:bg-indigo-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/40 transition disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating Demo Assistant...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Demo Assistant
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Scraper Status Panel */}
          {isPending && scrapingPhase && (
            <div className="bg-slate-950/65 border border-slate-850 p-6 rounded-[2rem] space-y-4 animate-pulse">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Scraper Engine Progress</h4>
              </div>
              <p className="text-xs font-semibold text-slate-350 bg-slate-900/60 p-4 rounded-xl border border-slate-850">
                {scrapingPhase}
              </p>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                This takes approximately 10-30 seconds depending on site size.
              </div>
            </div>
          )}
        </div>

        {/* Right: Created demo details */}
        <div className="lg:col-span-5">
          {createdDemo ? (
            <div className="bg-gradient-to-br from-indigo-900/40 via-slate-950 to-indigo-950/20 border border-indigo-500/20 p-8 rounded-[2rem] space-y-6 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              
              <div className="w-12 h-12 bg-indigo-600/20 text-indigo-400 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                <ShieldCheck className="w-6 h-6" />
              </div>
              
              <div>
                <h3 className="text-lg font-extrabold text-white mb-1">Demo Assistant Generated!</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Your bespoke AI chatbot is now online, pre-trained, and ready for prospecting.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Demo Access URL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdDemo.url}
                      className="flex-1 bg-slate-900/80 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                    <button
                      onClick={() => copyToClipboard(createdDemo.url)}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                      title="Copy Link"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <a
                    href={createdDemo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <button className="w-full py-3 bg-indigo-650 hover:bg-indigo-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition-all duration-200">
                      Open Demo chatbot
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </a>
                  <button
                    onClick={() => {
                      setCreatedDemo(null);
                    }}
                    className="px-4 py-3 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                  >
                    Create Another
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/45 border border-slate-850/60 p-8 rounded-[2rem] h-full flex flex-col justify-between text-center py-20">
              <div className="max-w-xs mx-auto space-y-4">
                <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center text-slate-500 mx-auto border border-slate-850">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="font-extrabold text-white text-base">Interactive Chat Preview</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Enter a prospect&apos;s website URL on the left. The scraper engine will crawl the website and build a custom model assistant automatically.
                </p>
              </div>
              <div className="text-[10px] font-bold text-slate-650 uppercase tracking-widest pt-10">
                Primary prospecting engine
              </div>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
