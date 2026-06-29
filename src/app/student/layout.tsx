import { AppHeader } from "@/components/layout/AppHeader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-4xl p-6 lg:p-8">{children}</main>
    </div>
  );
}
