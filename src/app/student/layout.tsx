import { AppHeader } from "@/components/layout/AppHeader";
import { getSessionUser } from "@/lib/auth/session";
import { redirectIfStudentLoginDisabled } from "@/lib/features/settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();
  if (session) {
    await redirectIfStudentLoginDisabled(session.role);
  }

  return (
    <div className="min-h-screen overflow-x-hidden">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-5 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
