"use client";

import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Sparkles, 
  MessageSquare, 
  ExternalLink, 
  X, 
  Layers, 
  Code,
  Zap,
  Globe,
  ShoppingBag
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";

const categories = ["All", "CMS", "E-commerce", "Communication", "Automation"];

const integrations = [
  {
    name: "Shopify",
    category: "E-commerce",
    description: "Launch Agentify directly in your online store to answer sizing, stock, and shipping questions instantly.",
    longDesc: "Install our script tag with one click inside your Shopify admin. Agentify can automatically read product details from your storefront schema and help customers through checkout.",
    icon: ShoppingBag,
    color: "text-emerald-600 bg-emerald-50 border-emerald-100",
    steps: [
      "Navigate to your Shopify Dashboard.",
      "Go to Online Store > Themes > Edit Code.",
      "Paste the Agentify script tag inside the header tag of theme.liquid.",
      "Save changes and refresh your store to see the AI assistant live."
    ]
  },
  {
    name: "WordPress",
    category: "CMS",
    description: "Embed our highly lightweight AI widget across your WordPress pages or posts in seconds.",
    longDesc: "Use standard script integrations or header footer inject tools to add the Agentify assistant. Fully optimized to not impact page performance score.",
    icon: Globe,
    color: "text-blue-600 bg-blue-50 border-blue-100",
    steps: [
      "Log in to your WordPress Admin dashboard.",
      "Install and activate the 'Header and Footer Scripts' plugin.",
      "Go to Settings > Header and Footer Scripts.",
      "Copy your unique Agentify widget script and paste it into the footer section.",
      "Save settings. Your site is now armed with AI support!"
    ]
  },
  {
    name: "Webflow",
    category: "CMS",
    description: "Sync the design-first AI assistant into Webflow custom code settings or individual site pages.",
    longDesc: "Maintain pixel-perfect branding. Customize the widget styling inside your Agentify Customizer, then drop the HTML embed element into Webflow.",
    icon: Code,
    color: "text-indigo-600 bg-indigo-50 border-indigo-100",
    steps: [
      "Open your project dashboard in Webflow.",
      "Click Site Settings > Custom Code.",
      "Find the 'Footer Code' field and paste your Agentify widget script.",
      "Save and publish your Webflow site to make the changes live."
    ]
  },
  {
    name: "WhatsApp",
    category: "Communication",
    description: "Synchronize Agentify to answer customer queries automatically inside their WhatsApp thread.",
    longDesc: "Connect Agentify with the WhatsApp Business Cloud API. The AI uses the same trained knowledge base to respond to DMs, escalating to human staff via dashboard when necessary.",
    icon: MessageSquare,
    color: "text-green-600 bg-green-50 border-green-100",
    steps: [
      "Access your Agentify Dashboard and head to Channels.",
      "Select WhatsApp Business and click 'Connect Account'.",
      "Authorize your Meta Developer WhatsApp number.",
      "Configure your custom greeting and trigger words.",
      "Test directly using our live sandbox before publishing."
    ]
  },
  {
    name: "Slack",
    category: "Communication",
    description: "Receive instant notifications for human fallback handover requests directly in your Slack channels.",
    longDesc: "Never miss a lead or support emergency. Send a notification with conversation transcripts directly to your selected Slack channels when visitors click 'Talk to Human'.",
    icon: MessageSquare,
    color: "text-purple-600 bg-purple-50 border-purple-100",
    steps: [
      "Go to Settings > Integrations in your Agentify account.",
      "Select Slack and click 'Authorize'.",
      "Choose the specific Slack workspace and channel for handovers.",
      "Test by triggering a manual handoff inside your live playground."
    ]
  },
  {
    name: "Zapier",
    category: "Automation",
    description: "Route captured lead emails, phone numbers, and conversation history to 5000+ CRM systems.",
    longDesc: "Whenever Agentify collects lead contact details, instantly sync them to Salesforce, HubSpot, Mailchimp, or custom sheets using our trigger integrations.",
    icon: Layers,
    color: "text-orange-600 bg-orange-50 border-orange-100",
    steps: [
      "Go to Zapier and click 'Create a new Zap'.",
      "Search for Agentify as the Trigger App.",
      "Select 'New Lead Captured' as the trigger event.",
      "Connect your Agentify account using your private API Key.",
      "Set up your desired Action (e.g. HubSpot, Google Sheets) and publish."
    ]
  },
  {
    name: "Wix",
    category: "CMS",
    description: "Integrate our AI support widget into Wix sites via the Custom Tool Settings interface.",
    longDesc: "Drop the Agentify JavaScript library into your Wix site head or body in seconds with absolute security.",
    icon: Globe,
    color: "text-cyan-600 bg-cyan-50 border-cyan-100",
    steps: [
      "Go to Wix site dashboard and choose Settings.",
      "Scroll down to Custom Code in the Advanced section.",
      "Click '+ Add Custom Code' at the top right.",
      "Paste the Agentify script snippet, choose 'All Pages' and 'Place code in Body - end'.",
      "Apply the changes to deploy your assistant."
    ]
  },
  {
    name: "Squarespace",
    category: "CMS",
    description: "Install your assistant across your Squarespace store or brochure site using Code Injection.",
    longDesc: "Easily drops into any Squarespace theme, loading asynchronously so your website visitors experience no lag.",
    icon: Code,
    color: "text-slate-800 bg-slate-100 border-slate-200",
    steps: [
      "Log in to Squarespace and select your site.",
      "Go to Settings > Developer Tools > Code Injection.",
      "Paste the script code from Agentify into the Footer input field.",
      "Save settings. Your assistant is now active!"
    ]
  }
];

