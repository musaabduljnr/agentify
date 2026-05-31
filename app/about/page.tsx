import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Bot, Sparkles, Target, Zap, Users, Heart, ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "About Us | Agentify",
  description: "Learn about the mission, values, and journey behind Agentify—empowering businesses with intelligent, 24/7 autonomous support.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 bg-gradient-to-b from-indigo-50/50 via-white to-white overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.05),transparent)] pointer-events-none"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold mb-6">
            <Sparkles className="w-4 h-4" />
            <span>Our Journey & Mission</span>
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-slate-900 leading-tight mb-6 max-w-4xl mx-auto">
            Democratizing <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-600">Enterprise AI</span> for every business
          </h1>
          <p className="text-slate-600 text-lg sm:text-xl max-w-2xl mx-auto mb-10 font-medium leading-relaxed">
            We build simple, highly reliable autonomous assistants that live on your website, learn from your data, and help you grow while you sleep.
          </p>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20 border-t border-slate-100">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider mb-4">
                <Target className="w-4 h-4 text-indigo-600" />
                The Spark
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-6">
                Born out of an intensive 48-Hour Sprint
              </h2>
              <p className="text-slate-600 mb-4 leading-relaxed">
                Agentify started with a single, crucial observation: most small business websites are open 24/7, but the business owners and support teams are not. Important visitor questions get missed, and potential sales leak daily.
              </p>
              <p className="text-slate-600 mb-4 leading-relaxed">
                To solve this, we initiated a high-focus, 48-hour engineering and positioning sprint. We wanted to see if we could build a production-grade, highly secure, and lightning-fast AI system that trains itself from a single URL.
              </p>
              <p className="text-slate-600 leading-relaxed">
                What began as a sprint quickly evolved into a robust SaaS platform. Today, Agentify helps thousands of businesses worldwide manage automated support, capture pre-qualified sales leads, and create tailored chatbot widgets in minutes.
              </p>
            </div>
            
            <div className="relative">
              <div className="absolute inset-4 -z-10 rounded-3xl bg-indigo-50/70 blur-xl"></div>
              <div className="bg-slate-900 rounded-[2rem] border border-slate-800 p-8 text-white shadow-2xl relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Agentify Core Vision</h4>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Est. 2026</span>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-white/5 rounded-xl text-indigo-400">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-slate-100">Speed to Value</h5>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">From account setup to a live website assistant in less than 2 minutes. No coding required.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-white/5 rounded-xl text-indigo-400">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-slate-100">Privacy & Security</h5>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">Isolated vector search pools and secure data-scraping parameters so client data is never leaked.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-white/5 rounded-xl text-indigo-400">
                      <Heart className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-slate-100">Human-Centric Design</h5>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">The AI serves as a powerful front-line assistant, handing off smoothly to real humans whenever needed.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Section */}
      <section className="py-16 bg-slate-50 border-y border-slate-200">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { num: "5,000+", label: "Active Assistants" },
              { num: "2.4M+", label: "Messages Handled" },
              { num: "98.7%", label: "Accuracy Rate" },
              { num: "24/7", label: "Instant Support" }
            ].map((stat, i) => (
              <div key={i} className="space-y-1">
                <div className="text-3xl sm:text-4xl font-extrabold text-indigo-600">{stat.num}</div>
                <div className="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Values Section */}
      <section className="py-24">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
              What guides our decisions
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Our products are built on solid engineering practices, clean user interfaces, and an uncompromising commitment to trust.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Simplicity Wins",
                desc: "We strip away complex configurations. Setting up advanced machine learning on your site should feel as easy as copy-pasting a text link.",
                icon: Zap
              },
              {
                title: "Reliability First",
                desc: "AI should only represent facts about your business. We design restricted-context search flows to avoid hallucinations or incorrect answers.",
                icon: Bot
              },
              {
                title: "Sovereignty of Data",
                desc: "Your data belongs to you. We respect web parameters, scrapers are highly polite, and database records remain encrypted and sandboxed.",
                icon: Target
              }
            ].map((val, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6">
                  <val.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">{val.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{val.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-indigo-600 relative overflow-hidden text-white text-center">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent)] pointer-events-none"></div>
        <div className="container mx-auto px-4 relative z-10">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Experience the future of customer support today
          </h2>
          <p className="text-indigo-100 text-lg mb-8 max-w-xl mx-auto">
            Get your AI assistant trained and deployed on your website in under 2 minutes.
          </p>
          <div className="flex justify-center">
            <Link href="/signup">
              <Button className="bg-white text-indigo-600 hover:bg-indigo-50 font-bold rounded-full px-8 h-12 flex items-center gap-2">
                Start your 14-day free trial
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
