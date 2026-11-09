"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";

const MIN_PASSWORD_LENGTH = 10;

const RESET_ERRORS: Record<string, string> = {
  invalid_reset: "This link is invalid, has expired or was already used. Ask your administrator for a new one.",
  password_too_short: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
  backend_unavailable: "Deku Finance is unreachable right now. Please try again shortly.",
};

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      if (res.ok) {
        setIsDone(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(RESET_ERRORS[data.error] ?? "The password couldn't be changed. Please try again.");
      }
    } catch {
      setError(RESET_ERRORS.backend_unavailable);
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-line bg-canvas text-sm text-ink";

  return (
    <main className="min-h-screen flex items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm bg-surface border border-line rounded-2xl p-6 space-y-4">
        <h1 className="text-lg font-bold text-ink">Set a new password</h1>
        {isDone ? (
          <div className="space-y-3 text-sm text-ink-soft">
            <p>Your password is changed, and you&apos;ve been signed out everywhere else.</p>
            <Link href="/login" className="font-bold text-brand-strong underline">
              Sign in
            </Link>
          </div>
        ) : !token ? (
          <p className="text-sm text-ink-soft">{RESET_ERRORS.invalid_reset}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">
                {error}
              </p>
            )}
            <div>
              <label htmlFor="new-password" className="block text-xs font-semibold text-ink-soft mb-1">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-xs font-semibold text-ink-soft mb-1">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
              />
            </div>
            <Button type="submit" disabled={isSaving} className="w-full">
              {isSaving ? "Saving…" : "Set password"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
