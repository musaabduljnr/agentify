"use client";

import { Check } from "lucide-react";

export function OnboardingStepper({ currentStep, totalSteps }: { currentStep: number, totalSteps: number }) {
  return (
    <div className="flex items-center justify-between mb-12 relative px-4 max-w-lg mx-auto">
      {/* Background Line */}
      <div className="absolute top-5 left-8 right-8 h-1 bg-slate-100 -z-10" />
      <div 
        className="absolute top-5 left-8 h-1 bg-indigo-600 -z-10 transition-all duration-500" 
        style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
      />

      {Array.from({ length: totalSteps }).map((_, i) => {
        const step = i + 1;
        const isCompleted = currentStep > step;
        const isActive = currentStep === step;

        return (
          <div key={step} className="flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-4 ${
              isCompleted 
                ? "bg-indigo-600 border-indigo-600 text-white" 
                : isActive 
                  ? "bg-white border-indigo-600 text-indigo-600 shadow-lg shadow-indigo-100" 
                  : "bg-white border-slate-100 text-slate-300"
            }`}>
              {isCompleted ? <Check className="w-5 h-5" /> : step}
            </div>
          </div>
        );
      })}
    </div>
  );
}
