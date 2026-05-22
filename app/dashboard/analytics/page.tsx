import { getBusinessAnalytics } from "@/lib/actions/analytics";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";
import Link from "next/link";

interface AnalyticsPageProps {
  searchParams?: any;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  // Safe resolution of searchParams that supports modern Next.js versions cleanly
  const resolvedParams = searchParams instanceof Promise ? await searchParams : (searchParams || {});
  
  // Parse days from query, defaulting to 30 days
  const days = resolvedParams.days ? parseInt(resolvedParams.days, 10) : 30;
  const activeDays = [7, 30, 90].includes(days) ? days : 30;

  // Fetch analytics data server-side
  const data = await getBusinessAnalytics(activeDays);

  if (!data) {
    return (
      <>
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Analytics & Insights</h1>
          <p className="text-slate-500">View performance insights and usage details for your business assistant.</p>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-16 text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 mx-auto mb-6">
            <BarChart3 className="w-8 h-8 text-slate-350" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Active Business Profile</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto mb-8">
            You must complete your business profile onboarding to enable tracking, lead capturing, and performance analytics.
          </p>
          <Button asChild className="rounded-2xl px-6 h-12 font-bold shadow-md shadow-indigo-900/10">
            <Link href="/onboarding">Start Onboarding</Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Analytics & Insights</h1>
        <p className="text-slate-500">Monitor interaction trends, RAG effectiveness, captured leads, and usage statistics.</p>
      </div>

      <AnalyticsView data={data} selectedDays={activeDays} />
    </>
  );
}
