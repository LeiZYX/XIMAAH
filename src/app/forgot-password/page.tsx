"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Card } from "@/components/ui/Card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    setMessage(data.message ?? "Request submitted.");
    setLoading(false);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <h1 className="text-xl font-semibold">Forgot password</h1>
        <p className="mt-1 text-sm text-slate-600">Enter your email to receive a reset link.</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
          >
            Send reset link
          </button>
        </form>
        {message ? <p className="mt-4 text-sm text-green-700">{message}</p> : null}
        <p className="mt-4 text-sm">
          <Link href="/login" className="text-indigo-600">
            Back to login
          </Link>
        </p>
      </Card>
    </div>
  );
}
