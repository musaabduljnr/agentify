import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Pricing } from "@/components/landing/Pricing";
import { FAQ } from "@/components/landing/FAQ";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <Features />
      
      {/* Use Cases Section */}
      <section className="py-24 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-4">
              Built for every industry
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Whether you are a local shop or a global enterprise, Agentify helps you engage visitors better.
            </p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-4">
            {["Real Estate", "Ecommerce", "Agencies", "Education", "Local Businesses", "SaaS", "Healthcare"].map((industry) => (
              <div 
                key={industry} 
                className="px-8 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm font-semibold text-slate-700 hover:border-indigo-600 hover:text-indigo-600 transition-all cursor-default"
              >
                {industry}
              </div>
            ))}
          </div>
        </div>
      </section>

      <HowItWorks />
      <Pricing />
      <FAQ />
      
      {/* Final CTA */}
      <section className="py-24 bg-indigo-600 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent)] pointer-events-none"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6">
            Ready to automate your customer support?
          </h2>
          <p className="text-indigo-100 text-xl mb-10 max-w-2xl mx-auto">
            Join thousands of businesses already using Agentify to grow their sales and support.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50 rounded-full px-10 h-14 text-lg">
                Start your 14-day free trial
              </Button>
            </Link>
            <Link href="/demo">
              <Button size="lg" variant="outline" className="border-indigo-400 text-white hover:bg-indigo-500 rounded-full px-10 h-14 text-lg">
                View interactive demo
              </Button>
            </Link>
          </div>
        </div>
      </section>
      
      <Footer />
    </main>
  );
}
