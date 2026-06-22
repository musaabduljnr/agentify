import { getWebhooks, getWebhookDeliveries, getWebhookStats } from "@/lib/actions/webhooks";
import { WebhookMonitor } from "@/components/dashboard/WebhookMonitor";
import { Webhook } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WebhooksPage() {
  const [webhooks, { data: deliveries, total }, stats] = await Promise.all([
    getWebhooks(),
    getWebhookDeliveries("all", 1, 20),
    getWebhookStats(),
  ]);

  return (
    <>
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
            <Webhook className="w-5 h-5 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900">Webhook Monitoring</h1>
        </div>
        <p className="text-slate-500">
          Manage outbound webhooks and monitor delivery status, retries, and error logs.
        </p>
      </div>

      <WebhookMonitor
        initialWebhooks={webhooks}
        initialDeliveries={deliveries}
        totalDeliveries={total}
        stats={stats}
      />
    </>
  );
}
