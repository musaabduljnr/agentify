"use client";

import { OnboardingData } from "@/lib/actions/onboarding";
import { motion } from "framer-motion";
import { Bot, Send, Sparkles, X } from "lucide-react";

export function OnboardingPreview({ data, step }: { data: Partial<OnboardingData>, step: number }) {
  // Step 1 & 2: Show a profile card
  if (step < 3) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-md border border-slate-100"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 text-2xl font-black">
              {data.businessName ? data.businessName.charAt(0).toUpperCase() : "B"}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                {data.businessName || "Your Business"}
              </h3>
              <p className="text-sm font-medium text-slate-500">
                {data.industry || "Industry"}
              </p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs font-bold text-slate-400 mb-1 uppercase">Website</p>
              <p className="text-sm font-medium text-slate-700 truncate">
                {data.websiteUrl || "https://example.com"}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs font-bold text-slate-400 mb-1 uppercase">Contact</p>
              <p className="text-sm font-medium text-slate-700 truncate">
                {data.contactEmail || "hello@example.com"}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Step 3 & 4: Show the mock chat widget
  const color = data.primaryColor || "#4f46e5";
  const position = data.position || "bottom-right";
  const alignment = position.includes("left") ? "items-start" : "items-end";

  return (
    <div className="w-full h-full bg-slate-100 relative overflow-hidden flex flex-col shadow-inner">
      {/* Mock Browser Header */}
      <div className="h-12 bg-white border-b border-slate-200 flex items-center px-4 gap-2 shadow-sm z-10 shrink-0">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="mx-auto px-4 py-1 rounded-md bg-slate-100 text-xs text-slate-400 font-medium font-mono truncate max-w-[200px]">
          {data.websiteUrl || "example.com"}
        </div>
      </div>

      {/* Mock Website Content */}
      <div className="flex-1 p-8 opacity-40 blur-[1px] pointer-events-none">
        <div className="w-48 h-8 bg-slate-300 rounded-lg mb-6" />
        <div className="w-full max-w-lg h-4 bg-slate-200 rounded-md mb-3" />
        <div className="w-full max-w-md h-4 bg-slate-200 rounded-md mb-3" />
        <div className="w-full max-w-sm h-4 bg-slate-200 rounded-md mb-8" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-32 bg-slate-200 rounded-xl" />
          <div className="h-32 bg-slate-200 rounded-xl" />
          <div className="h-32 bg-slate-200 rounded-xl" />
        </div>
      </div>

      {/* Floating Widget Mock */}
      <div className={`absolute bottom-0 left-0 w-full p-6 flex flex-col ${alignment} pointer-events-none z-20`}>
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden mb-4 flex flex-col pointer-events-auto"
        >
          {/* Header */}
          <div className="p-4 text-white flex items-center justify-between" style={{ backgroundColor: color }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-sm leading-tight">{data.assistantName || "AI Assistant"}</h4>
                <p className="text-[10px] opacity-80 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Online
                </p>
              </div>
            </div>
            <button className="opacity-70 hover:opacity-100 transition-opacity">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Messages Area */}
          <div className="p-4 flex-1 bg-slate-50 min-h-[160px] flex flex-col justify-end gap-3">
            <div className="flex gap-2 w-[90%]">
              <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white" style={{ backgroundColor: color }}>
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="bg-white border border-slate-100 p-3 rounded-2xl rounded-tl-sm text-sm text-slate-600 shadow-sm">
                {data.welcomeMessage || "Hello! How can I help?"}
              </div>
            </div>
            
            {(data.suggestedQuestions || []).length > 0 && (
              <div className="flex flex-col gap-1.5 mt-2">
                {(data.suggestedQuestions || []).map((q: string, i: number) => (
                  <div key={i} className="text-xs font-medium px-3 py-2 rounded-xl border border-indigo-100 bg-white text-indigo-600 self-end max-w-[90%] shadow-sm truncate">
                    {q}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-slate-100 flex gap-2">
            <div className="flex-1 bg-slate-100 rounded-xl h-9 px-3 flex items-center text-xs text-slate-400">
              Type your message...
            </div>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ backgroundColor: color }}>
              <Send className="w-4 h-4" />
            </div>
          </div>
        </motion.div>

        {/* Bubble */}
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center cursor-pointer pointer-events-auto text-white"
          style={{ backgroundColor: color }}
        >
          <Sparkles className="w-6 h-6" />
        </motion.div>
      </div>
    </div>
  );
}
