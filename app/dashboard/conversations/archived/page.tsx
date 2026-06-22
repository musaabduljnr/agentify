import { getArchivedConversations } from "@/lib/actions/archival";
import { ArchivalManager } from "@/components/dashboard/ArchivalManager";
import { Archive } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ArchivedConversationsPage() {
  const { data, total } = await getArchivedConversations(1, 20);

  return (
    <>
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center">
            <Archive className="w-5 h-5 text-slate-600" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900">Archived Conversations</h1>
        </div>
        <p className="text-slate-500">
          Conversations moved to archive. You can restore them at any time.
        </p>
      </div>

      <ArchivalManager initialData={data} total={total} />
    </>
  );
}
