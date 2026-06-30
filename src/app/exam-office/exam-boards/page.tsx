import { ExamBoardsManager } from "@/components/exam-boards/ExamBoardsManager";

export default function ExamOfficeExamBoardsPage() {
  return (
    <ExamBoardsManager
      canDelete={false}
      description="View and update board-specific centre settings used on exam documents and fee documents."
    />
  );
}
