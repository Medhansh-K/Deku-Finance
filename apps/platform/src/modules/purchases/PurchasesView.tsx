"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { useOptionalLearnDemo } from "@/context/LearnDemoContext";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { accountingApi, organisationsApi, partiesApi, purchasesApi } from "@/api/endpoints";
import type { Account, FiscalPeriod, Party } from "@/types/accounting";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally, toISODateString } from "@/lib/formatters/date";
import { parseMoneyPaise } from "@/lib/bank/statement-parser";
import { isValidGstin } from "@/lib/vouchers/invoice-text-parser";
import { ITC_HEADS } from "@/lib/gst/returns";
import {
  BillDraft,
  billKey,
  billPayload,
  billsInMonth,
  billTotal,
  computeTax,
  CsvBillRow,
  isIntraState,
  isStateCode,
  ITC_ELIGIBILITY_LABEL,
  ItcEligibility,
  itcTax,
  itcTotals,
  paise,
  parseBillsCsv,
  PurchaseBill,
  purchaseVoucherLines,
  validateBill,
  VoucherAccounts,
} from "@/lib/purchases/bills";
import {
  PurchaseOrdersTab,
  MaterialRequestsTab,
  ApPaymentCalendarTab,
  type PurchaseOrder,
} from "./ProcurementAndCalendarTabs";

type Tab = "add" | "bulk" | "register" | "orders" | "requisitions" | "calendar";

const fieldClass =
  "w-full h-9 rounded-ctl border border-line-strong bg-surface px-3 text-[13.5px] text-ink focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20";
const labelClass = "block text-[13px] font-medium text-ink-soft";
const rupees = (p: number) => formatINR(p / 100);

interface FormState {
  partyId: string;
  supplierName: string;
  gstin: string;
  billNumber: string;
  billDate: string;
  pos: string;
  taxable: string;
  rate: string;
  cgst: string;
  sgst: string;
  igst: string;
  cess: string;
  eligibility: ItcEligibility;
  reason: string;
  createVoucher: boolean;
  expenseAccountId: string;
  payableAccountId: string;
}

const emptyForm = (pos: string): FormState => ({
  partyId: "",
  supplierName: "",
  gstin: "",
  billNumber: "",
  billDate: "",
  pos,
  taxable: "",
  rate: "",
  cgst: "",
  sgst: "",
  igst: "",
  cess: "",
  eligibility: "eligible",
  reason: "",
  createVoucher: true,
  expenseAccountId: "",
  payableAccountId: "",
});

