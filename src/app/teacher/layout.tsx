import { AppHeader } from "@/components/layout/AppHeader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-5 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
