import { redirectIfStudentLoginDisabled } from "@/lib/features/settings";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();
  if (session) {
    await redirectIfStudentLoginDisabled(session.role);
  }
  return children;
}
