"use client";

import React, { useState } from "react";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { organisationsApi } from "@/api/endpoints";
import { useAuth } from "@/context/AuthContext";
import { GST_STATES } from "@/lib/invoices/tax-summary";
import type { Organisation } from "@/types";
import { ProfileForm, formFromOrg, profileErrors, settingsFromForm } from "@/lib/organisation/profile";

const selectClass =
  "w-full h-9 rounded-md border border-line-strong bg-surface px-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20";

/** The company profile stored on the organisation record. Owners and admins can save it. */
export function CompanyProfileCard() {
  const { organisation } = useAuth();
  if (!organisation) return null;
  return <ProfileEditor key={organisation.id} organisation={organisation} />;
}

function ProfileEditor({ organisation }: { organisation: Organisation }) {
  const { refreshOrganisations } = useAuth();
  const [form, setForm] = useState<ProfileForm>(() => formFromOrg(organisation));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const errors = profileErrors(form);
  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.keys(errors).length > 0) return setMessage({ ok: false, text: "Fix the highlighted fields first." });
    setBusy(true);
    setMessage(null);
    try {
      await organisationsApi.updateSettings(organisation.id, settingsFromForm(form));
      await refreshOrganisations();
      setMessage({ ok: true, text: "Company profile saved." });
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4 rounded-lg border border-line-strong bg-surface p-5 shadow-xs">
      <div className="flex items-center gap-2 border-b border-line pb-3">
        <Landmark className="h-4 w-4 text-ink-muted" />
        <h3 className="font-mono text-sm font-bold uppercase text-ink">Company Profile</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="cp-mode" className="block text-sm font-medium text-ink-soft">Operating mode</label>
          <select id="cp-mode" value={form.mode} className={selectClass}
            onChange={(e) => set("mode", e.target.value as ProfileForm["mode"])}>
            <option value="gst">GST registered</option>
            <option value="pure">Not GST registered (Section 22)</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="cp-state" className="block text-sm font-medium text-ink-soft">State of registration</label>
          <select id="cp-state" value={form.stateCode} className={selectClass} onChange={(e) => set("stateCode", e.target.value)}>
            <option value="">Choose a state</option>
            {GST_STATES.map(([code, name]) => (
              <option key={code} value={code}>{code} – {name}</option>
            ))}
          </select>
          {errors.stateCode && <p className="text-xs text-rose-700">{errors.stateCode}</p>}
        </div>

        {form.mode === "gst" && (
          <>
            <Input id="cp-gstin" label="GSTIN" value={form.gstin} error={errors.gstin} maxLength={15}
              className="font-mono uppercase" onChange={(e) => set("gstin", e.target.value)} />
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" checked={form.compositionScheme} className="accent-brand"
                onChange={(e) => set("compositionScheme", e.target.checked)} />
              Composition scheme
            </label>
          </>
        )}

        <Input id="cp-line1" label="Registered address" value={form.address.line1 ?? ""}
          onChange={(e) => set("address", { ...form.address, line1: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input id="cp-city" label="City" value={form.address.city ?? ""}
            onChange={(e) => set("address", { ...form.address, city: e.target.value })} />
          <Input id="cp-pin" label="PIN code" inputMode="numeric" maxLength={6} value={form.address.pincode ?? ""}
            onChange={(e) => set("address", { ...form.address, pincode: e.target.value })} />
        </div>

        <Input id="cp-udyam" label="Udyam number" value={form.udyamNumber} error={errors.udyamNumber}
          placeholder="UDYAM-MH-01-0001234" className="font-mono uppercase" onChange={(e) => set("udyamNumber", e.target.value)} />
        <Input id="cp-upi" label="UPI ID" value={form.upiVpa} error={errors.upiVpa} placeholder="name@bank"
          autoComplete="off" spellCheck={false} onChange={(e) => set("upiVpa", e.target.value)} />

        <Input id="cp-bank" label="Bank name" value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
        <Input id="cp-beneficiary" label="Beneficiary name" value={form.bankBeneficiary}
          onChange={(e) => set("bankBeneficiary", e.target.value)} />
        <Input id="cp-account" label="Account number" value={form.bankAccountNumber} error={errors.bankAccountNumber}
          inputMode="numeric" autoComplete="off" className="font-mono" onChange={(e) => set("bankAccountNumber", e.target.value)} />
        <Input id="cp-ifsc" label="IFSC" value={form.bankIfsc} error={errors.bankIfsc} maxLength={11}
          autoComplete="off" spellCheck={false} className="font-mono uppercase" onChange={(e) => set("bankIfsc", e.target.value)} />
      </div>

      <p className="text-xs text-ink-muted">
        UPI and bank details are printed on invoices and used in Collections reminders. Only owners and admins can save.
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" isLoading={busy}>Save profile</Button>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-xs text-emerald-700" : "text-xs text-rose-700"}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
