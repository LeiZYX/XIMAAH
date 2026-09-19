type Cell = "Yes" | "No" | string;

const ROWS: Array<{ matter: string; admin: Cell; examOfficer: Cell; finance: Cell }> = [
  {
    matter: "Generate, regenerate, preview, print, history",
    admin: "Yes",
    examOfficer: "Yes",
    finance: "Yes",
  },
  {
    matter: "Mark as paid offline",
    admin: "Yes",
    examOfficer: "Yes",
    finance: "Yes",
  },
  {
    matter: "View refund due and refund status",
    admin: "Yes",
    examOfficer: "Yes",
    finance: "Yes",
  },
  {
    matter: "Record refund and Offline Refunds form",
    admin: "Yes",
    examOfficer: "No",
    finance: "Yes",
  },
  {
    matter: "Reprice by current fee stage",
    admin: "Yes",
    examOfficer: "Yes",
    finance: "No",
  },
  {
    matter: "Fee rules, fee schedule, exchange rates",
    admin: "Yes",
    examOfficer: "No, unless the exam-officer fee-rules switch is on",
    finance: "No",
  },
  {
    matter: "Registrations, subjects, UCI, board submissions, window settings",
    admin: "Yes",
    examOfficer: "Yes",
    finance: "No (window filter only)",
  },
  {
    matter: "Post-results",
    admin: "Yes",
    examOfficer: "Yes",
    finance: "No",
  },
  {
    matter: "Audit logs and login logs",
    admin: "Yes",
    examOfficer: "Yes",
    finance: "No",
  },
  {
    matter: "Create users",
    admin: "Yes",
    examOfficer: "No",
    finance: "No",
  },
];

export function RolePermissionsTable({ activeRole }: { activeRole?: string }) {
  const highlight = (role: string) =>
    activeRole === role ? "bg-indigo-50" : "";

  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-sm font-medium text-slate-800">What each role can do</p>
      <p className="mb-3 text-xs text-slate-500">
        Normal, Late, and High Late change the price and the refund percent. They do not change these permissions. Exam Officer is the same role as 考试办.
      </p>
      <table className="min-w-full border-collapse border border-slate-200 text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs uppercase text-slate-600">
            <th className="border border-slate-200 px-3 py-2">Matter</th>
            <th className={`border border-slate-200 px-3 py-2 ${highlight("ADMIN")}`}>Admin</th>
            <th className={`border border-slate-200 px-3 py-2 ${highlight("EXAM_OFFICER")}`}>
              Exam Officer
            </th>
            <th className={`border border-slate-200 px-3 py-2 ${highlight("FINANCE")}`}>Finance</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.matter}>
              <td className="border border-slate-200 px-3 py-2 text-slate-800">{row.matter}</td>
              <td className={`border border-slate-200 px-3 py-2 ${highlight("ADMIN")}`}>{row.admin}</td>
              <td className={`border border-slate-200 px-3 py-2 ${highlight("EXAM_OFFICER")}`}>
                {row.examOfficer}
              </td>
              <td className={`border border-slate-200 px-3 py-2 ${highlight("FINANCE")}`}>
                {row.finance}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
