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

  const nameLine = [chineseName, englishName].filter(Boolean).join(" · ");

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
    </section>
  );
}
