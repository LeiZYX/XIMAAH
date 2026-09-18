import { StudentIdentityBanner } from "@/components/student/StudentIdentityBanner";
import { loadSessionStudentPortalIdentity } from "@/lib/auth/load-student-portal-identity";

/** Server component: same Signed-in-as block used on Student portal. */
export async function StudentPortalIdentityBanner() {
  const identity = await loadSessionStudentPortalIdentity();
  if (!identity) return null;
  return <StudentIdentityBanner identity={identity} />;
}
