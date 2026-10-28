"use client";

import { useEffect, useMemo, useState } from "react";
import { accountingApi, invoicesApi, organisationsApi } from "@/api/endpoints";
import type { Account, JournalEntry } from "@/types/accounting";
import { buildGstr1, buildGstr3b, periodInvoices, ReturnInvoice } from "@/lib/gst/returns";

export interface ReturnBooks {
  gstin: string | null;
  invoices: ReturnInvoice[];
  accounts: Account[];
  journals: JournalEntry[];
}

/** Loads the active company's books for a MMYYYY period and builds both returns from them. */
export function useReturnBooks(retPeriod: string) {
  const [orgId, setOrgId] = useState("");
  const [books, setBooks] = useState<ReturnBooks | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("deku_active_org_id");
    if (saved) setOrgId(saved);
  }, []);

  useEffect(() => {
    if (!orgId || !retPeriod) return;
    let stale = false;
    setLoading(true);
    setLoadError(null);
    setBooks(null);
    (async () => {
      const [org, list, accounts, journals] = await Promise.all([
        organisationsApi.get(orgId),
        invoicesApi.list(orgId),
        accountingApi.listAccounts(orgId),
        accountingApi.listJournals(orgId),
      ]);
      const all = (list.data || []) as unknown as ReturnInvoice[];
      // The list has the customer's GSTIN but no lines; the detail call has lines but no customer.
      const withLines = await Promise.all(
        periodInvoices(all, retPeriod).map(async (inv) => {
          const full = (await invoicesApi.get(orgId, inv.id)).data?.[0] as ReturnInvoice | undefined;
          return { ...inv, sales_invoice_lines: full?.sales_invoice_lines ?? [] };
        })
      );
      const byId = new Map(withLines.map((i) => [i.id, i]));
      if (stale) return;
      setBooks({
        gstin: org.data?.[0]?.gstin ?? null,
        invoices: all.map((i) => byId.get(i.id) ?? i),
        accounts: accounts.data || [],
        journals: journals.data || [],
      });
    })()
      .catch((err) => !stale && setLoadError(err?.message || "Failed to load the books for this period"))
      .finally(() => !stale && setLoading(false));
    return () => {
      stale = true;
    };
  }, [orgId, retPeriod]);

  const gstr1 = useMemo(() => books && buildGstr1({ ...books, retPeriod }), [books, retPeriod]);
  const gstr3b = useMemo(() => books && buildGstr3b({ ...books, retPeriod }), [books, retPeriod]);

  return { orgId, books, loading, loadError, gstr1, gstr3b };
}
