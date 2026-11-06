import { AlertTriangle, CheckCircle2, Database, RefreshCcw } from "lucide-react";
import type { getKnowledgeConsistencyReport } from "@/lib/actions/knowledge";

type ConsistencyReport = Awaited<ReturnType<typeof getKnowledgeConsistencyReport>>;

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusTone(status: string) {
  if (status === "ready") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "failed") return "bg-red-50 text-red-700 border-red-100";
  if (status === "indexing") return "bg-blue-50 text-blue-700 border-blue-100";
  return "bg-amber-50 text-amber-700 border-amber-100";
}

export function KnowledgeConsistencyPanel({ report }: { report: ConsistencyReport }) {
  if ("error" in report) {
    return (
      <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
        Consistency diagnostics are unavailable: {report.error}
      </div>
    );
  }

  const { totals, rows, orphanedChunks } = report;
  const hasIssues =
    totals.failedSources > 0 ||
    totals.pendingSources > 0 ||
    totals.sourcesWithStaleChunks > 0 ||
    (orphanedChunks ?? 0) > 0;

  return (
    <details
      open={hasIssues}
      className="mt-8 rounded-3xl border border-slate-200 bg-white shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50">
            <Database className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Knowledge consistency</h2>
            <p className="text-xs text-slate-500">
              Only the current, successfully indexed version of each source is used by the assistant.
            </p>
          </div>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
            hasIssues
              ? "border-amber-100 bg-amber-50 text-amber-700"
              : "border-emerald-100 bg-emerald-50 text-emerald-700"
          }`}
        >
          {hasIssues ? "Needs attention" : "Healthy"}
        </span>
      </summary>

      <div className="border-t border-slate-100 px-6 py-5">
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-xl bg-emerald-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Retrievable</p>
            <p className="text-lg font-extrabold text-emerald-800">{totals.retrievableSources}</p>
          </div>
          <div className="rounded-xl bg-amber-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Pending</p>
            <p className="text-lg font-extrabold text-amber-800">{totals.pendingSources}</p>
          </div>
          <div className="rounded-xl bg-red-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">Failed</p>
            <p className="text-lg font-extrabold text-red-800">{totals.failedSources}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Current chunks</p>
            <p className="text-lg font-extrabold text-slate-800">
              {totals.currentChunks}
              <span className="text-xs font-semibold text-slate-400"> / {totals.chunks}</span>
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Orphaned chunks</p>
            <p className="text-lg font-extrabold text-slate-800">{orphanedChunks ?? "n/a"}</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No knowledge sources yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Source", "Index status", "Versions", "Retrievable", "Chunks", "Last indexed", "Last error"].map(
                    (heading) => (
                      <th
                        key={heading}
                        className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400"
                      >
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.source_id} className="border-b border-slate-50">
                    <td className="px-3 py-3">
                      <p className="max-w-[220px] truncate text-sm font-semibold text-slate-800" title={row.title}>
                        {row.title}
                      </p>
                      <p className="text-[10px] text-slate-400">{row.source_status}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusTone(
                          row.index_status
                        )}`}
                      >
                        {row.index_status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">
                      content {row.content_version} / indexed {row.indexed_version ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      {row.is_retrievable ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
                          <RefreshCcw className="h-3.5 w-3.5" /> No
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">
                      {row.current_version_chunk_count} current / {row.chunk_count} total
                      {row.stale_chunk_count > 0 && (
                        <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-bold text-amber-600">
                          <AlertTriangle className="h-3 w-3" />
                          {row.stale_chunk_count} stale
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                      {formatDate(row.indexed_at)}
                    </td>
                    <td className="max-w-[220px] px-3 py-3 text-xs text-red-500">
                      <span className="line-clamp-2" title={row.index_error || undefined}>
                        {row.index_error || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  );
}
