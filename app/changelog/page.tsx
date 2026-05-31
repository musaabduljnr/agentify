import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  Bot, 
  Zap, 
  Layers, 
  ChevronRight, 
  Calendar, 
  Code,
  ShieldAlert
} from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Changelog | Agentify",
  description: "Follow the product evolution of Agentify. Read about our latest feature releases, updates, improvements, and bug fixes.",
};

const updates = [
  {
    version: "v1.2.0",
    codename: "Widget Customization Engine",
    date: "May 24, 2026",
    badge: "Major",
    icon: Sparkles,
    color: "text-indigo-600 bg-indigo-50 border-indigo-100",
    description: "This release completely overhaul how the live chat widget feels, behaves, and matches your brand identity. You can now tweak and preview every pixel before deploying.",
    features: [
      {
        title: "Live Customizer Panel",
        detail: "Interactive sidebar customizer showing changes in real-time. Alter widget theme colors, custom text greeting, and bot avatars in a single interface."
      },
      {
        title: "Adaptive Contrast Matching",
        detail: "Provide your brand hex color and our customizer will automatically compute high-contrast text and icons overlays for perfect readability."
      },
      {
        title: "Advanced Lead Form Configuration",
        detail: "Toggle individual input fields (Name, Email, Phone, Company) or enforce required field rules during customer handoffs."
      },
      {
        title: "Configurable Welcome Delay & Sound Alerts",
        detail: "Control exactly when the greeting message pops up and whether to play soft notification sounds for high engagement."
      }
    ]
  },
  {
    version: "v1.1.0",
    codename: "Vector Memory & Multi-Model Core",
    date: "April 18, 2026",
    badge: "Feature",
    icon: Bot,
    color: "text-emerald-600 bg-emerald-50 border-emerald-100",
    description: "Under-the-hood intelligence upgrade. We migrated database vector parsing to high-speed indexing pools and optimized context memory limits.",
    features: [
      {
        title: "Supabase pgvector Database Sync",
        detail: "Upgraded embedding storage to full vector indexes, bringing knowledge-retrieval speeds down to less than 150ms per query."
      },
      {
        title: "Auto-Scrape Reindexing Scheduler",
        detail: "Optionally tell Agentify to crawl your website weekly or monthly to verify that changed prices or services are instantly learned."
      },
      {
        title: "Dual Provider Fallbacks",
        detail: "Configure multiple AI routing streams (Google GenAI models and internal backup modules) so customer replies are delivered even during API outages."
      },
      {
        title: "Context Injection Protections",
        detail: "Robust prompt engineering filters targeting user prompt injections. Secure safeguards block visitors from commanding the AI to speak about competitors or break pricing plans."
      }
    ]
  },
  {
    version: "v1.0.0",
    codename: "The Lighthouse Release",
    date: "March 15, 2026",
    badge: "Official Launch",
    icon: Zap,
    color: "text-blue-600 bg-blue-50 border-blue-100",
    description: "The initial official public launch of Agentify—the ultimate system turning website visitor questions into business opportunities.",
    features: [
      {
        title: "One-line Embed Widget",
        detail: "Asynchronous widget script load tag that drops cleanly into any website body without altering layout flow or speed benchmarks."
      },
      {
        title: "Interactive Sandbox Playground",
        detail: "Instantly chat with your newly trained AI inside our dashboard to verify its knowledge base before embedding on your site."
      },
      {
        title: "Resend Email Template Integration",
        detail: "Elegant transactional mail systems powering signup welcome guides, lead capturing digests, and subscription invoices."
      },
      {
        title: "Paystack Payment Gateway",
        detail: "Secure local subscription engine allowing starter and growth checkouts via card, bank transfer, or USSD codes."
      }
    ]
  }
];

export default function ChangelogPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Header */}
      <section className="relative pt-32 pb-16 bg-gradient-to-b from-indigo-50/50 via-slate-50 to-slate-50 overflow-hidden border-b border-slate-200/50">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.03),transparent)] pointer-events-none"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold mb-6">
            <Calendar className="w-4 h-4" />
            <span>Product Updates</span>
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-slate-900 leading-tight mb-6">
            What&apos;s New in <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-600">Agentify</span>
          </h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto font-medium">
            Follow our design updates, functional upgrades, and security improvements as we build the premier autonomous web agent.
          </p>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-4xl relative">
          
          {/* Continuous Vertical Timeline Line */}
          <div className="absolute left-4 md:left-1/2 top-4 bottom-4 w-[2px] bg-indigo-100 -translate-x-1/2 hidden md:block"></div>

          <div className="space-y-16">
            {updates.map((update, idx) => {
              const Icon = update.icon;
              return (
                <div key={idx} className="relative flex flex-col md:flex-row md:justify-between items-start gap-8">
                  
                  {/* Circle Marker on Line */}
                  <div className="absolute left-4 md:left-1/2 w-10 h-10 rounded-full bg-white border-4 border-indigo-50 shadow-md -translate-x-1/2 hidden md:flex items-center justify-center text-indigo-600 z-10">
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Left Side: Version Tag and Date */}
                  <div className="w-full md:w-[45%] text-left md:text-right md:pr-12 md:pt-2">
                    <div className="inline-flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
                      <span className="text-xs font-bold text-indigo-600">{update.version}</span>
                      <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                      <span className="text-xs font-bold text-slate-500">{update.codename}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mt-3 justify-start md:justify-end">
                      <Calendar className="w-3.5 h-3.5" />
                      {update.date}
                    </div>
                  </div>

                  {/* Spacer for Timeline Center */}
                  <div className="w-0 hidden md:block"></div>

                  {/* Right Side: Detailed Card */}
                  <div className="w-full md:w-[45%] bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm text-left">
                    <div className="flex items-center justify-between mb-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                        update.badge === 'Major' ? 'text-indigo-600 bg-indigo-50 border border-indigo-100' :
                        update.badge === 'Feature' ? 'text-emerald-600 bg-emerald-50 border border-emerald-100' :
                        'text-blue-600 bg-blue-50 border border-blue-100'
                      }`}>
                        {update.badge}
                      </span>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed mb-6 font-medium">
                      {update.description}
                    </p>

                    <hr className="border-slate-100 mb-6" />

                    <div className="space-y-5">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Key Changes</h4>
                      {update.features.map((feat, fIdx) => (
                        <div key={fIdx} className="flex gap-3">
                          <ChevronRight className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                          <div>
                            <h5 className="font-bold text-slate-900 text-sm">{feat.title}</h5>
                            <p className="text-slate-500 text-xs mt-1 leading-relaxed">{feat.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Subscribe CTA */}
      <section className="py-20 border-t border-slate-200 bg-white text-center">
        <div className="container mx-auto px-4 max-w-xl">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Subscribe to updates</h2>
          <p className="text-slate-500 text-sm mb-6 font-medium">
            Get notified whenever we launch new features, code integrations, or security measures.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="email" 
              placeholder="name@company.com" 
              className="flex-1 px-5 py-3 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium"
            />
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold px-6 shadow-md shadow-indigo-200">
              Subscribe
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
