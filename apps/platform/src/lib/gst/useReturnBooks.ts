"use client";

import { useEffect, useState } from "react";
import { gstApi } from "@/api/endpoints";
import type { ReturnResult } from "@/lib/gst/returns";

/** Fetches both returns for a MMYYYY period, computed by the backend from the active company's books. */
export function useReturnBooks(retPeriod: string) {
  const [orgId, setOrgId] = useState("");
  const [returns, setReturns] = useState<{ gstr1: ReturnResult; gstr3b: ReturnResult } | null>(null);
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
    setReturns(null);
    Promise.all([gstApi.get(orgId, retPeriod, "gstr1"), gstApi.get(orgId, retPeriod, "gstr3b")])
      .then(([g1, g3]) => !stale && setReturns({ gstr1: g1.data, gstr3b: g3.data }))
      .catch((err) => !stale && setLoadError(err?.message || "Failed to build the returns for this period"))
      .finally(() => !stale && setLoading(false));
    return () => {
      stale = true;
    };
  }, [orgId, retPeriod]);

  const gstr1 = returns?.gstr1 ?? null;
  const gstr3b = returns?.gstr3b ?? null;
  const gstin = ((gstr1?.json?.gstin ?? gstr3b?.json?.gstin) as string | undefined) ?? null;
  return { orgId, loading, loadError, gstr1, gstr3b, gstin };
}
