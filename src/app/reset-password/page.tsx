"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { Card } from "@/components/ui/Card";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Reset failed");
    } else {
      setMessage("Password updated. You can now sign in.");
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <h1 className="text-xl font-semibold">Reset password</h1>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={loading || !token}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
          >
            Reset password
          </button>
        </form>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-green-700">{message}</p> : null}
        <p className="mt-4 text-sm">
          <Link href="/login" className="text-indigo-600">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
