import Link from "next/link";
import { StudentIdentityBanner } from "@/components/student/StudentIdentityBanner";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StudentHomePage() {
  const session = await getSessionUser();
  let identity = null;

  if (session) {
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        name: true,
        studentNo: true,
        studentProfile: {
          select: {
            studentNo: true,
            currentGrade: true,
            currentClassName: true,
          },
        },
        candidate: {
          select: {
            chineseName: true,
            preferredEnglishName: true,
          },
        },
      },
    });

    if (user) {
      identity = {
        name: user.name,
        chineseName: user.candidate?.chineseName ?? null,
        preferredEnglishName: user.candidate?.preferredEnglishName ?? null,
        studentNo: user.studentProfile?.studentNo ?? user.studentNo ?? null,
        currentGrade: user.studentProfile?.currentGrade ?? null,
        currentClassName: user.studentProfile?.currentClassName ?? null,
      };
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student portal"
        description="Browse exams and manage your registrations."
      />
      {identity ? <StudentIdentityBanner identity={identity} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/calendar">
          <Card className="h-full transition hover:border-indigo-300 hover:shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Exam calendar</h2>
            <p className="mt-1 text-sm text-slate-600">
              Browse all exam sessions and register during open registration windows.
            </p>
          </Card>
        </Link>
        <Link href="/student/registrations">
          <Card className="h-full transition hover:border-indigo-300 hover:shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 sm:text-lg">My Exam Registrations</h2>
            <p className="mt-1 text-sm text-slate-600">
              Review your selections by exam series and registration window.
            </p>
          </Card>
        </Link>
        <Link href="/student/fee-statements" className="sm:col-span-2">
          <Card className="transition hover:border-indigo-300 hover:shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Fee Statements</h2>
            <p className="mt-1 text-sm text-slate-600">
              View issued fee statements for your locked registrations.
            </p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
