import DashboardLayoutClient from "@/components/dashboard/DashboardLayout";
import { requireCompleteBusinessSetup } from "@/lib/queries/business";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This will handle redirection if setup is incomplete or user is not logged in
  const setup = await requireCompleteBusinessSetup();

  return (
    <DashboardLayoutClient 
      user={setup.user} 
      profile={setup.profile}
      business={setup.business}
      assistant={setup.assistant}
    >
      {children}
    </DashboardLayoutClient>
  );
}
