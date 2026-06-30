import type { ExamBoardCentreInfo } from "@/lib/exam-boards/centre";
import { centreInfoLines } from "@/lib/exam-boards/centre";

export function ExamDocumentCentreHeader({ centre }: { centre: ExamBoardCentreInfo }) {
  const lines = centreInfoLines(centre);
  return (
    <div className="exam-document-centre-header mb-4 border-b border-slate-300 pb-3 text-sm text-slate-700">
      {lines.map((line, index) => (
        <p key={index} className={index === 0 ? "font-semibold text-slate-900" : undefined}>
          {line}
        </p>
      ))}
    </div>
  );
}
