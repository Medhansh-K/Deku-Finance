"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";

const MIN_PASSWORD_LENGTH = 10;

const ERRORS: Record<string, string> = {
  invalid_credentials: "Your current password is incorrect.",
  invalid_token: "Your session has expired. Please sign in again.",
  password_too_short: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
  too_many_attempts: "Too many failed attempts. Please try again in 15 minutes.",
  backend_unavailable: "Deku Finance is unreachable right now. Please try again shortly.",
};

export function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (next !== confirm) {
      setMessage({ ok: false, text: "The two new passwords don't match." });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      if (res.ok) {
        setMessage({ ok: true, text: "Password changed. Other devices have been signed out." });
        setCurrent("");
        setNext("");
        setConfirm("");
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({ ok: false, text: ERRORS[data.error] ?? "The password couldn't be changed. Please try again." });
      }
    } catch {
      setMessage({ ok: false, text: ERRORS.backend_unavailable });
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-line bg-canvas text-xs text-ink";
  const fields = [
    { id: "current-password", label: "Current password", value: current, set: setCurrent, autoComplete: "current-password" },
    { id: "new-password", label: "New password", value: next, set: setNext, autoComplete: "new-password" },
    { id: "confirm-password", label: "Confirm new password", value: confirm, set: setConfirm, autoComplete: "new-password" },
  ];

  return (
    <div className="bg-surface border border-line-strong rounded-lg p-5 shadow-xs space-y-3">
      <h3 className="text-sm font-bold uppercase text-ink font-mono">Password</h3>
      <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-3">
        {fields.map((f) => (
          <div key={f.id}>
            <label htmlFor={f.id} className="block text-xs font-semibold text-ink-soft mb-1">
              {f.label}
            </label>
            <input
              id={f.id}
              type="password"
              required
              autoComplete={f.autoComplete}
              minLength={f.id === "current-password" ? undefined : MIN_PASSWORD_LENGTH}
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
              className={inputClass}
            />
          </div>
        ))}
        <div className="sm:col-span-3 flex items-center gap-3">
          <Button type="submit" size="sm" disabled={isSaving}>
            {isSaving ? "Saving…" : "Change password"}
          </Button>
          {message && (
            <span role="status" className={`text-xs ${message.ok ? "text-emerald-700" : "text-rose-700"}`}>
              {message.text}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
