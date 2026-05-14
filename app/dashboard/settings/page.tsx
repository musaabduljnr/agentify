import { Metadata } from "next";
import { SettingsForm } from "@/components/dashboard/settings/settings-form";
import { requireCurrentBusiness } from "@/lib/queries/business";
import { 
  User, 
  Building2, 
  Shield, 
  Bell, 
  Lock,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RepairButton } from "@/components/dashboard/repair-button";

export const metadata: Metadata = {
  title: "Settings | Agentify",
  description: "Manage your account and business profile.",
};

export default async function SettingsPage() {
  const business = await requireCurrentBusiness();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
      {/* Navigation */}
      <div className="lg:col-span-1 space-y-2">
        {[
          { icon: Building2, label: "Business Profile", active: true },
          { icon: User, label: "Personal Info", active: false },
          { icon: Bell, label: "Notifications", active: false },
          { icon: Shield, label: "Security", active: false },
          { icon: Lock, label: "Privacy", active: false },
        ].map((item) => (
          <button 
            key={item.label}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold transition-all ${
              item.active 
                ? "bg-white border border-slate-200 text-indigo-600 shadow-sm" 
                : "text-slate-400 hover:text-slate-700 hover:bg-slate-100/50"
            }`}
          >
            <item.icon className={`w-5 h-5 ${item.active ? "text-indigo-600" : "text-slate-300"}`} />
            {item.label}
          </button>
        ))}
        
        <div className="mt-10 p-6 bg-indigo-600 rounded-[2rem] text-white shadow-xl shadow-indigo-200">
          <h4 className="font-black mb-2">Need a Repair?</h4>
          <p className="text-xs text-indigo-100 mb-4 font-medium leading-relaxed">If your assistant or settings aren&apos;t loading correctly, try repairing your setup.</p>
          <RepairButton className="w-full rounded-xl h-10 text-xs font-bold text-indigo-600" />
        </div>
      </div>

      {/* Content */}
      <div className="lg:col-span-3 space-y-8">
        <SettingsForm initialBusiness={business} />

        <div className="bg-red-50 rounded-3xl border border-red-100 p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h4 className="text-red-900 font-extrabold text-lg mb-1">Danger Zone</h4>
            <p className="text-red-700 text-sm font-medium">Permanently delete your business account and all associated data.</p>
          </div>
          <Button variant="outline" className="bg-white text-red-600 border border-red-200 hover:bg-red-600 hover:text-white rounded-2xl h-12 px-8 font-bold transition-all shrink-0">
            Delete Account
          </Button>
        </div>
      </div>
    </div>
  );
}
