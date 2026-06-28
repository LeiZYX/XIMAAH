import { AppHeader } from "@/components/layout/AppHeader";
import { ExamOfficeSidebar } from "@/components/layout/ExamOfficeSidebar";

export default function ExamOfficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <div className="flex min-h-[calc(100vh-73px)]">
        <ExamOfficeSidebar />
        <main className="flex-1 overflow-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