export function PurchasesView() {
  const [orgId, setOrgId] = useState("");
  const [month, setMonth] = useState("");
  const [tab, setTab] = useState<Tab>("add");
  const [companyGstin, setCompanyGstin] = useState<string | null>(null);
  const [requireApproval, setRequireApproval] = useState(false);
  const [parties, setParties] = useState<Party[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setOrgId(localStorage.getItem("deku_active_org_id") || "");
    setMonth(toISODateString().slice(0, 7));
  }, []);

  // shortcut: loads the whole register so duplicates are caught across periods; page by period when it gets large.
  const loadBills = useCallback(async () => {
    if (!orgId) return;
    try {
      setBills((await purchasesApi.list(orgId)).data || []);
    } catch (e) {
      setLoadError((e as Error).message || "Could not load purchase bills");
    }
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    Promise.all([
      organisationsApi.get(orgId),
      partiesApi.list(orgId),
      accountingApi.listAccounts(orgId),
      accountingApi.listFiscalPeriods(orgId),
    ])
      .then(([org, p, a, fp]) => {
        setCompanyGstin(org.data?.[0]?.gstin ?? null);
        setRequireApproval(org.data?.[0]?.require_journal_approval ?? false);
        setParties(p.data || []);
        setAccounts((a.data || []).filter((acc) => acc.is_postable));
        setPeriods(fp.data || []);
      })
      .catch((e) => setLoadError((e as Error).message || "Could not load company masters"));
    loadBills();
  }, [orgId, loadBills]);

  const existing = useMemo(() => new Set(bills.map((b) => billKey(b.supplier_gstin, b.bill_number))), [bills]);
  const totals = useMemo(() => itcTotals(bills, month), [bills, month]);

  if (!orgId) return <p className="text-[13.5px] text-ink-muted">Select a company to see its purchase register.</p>;

  const tabs: { id: Tab; label: string }[] = [
    { id: "add", label: "Add purchase bill" },
    { id: "bulk", label: "Bulk upload" },
    { id: "register", label: "Register" },
    { id: "orders", label: "Purchase orders" },
    { id: "requisitions", label: "Material requests" },
    { id: "calendar", label: "AP payment calendar (MSME)" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-44">
          <Input label="Period" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <p className="text-[12.5px] text-ink-muted max-w-md">
          ITC is placed in the month of the bill date. GSTR-3B Table 4 is built from these bills once any exist for the
          month.
        </p>
      </div>

      {loadError && <Notice tone="error">{loadError}</Notice>}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Eligible ITC" value={rupees(itcTax(totals.eligible))} hint="4(A)(5) All other ITC" />
        <StatCard
          label="Blocked ITC"
          value={rupees(itcTax(totals.blocked) + itcTax(totals.ineligible))}
          hint={`17(5) ${rupees(itcTax(totals.blocked))} · other ${rupees(itcTax(totals.ineligible))}`}
        />
        <StatCard label="Bills in period" value={String(totals.count)} hint={month || "No period chosen"} />
      </div>

      <div className="rounded-panel border border-line bg-surface">
        <div data-tour="purchases-tabs" role="tablist" className="flex gap-1 border-b border-line px-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-3 text-[13.5px] border-b-2 -mb-px transition-colors ${
                tab === t.id ? "border-brand text-ink font-medium" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === "add" && (
            <AddBill
              key={companyGstin ?? ""} // remount so the place of supply defaults to the company's state once loaded
              orgId={orgId}
              companyGstin={companyGstin}
              requireApproval={requireApproval}
              parties={parties}
              accounts={accounts}
              periods={periods}
              existing={existing}
              onSaved={loadBills}
            />
          )}
          {tab === "bulk" && (
            <BulkUpload
              orgId={orgId}
              companyGstin={companyGstin}
              parties={parties}
              existing={existing}
              onImported={loadBills}
            />
          )}
          {tab === "register" && <Register orgId={orgId} bills={bills} month={month} onChanged={loadBills} />}
          {tab === "orders" && (
            <PurchaseOrdersTab
              parties={parties}
              onConvertToBill={(po) => {
                setTab("add");
              }}
            />
          )}
          {tab === "requisitions" && <MaterialRequestsTab />}
          {tab === "calendar" && <ApPaymentCalendarTab />}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-panel border border-line bg-surface p-5">
      <p className="text-[13px] text-ink-muted">{label}</p>
      <p className="mt-1.5 tabular-nums text-[26px] font-semibold tracking-[-0.035em] text-ink">{value}</p>
      <p className="mt-0.5 text-[12.5px] text-ink-muted">{hint}</p>
    </div>
  );
}

