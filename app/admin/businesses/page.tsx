import { getAllBusinesses } from "@/lib/actions/admin";
import { BusinessesTable } from "@/components/admin/businesses-table";
import { Building2 } from "lucide-react";

export default async function AdminBusinessesPage() {
  const businesses = await getAllBusinesses();

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20 text-indigo-400">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">
            Businesses Management
          </h1>
          <p className="text-slate-400 text-sm">
            Monitor active business profiles, manage widgets, and toggle platform access suspension states.
          </p>
        </div>
      </div>

      {/* Interactive Client-Side Businesses Table */}
      <BusinessesTable initialBusinesses={businesses} />
    </div>
  );
}
