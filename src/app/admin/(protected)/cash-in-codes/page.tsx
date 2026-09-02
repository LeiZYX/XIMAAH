import { CashInCodesManager } from "@/components/cash-in/CashInCodesManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminCashInCodesPage() {
  return <CashInCodesManager basePath="/admin" />;
}