function Notice({ tone, children }: { tone: "error" | "ok"; children: React.ReactNode }) {
  const cls =
    tone === "error" ? "border-bad/25 bg-bad-wash text-bad" : "border-ok/25 bg-ok-wash text-ok";
  const Icon = tone === "error" ? AlertTriangle : CheckCircle2;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-2 rounded-ctl border p-3 text-[13.5px] ${cls}`}>
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

function AddBill({
  orgId,
  companyGstin,
  requireApproval,
  parties,
  accounts,
  periods,
  existing,
  onSaved,
}: {
  orgId: string;
  companyGstin: string | null;
  requireApproval: boolean;
  parties: Party[];
  accounts: Account[];
  periods: FiscalPeriod[];
  existing: Set<string>;
  onSaved: () => Promise<void>;
}) {
  const demo = useOptionalLearnDemo();
  const ownState = (companyGstin ?? "").slice(0, 2);
  const [f, setF] = useState<FormState>(() => emptyForm(ownState));
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const suppliers = parties.filter((p) => p.type !== "customer");
  const inputLedgers = useMemo(() => {
    const input: VoucherAccounts["input"] = {};
    for (const a of accounts) {
      const head = ITC_HEADS.find(([re]) => re.test(a.name));
      if (head && !input[head[1]]) input[head[1]] = a.id;
    }
    return input;
  }, [accounts]);

  // Taxes follow the rate until the user types a tax figure directly.
  const update = (patch: Partial<FormState>) =>
    setF((prev) => {
      const next = { ...prev, ...patch };
      const rateTouched = "taxable" in patch || "rate" in patch || "gstin" in patch || "pos" in patch;
      const taxable = parseMoneyPaise(next.taxable);
      const rate = Number(next.rate);
      if (rateTouched && next.rate.trim() !== "" && rate >= 0 && taxable !== null && !Number.isNaN(taxable)) {
        const intra = isIntraState(next.gstin.toUpperCase(), next.pos);
        const t = computeTax(taxable, rate, intra);
        const fmt = (p: number) => (p / 100).toFixed(2);
        Object.assign(next, { cgst: fmt(t.cgst), sgst: fmt(t.sgst), igst: fmt(t.igst) });
      }
      return next;
    });

  const pickSupplier = (id: string) => {
    const p = parties.find((x) => x.id === id);
    update({ partyId: id, supplierName: p?.legal_name ?? "", gstin: (p?.gstin ?? "").toUpperCase() });
  };

  const draft: BillDraft = {
    party_id: f.partyId || null,
    supplier_name: f.supplierName,
    supplier_gstin: f.gstin.trim().toUpperCase(),
    bill_number: f.billNumber,
    bill_date: f.billDate,
    place_of_supply: f.pos.trim(),
    // A blank tax box means no such tax; text that is not a number stays NaN so validation reports it.
    taxable: parseMoneyPaise(f.taxable),
    cgst: parseMoneyPaise(f.cgst) ?? 0,
    sgst: parseMoneyPaise(f.sgst) ?? 0,
    igst: parseMoneyPaise(f.igst) ?? 0,
    cess: parseMoneyPaise(f.cess) ?? 0,
    itc_eligibility: f.eligibility,
    blocked_reason: f.reason,
  };
  const gstinError =
    f.gstin.trim() && !isValidGstin(f.gstin.trim()) ? "Not a valid GSTIN (check digit or format)" : undefined;

  const submit = async () => {
    setNotice(null);
    const errs = validateBill(draft, existing);
    const voucher = f.createVoucher
      ? purchaseVoucherLines(draft, { expense: f.expenseAccountId, payable: f.payableAccountId, input: inputLedgers })
      : null;
    const period = periods.find((p) => p.status === "open" && p.start_date <= f.billDate && f.billDate <= p.end_date);
    if (voucher) {
      errs.push(...voucher.errors);
      if (f.billDate && !period) errs.push(`No open fiscal period covers ${f.billDate}, so the voucher cannot be created`);
    }
    setErrors(errs);
    if (errs.length) return;

    setBusy(true);
    try {
      const saved = (await purchasesApi.create(orgId, billPayload(draft))).data?.[0];
      let message = `Bill ${draft.bill_number.trim()} added to the register.`;
      if (voucher && saved && period) {
        try {
          const res = await accountingApi.createJournal(orgId, {
            fiscal_period_id: period.id,
            entry_number: `PUR-${draft.supplier_gstin}-${draft.bill_number.trim()}`,
            entry_date: draft.bill_date,
            narration: `[PURCHASE] Bill ${draft.bill_number.trim()} from ${draft.supplier_name.trim()}`,
            reference: draft.bill_number.trim(),
            lines: voucher.lines,
          });
          const entryId: string | undefined = res.entry?.[0]?.id;
          if (!entryId) throw new Error("the journal API returned no entry id");
          // Maker-checker: with approvals on the voucher waits for a second person, as in VoucherWorkspace.
          if (requireApproval) await accountingApi.submitJournal(orgId, entryId);
          else await accountingApi.postJournal(orgId, entryId);
          await purchasesApi.linkJournal(orgId, saved.id, entryId);
          message += requireApproval
            ? " Its purchase voucher was submitted for approval."
            : " Its purchase voucher was posted to the ledger.";
        } catch (e) {
          setErrors([`Bill saved, but the purchase voucher was not completed: ${(e as Error).message}`]);
        }
      }
      setNotice(message);
      setF({ ...emptyForm(ownState), createVoucher: f.createVoucher, expenseAccountId: f.expenseAccountId, payableAccountId: f.payableAccountId });
      await onSaved();
    } catch (e) {
      setErrors([(e as Error).message || "Could not save the bill"]);
    } finally {
      setBusy(false);
    }
  };

  const intra = isStateCode(f.pos.trim()) && isValidGstin(draft.supplier_gstin) ? isIntraState(draft.supplier_gstin, f.pos.trim()) : null;
  const expenseAccounts = accounts.filter((a) => a.type === "expense" || a.type === "asset");
  const payableAccounts = accounts.filter((a) => a.type === "liability");

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {notice && <Notice tone="ok">{notice}</Notice>}
      {demo && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-ctl border border-brand/30 bg-brand-wash px-3 py-2 text-[13px]">
          <span className="text-ink-soft">
            Need quick sample values? Autofill a realistic supplier bill, then click <strong>Save</strong> yourself.
          </span>
          <button
            type="button"
            data-tour="purchase-autofill"
            onClick={() => {
              const sup = suppliers[0];
              const expAcc = expenseAccounts.find((a) => a.code === "5010" || a.code === "5020") ?? expenseAccounts[0];
              const apAcc = payableAccounts.find((a) => a.code === "2010") ?? payableAccounts[0];
              update({
                partyId: sup?.id || "",
                supplierName: sup?.legal_name || "Sample Supplier Pvt Ltd",
                gstin: (sup?.gstin || companyGstin || "").toUpperCase(),
                billNumber: `DEMO-PB-${String(existing.size + 101)}`,
                billDate: toISODateString(),
                pos: ownState || "27",
                taxable: "50000",
                rate: "18",
                eligibility: "eligible",
                createVoucher: true,
                expenseAccountId: expAcc?.id || "",
                payableAccountId: apAcc?.id || "",
              });
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-ctl border border-brand/30 bg-surface px-3 text-[13px] font-medium text-brand-strong hover:bg-brand-wash-strong cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-brand-strong" />
            <span>Autofill sample bill</span>
          </button>
        </div>
      )}
      {errors.length > 0 && (
        <Notice tone="error">
          <ul className="list-disc pl-4 space-y-0.5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Notice>
      )}

      <fieldset className="grid gap-4 md:grid-cols-3">
        <legend className="mb-2 text-[15px] font-semibold tracking-tight text-ink">Supplier and bill</legend>
        <label className="space-y-1">
          <span className={labelClass}>Supplier (from Parties)</span>
          <select className={fieldClass} value={f.partyId} onChange={(e) => pickSupplier(e.target.value)}>
            <option value="">Choose a supplier…</option>
            {suppliers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name || p.legal_name}
                {p.gstin ? ` · ${p.gstin}` : " · no GSTIN"}
              </option>
            ))}
          </select>
        </label>
        <Input label="Supplier name" value={f.supplierName} onChange={(e) => update({ supplierName: e.target.value })} />
        <Input
          label="Supplier GSTIN"
          value={f.gstin}
          error={gstinError}
          maxLength={15}
          onChange={(e) => update({ gstin: e.target.value.toUpperCase() })}
        />
        <Input label="Bill number" value={f.billNumber} onChange={(e) => update({ billNumber: e.target.value })} />
        <Input label="Bill date" type="date" value={f.billDate} onChange={(e) => update({ billDate: e.target.value })} />
        <Input
          label="Place of supply (state code)"
          value={f.pos}
          maxLength={2}
          inputMode="numeric"
          placeholder="27"
          error={f.pos && !isStateCode(f.pos.trim()) ? "Use a two-digit state code (01-38, 97)" : undefined}
          onChange={(e) => update({ pos: e.target.value.replace(/\D/g, "") })}
        />
      </fieldset>

      <fieldset className="grid gap-4 md:grid-cols-6">
        <legend className="mb-2 text-[15px] font-semibold tracking-tight text-ink">
          Amounts{" "}
          {intra !== null && (
            <span className="font-normal text-ink-muted">({intra ? "intra-state: CGST + SGST" : "inter-state: IGST"})</span>
          )}
        </legend>
        <Input label="Taxable value" isNumeric prefixSymbol="₹" value={f.taxable} onChange={(e) => update({ taxable: e.target.value })} />
        <Input label="GST rate" isNumeric suffixSymbol="%" value={f.rate} onChange={(e) => update({ rate: e.target.value })} />
        <Input label="CGST" isNumeric prefixSymbol="₹" value={f.cgst} onChange={(e) => update({ cgst: e.target.value })} />
        <Input label="SGST" isNumeric prefixSymbol="₹" value={f.sgst} onChange={(e) => update({ sgst: e.target.value })} />
        <Input label="IGST" isNumeric prefixSymbol="₹" value={f.igst} onChange={(e) => update({ igst: e.target.value })} />
        <Input label="Cess" isNumeric prefixSymbol="₹" value={f.cess} onChange={(e) => update({ cess: e.target.value })} />
        <p className="md:col-span-6 text-[13.5px] text-ink-muted">
          Bill total <span className="tabular-nums font-semibold text-ink">{rupees(billTotal(draft))}</span>
        </p>
      </fieldset>

      <fieldset className="grid gap-4 md:grid-cols-3">
        <legend className="mb-2 text-[15px] font-semibold tracking-tight text-ink">Input tax credit</legend>
        <label className="space-y-1">
          <span className={labelClass}>ITC eligibility</span>
          <select
            className={fieldClass}
            data-tour="purchases-itc" value={f.eligibility}
            onChange={(e) => update({ eligibility: e.target.value as ItcEligibility })}
          >
            {(Object.keys(ITC_ELIGIBILITY_LABEL) as ItcEligibility[]).map((k) => (
              <option key={k} value={k}>
                {ITC_ELIGIBILITY_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        {f.eligibility !== "eligible" && (
          <div className="md:col-span-2">
            <Input
              label="Reason (required)"
              placeholder="e.g. Motor vehicle for personal use, 17(5)(a)"
              value={f.reason}
              onChange={(e) => update({ reason: e.target.value })}
            />
          </div>
        )}
      </fieldset>

      <fieldset data-tour="purchases-voucher" className="space-y-3 rounded-ctl border border-line bg-canvas p-4">
        <label className="flex items-center gap-2 text-[13.5px] text-ink">
          <input
            type="checkbox"
            checked={f.createVoucher}
            onChange={(e) => update({ createVoucher: e.target.checked })}
          />
          Also create the purchase voucher
          {requireApproval && <Badge variant="warning">Goes to approvals</Badge>}
        </label>
        {f.createVoucher && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className={labelClass}>Debit (purchase or expense ledger)</span>
              <select className={fieldClass} value={f.expenseAccountId} onChange={(e) => update({ expenseAccountId: e.target.value })}>
                <option value="">Choose a ledger…</option>
                {expenseAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className={labelClass}>Credit (supplier payable ledger)</span>
              <select className={fieldClass} value={f.payableAccountId} onChange={(e) => update({ payableAccountId: e.target.value })}>
                <option value="">Choose a ledger…</option>
                {payableAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="md:col-span-2 text-[12.5px] text-ink-muted">
              Eligible tax is debited to the Input CGST/SGST/IGST ledgers; blocked or ineligible tax is added to the
              purchase cost.
            </p>
          </div>
        )}
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" variant="tally" isLoading={busy}>
          {f.createVoucher ? (requireApproval ? "Save bill and submit voucher" : "Save bill and post voucher") : "Save bill"}
        </Button>
      </div>
    </form>
  );
}

function BulkUpload({
  orgId,
  companyGstin,
  parties,
  existing,
  onImported,
}: {
  orgId: string;
  companyGstin: string | null;
  parties: Party[];
  existing: Set<string>;
  onImported: () => Promise<void>;
}) {
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<{ rows: CsvBillRow[]; fileError: string | null } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: string[] } | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setConfirming(false);
    setParsed(parseBillsCsv(await file.text(), { companyGstin, existing }));
  };

  const valid = parsed?.rows.filter((r) => r.errors.length === 0) ?? [];
  const byGstin = new Map(parties.filter((p) => p.gstin).map((p) => [p.gstin!.toUpperCase(), p.id]));

  const importRows = async () => {
    setBusy(true);
    const failed: string[] = [];
    let ok = 0;
    for (const r of valid) {
      try {
        await purchasesApi.create(orgId, billPayload({ ...r.draft, party_id: byGstin.get(r.draft.supplier_gstin) ?? null }));
        ok++;
      } catch (e) {
        failed.push(`Row ${r.row} (${r.draft.bill_number}): ${(e as Error).message}`);
      }
    }
    setResult({ ok, failed });
    setParsed(null);
    setConfirming(false);
    setBusy(false);
    await onImported();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-ctl border border-dashed border-line-strong px-3 text-[13.5px] text-ink hover:bg-canvas">
          <UploadCloud className="h-4 w-4 text-ink-muted" />
          {fileName || "Choose a CSV file"}
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
        </label>
        <p className="max-w-xl text-[12.5px] text-ink-muted">
          Columns: Supplier GSTIN, Supplier Name, Invoice No, Invoice Date, Taxable Value, CGST, SGST, IGST. Optional:
          Cess, Place of Supply, ITC Eligibility (eligible / blocked / ineligible), Reason. Without an ITC Eligibility
          column every row is imported as eligible. The file is read in your browser; only valid rows are sent to Deku.
        </p>
      </div>

      {result && (
        <Notice tone={result.failed.length ? "error" : "ok"}>
          <p>
            {result.ok} bill{result.ok === 1 ? "" : "s"} imported.
            {result.failed.length > 0 && ` ${result.failed.length} could not be saved:`}
          </p>
          {result.failed.length > 0 && (
            <ul className="list-disc pl-4">
              {result.failed.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}

      {parsed?.fileError && <Notice tone="error">{parsed.fileError}</Notice>}

      {parsed && !parsed.fileError && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="success">{valid.length} valid</Badge>
            <Badge variant={parsed.rows.length - valid.length ? "danger" : "default"}>
              {parsed.rows.length - valid.length} with errors
            </Badge>
            <div className="ml-auto flex items-center gap-2">
              {confirming ? (
                <>
                  <span className="text-[13.5px] text-ink">
                    Import {valid.length} bill{valid.length === 1 ? "" : "s"}? Rows with errors are skipped.
                  </span>
                  <Button variant="tally" size="sm" isLoading={busy} onClick={importRows}>
                    Confirm import
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button variant="tally" size="sm" disabled={valid.length === 0} onClick={() => setConfirming(true)}>
                  Import valid rows
                </Button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto rounded-panel border border-line bg-surface">
            <table className="w-full border-collapse text-left text-[13.5px]">
              <thead className="bg-[#fafbfa] text-[12.5px] text-ink-muted">
                <tr>
                  {["Row", "Status", "Supplier", "GSTIN", "Bill no", "Date", "POS", "Taxable", "Tax", "ITC"].map((h) => (
                    <th key={h} className={`px-3 py-2.5 font-medium ${h === "Taxable" || h === "Tax" ? "text-right" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((r) => {
                  const d = r.draft;
                  const tax = (d.cgst ?? 0) + (d.sgst ?? 0) + (d.igst ?? 0) + (d.cess ?? 0);
                  return (
                    <tr key={r.row} className="border-t border-line align-top">
                      <td className="px-3 py-2 text-ink-muted">{r.row}</td>
                      <td className="px-3 py-2">
                        {r.errors.length ? (
                          <div className="space-y-0.5 text-[13px] text-bad">
                            {r.errors.map((e) => (
                              <p key={e}>{e}</p>
                            ))}
                          </div>
                        ) : (
                          <Badge variant="success">Valid</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-ink">{d.supplier_name}</td>
                      <td className="px-3 py-2 font-mono text-[13px] text-ink">{d.supplier_gstin}</td>
                      <td className="px-3 py-2 text-ink">{d.bill_number}</td>
                      <td className="px-3 py-2 text-ink">{d.bill_date && formatDateTally(d.bill_date)}</td>
                      <td className="px-3 py-2 text-ink">{d.place_of_supply}</td>
                      <td className="px-3 py-2 text-right text-ink">
                        {d.taxable === null || Number.isNaN(d.taxable) ? "–" : rupees(d.taxable)}
                      </td>
                      <td className="px-3 py-2 text-right text-ink">{Number.isNaN(tax) ? "–" : rupees(tax)}</td>
                      <td className="px-3 py-2 text-ink">{ITC_ELIGIBILITY_LABEL[d.itc_eligibility]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Register({
  orgId,
  bills,
  month,
  onChanged,
}: {
  orgId: string;
  bills: PurchaseBill[];
  month: string;
  onChanged: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [allPeriods, setAllPeriods] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const rows = (allPeriods ? bills : billsInMonth(bills, month)).filter(
    (b) =>
      !q ||
      b.supplier_name.toLowerCase().includes(q) ||
      b.supplier_gstin.toLowerCase().includes(q) ||
      b.bill_number.toLowerCase().includes(q)
  );

  const remove = async (b: PurchaseBill) => {
    if (!window.confirm(`Delete bill ${b.bill_number} from ${b.supplier_name}?`)) return;
    setError(null);
    try {
      await purchasesApi.remove(orgId, b.id);
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-72">
          <Input
            label="Search"
            placeholder="Supplier, GSTIN or bill number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-[13.5px] text-ink">
          <input type="checkbox" checked={allPeriods} onChange={(e) => setAllPeriods(e.target.checked)} />
          All periods
        </label>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="overflow-x-auto rounded-panel border border-line bg-surface">
        <table className="w-full border-collapse text-left text-[13.5px]">
          <thead className="bg-[#fafbfa] text-[12.5px] text-ink-muted">
            <tr>
              {["Date", "Supplier", "GSTIN", "Bill no", "Taxable", "CGST", "SGST", "IGST", "Cess", "Total", "ITC", "Voucher", ""].map(
                (h, i) => (
                  <th key={i} className={`px-3 py-2.5 font-medium ${i >= 4 && i <= 9 ? "text-right" : ""}`}>
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={13} className="px-3 py-6 text-center text-ink-muted">
                  No purchase bills {allPeriods ? "" : "in this period"}
                  {q ? " match the search" : ""}.
                </td>
              </tr>
            )}
            {rows.map((b) => (
              <tr key={b.id} className="border-t border-line">
                <td className="px-3 py-2 text-ink-soft whitespace-nowrap">{formatDateTally(b.bill_date)}</td>
                <td className="px-3 py-2 text-ink">{b.supplier_name}</td>
                <td className="px-3 py-2 font-mono text-[13px] text-ink">{b.supplier_gstin}</td>
                <td className="px-3 py-2 text-ink">{b.bill_number}</td>
                {[b.taxable_amount, b.cgst, b.sgst, b.igst, b.cess, b.total_amount].map((v, i) => (
                  <td key={i} className={`px-3 py-2 text-right text-ink whitespace-nowrap ${i === 5 ? "font-medium" : ""}`}>
                    {rupees(paise(v))}
                  </td>
                ))}
                <td className="px-3 py-2">
                  <Badge variant={b.itc_eligibility === "eligible" ? "success" : "warning"}>
                    {ITC_ELIGIBILITY_LABEL[b.itc_eligibility]}
                  </Badge>
                  {b.blocked_reason && <p className="mt-0.5 text-[12.5px] text-ink-muted">{b.blocked_reason}</p>}
                </td>
                <td className="px-3 py-2 text-ink-muted">{b.journal_entry_id ? "Linked" : "Not in books"}</td>
                <td className="px-3 py-2">
                  {!b.journal_entry_id && (
                    <Button variant="ghost" size="sm" aria-label={`Delete bill ${b.bill_number}`} onClick={() => remove(b)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
