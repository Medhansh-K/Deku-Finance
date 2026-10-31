"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { accountingApi, organisationsApi } from "@/api/endpoints";
import type { Organisation } from "@/types";
import { GST_STATES } from "@/lib/invoices/tax-summary";
import {
  OnboardingStep,
  ProfileForm,
  currentFiscalPeriod,
  formFromOrg,
  onboardingSteps,
  profileErrors,
  settingsFromForm,
  stepError,
} from "@/lib/organisation/profile";

const STEP_TITLES: Record<OnboardingStep, string> = {
  mode: "How does your business work?",
  details: "Business details",
  gstin: "GST registration",
  fiscal: "First financial year",
  accounts: "Chart of accounts",
};

const selectClass =
  "w-full h-9 rounded-md border border-line-strong bg-surface px-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20";

export default function OnboardingPage() {
  const { organisation } = useAuth();
  if (!organisation) {
    return <main className="min-h-screen bg-canvas p-8 text-sm text-ink-muted">Loading your company…</main>;
  }
  // Keyed so the form starts from this company's saved profile.
  return <Wizard key={organisation.id} organisation={organisation} />;
}

function Wizard({ organisation }: { organisation: Organisation }) {
  const router = useRouter();
  const { refreshOrganisations } = useAuth();
  const [form, setForm] = useState<ProfileForm>(() => formFromOrg(organisation));
  const [period, setPeriod] = useState(() => currentFiscalPeriod(new Date(), organisation.fy_start_month));
  const [step, setStep] = useState<OnboardingStep>("mode");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orgId = organisation.id;
  const steps = onboardingSteps(form.mode);
  const index = steps.indexOf(step);
  const errors = profileErrors(form);
  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    const blocked = stepError(step, form);
    if (blocked) return setError(blocked);
    setError(null);
    if (step !== "fiscal") return setStep(steps[index + 1]);
    // Save the profile, then open the first financial year unless one already exists (a retried wizard).
    void run(async () => {
      if (!period.name.trim() || !period.start_date || !period.end_date || period.end_date <= period.start_date)
        throw new Error("Enter a name and an end date after the start date.");
      await organisationsApi.updateSettings(orgId, settingsFromForm(form));
      const existing = (await accountingApi.listFiscalPeriods(orgId)).data ?? [];
      if (existing.length === 0) await accountingApi.createFiscalPeriod(orgId, period);
      setStep("accounts");
    });
  };

  const finish = () =>
    run(async () => {
      await accountingApi.seedAccounts(orgId);
      await organisationsApi.updateSettings(orgId, { onboarded: true });
      await refreshOrganisations();
      router.replace("/gateway");
    });

  return (
    <main className="min-h-screen bg-canvas px-4 py-10 text-ink">
      <div className="mx-auto max-w-xl space-y-5 rounded-lg border border-line bg-surface p-6 shadow-card">
        <header className="space-y-1">
          <p className="text-xs font-medium text-ink-muted">
            Set up {organisation.name} · step {index + 1} of {steps.length}
          </p>
          <h1 className="text-lg font-semibold">{STEP_TITLES[step]}</h1>
        </header>

        {step === "mode" && (
          <fieldset className="space-y-2">
            <legend className="sr-only">Operating mode</legend>
            {(
              [
                ["gst", "GST registered", "Tax invoices with CGST/SGST/IGST, GSTR-1 and GSTR-3B."],
                ["pure", "Not GST registered", "Plain bookkeeping under the Section 22 threshold; no GST on invoices."],
              ] as const
            ).map(([value, label, hint]) => (
              <label key={value} className="flex cursor-pointer gap-3 rounded-md border border-line-strong p-3 has-[:checked]:border-brand">
                <input
                  type="radio"
                  name="mode"
                  value={value}
                  checked={form.mode === value}
                  onChange={() => set("mode", value)}
                  className="mt-1 accent-brand"
                />
                <span>
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block text-xs text-ink-muted">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {step === "details" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="ob-state" className="block text-sm font-medium text-ink-soft">
                State of registration
              </label>
              <select id="ob-state" value={form.stateCode} onChange={(e) => set("stateCode", e.target.value)} className={selectClass}>
                <option value="">Choose a state</option>
                {GST_STATES.map(([code, name]) => (
                  <option key={code} value={code}>
                    {code} – {name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              id="ob-line1"
              label="Registered address"
              value={form.address.line1 ?? ""}
              onChange={(e) => set("address", { ...form.address, line1: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input id="ob-city" label="City" value={form.address.city ?? ""}
                onChange={(e) => set("address", { ...form.address, city: e.target.value })} />
              <Input id="ob-pin" label="PIN code" inputMode="numeric" maxLength={6} value={form.address.pincode ?? ""}
                onChange={(e) => set("address", { ...form.address, pincode: e.target.value })} />
            </div>
            <Input id="ob-udyam" label="Udyam number (optional)" value={form.udyamNumber} error={errors.udyamNumber}
              placeholder="UDYAM-MH-01-0001234" className="font-mono uppercase"
              onChange={(e) => set("udyamNumber", e.target.value)} />
          </div>
        )}

        {step === "gstin" && (
          <div className="space-y-3">
            <Input id="ob-gstin" label="GSTIN" value={form.gstin} error={form.gstin ? errors.gstin : undefined}
              maxLength={15} className="font-mono uppercase" onChange={(e) => set("gstin", e.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.compositionScheme} className="accent-brand"
                onChange={(e) => set("compositionScheme", e.target.checked)} />
              Registered under the composition scheme
            </label>
          </div>
        )}

        {step === "fiscal" && (
          <div className="space-y-3">
            <p className="text-xs text-ink-muted">Vouchers can only be posted inside an open financial year.</p>
            <Input id="ob-fy-name" label="Name" value={period.name} onChange={(e) => setPeriod({ ...period, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input id="ob-fy-start" label="Starts" type="date" value={period.start_date}
                onChange={(e) => setPeriod({ ...period, start_date: e.target.value })} />
              <Input id="ob-fy-end" label="Ends" type="date" value={period.end_date}
                onChange={(e) => setPeriod({ ...period, end_date: e.target.value })} />
            </div>
          </div>
        )}

        {step === "accounts" && (
          <p className="text-sm text-ink-soft">
            Deku creates the standard chart of accounts (assets, liabilities, income, expenses and GST ledgers). You can add
            or rename accounts later under Masters.
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="flex justify-between border-t border-line pt-4">
          <Button variant="secondary" size="sm" disabled={index === 0 || busy || step === "accounts"}
            onClick={() => setStep(steps[index - 1])}>
            Back
          </Button>
          {step === "accounts" ? (
            <Button size="sm" isLoading={busy} onClick={finish}>
              Create accounts and finish
            </Button>
          ) : (
            <Button size="sm" isLoading={busy} onClick={next}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
