import {
  formatGradeClassLine,
  resolveChineseName,
  resolveDisplayEnglishName,
  resolveSchoolNo,
  type StudentIdentityFields,
} from "@/lib/auth/student-identity";

export function StudentIdentityBanner({ identity }: { identity: StudentIdentityFields }) {
  const englishName = resolveDisplayEnglishName(identity);
  const chineseName = resolveChineseName(identity);
  const schoolNo = resolveSchoolNo(identity);
  const gradeClass = formatGradeClassLine(identity);
  const examIdentities = identity.examIdentities ?? [];

  const nameLine = chineseName ? `${englishName}（${chineseName}）` : englishName;

  return (
    <section
      aria-label="Signed-in student identity"
      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:px-5"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Signed in as
      </p>
      <p className="mt-1 text-base font-semibold text-slate-900 sm:text-lg">{nameLine}</p>
      <p className="mt-1 text-sm text-slate-600">
        {schoolNo ? (
          <>
            School No. <span className="font-medium text-slate-800">{schoolNo}</span>
          </>
        ) : (
          <span className="text-amber-700">
            Profile incomplete — contact Exams Office for your School No.
          </span>
        )}
        {gradeClass ? <span className="text-slate-400"> · </span> : null}
        {gradeClass ? <span>{gradeClass}</span> : null}
      </p>
      {examIdentities.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {examIdentities.map((row) => (
            <li key={row.boardCode}>
              {examIdentities.length > 1 ? (
                <span className="font-medium text-slate-700">{row.boardCode}: </span>
              ) : null}
              <span>
                UCI Center no.{" "}
                <span className="font-medium font-mono text-slate-800">
                  {row.centreNumber ?? "—"}
                </span>
              </span>
              <span className="text-slate-400"> · </span>
              <span>
                UCI no.{" "}
                <span className="font-medium font-mono text-slate-800">
                  {row.uciNumber ?? "—"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          UCI Center no. <span className="font-medium text-slate-800">—</span>
          <span className="text-slate-400"> · </span>
          UCI no. <span className="font-medium text-slate-800">—</span>
        </p>
      )}
    </section>
  );
}
