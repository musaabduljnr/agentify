import { Globe, Cpu, Code2, Rocket, ArrowRight } from "lucide-react";

const steps = [
  {
    step: "01",
    title: "Input Website URL",
    description: "Provide your public website address or upload custom business documents, PDF guides, or product sheets.",
    icon: Globe,
  },
  {
    step: "02",
    title: "Autonomous Ingestion",
    description: "Our neural engine scans your structure, extracts core facts, and builds an accurate semantic vector index.",
    icon: Cpu,
  },
  {
    step: "03",
    title: "Deploy 1-Line Embed",
    description: "Paste your lightweight script snippet into your site header, WordPress plugin, or Shopify theme.",
    icon: Code2,
  },
  {
    step: "04",
    title: "24/7 Intelligent Support",
    description: "Your assistant immediately resolves inquiries, qualifies buyer interest, and captures high-intent leads.",
    icon: Rocket,
  },
];

export function HowItWorks() {
  return (
    <section className="py-28 bg-[#07080c] relative overflow-hidden border-t border-white/[0.06]">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-20 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-white/10 bg-white/[0.03] text-slate-400 text-xs font-semibold tracking-wider uppercase">
            <span>Seamless Onboarding</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Live in four simple steps
          </h2>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
            Zero engineering required. Go from raw website URL to a fully operational AI agent in less than two minutes.
          </p>
        </div>
        
        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
          {steps.map((step, index) => (
            <div 
              key={index} 
              className="group relative rounded-2xl p-6 bg-[#0b0c13] border border-white/[0.08] hover:border-indigo-500/30 transition-all flex flex-col justify-between"
            >
              {/* Step indicator header */}
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <step.icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono font-bold text-slate-500 group-hover:text-indigo-400 transition-colors">
                  {step.step}
                </span>
              </div>

              {/* Step content */}
              <div>
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-200 transition-colors">
                  {step.title}
                </h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>

              {/* Bottom accent indicator */}
              <div className="mt-6 pt-4 border-t border-white/[0.04] flex items-center text-[11px] font-semibold text-slate-500 group-hover:text-slate-300 transition-colors">
                <span>Step {step.step} of 04</span>
                {index < steps.length - 1 && (
                  <ArrowRight className="w-3 h-3 ml-auto text-slate-600 group-hover:text-indigo-400" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
