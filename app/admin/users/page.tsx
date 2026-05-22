import { getAllUsers } from "@/lib/actions/admin";
import { UsersTable } from "@/components/admin/users-table";
import { Users } from "lucide-react";

export default async function AdminUsersPage() {
  const users = await getAllUsers();

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20 text-indigo-400">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">
            Users Management
          </h1>
          <p className="text-slate-400 text-sm">
            Audit user profile details, review signups, and promote/demote administrator privileges.
          </p>
        </div>
      </div>

      {/* Interactive Client-Side User Table */}
      <UsersTable initialUsers={users} />
    </div>
  );
}
