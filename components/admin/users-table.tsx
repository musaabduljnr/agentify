"use client";

import { useState } from "react";
import { updateUserRole } from "@/lib/actions/admin";
import { Search, ShieldAlert, ShieldCheck, Mail, Calendar, Building, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UsersTableProps {
  initialUsers: any[];
}

export function UsersTable({ initialUsers }: UsersTableProps) {
  const [users, setUsers] = useState(initialUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Handle Search & Filter logic
  const filteredUsers = users.filter((user) => {
    const nameStr = (user.full_name || "").toLowerCase();
    const emailStr = (user.email || "").toLowerCase();
    const matchesSearch =
      nameStr.includes(searchTerm.toLowerCase()) || emailStr.includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === "all" || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const handleRoleToggle = async (userId: string, currentRole: string) => {
    const targetRole = currentRole === "admin" ? "client" : "admin";
    setUpdatingId(userId);
    setActionError(null);

    try {
      const result = await updateUserRole(userId, targetRole);
      if (result.error) {
        throw new Error(result.error);
      }

      // Optimistically update frontend state
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: targetRole } : u))
      );
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Failed to update user role privilege.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Top Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-950 p-6 rounded-3xl border border-slate-800">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search email or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex gap-2 shrink-0">
          {["all", "admin", "client"].map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-4 py-2 rounded-xl text-xs font-bold capitalize border transition-all ${
                roleFilter === role
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                  : "bg-slate-900 border-slate-850 text-slate-400 hover:text-white"
              }`}
            >
              {role}s
            </button>
          ))}
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium rounded-2xl">
          ⚠ {actionError}
        </div>
      )}

      {/* Main Table Panel */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden">
        {filteredUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-850 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-4 px-6">Name & Details</th>
                  <th className="py-4 px-6">Email Address</th>
                  <th className="py-4 px-6">Platform Role</th>
                  <th className="py-4 px-6">Business Status</th>
                  <th className="py-4 px-6">Joined Date</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {filteredUsers.map((user) => {
                  const regDate = user.created_at
                    ? new Date(user.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "Unknown";

                  return (
                    <tr key={user.id} className="text-slate-350 hover:bg-slate-900/30 transition-colors">
                      <td className="py-4 px-6">
                        <p className="font-extrabold text-white text-sm">{user.full_name || "—"}</p>
                        <span className="text-[10px] text-slate-500 font-medium font-mono truncate block max-w-[150px]">
                          ID: {user.id}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-semibold">
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          {user.email}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
                            user.role === "admin"
                              ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                              : "bg-slate-900 border-slate-800 text-slate-400"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {user.businesses && user.businesses.length > 0 ? (
                          <span className="flex items-center gap-1.5 font-bold text-white">
                            <Building className="w-3.5 h-3.5 text-indigo-400" />
                            {user.businesses[0].name}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">No business linked</span>
                        )}
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {regDate}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Button
                          onClick={() => handleRoleToggle(user.id, user.role)}
                          disabled={updatingId === user.id}
                          variant="ghost"
                          className={`rounded-xl h-9 text-[10px] font-bold uppercase tracking-wider border hover:bg-slate-900 hover:text-white transition-all ${
                            user.role === "admin"
                              ? "border-red-500/20 text-red-400 hover:border-red-500/40"
                              : "border-indigo-500/20 text-indigo-400 hover:border-indigo-500/40"
                          }`}
                        >
                          {updatingId === user.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              Syncing...
                            </>
                          ) : user.role === "admin" ? (
                            <>
                              <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
                              Demote
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                              Promote
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16 text-slate-500">
            <p className="text-sm">No profiles found matching search constraints.</p>
          </div>
        )}
      </div>
    </div>
  );
}
