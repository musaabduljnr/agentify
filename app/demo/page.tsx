import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Bot, MessageSquare, Sparkles, Zap, Shield, BarChart } from "lucide-react";
import Link from "next/link";

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      
      <section className="pt-32 pb-20 bg-slate-50">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-widest mb-8">
            <Sparkles className="w-4 h-4" />
            Interactive Experience
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-slate-900 mb-6 leading-tight">
            See Agentify in <span className="text-indigo-600 underline decoration-indigo-200 underline-offset-8">Action</span>
          </h1>
          <p className="text-slate-500 text-xl max-w-2xl mx-auto mb-12 font-medium">
            Test our AI assistant right here. This is exactly how it will look and behave on your website.
          </p>
          
          {/* Demo Widget Container */}
          <div className="max-w-4xl mx-auto bg-white rounded-[3rem] border border-slate-200 shadow-2xl shadow-indigo-100 overflow-hidden min-h-[600px] flex flex-col lg:flex-row">
            {/* Left: Demo Info */}
            <div className="lg:w-1/3 bg-slate-900 p-10 text-white text-left flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-4">Demo Assistant</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-8">
                  This assistant is trained on Agentify's own knowledge base. Go ahead, ask it about our features or pricing!
                </p>
                <div className="space-y-4">
                  {[
                    { icon: Zap, text: "Instant Responses" },
                    { icon: Shield, text: "Brand Safe" },
                    { icon: BarChart, text: "Lead Generation" }
                  ].map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <div key={i} className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-indigo-300">
                        <Icon className="w-4 h-4" />
                        {item.text}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="pt-8 border-t border-white/10">
                <Link href="/signup">
                  <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-12 font-bold shadow-lg shadow-indigo-900/20">
                    Get Started Free
                  </Button>
                </Link>
              </div>
            </div>
            
            {/* Right: Actual Chat Mockup (Interactive in real app, static for now) */}
            <div className="lg:w-2/3 bg-slate-50 p-8 flex flex-col">
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-200">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div className="bg-white p-4 rounded-3xl rounded-tl-none border border-slate-200 text-sm text-slate-700 font-medium max-w-[80%] shadow-sm leading-relaxed">
                    Hello! 👋 I'm the Agentify demo assistant. I can help you understand how our AI can transform your customer engagement. What would you like to know?
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  <div className="bg-indigo-600 p-4 rounded-3xl rounded-tr-none text-sm text-white font-medium max-w-[80%] shadow-lg shadow-indigo-100">
                    How much does it cost?
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-200">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div className="bg-white p-4 rounded-3xl rounded-tl-none border border-slate-200 text-sm text-slate-700 font-medium max-w-[80%] shadow-sm leading-relaxed">
                    Our pricing is designed to grow with you! We have a <span className="font-bold text-indigo-600">Free Starter</span> plan, a <span className="font-bold text-indigo-600">Pro</span> plan for $49/mo, and an <span className="font-bold text-indigo-600">Enterprise</span> plan for larger teams. 
                    <br /><br />
                    Would you like me to send you the full pricing table?
                  </div>
                </div>
              </div>
              
              <div className="mt-8">
                <div className="flex flex-wrap gap-2 mb-6">
                  {["What features are included?", "How do I install it?", "Can I see some examples?"].map(q => (
                    <button key={q} className="px-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm">
                      {q}
                    </button>
                  ))}
                </div>
                <div className="bg-white border border-slate-200 rounded-[2rem] py-4 px-6 text-sm text-slate-400 font-medium flex justify-between items-center shadow-inner">
                  <span>Type your message here...</span>
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                    <Zap className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { title: "24/7 Availability", description: "Your AI never sleeps, answering customer questions even while you are away." },
              { title: "Instant Training", description: "Just paste your website URL and our AI learns everything about your business in seconds." },
              { title: "Lead Capture", description: "Turn visitors into customers by automatically collecting contact info during chats." }
            ].map((feature, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Bot className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-4">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
