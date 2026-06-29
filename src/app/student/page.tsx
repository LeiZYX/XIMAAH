import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function StudentHomePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Student portal"
        description="Browse exams and manage your registrations."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/calendar">
          <Card className="transition hover:border-indigo-300 hover:shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Exam calendar</h2>
            <p className="mt-1 text-sm text-slate-600">
              Browse all exam sessions and register during open registration windows.
            </p>
          </Card>
        </Link>
        <Link href="/student/registrations">
          <Card className="transition hover:border-indigo-300 hover:shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">My Exam Registrations</h2>
            <p className="mt-1 text-sm text-slate-600">
              Review your selections by exam series and registration window.
            </p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