export default function IntegrationsPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedIntegration, setSelectedIntegration] = useState<typeof integrations[0] | null>(null);

  const filteredIntegrations = integrations.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                          item.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "All" || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Header */}
      <section className="relative pt-32 pb-20 bg-gradient-to-b from-indigo-50/50 via-slate-50 to-slate-50 overflow-hidden border-b border-slate-200/50">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.04),transparent)] pointer-events-none"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold mb-6">
            <Sparkles className="w-4 h-4" />
            <span>Connected Workspaces</span>
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-slate-900 leading-tight mb-6">
            Integrates with your <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-600">Favorite Tools</span>
          </h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto mb-10 font-medium">
            Connect Agentify to your website, messaging systems, and automated CRMs with zero complex setups.
          </p>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto relative shadow-md rounded-2xl bg-white border border-slate-200 p-2 flex items-center gap-2">
            <Search className="w-5 h-5 text-slate-400 ml-3" />
            <input 
              type="text" 
              placeholder="Search integrations (e.g. Shopify, Webflow...)" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent py-2 px-1 text-slate-700 font-medium placeholder-slate-400 focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="p-1 rounded-full hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Directory Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Category Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-5 py-2 rounded-full text-sm font-bold transition-all shadow-sm ${
                  activeCategory === cat 
                    ? "bg-indigo-600 text-white" 
                    : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Cards Grid */}
          {filteredIntegrations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredIntegrations.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div 
                    key={i}
                    onClick={() => setSelectedIntegration(item)}
                    className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border mb-6 group-hover:scale-105 transition-all ${item.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors flex items-center gap-2">
                        {item.name}
                        <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h3>
                      <p className="text-slate-500 text-sm leading-relaxed mb-6">
                        {item.description}
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{item.category}</span>
                      <span className="text-xs font-bold text-indigo-600 group-hover:underline flex items-center gap-1">
                        Setup Guide <Zap className="w-3 h-3 fill-indigo-600 text-indigo-600" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-3xl max-w-xl mx-auto shadow-sm">
              <Layers className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">No integrations found</h3>
              <p className="text-slate-500 text-sm">We couldn't find anything matching your search term.</p>
              <Button onClick={() => { setSearch(""); setActiveCategory("All"); }} className="mt-6 rounded-full">
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Guide Overlay Modal */}
      {selectedIntegration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div 
            className="w-full max-w-2xl bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${selectedIntegration.color}`}>
                  <selectedIntegration.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg leading-none">{selectedIntegration.name} Integration</h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">{selectedIntegration.category}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedIntegration(null)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 hover:border-slate-300 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors shadow-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 overflow-y-auto space-y-6 flex-1">
              <div>
                <h4 className="font-bold text-slate-900 mb-2">How it works</h4>
                <p className="text-slate-600 text-sm leading-relaxed">{selectedIntegration.longDesc}</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-4">Installation Steps</h4>
                <div className="space-y-4">
                  {selectedIntegration.steps.map((step, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <p className="text-slate-600 text-sm leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Code Snippet Example */}
              <div className="bg-slate-950 rounded-2xl p-5 border border-slate-900 text-left font-mono text-xs">
                <div className="flex justify-between items-center text-slate-500 mb-3 text-[10px] uppercase font-bold tracking-wider">
                  <span>Widget Embed Code</span>
                  <span className="text-indigo-400">Copy Script</span>
                </div>
                <pre className="text-indigo-300 overflow-x-auto whitespace-pre-wrap select-all">
{`<!-- Agentify Chat Widget -->
<script 
  src="https://cdn.agentify.app/widget.js" 
  data-agent-id="agent_live_prod_827f3b" 
  defer>
</script>
<!-- End Agentify Chat Widget -->`}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setSelectedIntegration(null)} className="rounded-full">
                Close
              </Button>
              <Link href="/signup">
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6">
                  Get Widget Key
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}
