import { Metadata } from "next";
import { SettingsForm } from "@/components/dashboard/settings/settings-form";
import { getCurrentBusinessSetup } from "@/lib/queries/business";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Settings | Agentify",
  description: "Manage your account and business profile.",
};

export default async function SettingsPage() {
  const setup = await getCurrentBusinessSetup();
  if (!setup.user) redirect("/login");
  if (!setup.business) redirect("/onboarding");

  return (
    <SettingsForm
      initialBusiness={setup.business}
      initialProfile={setup.profile}
      initialUser={{
        email: setup.user.email,
        user_metadata: setup.user.user_metadata,
      }}
      initialWidgetConfig={setup.widgetConfig}
    />
  );
}
