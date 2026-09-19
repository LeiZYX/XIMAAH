import { AppHeader } from "@/components/layout/AppHeader";
import { FinanceSidebar } from "@/components/layout/FinanceSidebar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <div className="flex min-h-[calc(100vh-73px)]">
        <FinanceSidebar />
        <main className="flex-1 overflow-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
