"use client";

import React from "react";
import Link from "next/link";
import { FileText, Paperclip, Pencil, Printer, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { filesApi } from "@/api/endpoints";
import type { JournalEntry, SalesInvoice } from "@/types/accounting";
import type { VoucherItem } from "@/lib/reports/vouchers";
import { formatINR } from "@/lib/formatters/currency";
import { memberName, roleLabel, type OrgMember } from "@/modules/departments-members/team";

export const money = (n: number) => formatINR(n, { minimumFractionDigits: 0 });

/** Date-only strings ("2026-11-09") are calendar dates, so read them in UTC to keep the day. */
export function formatDay(d: string | null | undefined, withYear = false): string {
  if (!d) return "–";
  const date = new Date(d.length === 10 ? `${d}T00:00:00Z` : d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(withYear && { year: "numeric" }), timeZone: "UTC" });
}

function formatStamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? null
    : d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const CHIP = "inline-flex items-center h-[22px] px-2 rounded-chip text-xs font-medium whitespace-nowrap";

export function statusChip(v: VoucherItem, long = false) {
  if (v.status === "posted") return <span className={`${CHIP} bg-ok-wash text-ok`}>{long ? "Posted to ledger" : "Posted"}</span>;
  if (v.status === "reversed") return <span className={`${CHIP} bg-bad-wash text-bad`}>Reversed</span>;
  if (v.submitted_at) return <span className={`${CHIP} bg-warn-wash text-warn`}>Awaiting approval</span>;
  if (v.rejection_reason) return <span className={`${CHIP} bg-bad-wash text-bad`}>Sent back</span>;
  return <span className={`${CHIP} bg-warn-wash text-warn`}>Draft</span>;
}

/** Party in bold, narration under it; a voucher with no party leads with its narration and first line's note. */
export function particulars(v: VoucherItem): [string, string] {
  return v.party_name && v.party_name !== "–"
    ? [v.party_name, v.narration]
    : [v.narration || v.source_document, v.lines[0]?.description || v.source_document];
}

const SUPPLY: Record<string, string> = { intra_state: "Intra-state", inter_state: "Inter-state", export: "Export" };

function supplyText(inv: SalesInvoice): string {
  const tax = (inv.igst_amount ?? 0) > 0 ? "IGST" : (inv.cgst_amount ?? 0) > 0 ? "CGST + SGST" : "";
  return [SUPPLY[inv.supply_type] ?? inv.supply_type, tax].filter(Boolean).join(", ");
}

interface TrailStep {
  label: string;
  userId?: string | null;
  at?: string | null;
  /** Shown instead of a person when nobody is recorded for this step. */
  missing?: string;
  note?: string;
}

/** Who made, submitted and approved or rejected the voucher, from the columns migration 20 records. */
export function approvalTrail(v: VoucherItem, j: JournalEntry | undefined): TrailStep[] {
  if (!j) return [];
  const steps: TrailStep[] = [
    { label: "Created by", userId: j.created_by, at: j.created_at, missing: "No creator was stamped on this voucher" },
  ];
  const posted = v.status === "posted" || v.status === "reversed";
  if (j.submitted_by || j.submitted_at) {
    steps.push({ label: "Submitted for approval by", userId: j.submitted_by, at: j.submitted_at, missing: "Submitted, but the submitter was not stamped" });
  } else {
    steps.push({
      label: "Submitted for approval by",
      missing: posted ? "Posted directly, no approval step" : j.rejected_at ? "Sent back, not resubmitted yet" : "Not submitted yet",
    });
  }
  if (posted) {
    steps.push({
      label: j.submitted_at ? "Approved and posted by" : "Posted by",
      userId: j.posted_by,
      at: j.posted_at,
      missing: "No approver was stamped on this voucher",
    });
  } else if (j.rejected_at || j.rejected_by) {
    steps.push({ label: "Rejected by", userId: j.rejected_by, at: j.rejected_at, missing: "The reviewer was not stamped", note: j.rejection_reason ?? undefined });
  } else {
    steps.push({ label: "Approved and posted by", missing: j.submitted_at ? "Awaiting approval" : "Not posted yet" });
  }
  return steps;
}

