import DashboardLayoutClient from "@/components/dashboard/DashboardLayout";
import { requireCompleteBusinessSetup } from "@/lib/queries/business";
import { getUsageSummary } from "@/lib/billing/usage";
import { getDashboardNotifications } from "@/lib/queries/notifications";
import { ClaimDemoHandler } from "@/components/dashboard/ClaimDemoHandler";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This will handle redirection if setup is incomplete or user is not logged in
  const setup = await requireCompleteBusinessSetup();

  // Fetch subscription data for sidebar
  let subscriptionData = null;
  let notificationData: Awaited<ReturnType<typeof getDashboardNotifications>> = {
    notifications: [],
    unreadCount: 0,
  };
  if (setup.business && setup.subscription) {
    try {
      const usage = await getUsageSummary(setup.business.id);
      subscriptionData = {
        plan: setup.subscription.plan,
        status: setup.subscription.status,
        messagesUsed: usage.messages.used,
        messagesLimit: usage.messages.limit,
      };
    } catch (e) {
      // fallback
      subscriptionData = {
        plan: setup.subscription.plan || "starter",
        status: setup.subscription.status || "pending",
        messagesUsed: setup.subscription.current_usage || 0,
        messagesLimit: setup.subscription.message_limit || 200,
      };
    }

    try {
      notificationData = await getDashboardNotifications(setup.business.id, setup.user.id);
    } catch (error) {
      console.error("Failed to load dashboard notifications:", error);
    }
  }

  return (
    <DashboardLayoutClient 
      user={setup.user} 
      profile={setup.profile}
      business={setup.business}
      businesses={setup.businesses}
      assistant={setup.assistant}
      subscription={subscriptionData}
      notifications={notificationData.notifications}
      notificationUnreadCount={notificationData.unreadCount}
      notificationUserId={setup.user.id}
    >
      <ClaimDemoHandler userId={setup.user.id} />
      {children}
    </DashboardLayoutClient>
  );
}
