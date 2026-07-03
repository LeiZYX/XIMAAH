"use client";

import { useRef, useState } from "react";

export function isXlsxFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".xlsx");
}

export function ExcelFileDropzone({
  file,
  onFileChange,
  onInvalidFile,
  disabled = false,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  onInvalidFile?: (message: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function rejectInvalid(message: string) {
    onInvalidFile?.(message);
  }

  function selectFile(selected: File | undefined) {
    if (!selected) return;
    if (!isXlsxFile(selected)) {
      rejectInvalid("Only Excel (.xlsx) files are supported.");
      return;
    }
    onFileChange(selected);
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    if (disabled) return;
    selectFile(event.dataTransfer.files?.[0]);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-900">Choose Excel File (.xlsx)</p>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
            : dragOver
              ? "border-indigo-500 bg-indigo-50"
              : "border-slate-300 bg-white hover:border-slate-400"
        }`}
      >
        <p className="text-sm text-slate-700">Drag and drop your .xlsx file here</p>
        <p className="mt-1 text-xs text-slate-500">or</p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Browse files
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          disabled={disabled}
          onChange={handleInputChange}
        />
        {file ? (
          <p className="mt-4 text-sm font-medium text-indigo-700">{file.name}</p>
        ) : (
          <p className="mt-4 text-xs text-slate-500">No file selected</p>
        )}
      </div>
    </div>
  );
}
