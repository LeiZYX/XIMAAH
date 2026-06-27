"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { Card } from "@/components/ui/Card";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Login failed");

      const destination = data.user.mustChangePassword
        ? "/account/change-password"
        : data.user.homePath || nextPath;

      router.replace(destination);
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              X
            </span>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-900">XIMA Assessment Hub</p>
              <p className="text-xs text-slate-500">Sign in</p>
            </div>
          </Link>
        </div>

        <Card>
          <h1 className="text-xl font-semibold text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-600">
            Use username, email, phone, or student number depending on your role.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Identifier</span>
              <input
                required
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="Email, username, phone, or student number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

          <p className="mt-4 text-center text-sm">
            <Link href="/forgot-password" className="text-indigo-600 hover:text-indigo-700">
              Forgot password?
            </Link>
          </p>
        </Card>

        <p className="mt-4 text-center text-sm text-slate-500">
          <Link href="/calendar" className="text-indigo-600 hover:text-indigo-700">
            Browse public calendar
          </Link>
        </p>
      </div>
    </div>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <LoginFormInner />
    </Suspense>
  );
}
