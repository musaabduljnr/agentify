import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FAQ } from "@/components/landing/FAQ";
import { Footer } from "@/components/landing/Footer";
import { InstantAgentForm } from "@/components/landing/InstantAgentForm";
import { 
  Building2, 
  ShoppingBag, 
  Briefcase, 
  GraduationCap, 
  Store, 
  Cpu, 
  Stethoscope 
} from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#f7f9fd] text-[#181c1f] selection:bg-[#2a54c0]/20 selection:text-[#181c1f]">
      {/* 1. Header / Navbar */}
      <Navbar />

      {/* 2. Hero Section with Interactive 3-Panel Showcase and InstantAgentForm */}
      <Hero />

      {/* 3. Social Proof Logo Strip (Stitch Section 2) */}
      <section className="w-full py-12 px-6 lg:px-12 bg-[#f2f4f8] border-y border-[#eceef2]">
        <div className="max-w-6xl mx-auto flex flex-col items-center">
          <p className="text-[11px] uppercase tracking-widest text-[#575f6a] font-semibold mb-8 text-center">
            Trusted by modern businesses & high-growth revenue teams
          </p>
          {/* Minimalist Monochrome Logo Row from Stitch */}
          <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-8 items-center justify-items-center opacity-70 grayscale hover:grayscale-0 transition-all">
            <div className="flex items-center gap-2 text-sm font-semibold tracking-tighter text-[#181c1f]">
              <span className="w-5 h-5 rounded-full bg-[#181c1f] text-white flex items-center justify-center text-[10px] font-bold">C</span>
              Capsule
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold tracking-tighter text-[#181c1f]">
              <span className="w-5 h-5 rounded-full bg-[#181c1f] text-white flex items-center justify-center text-[10px] font-bold">S</span>
              Sisyphus
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold tracking-tighter text-[#181c1f]">
              <span className="w-5 h-5 rounded-full bg-[#181c1f] text-white flex items-center justify-center text-[10px] font-bold">CT</span>
              Catalog
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold tracking-tighter text-[#181c1f]">
              <span className="w-5 h-5 rounded-full bg-[#181c1f] text-white flex items-center justify-center text-[10px] font-bold">A</span>
              Acme Corp
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold tracking-tighter text-[#181c1f]">
              <span className="w-5 h-5 rounded-full bg-[#181c1f] text-white flex items-center justify-center text-[10px] font-bold">N</span>
              Nietzsche
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold tracking-tighter text-[#181c1f]">
              <span className="w-5 h-5 rounded-full bg-[#181c1f] text-white flex items-center justify-center text-[10px] font-bold">CW</span>
              CloudWatch
            </div>
          </div>
        </div>
      </section>

      {/* 4. How Agentify Powers Operations (Stitch Section 3) */}
      <HowItWorks />

      {/* 5. Engineered for Performance / Bento Grid (Stitch Section 4) */}
      <Features />

      {/* 6. High-Impact Stats Banner (Stitch Section 5) */}
      <section className="w-full py-20 px-6 lg:px-12 bg-[#181c1f] text-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left divide-y md:divide-y-0 md:divide-x divide-[#2d3134]">
            <div className="pt-6 md:pt-0 md:px-6">
              <p className="text-5xl lg:text-6xl font-bold text-[#b4c5ff] mb-2 tracking-tight">85%</p>
              <h4 className="text-xl font-semibold mb-2">Instant Ticket Resolution</h4>
              <p className="text-sm text-[#c4c6d5] leading-relaxed">
                Routine inquiries resolved without any human agent intervention.
              </p>
            </div>
            <div className="pt-6 md:pt-0 md:px-6">
              <p className="text-5xl lg:text-6xl font-bold text-[#b4c5ff] mb-2 tracking-tight">3.4x</p>
              <h4 className="text-xl font-semibold mb-2">Qualified Pipeline Growth</h4>
              <p className="text-sm text-[#c4c6d5] leading-relaxed">
                Capture interested visitors after business hours in real time.
              </p>
            </div>
            <div className="pt-6 md:pt-0 md:px-6">
              <p className="text-5xl lg:text-6xl font-bold text-[#b4c5ff] mb-2 tracking-tight">24/7</p>
              <h4 className="text-xl font-semibold mb-2">Global Autonomous Uptime</h4>
              <p className="text-sm text-[#c4c6d5] leading-relaxed">
                Always-on customer service across multiple languages and time zones.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Industry Solutions Section */}
      <section id="solutions" className="w-full py-24 px-6 lg:px-12 bg-[#f7f9fd]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[11px] uppercase tracking-wider text-[#2a54c0] font-semibold block mb-2">
              Tailored Verticals
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#181c1f] tracking-tight mb-4">
              Engineered for every industry
            </h2>
            <p className="text-base text-[#575f6a] leading-relaxed">
              Whether you operate a local business or a high-velocity global brand, Agentify molds to your specific knowledge base.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[
              { name: "Ecommerce & Retail", icon: ShoppingBag, desc: "Instant product recommendations & tracking inquiries" },
              { name: "SaaS & Software", icon: Cpu, desc: "Automate onboarding, documentation & feature questions" },
              { name: "Real Estate", icon: Building2, desc: "Qualify buyers, schedule tours & capture buyer inquiries" },
              { name: "Digital Agencies", icon: Briefcase, desc: "Client lead intake, portfolio answers & quote requests" },
              { name: "Healthcare & Clinics", icon: Stethoscope, desc: "Appointment booking info & general service queries" },
              { name: "Education & Coaching", icon: GraduationCap, desc: "Course curriculum details & student registration intake" },
              { name: "Local Businesses", icon: Store, desc: "Hours, directions, menu questions & phone routing" },
            ].map((ind) => (
              <div 
                key={ind.name} 
                className="group p-5 rounded-xl bg-[#ffffff] border border-[#eceef2] shadow-xs hover:border-[#2a54c0]/40 hover:shadow-sm transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-[#f2f4f8] border border-[#eceef2] text-[#2a54c0] flex items-center justify-center mb-4 group-hover:bg-[#2a54c0] group-hover:text-white transition-all">
                  <ind.icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-[#181c1f] mb-1.5 group-hover:text-[#2a54c0] transition-colors">
                  {ind.name}
                </h3>
                <p className="text-xs text-[#575f6a] leading-relaxed">
                  {ind.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Frequently Asked Questions (Stitch Section 6) */}
      <FAQ />
      
      {/* 9. Final Call to Action with Instant Agent Generator (Stitch Section 7) */}
      <section className="w-full py-20 px-6 lg:px-12 bg-[#f2f4f8] border-t border-[#eceef2] relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ffffff] border border-[#eceef2] shadow-xs mb-6">
            <span className="w-2 h-2 rounded-full bg-[#027A48]"></span>
            <span className="text-xs text-[#181c1f] font-medium">Ready in under 120 seconds</span>
          </div>
          
          <h2 className="text-3xl sm:text-5xl font-bold text-[#181c1f] tracking-tight mb-4">
            Ready to deploy your AI agent today?
          </h2>
          
          <p className="text-base sm:text-lg text-[#575f6a] max-w-xl mx-auto mb-8 leading-relaxed">
            See how much time your support team can save while dramatically increasing your website lead conversion rates.
          </p>
          
          <div className="w-full max-w-xl mx-auto">
            <InstantAgentForm />
            <p className="text-xs text-[#575f6a] mt-4 font-medium">
              Free 14-day trial • No credit card required • Cancel anytime
            </p>
          </div>
        </div>
      </section>
      
      {/* 10. Footer (Stitch Footer) */}
      <Footer />
    </main>
  );
}
