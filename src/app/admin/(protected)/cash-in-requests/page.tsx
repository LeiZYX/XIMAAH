import { CashInRequestsManager } from "@/components/cash-in/CashInRequestsManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminCashInRequestsPage() {
  return <CashInRequestsManager basePath="/admin" />;
}
