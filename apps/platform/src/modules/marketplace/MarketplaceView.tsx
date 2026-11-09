"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { accountingApi, marketplaceApi, MarketplaceColumnMap, MarketplaceSettlement } from "@/api/endpoints";
import type { Account } from "@/types/accounting";
import { formatINR } from "@/lib/formatters/currency";
import { SALES_CHANNELS } from "@/lib/invoices/settlement";
import {
  AMOUNT_FIELDS,
  ColumnMap,
  FIELDS,
  netFrom,
  parseSettlement,
  readHeader,
  saveBlockers,
  settlementPayload,
  SettlementMeta,
} from "@/lib/marketplace/parsers";

const CHANNELS = SALES_CHANNELS.filter((c) => c.value !== "direct");
const channelLabel = (v: string) => CHANNELS.find((c) => c.value === v)?.label ?? v;
const fieldClass =
  "w-full h-9 rounded-md border border-line-strong bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20";
const labelClass = "block text-xs font-medium text-ink-soft";
const rupees = (p: number) => formatINR(p / 100);
const deductions = (s: MarketplaceSettlement) =>
  Number(s.refunds) + Number(s.commission) + Number(s.other_fees) + Number(s.gst_on_fees) + Number(s.tcs_amount) + Number(s.tds_amount);

export function MarketplaceView() {
  const [orgId, setOrgId] = useState("");
  const [maps, setMaps] = useState<MarketplaceColumnMap[]>([]);
  const [settlements, setSettlements] = useState<MarketplaceSettlement[]>([]);
  const [banks, setBanks] = useState<Account[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => setOrgId(localStorage.getItem("deku_active_org_id") || ""), []);

  const loadSettlements = useCallback(async () => {
    if (!orgId) return;
    try {
      setSettlements((await marketplaceApi.list(orgId)).data || []);
    } catch (e) {
      setLoadError((e as Error).message || "Could not load settlements");
    }
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    Promise.all([marketplaceApi.listColumnMaps(orgId), accountingApi.listAccounts(orgId)])
      .then(([m, a]) => {
        setMaps(m.data || []);
        setBanks((a.data || []).filter((acc) => acc.is_postable && acc.account_group === "asset"));
      })
      .catch((e) => setLoadError((e as Error).message || "Could not load column maps"));
    loadSettlements();
  }, [orgId, loadSettlements]);

  if (!orgId) return <p className="text-sm text-ink-muted">Select a company to import marketplace settlements.</p>;

  return (
    <div className="space-y-6">
      {loadError && <Notice tone="error">{loadError}</Notice>}
      <Importer
        orgId={orgId}
        maps={maps}
        onMapSaved={(m) => setMaps((prev) => [...prev.filter((x) => x.channel !== m.channel), m])}
        onSaved={loadSettlements}
      />
      <Register orgId={orgId} settlements={settlements} banks={banks} onChanged={loadSettlements} />
    </div>
  );
}

