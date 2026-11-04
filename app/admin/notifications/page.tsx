import { AdminNotifications } from "@/components/admin/AdminNotifications";
import { getAdminAnnouncements } from "@/lib/actions/admin-notifications";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const announcements = await getAdminAnnouncements();
  return <AdminNotifications announcements={announcements} />;
}
