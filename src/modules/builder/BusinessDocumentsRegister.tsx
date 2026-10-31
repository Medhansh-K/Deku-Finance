"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ArrowRightLeft, Trash2, FolderOpen, ExternalLink } from "lucide-react";
import { DataTable, ColumnDef } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { businessDocumentsApi } from "@/api/endpoints";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally } from "@/lib/formatters/date";
import {
  BUSINESS_DOC_STATUSES,
  BUSINESS_DOC_TYPES,
  BusinessDocStatus,
  BusinessDocument,
  NEXT_STATUSES,
  canConvert,
} from "@/lib/builder/business-documents";

const selectClass =
  "h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink focus:border-brand focus:outline-none";

const statusVariant = (s: BusinessDocStatus) =>
  s === "converted" || s === "accepted" ? "success" : s === "cancelled" || s === "rejected" ? "danger" : s === "sent" ? "teal" : "warning";

const typeLabel = (t: string) => BUSINESS_DOC_TYPES.find((x) => x.value === t)?.label ?? t;

interface Props {
  orgId: string;
  onOpen: (doc: BusinessDocument) => void;
}

export function BusinessDocumentsRegister({ orgId, onOpen }: Props) {
  const router = useRouter();
  const [docs, setDocs] = useState<BusinessDocument[]>([]);
  const [docType, setDocType] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await businessDocumentsApi.list(orgId, { doc_type: docType, status });
      setDocs(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load documents");
    } finally {
      setIsLoading(false);
    }
  }, [orgId, docType, status]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (doc: BusinessDocument, action: () => Promise<unknown>) => {
    setPendingId(doc.id);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setPendingId(null);
    }
  };

  const open = async (doc: BusinessDocument) => {
    setPendingId(doc.id);
    try {
      const res = await businessDocumentsApi.get(orgId, doc.id);
      if (res.data?.[0]) onOpen(res.data[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open the document");
    } finally {
      setPendingId(null);
    }
  };

  const convert = async (doc: BusinessDocument) => {
    const invoiceNumber = window.prompt(
      `Convert ${doc.doc_number} into a draft sales invoice.\nInvoice number to use (your next number in the invoice series):`
    );
    if (!invoiceNumber?.trim()) return;
    setPendingId(doc.id);
    setError(null);
    try {
      const res = await businessDocumentsApi.convert(orgId, doc.id, invoiceNumber.trim());
      if (res.data?.converted_to_id) router.push(`/gst?invoice=${res.data.converted_to_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't convert the document");
      setPendingId(null);
    }
  };

  const columns: ColumnDef<BusinessDocument>[] = [
    {
      header: "Number",
      sortKey: (d) => d.doc_number,
      cell: (d) => <span className="font-mono font-bold text-ink">{d.doc_number}</span>,
    },
    { header: "Type", sortKey: (d) => d.doc_type, cell: (d) => <span className="text-ink-soft">{typeLabel(d.doc_type)}</span> },
    {
      header: "Date",
      sortKey: (d) => d.doc_date,
      cell: (d) => <span className="font-mono text-ink">{formatDateTally(d.doc_date)}</span>,
    },
    {
      header: "Party",
      sortKey: (d) => d.parties?.legal_name ?? d.party_snapshot?.name ?? "",
      cell: (d) => <span className="text-ink">{d.parties?.legal_name ?? d.party_snapshot?.name ?? "–"}</span>,
    },
    {
      header: "Total",
      align: "right",
      sortKey: (d) => Number(d.total_amount),
      cell: (d) => <span className="font-mono font-bold text-ink">{formatINR(Number(d.total_amount))}</span>,
    },
    {
      header: "Status",
      sortKey: (d) => d.status,
      cell: (d) => <Badge variant={statusVariant(d.status)}>{d.status}</Badge>,
    },
    {
      header: "Actions",
      cell: (d) => {
        const busy = pendingId === d.id;
        return (
          <div className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="outline" size="sm" isLoading={busy} onClick={() => open(d)} title="Open in the builder">
              <FolderOpen className="h-3.5 w-3.5" /> Open
            </Button>
            {canConvert(d) && (
              <Button variant="tally" size="sm" isLoading={busy} onClick={() => convert(d)}>
                <ArrowRightLeft className="h-3.5 w-3.5" /> Convert
              </Button>
            )}
            {d.converted_to_type === "sales_invoice" && d.converted_to_id && (
              <Button variant="outline" size="sm" onClick={() => router.push(`/gst?invoice=${d.converted_to_id}`)}>
                <ExternalLink className="h-3.5 w-3.5" /> Invoice
              </Button>
            )}
            {d.doc_type === "purchase_order" && d.status !== "cancelled" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/vouchers?type=purchase&source=builder&docId=${d.id}`)}
                title="Record the purchase voucher once the supplier's bill arrives"
              >
                Purchase voucher
              </Button>
            )}
            {NEXT_STATUSES[d.status].length > 0 && (
              <select
                aria-label={`Change status of ${d.doc_number}`}
                className={selectClass}
                value=""
                disabled={busy}
                onChange={(e) => {
                  const next = e.target.value as BusinessDocStatus;
                  if (next) run(d, () => businessDocumentsApi.setStatus(orgId, d.id, next));
                }}
              >
                <option value="">Mark as…</option>
                {NEXT_STATUSES[d.status].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
            {d.status === "draft" && (
              <button
                type="button"
                className="p-1 text-ink-subtle hover:text-rose-700"
                title="Delete draft"
                aria-label={`Delete ${d.doc_number}`}
                onClick={() => {
                  if (confirm(`Delete draft ${d.doc_number}?`)) run(d, () => businessDocumentsApi.remove(orgId, d.id));
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Filter by type" className={selectClass} value={docType} onChange={(e) => setDocType(e.target.value)}>
          <option value="">All types</option>
          {BUSINESS_DOC_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select aria-label="Filter by status" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {BUSINESS_DOC_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={load} isLoading={isLoading}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>
      {error && <div className="p-2.5 rounded border border-rose-200 bg-rose-50 text-xs text-rose-700">{error}</div>}
      <DataTable
        columns={columns}
        data={docs}
        isLoading={isLoading}
        searchPlaceholder="Search by number or party..."
        emptyMessage="No documents yet. Build one and save it as a draft."
      />
    </div>
  );
}