function Importer({
  orgId,
  maps,
  onMapSaved,
  onSaved,
}: {
  orgId: string;
  maps: MarketplaceColumnMap[];
  onMapSaved: (m: MarketplaceColumnMap) => void;
  onSaved: () => Promise<void>;
}) {
  const [channel, setChannel] = useState<string>(CHANNELS[0].value);
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  // Unsaved edits to the mapping; null means "use the channel's saved mapping".
  const [mapEdit, setMapEdit] = useState<ColumnMap | null>(null);
  // Typed values; a missing field falls back to what the file says.
  const [metaEdit, setMetaEdit] = useState<{ settlement_ref?: string; period_from?: string; period_to?: string }>({});
  const [feeGstSplit, setFeeGstSplit] = useState<SettlementMeta["fee_gst_split"]>("igst");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const saved = maps.find((m) => m.channel === channel);
  const map: ColumnMap = useMemo(
    () =>
      mapEdit ??
      (saved ? { mapping: saved.mapping, deductions_negative: saved.deductions_negative } : { mapping: {}, deductions_negative: true }),
    [mapEdit, saved]
  );
  const setMap = (f: (m: ColumnMap) => ColumnMap) => setMapEdit(f(map));

  const headers = useMemo(() => (text ? readHeader(text, map.mapping).headers : []), [text, map.mapping]);
  const parsed = useMemo(() => (text ? parseSettlement(text, map) : null), [text, map]);

  const meta = {
    settlement_ref: metaEdit.settlement_ref ?? (parsed?.refs.length === 1 ? parsed.refs[0] : ""),
    period_from: metaEdit.period_from ?? parsed?.periodFrom ?? "",
    period_to: metaEdit.period_to ?? parsed?.periodTo ?? "",
    fee_gst_split: feeGstSplit,
  };
  const setMeta = (m: Partial<typeof meta>) => {
    const { fee_gst_split, ...rest } = m;
    if (fee_gst_split) setFeeGstSplit(fee_gst_split);
    setMetaEdit((e) => ({ ...e, ...rest }));
  };

  const fullMeta: SettlementMeta = { ...meta, channel, source_filename: fileName || null };
  const blockers = parsed ? saveBlockers(parsed, fullMeta) : [];

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setMessage(null);
    setMetaEdit({});
    setText(await file.text());
  };

  const setColumn = (key: string, header: string) =>
    setMap((m) => ({ ...m, mapping: { ...m.mapping, [key]: header || undefined } }));

  const save = async () => {
    if (!parsed || blockers.length) return;
    setBusy(true);
    setMessage(null);
    try {
      const toSave = { mapping: map.mapping, deductions_negative: map.deductions_negative };
      await marketplaceApi.saveColumnMap(orgId, channel, toSave);
      onMapSaved({ channel, ...toSave });
      setMapEdit(null);
      await marketplaceApi.create(orgId, settlementPayload(parsed, fullMeta));
      setMessage({ tone: "ok", text: `Settlement ${fullMeta.settlement_ref} saved as a draft. Post it from the register below.` });
      setText("");
      setFileName("");
      await onSaved();
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message || "Could not save the settlement" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-card space-y-4">
      <h2 className="text-sm font-semibold text-ink">Import a settlement</h2>
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-44">
          <label htmlFor="mkt-channel" className={labelClass}>
            Channel
          </label>
          <select id="mkt-channel" className={`${fieldClass} mt-1`} value={channel} onChange={(e) => {
              setChannel(e.target.value);
              setMapEdit(null);
            }}>
            {CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-line-strong px-3 py-2 text-sm text-ink hover:bg-canvas">
          <UploadCloud className="h-4 w-4 text-ink-muted" />
          {fileName || "Choose the settlement report (CSV)"}
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
        </label>
        <p className="max-w-md text-xs text-ink-muted">
          The file is read in your browser. Only the totals and the rows you save are sent to Deku.
        </p>
      </div>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {text && (
        <>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Map columns</h3>
            <p className="mt-1 text-xs text-ink-muted">
              Match your file&apos;s columns once; the mapping is saved for {channelLabel(channel)} with the settlement.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label htmlFor={`map-${f.key}`} className={labelClass}>
                    {f.label}
                  </label>
                  <select
                    id={`map-${f.key}`}
                    className={`${fieldClass} mt-1`}
                    value={map.mapping[f.key] ?? ""}
                    onChange={(e) => setColumn(f.key, e.target.value)}
                  >
                    <option value="">Not in this file</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={map.deductions_negative}
                onChange={(e) => setMap((m) => ({ ...m, deductions_negative: e.target.checked }))}
              />
              The report shows refunds, fees and withheld taxes as negative numbers
            </label>
          </div>

          {parsed?.fileError ? (
            <Notice tone="error">{parsed.fileError}</Notice>
          ) : (
            parsed && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Preview</h3>
                <table className="w-full max-w-lg text-sm">
                  <tbody>
                    {AMOUNT_FIELDS.map((f) => (
                      <tr key={f} className="border-b border-line">
                        <td className="py-1.5 text-ink-soft">{FIELDS.find((x) => x.key === f)!.label}</td>
                        <td className="py-1.5 text-right font-mono text-ink">{rupees(parsed.totals[f])}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-line font-semibold">
                      <td className="py-1.5 text-ink">Net payout (sales less deductions)</td>
                      <td className="py-1.5 text-right font-mono text-ink">{rupees(netFrom(parsed.totals))}</td>
                    </tr>
                    {parsed.fileNetPaise !== null && (
                      <tr>
                        <td className="py-1.5 text-ink-soft">Net payout in the file</td>
                        <td className="py-1.5 text-right font-mono text-ink">
                          {rupees(parsed.fileNetPaise)}{" "}
                          {parsed.fileNetPaise === parsed.computedNetPaise ? (
                            <Badge variant="success">matches</Badge>
                          ) : (
                            <Badge variant="danger">off by {rupees(parsed.fileNetPaise - parsed.computedNetPaise)}</Badge>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {parsed.errors.length > 0 && (
                  <Notice tone="error">
                    <p>
                      {parsed.errors.length} row{parsed.errors.length === 1 ? "" : "s"} could not be read and are left out:
                    </p>
                    <ul className="list-disc pl-4">
                      {parsed.errors.slice(0, 50).map((e) => (
                        <li key={e.row}>
                          Row {e.row}: {e.reason}
                        </li>
                      ))}
                    </ul>
                  </Notice>
                )}

                <div className="grid gap-3 sm:grid-cols-4">
                  <Input
                    label="Settlement ID"
                    value={meta.settlement_ref}
                    onChange={(e) => setMeta({ settlement_ref: e.target.value })}
                  />
                  <Input label="Period from" type="date" value={meta.period_from} onChange={(e) => setMeta({ period_from: e.target.value })} />
                  <Input label="Period to" type="date" value={meta.period_to} onChange={(e) => setMeta({ period_to: e.target.value })} />
                  <div>
                    <label htmlFor="mkt-fee-gst" className={labelClass}>
                      GST on fees charged as
                    </label>
                    <select
                      id="mkt-fee-gst"
                      className={`${fieldClass} mt-1`}
                      value={meta.fee_gst_split}
                      onChange={(e) => setMeta({ fee_gst_split: e.target.value as SettlementMeta["fee_gst_split"] })}
                    >
                      <option value="igst">IGST (operator in another state)</option>
                      <option value="cgst_sgst">CGST + SGST (same state)</option>
                    </select>
                  </div>
                </div>

                {blockers.length > 0 && (
                  <ul className="list-disc pl-4 text-sm text-ink-muted">
                    {blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
                <Button variant="tally" isLoading={busy} disabled={blockers.length > 0} onClick={save}>
                  Save settlement
                </Button>
              </div>
            )
          )}
        </>
      )}
    </section>
  );
}

function Register({
  orgId,
  settlements,
  banks,
  onChanged,
}: {
  orgId: string;
  settlements: MarketplaceSettlement[];
  banks: Account[];
  onChanged: () => Promise<void>;
}) {
  const [bankId, setBankId] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const run = async (id: string, action: () => Promise<string>) => {
    setBusyId(id);
    setMessage(null);
    try {
      setMessage({ tone: "ok", text: await action() });
      await onChanged();
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message || "Action failed" });
    } finally {
      setBusyId(null);
    }
  };

  const post = (s: MarketplaceSettlement) =>
    run(s.id, async () => {
      const { entry } = await marketplaceApi.post(orgId, s.id, bankId || null);
      if (entry.status === "posted") return `Settlement ${s.settlement_ref} posted as ${entry.entry_number}.`;
      if (entry.submitted_at) return `Voucher ${entry.entry_number} submitted for approval.`;
      return `Voucher ${entry.entry_number} saved as a draft for the owner, CFO or admin to post.`;
    });

  const remove = (s: MarketplaceSettlement) =>
    run(s.id, async () => {
      await marketplaceApi.remove(orgId, s.id);
      return `Draft settlement ${s.settlement_ref} deleted.`;
    });

  const status = (s: MarketplaceSettlement) => {
    const j = s.journal_entries;
    if (!s.journal_entry_id) return <Badge>Not posted</Badge>;
    if (j?.status === "posted") return <Badge variant="success">Posted {j.entry_number}</Badge>;
    if (j?.submitted_at) return <Badge variant="warning">Awaiting approval</Badge>;
    return <Badge variant="warning">Draft voucher {j?.entry_number ?? ""}</Badge>;
  };

  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-card space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-sm font-semibold text-ink">Settlements register</h2>
        <div className="w-72">
          <label htmlFor="mkt-bank" className={labelClass}>
            Payout received in
          </label>
          <select id="mkt-bank" className={`${fieldClass} mt-1`} value={bankId} onChange={(e) => setBankId(e.target.value)}>
            <option value="">Default bank account (1020)</option>
            {banks.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {settlements.length === 0 ? (
        <p className="text-sm text-ink-muted">No settlements imported yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th className="py-2 pr-3 font-medium">Channel</th>
                <th className="py-2 pr-3 font-medium">Settlement</th>
                <th className="py-2 pr-3 font-medium">Period</th>
                <th className="py-2 pr-3 text-right font-medium">Sales</th>
                <th className="py-2 pr-3 text-right font-medium">Deductions</th>
                <th className="py-2 pr-3 text-right font-medium">Net payout</th>
                <th className="py-2 pr-3 font-medium">Voucher</th>
                <th className="py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s.id} className="border-b border-line">
                  <td className="py-2 pr-3 text-ink">{channelLabel(s.channel)}</td>
                  <td className="py-2 pr-3 font-mono text-ink">{s.settlement_ref}</td>
                  <td className="py-2 pr-3 text-ink-soft">
                    {s.period_from} to {s.period_to}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-ink">{formatINR(Number(s.gross_sales))}</td>
                  <td className="py-2 pr-3 text-right font-mono text-ink">{formatINR(deductions(s))}</td>
                  <td className="py-2 pr-3 text-right font-mono font-semibold text-ink">{formatINR(Number(s.net_payout))}</td>
                  <td className="py-2 pr-3">{status(s)}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {!s.journal_entry_id && (
                      <>
                        <Button variant="tally" size="sm" isLoading={busyId === s.id} onClick={() => post(s)}>
                          Post
                        </Button>
                        <button
                          type="button"
                          aria-label={`Delete settlement ${s.settlement_ref}`}
                          disabled={busyId === s.id}
                          onClick={() => remove(s)}
                          className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-canvas hover:text-ink"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Notice({ tone, children }: { tone: "error" | "ok"; children: React.ReactNode }) {
  const cls =
    tone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-800";
  const Icon = tone === "error" ? AlertTriangle : CheckCircle2;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${cls}`}>
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}
