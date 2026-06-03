import { requireAdmin } from "@/lib/admin/require-admin";
import { getAdminConfigurations } from "@/lib/actions/admin-config";
import { ConfigurationCenter } from "@/components/admin/ConfigurationCenter";
import { SlidersHorizontal } from "lucide-react";

export const metadata = {
  title: "Admin Configuration Center",
  description: "Secure platform configurations and keys dashboard.",
};

export default async function AdminConfigurationPage() {
  // Enforce secure server-side admin check
  await requireAdmin();

  // Load and mask config center entries server-side
  const configurations = await getAdminConfigurations();

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20 text-indigo-400">
          <SlidersHorizontal className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">
            Configuration Center
          </h1>
          <p className="text-slate-400 text-sm">
            Dynamically adjust system options, toggle feature flags, and update keys without code updates or redeployments.
          </p>
        </div>
      </div>

      {/* Main Tabbed Config Dashboard */}
      <ConfigurationCenter initialConfigs={configurations} />
    </div>
  );
}
