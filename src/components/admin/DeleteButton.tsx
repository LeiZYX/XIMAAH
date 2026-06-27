"use client";

interface DeleteButtonProps {
  onDelete: () => Promise<void>;
  label?: string;
}

export function DeleteButton({ onDelete, label = "Delete" }: DeleteButtonProps) {
  return (
    <button
      type="button"
      onClick={async () => {
        if (!window.confirm("Are you sure you want to delete this item?")) return;
        await onDelete();
      }}
      className="rounded-md px-2 py-1 text-sm font-medium text-red-600 transition hover:bg-red-50"
    >
      {label}
    </button>
  );
}
