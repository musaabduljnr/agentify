import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const colorClasses: Record<string, string> = {
  indigo: "bg-indigo-50 text-indigo-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  blue: "bg-blue-50 text-blue-600",
};

export function StatCard({ label, title, value, change, trend, changeType = "neutral", icon, color = "indigo" }: any) {
  const displayLabel = label || title;
  const displayChange = change || trend || "No change";

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{displayLabel}</p>
        {icon && (
          <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center", colorClasses[color] || colorClasses.indigo)}>
            {icon}
          </div>
        )}
      </div>
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
          <span>{displayChange}</span>
        </div>
      </div>
    </div>
  );
}
