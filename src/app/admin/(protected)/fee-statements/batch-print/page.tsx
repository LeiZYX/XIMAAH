import { FeeBatchPrintView } from "@/components/fees/FeeBatchPrintView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminFeeBatchPrintPage() {
  return <FeeBatchPrintView basePath="/admin" />;
}
