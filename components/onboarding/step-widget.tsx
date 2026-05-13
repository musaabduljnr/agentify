"use client";

import { Input } from "@/components/ui/input";

export function StepWidget({ register, watch, setValue }: any) {
  const colors = ["#4f46e5", "#0ea5e9", "#10b981", "#f43f5e", "#f59e0b", "#7c3aed"];
  const positions = [
    { value: "bottom-right", label: "Bottom Right" },
    { value: "bottom-left", label: "Bottom Left" },
  ];

  const suggestedQuestions = watch("suggestedQuestions") || [];

  const addQuestion = (e: any) => {
    if (e.key === "Enter" && e.target.value) {
      e.preventDefault();
      setValue("suggestedQuestions", [...suggestedQuestions, e.target.value]);
      e.target.value = "";
    }
  };

  const removeQuestion = (index: number) => {
    setValue("suggestedQuestions", suggestedQuestions.filter((_: any, i: number) => i !== index));
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Brand Color</label>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                className={`w-10 h-10 rounded-full border-2 transition-all ${
                  watch("primaryColor") === color ? "border-slate-900 scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setValue("primaryColor", color)}
              />
            ))}
          </div>
          <Input 
            type="color"
            className="w-12 h-10 p-1 rounded-xl cursor-pointer"
            {...register("primaryColor")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Widget Position</label>
        <div className="grid grid-cols-2 gap-4">
          {positions.map((pos) => (
            <label 
              key={pos.value}
              className={`px-4 py-3 rounded-2xl text-sm font-bold cursor-pointer border-2 text-center transition-all ${
                watch("position") === pos.value 
                  ? "bg-indigo-50 border-indigo-600 text-indigo-600" 
                  : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
              }`}
            >
              <input 
                type="radio" 
                value={pos.value} 
                className="hidden" 
                {...register("position")}
              />
              {pos.label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Suggested Questions</label>
        <div className="space-y-3">
          <Input 
            placeholder="Press Enter to add a question..."
            onKeyDown={addQuestion}
          />
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((q: string, i: number) => (
              <div key={i} className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2">
                {q}
                <button type="button" onClick={() => removeQuestion(i)} className="hover:text-red-500">×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
