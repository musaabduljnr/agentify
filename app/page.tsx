import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Pricing } from "@/components/landing/Pricing";
import { FAQ } from "@/components/landing/FAQ";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  Sparkles,
  Building2, 
  ShoppingBag, 
  Briefcase, 
  GraduationCap, 
  Store, 
  Cpu, 
  Stethoscope 
} from "lucide-react";
import Link from "next/link";

const INDUSTRIES = [
  { name: "Ecommerce & Retail", icon: ShoppingBag, desc: "Instant product recommendations & tracking inquiries" },
  { name: "SaaS & Software", icon: Cpu, desc: "Automate onboarding, documentation & feature questions" },
  { name: "Real Estate", icon: Building2, desc: "Qualify buyers, schedule tours & capture buyer inquiries" },
  { name: "Digital Agencies", icon: Briefcase, desc: "Client lead intake, portfolio answers & quote requests" },
  { name: "Healthcare & Clinics", icon: Stethoscope, desc: "Appointment booking info & general service queries" },
  { name: "Education & Coaching", icon: GraduationCap, desc: "Course curriculum details & student registration intake" },
  { name: "Local Businesses", icon: Store, desc: "Hours, directions, menu questions & phone routing" },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#07080c] text-slate-100 selection:bg-indigo-500/30 selection:text-white">
      <Navbar />
      <Hero />
      <Features />
      
      {/* Use Cases Section */}
      <section className="py-28 bg-[#07080c] relative overflow-hidden border-t border-white/[0.06]">
        {/* Glow */}
        <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-white/10 bg-white/[0.03] text-slate-400 text-xs font-semibold tracking-wider uppercase">
              <span>Universal Applicability</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Engineered for every industry
            </h2>
            <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
              Whether you operate a local business or a high-velocity global brand, Agentify molds to your specific knowledge base.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {INDUSTRIES.map((ind) => (
              <div 
                key={ind.name} 
                className="group p-5 rounded-2xl bg-[#0b0c13] border border-white/[0.08] hover:border-indigo-500/40 hover:bg-[#0f111a] transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <ind.icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1.5 group-hover:text-indigo-200 transition-colors">
                    {ind.name}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {ind.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <HowItWorks />
      <Pricing />
      <FAQ />
      
      {/* Final CTA Banner */}
      <section className="py-28 bg-[#090b12] relative overflow-hidden border-t border-white/[0.08]">
        {/* Radial backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-r from-indigo-600/20 via-violet-600/20 to-blue-600/20 rounded-full blur-[140px] pointer-events-none" />
        
        <div className="container mx-auto px-4 text-center relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Launch In 60 Seconds
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Ready to convert website visitors into customers?
          </h2>
          
          <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            Join thousands of modern founders and operators using Agentify to automate lead capture and customer care.
          </p>
          
          <div className="pt-4 flex flex-col sm:flex-row items-center gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-8 h-12 text-sm sm:text-base font-semibold shadow-lg shadow-indigo-600/30 transition-all">
                <span>Start 14-Day Free Trial</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button size="lg" variant="outline" className="border-white/10 bg-white/[0.04] text-slate-300 hover:text-white hover:bg-white/[0.08] rounded-xl px-8 h-12 text-sm sm:text-base font-semibold transition-all">
                Explore Live Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>
      
      <Footer />
    </main>
  );
}
