import { Suspense } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { CalendarView } from "@/components/calendar/CalendarView";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CalendarPage() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <PageHeader
          title="Assessment Calendar"
          description="View exam sessions and key dates. Filter by exam board, qualification, subject, or series."
        />
        <Suspense fallback={<p className="text-sm text-slate-600">Loading calendar...</p>}>
          <CalendarView />
        </Suspense>
      </main>
    </div>
  );
}
