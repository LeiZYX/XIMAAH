import { AppHeader } from "@/components/layout/AppHeader";

export default function ExamOfficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-7xl p-6 lg:p-8">{children}</main>
    </div>
  );
}