function TrailPerson({ step, members }: { step: TrailStep; members: OrgMember[] | null }) {
  const when = formatStamp(step.at);
  if (!step.userId) {
    return (
      <div>
        <div className="text-ink-muted">Not recorded</div>
        <div className="text-[12.5px] text-ink-subtle">{step.missing}</div>
        {when && <div className="text-[12.5px] text-ink-muted">{when}</div>}
      </div>
    );
  }
  const m = members?.find((x) => x.user_id === step.userId);
  const role = m ? roleLabel(m.role) : null;
  // Demo and some real profiles carry the role in the name, e.g. "Meera Joshi (CFO)".
  const name = m ? memberName(m).replace(` (${role})`, "") : members ? "Former member" : "Member list unavailable";
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={m ? "font-[550] text-ink" : "text-ink-muted"}>{name}</span>
        {role && <span className={`${CHIP} bg-canvas-sunken text-ink-soft`}>{role}</span>}
      </div>
      <div className="text-[12.5px] text-ink-muted">{when ?? "Time not recorded"}</div>
    </div>
  );
}

export interface VoucherDrawerProps {
  entry: VoucherItem;
  journal?: JournalEntry;
  invoice?: SalesInvoice;
  members: OrgMember[] | null;
  partyNames: Map<string, string>;
  orgId: string;
  isActionPending: boolean;
  onClose: () => void;
  onPrint: () => void;
  onReverse: () => void;
  onEdit: () => void;
  onPost: () => void;
  onAttach: (file: File | undefined) => void;
}

