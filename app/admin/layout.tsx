import { requireAdmin } from "@/lib/admin/require-admin";
import { headers } from "next/headers";
import AdminLayoutClient from "@/components/admin/AdminLayoutClient";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const pathname = headerList.get("x-pathname");

  if (pathname === "/admin/login") {
    return children;
  }

  // Enforce secure server-side admin check
  const profile = await requireAdmin();

  return (
    <AdminLayoutClient profile={profile}>
      {children}
    </AdminLayoutClient>
  );
}

