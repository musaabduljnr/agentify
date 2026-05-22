import DashboardLayoutClient from "@/components/dashboard/DashboardLayout";
import { requireCompleteBusinessSetup } from "@/lib/queries/business";
import { getUsageSummary } from "@/lib/billing/usage";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This will handle redirection if setup is incomplete or user is not logged in
  const setup = await requireCompleteBusinessSetup();

  // Fetch subscription data for sidebar
  let subscriptionData = null;
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
        plan: setup.subscription.plan || "free_trial",
        status: setup.subscription.status || "active",
        messagesUsed: setup.subscription.current_usage || 0,
        messagesLimit: setup.subscription.message_limit || 100,
      };
    }
  }

  return (
    <DashboardLayoutClient 
      user={setup.user} 
      profile={setup.profile}
      business={setup.business}
      assistant={setup.assistant}
      subscription={subscriptionData}
    >
      {children}
    </DashboardLayoutClient>
  );
}
