import { getNotificationFeed } from "@/lib/actions/notifications";
import { NotificationFeed } from "@/components/dashboard/NotificationFeed";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const { notifications, unreadCount } = await getNotificationFeed();

  return (
    <NotificationFeed
      initialNotifications={notifications}
      initialUnreadCount={unreadCount}
    />
  );
}
