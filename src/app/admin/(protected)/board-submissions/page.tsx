import { Suspense } from "react";
import { BoardSubmissionsView } from "@/components/board-submissions/BoardSubmissionsView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminBoardSubmissionsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-600">Loading board submissions…</p>}>
      <BoardSubmissionsView basePath="/admin" />
    </Suspense>
  );
}
