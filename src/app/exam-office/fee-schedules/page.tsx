import { FeeScheduleManager } from "@/components/fees/FeeScheduleManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExamOfficeFeeSchedulesPage() {
  return <FeeScheduleManager />;
}
