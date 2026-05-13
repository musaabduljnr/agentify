import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, change, changeType }: any) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">{label}</p>
      <div className="flex items-end justify-between">
        <h3 className="text-3xl font-extrabold text-slate-900">{value}</h3>
        <div className={cn(
          "flex items-center gap-1 text-sm font-bold px-2 py-1 rounded-lg",
          changeType === "positive" ? "text-green-600 bg-green-50" : 
          changeType === "negative" ? "text-red-600 bg-red-50" : 
          "text-slate-500 bg-slate-50"
        )}>
          {changeType === "positive" && <ArrowUpRight className="w-4 h-4" />}
          {changeType === "negative" && <ArrowDownRight className="w-4 h-4" />}
          {changeType === "neutral" && <Minus className="w-4 h-4" />}
          <span>{change}</span>
        </div>
      </div>
    </div>
  );
}
