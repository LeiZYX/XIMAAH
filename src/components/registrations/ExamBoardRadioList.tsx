"use client";

export interface ExamBoardOption {
  id: string;
  name: string;
  code: string;
}

export function ExamBoardRadioList({
  boards,
  value,
  onChange,
}: {
  boards: ExamBoardOption[];
  value: string;
  onChange: (boardId: string) => void;
}) {
  if (boards.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No exam boards found. Run <code className="rounded bg-slate-100 px-1">npm run db:seed</code>.
      </p>
    );
  }

  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Exam board</legend>
      {boards.map((board) => {
        const selected = value === board.id;
        return (
          <label
            key={board.id}
            className={`flex cursor-pointer items-start gap-3 border px-3 py-2.5 text-sm transition ${
              selected
                ? "border-indigo-600 bg-indigo-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <input
              type="radio"
              name="examBoard"
              value={board.id}
              checked={selected}
              onChange={() => onChange(board.id)}
              className="mt-0.5 border-slate-300 text-indigo-600"
            />
            <span className="font-medium text-slate-900">{board.name}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
