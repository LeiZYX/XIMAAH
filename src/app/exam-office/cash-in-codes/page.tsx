import { CashInCodesManager } from "@/components/cash-in/CashInCodesManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExamOfficeCashInCodesPage() {
  return <CashInCodesManager basePath="/exam-office" />;
}
