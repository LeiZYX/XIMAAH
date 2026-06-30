import type { ReactNode } from "react";

export type RegistrationItemBadge = "Pending Add" | "Pending Remove" | null;

interface RegistrationItemCardProps {
  title: string;
  badge?: RegistrationItemBadge;
  action?: ReactNode;
  children: ReactNode;
  muted?: boolean;
}

export function RegistrationItemCard({
  title,
  badge = null,
  action,
  children,
  muted = false,
}: RegistrationItemCardProps) {
  return (
    <div
      className={`rounded-lg border bg-white p-4 ${
        muted ? "border-slate-200 bg-slate-50/80 opacity-80" : "border-slate-200"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
            {badge ? (
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  badge === "Pending Add"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-900"
                }`}
              >
                {badge}
              </span>
            ) : null}
          </div>
          {children}
        </div>
        {action ? <div className="shrink-0 self-start">{action}</div> : null}
      </div>
    </div>
  );
}

export function RegistrationItemMeta({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm text-slate-900">{value}</p>
    </div>
  );
}
