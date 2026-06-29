import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function LoginPage() {
  return <LoginForm />;
}
