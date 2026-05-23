import { Button } from "@/components/ui/button";
import { Bot, Sparkles, Zap, Shield } from "lucide-react";

export function Hero() {
  return (
    <section className="pt-32 pb-20 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              <span>AI-Powered Customer Support</span>
            </div>
            <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 leading-tight mb-6">
              Turn your website into a <span className="text-indigo-600">24/7 AI sales assistant</span>
            </h1>
            <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto lg:mx-0">
              Create a custom AI assistant trained on your business data. Embed it on your site in minutes and start converting visitors into leads automatically.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <Button size="lg" className="rounded-full px-8 h-14 text-lg">
                Start free trial
              </Button>
              <Button size="lg" variant="outline" className="rounded-full px-8 h-14 text-lg border-slate-300 bg-white text-slate-900 hover:bg-slate-50">
                View demo
              </Button>
            </div>
            
            <div className="mt-10 flex items-center gap-8 justify-center lg:justify-start grayscale opacity-60">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                <Zap className="w-4 h-4" /> <span>Fast Setup</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                <Shield className="w-4 h-4" /> <span>Secure & Private</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                <Bot className="w-4 h-4" /> <span>Smart Training</span>
              </div>
            </div>
          </div>
          
          <div className="flex-1 relative">
            <div className="relative z-10 bg-white rounded-3xl shadow-2xl border border-slate-200 p-2 max-w-md mx-auto">
              <div className="bg-slate-50 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Agentify Assistant</h3>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Online</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4 mb-6">
                  <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 text-sm text-slate-700 max-w-[80%]">
                    Hello! How can I help you with Agentify today?
                  </div>
                  <div className="bg-indigo-600 p-3 rounded-2xl rounded-tr-none text-sm text-white max-w-[80%] ml-auto">
                    How do I install the chatbot on my WordPress site?
                  </div>
                  <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 text-sm text-slate-700 max-w-[80%] flex items-center gap-2">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce delay-100"></span>
                      <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce delay-200"></span>
                    </span>
                  </div>
                </div>
                
                <div className="relative">
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-indigo-600">
                      <Zap className="w-4 h-4 fill-indigo-600" />
                    </Button>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-full py-3 px-4 text-sm text-slate-400">
                    Type your message...
                  </div>
                </div>
              </div>
            </div>
            
            {/* Background elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-indigo-50 rounded-full blur-3xl -z-10 opacity-50"></div>
          </div>
        </div>
      </div>
    </section>
  );
}
