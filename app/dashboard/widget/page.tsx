import { getWidgetConfig } from "@/lib/actions/widget";

export const dynamic = "force-dynamic";

import { WidgetCustomizerForm } from "@/components/dashboard/widget/widget-customizer-form";

export default async function WidgetCustomizerPage() {
  const initialData = await getWidgetConfig();

  return (
    <WidgetCustomizerForm initialData={initialData} />
  );
}
