import { AppHeader } from "@/components/layout/AppHeader";
import { CalendarView } from "@/components/calendar/CalendarView";
import { PageHeader } from "@/components/ui/PageHeader";

export default function CalendarPage() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Assessment Calendar"
          description="View exam sessions and key dates. Filter by exam board, qualification, subject, or series."
        />
        <CalendarView />
      </main>
    </div>
  );
}
