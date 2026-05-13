"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function StepAssistant({ register, errors, watch }: any) {
  const tones = ["Friendly", "Professional", "Helpful", "Witty", "Direct"];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Assistant Name</label>
        <Input 
          {...register("assistantName", { required: "Assistant name is required" })}
          placeholder="e.g. Agentify AI, Sarah"
          className={errors.assistantName ? "border-red-500 focus-visible:ring-red-500/20" : ""}
        />
        {errors.assistantName && <p className="text-xs font-bold text-red-500 ml-1">{errors.assistantName.message}</p>}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Tone of Voice</label>
        <div className="flex flex-wrap gap-2">
          {tones.map((tone) => (
            <label 
              key={tone}
              className={`px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-2 transition-all ${
                watch("assistantTone") === tone 
                  ? "bg-indigo-50 border-indigo-600 text-indigo-600" 
                  : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
              }`}
            >
              <input 
                type="radio" 
                value={tone} 
                className="hidden" 
                {...register("assistantTone", { required: "Tone is required" })}
              />
              {tone}
            </label>
          ))}
        </div>
        {errors.assistantTone && <p className="text-xs font-bold text-red-500 ml-1">{errors.assistantTone.message}</p>}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Welcome Message</label>
        <Textarea 
          {...register("welcomeMessage", { required: "Welcome message is required" })}
          placeholder="Hi! How can I help you today?"
          className={errors.welcomeMessage ? "border-red-500 focus-visible:ring-red-500/20" : ""}
        />
        {errors.welcomeMessage && <p className="text-xs font-bold text-red-500 ml-1">{errors.welcomeMessage.message}</p>}
      </div>
    </div>
  );
}
