import { 
  Globe, 
  MessageSquare, 
  Users, 
  BarChart3, 
  Palette, 
  Headset,
  Sparkles,
  ArrowUpRight
} from "lucide-react";

const features = [
  {
    title: "Website-Trained Intelligence",
    description: "Provide your public website URL. Our crawler parses every page, product, and FAQ to construct a tailored vector knowledge base in seconds.",
    icon: Globe,
    badge: "Instant Ingestion",
    className: "md:col-span-2 md:row-span-2 bg-gradient-to-br from-[#0e101a] via-[#0b0c13] to-[#07080c] border border-indigo-500/30",
    glow: true,
  },
  {
    title: "Widget & Hosted Chat Links",
    description: "Embed on your site with a single script tag or share hosted standalone links across social bio, email, and WhatsApp.",
    icon: MessageSquare,
    badge: "Multi-Channel",
    className: "bg-[#0b0c13] border border-white/[0.08]",
  },
  {
    title: "Autonomous Lead Capture",
    description: "Naturally collect visitor emails, phone numbers, and company names during context-aware conversations.",
    icon: Users,
    badge: "CRM Sync",
    className: "bg-[#0b0c13] border border-white/[0.08]",
  },
  {
    title: "Real-Time Conversation Analytics",
    description: "Inspect customer intent, trending queries, unanswered questions, and sentiment metrics from your executive dashboard.",
    icon: BarChart3,
    badge: "Telemetry",
    className: "bg-[#0b0c13] border border-white/[0.08]",
  },
  {
    title: "Complete Brand White-Labeling",
    description: "Fully customize avatar, theme colors, widget position, welcome message, and system personality to mirror your brand.",
    icon: Palette,
    badge: "Styling",
    className: "bg-[#0b0c13] border border-white/[0.08]",
  },
  {
    title: "Seamless Human Escalation",
    description: "When complex queries arise, smoothly transfer conversations to live support staff or log instant email tickets.",
    icon: Headset,
    badge: "Fallback Guard",
    className: "md:col-span-2 bg-gradient-to-r from-[#0b0c13] to-[#0d0f19] border border-white/[0.08]",
  },
];

export function Features() {
  return (
    <section id="features" className="py-28 bg-[#07080c] relative overflow-hidden border-t border-white/[0.06]">
      {/* Background ambient glow */}
      <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/4 w-80 h-80 bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-300 text-xs font-semibold tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Core Capabilities
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Everything your business needs to{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-300">
              automate support
            </span>
          </h2>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
            From zero-code web scraping to enterprise human escalation, Agentify provides a unified infrastructure for conversational commerce.
          </p>
        </div>
        
        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:auto-rows-[250px]">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`group relative rounded-2xl p-7 flex flex-col justify-between transition-all duration-300 hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/5 ${feature.className}`}
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <feature.icon className="w-5 h-5" />
                  </div>
                  {feature.badge && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06]">
                      {feature.badge}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-1.5 group-hover:text-indigo-200 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>

              <div className="pt-4 flex items-center text-xs font-medium text-slate-500 group-hover:text-indigo-400 transition-colors">
                <span>Explore feature</span>
                <ArrowUpRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