export function VoucherDrawer({
  entry,
  journal,
  invoice,
  members,
  partyNames,
  orgId,
  isActionPending,
  onClose,
  onPrint,
  onReverse,
  onEdit,
  onPost,
  onAttach,
}: VoucherDrawerProps) {
  const [title] = particulars(entry);
  const subtitle = entry.party_name !== "–" ? entry.narration : "";
  const totalDr = entry.lines.reduce((s, l) => s + l.debit, 0);
  const totalCr = entry.lines.reduce((s, l) => s + l.credit, 0);
  const source = invoice
    ? `Invoice ${invoice.invoice_number}`
    : entry.reference && entry.reference !== entry.entry_number
    ? entry.reference
    : entry.source_document;
  const proof = entry.document_proof;
  const trail = approvalTrail(entry, journal);

  return (
    <aside
      aria-labelledby="day-book-drawer-title"
      className="fixed inset-0 z-40 overflow-y-auto bg-surface lg:sticky lg:inset-auto lg:top-4 lg:z-auto lg:max-h-[calc(100vh-2rem)] lg:self-start lg:rounded-panel lg:border lg:border-line lg:shadow-pop"
    >
      <div className="border-b border-line px-5 pt-[18px] pb-4">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[13px] text-ink-soft">{entry.entry_number}</span>
          {statusChip(entry, true)}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close voucher details"
            title="Close (Esc)"
            className="ml-auto grid h-7 w-7 place-items-center rounded-ctl text-ink-muted hover:bg-canvas-sunken hover:text-ink cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 id="day-book-drawer-title" className="mt-2.5 text-lg font-semibold tracking-[-0.02em] text-ink">
          {title}
        </h3>
        {subtitle && subtitle !== title && <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>}
        <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-3 text-[13.5px]">
          <div>
            <dt className="text-[12.5px] text-ink-muted">Date</dt>
            <dd className="text-ink">{formatDay(entry.entry_date, true)}</dd>
          </div>
          <div>
            <dt className="text-[12.5px] text-ink-muted">Source</dt>
            <dd className="text-ink">{source}</dd>
          </div>
          {invoice && (
            <div>
              <dt className="text-[12.5px] text-ink-muted">Supply</dt>
              <dd className="text-ink">{supplyText(invoice)}</dd>
            </div>
          )}
          <div>
            <dt className="text-[12.5px] text-ink-muted">L.F.</dt>
            <dd className="font-mono text-ink">{entry.ledger_folio}</dd>
          </div>
        </dl>
        {entry.status === "draft" && entry.submitted_at && (
          <p className="mt-3.5 rounded-ctl bg-warn-wash px-3 py-2 text-[13px] text-warn">
            This voucher is awaiting approval, so it can&apos;t be edited. The approver can send it back.
          </p>
        )}
        {entry.status === "draft" && !entry.submitted_at && entry.rejection_reason && (
          <p className="mt-3.5 rounded-ctl bg-bad-wash px-3 py-2 text-[13px] text-bad">
            <span className="font-medium">Sent back:</span> {entry.rejection_reason}
          </p>
        )}
      </div>

      <section className="px-5 pt-3.5 pb-1.5">
        <h4 className="mb-1.5 text-[13px] font-semibold text-ink-soft">Journal lines</h4>
        <table className="w-full border-collapse text-[13.5px] tabular-nums">
          <thead className="sr-only">
            <tr>
              <th>Dr or Cr</th>
              <th>Account</th>
              <th>Debit</th>
              <th>Credit</th>
            </tr>
          </thead>
          <tbody>
            {entry.lines.map((line, idx) => {
              const detail = [line.ledger_folio, line.party_id ? partyNames.get(line.party_id) : null, line.description]
                .filter(Boolean)
                .join(" · ");
              return (
                <tr key={idx} className="border-b border-line">
                  <td className="w-[34px] py-2.5 align-top text-[12.5px] font-semibold text-brand-strong">{line.dr_cr}</td>
                  <td className="py-2.5 pr-3">
                    <span className="text-ink">{line.account_name}</span>
                    {detail && <span className="block text-xs text-ink-muted">{detail}</span>}
                  </td>
                  <td className="w-[96px] py-2.5 text-right align-top">
                    {line.debit > 0 ? money(line.debit) : <span className="text-ink-subtle">–</span>}
                  </td>
                  <td className="w-[96px] py-2.5 text-right align-top">
                    {line.credit > 0 ? money(line.credit) : <span className="text-ink-subtle">–</span>}
                  </td>
                </tr>
              );
            })}
            <tr className="font-semibold">
              <td />
              <td className="pt-3 pb-2 text-ink">Total</td>
              <td className="pt-3 pb-2 text-right">
                <span className="ledger-total">{money(totalDr)}</span>
              </td>
              <td className="pt-3 pb-2 text-right">
                <span className="ledger-total">{money(totalCr)}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="px-5 pt-3">
        <h4 className="mb-1.5 text-[13px] font-semibold text-ink-soft">Approval trail</h4>
        {trail.length === 0 ? (
          <p className="text-[13px] text-ink-muted">Approval details were not returned for this voucher.</p>
        ) : (
          <ol className="space-y-3">
            {trail.map((step) => (
              <li key={step.label} className="grid grid-cols-[172px_1fr] gap-3 text-[13.5px]">
                <span className="text-[13px] text-ink-muted">{step.label}</span>
                <div>
                  <TrailPerson step={step} members={members} />
                  {step.note && <p className="mt-1 text-[12.5px] text-bad">Reason: {step.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {proof ? (
        <div className="mx-5 mt-4 flex items-start gap-2.5 rounded-[10px] border border-line px-3.5 py-3 text-[13px]">
          <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
          <div className="min-w-0">
            <span className="block truncate font-medium text-ink">{proof.title}</span>
            <span className="text-[12.5px] text-ink-muted">
              {[proof.categoryLabel, proof.refNumber && `Ref ${proof.refNumber}`, proof.fileSize].filter(Boolean).join(" · ")}
            </span>
          </div>
          {proof.fileId && (
            <a href={filesApi.downloadUrl(orgId, proof.fileId)} className="ml-auto shrink-0 font-medium text-brand-strong hover:underline">
              Download
            </a>
          )}
        </div>
      ) : (
        <div className="mx-5 mt-4 flex items-center gap-2.5 rounded-[10px] border border-dashed border-line-strong px-3.5 py-3 text-[13px] text-ink-muted">
          <Paperclip className="h-4 w-4 shrink-0" />
          No document attached
          <label className="ml-auto inline-flex h-[30px] shrink-0 cursor-pointer items-center rounded-ctl border border-line-strong bg-surface px-3 font-medium text-ink hover:bg-canvas focus-within:ring-2 focus-within:ring-brand">
            Attach document
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="sr-only"
              disabled={isActionPending}
              onChange={(e) => onAttach(e.target.files?.[0])}
            />
          </label>
        </div>
      )}

      <div className="flex flex-wrap gap-2.5 px-5 pt-4 pb-5 [&>*]:flex-1">
        {invoice && (
          <Link
            href={`/gst?invoice=${invoice.id}`}
            className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-ctl border border-line-strong bg-surface px-3.5 text-[13.5px] font-medium text-ink hover:bg-canvas"
          >
            <FileText className="h-4 w-4" /> Open invoice
          </Link>
        )}
        <Button variant="secondary" onClick={onPrint}>
          <Printer className="h-4 w-4" /> Print
        </Button>
        {entry.status === "posted" && (
          <Button variant="secondary" onClick={onReverse} className="text-bad">
            <RotateCcw className="h-4 w-4" /> Reverse
          </Button>
        )}
        {entry.status === "draft" && !entry.submitted_at && (
          <Button variant="secondary" onClick={onEdit}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        )}
        {entry.status === "draft" && (
          <Button variant="tally" onClick={onPost} isLoading={isActionPending}>
            Post to ledger
          </Button>
        )}
      </div>
    </aside>
  );
}
