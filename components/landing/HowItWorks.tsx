import { 
  Globe2, 
  Terminal, 
  Rocket, 
  Check, 
  Link as LinkIcon, 
  TrendingUp 
} from "lucide-react";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="w-full py-24 px-6 lg:px-12 bg-[#f7f9fd]">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-[11px] uppercase tracking-wider text-[#2a54c0] font-semibold block mb-3">
            Simple 3-Minute Setup
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#181c1f] tracking-tight mb-4">
            How Agentify powers your customer operations
          </h2>
          <p className="text-base sm:text-lg text-[#575f6a] leading-relaxed">
            No coding, no prompt engineering bottlenecks. Connect your domain knowledge and let autonomous agents execute support workflows.
          </p>
        </div>

        {/* 3 Step Cards from Stitch */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Step 1 */}
          <div className="bg-[#ffffff] p-8 rounded-xl border border-[#eceef2] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#f2f4f8] border border-[#eceef2] flex items-center justify-center text-[#2a54c0] mb-6">
                <Globe2 className="w-6 h-6" />
              </div>
              <span className="text-[11px] text-[#575f6a] uppercase font-semibold">
                Step 01
              </span>
              <h3 className="text-xl font-bold text-[#181c1f] mt-1 mb-3">
                Scan & Connect
              </h3>
              <p className="text-sm text-[#575f6a] leading-relaxed mb-6">
                Paste your website URL, sync your help center, or drop PDF manuals. Our crawler maps and ingests your product knowledge safely in seconds.
              </p>
            </div>
            <div className="p-3 bg-[#f2f4f8] rounded-lg font-mono text-xs text-[#575f6a] flex items-center gap-2 border border-[#eceef2]">
              <Check className="w-4 h-4 text-[#027A48] shrink-0" />
              <span className="truncate">Crawled 128 sub-pages • Zero hallucinations</span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-[#ffffff] p-8 rounded-xl border border-[#eceef2] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#dbe1ff] border border-[#b4c5ff] flex items-center justify-center text-[#013daa] mb-6">
                <Terminal className="w-6 h-6" />
              </div>
              <span className="text-[11px] text-[#575f6a] uppercase font-semibold">
                Step 02
              </span>
              <h3 className="text-xl font-bold text-[#181c1f] mt-1 mb-3">
                Deploy in Seconds
              </h3>
              <p className="text-sm text-[#575f6a] leading-relaxed mb-6">
                Embed a customized chat widget via one line of HTML, or share standalone Hosted Chat Links across email signatures, WhatsApp, or Instagram bio.
              </p>
            </div>
            <div className="p-3 bg-[#f2f4f8] rounded-lg font-mono text-xs text-[#575f6a] flex items-center gap-2 border border-[#eceef2]">
              <LinkIcon className="w-4 h-4 text-[#2a54c0] shrink-0" />
              <span className="font-semibold text-[#181c1f] truncate">agentify.chat/your-company</span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-[#ffffff] p-8 rounded-xl border border-[#eceef2] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#f2f4f8] border border-[#eceef2] flex items-center justify-center text-[#2a54c0] mb-6">
                <Rocket className="w-6 h-6" />
              </div>
              <span className="text-[11px] text-[#575f6a] uppercase font-semibold">
                Step 03
              </span>
              <h3 className="text-xl font-bold text-[#181c1f] mt-1 mb-3">
                Automate & Convert
              </h3>
              <p className="text-sm text-[#575f6a] leading-relaxed mb-6">
                Your AI handles up to 85% of tier-1 support tickets instantaneously, captures warm enterprise leads, and alerts human operators when necessary.
              </p>
            </div>
            <div className="p-3 bg-[#ECFDF3] rounded-lg font-mono text-xs text-[#027A48] flex items-center gap-2 border border-[#a6f4c5]">
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span className="font-semibold truncate">+34% Lead Conversion Rate verified</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
