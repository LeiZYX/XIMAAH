import Link from "next/link";
import { StudentPortalIdentityBanner } from "@/components/student/StudentPortalIdentityBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { StudentRegistrationsClient } from "./StudentRegistrationsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function StudentRegistrationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Exam Registrations"
        description="See which exam series you are registering for, your selected exams, and whether each registration window is still open."
      />
      <StudentPortalIdentityBanner />
      <p className="text-sm">
        <Link href="/calendar" className="text-indigo-600 hover:text-indigo-700">
          Browse all exams on the calendar
        </Link>
      </p>
      <StudentRegistrationsClient />
    </div>
  );
}
