"use client";

import React, { useEffect, useState } from "react";
import { RefreshCw, Plus } from "lucide-react";
import { DataTable, ColumnDef } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { catalogueApi, inventoryApi, organisationsApi } from "@/api/endpoints";
import type { CatalogueItem } from "@/types/accounting";
import { formatINR } from "@/lib/formatters/currency";
import {
  AdjustmentForm,
  SOURCE_LABEL,
  StockLedgerRow,
  StockSummaryRow,
  Warehouse,
  adjustmentPayload,
  stockErrorMessage,
  totalValuePaise,
} from "@/lib/inventory/stock";

type Tab = "stock" | "adjust" | "warehouses";
// Called only in effects and handlers: prerendering refuses a clock read during render.
const today = () => new Date().toISOString().slice(0, 10);
const selectClass =
  "w-full rounded border border-line-strong bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-brand focus:outline-none";

function Message({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-emerald-700" : "text-rose-700"}>
      {msg.text}
    </p>
  );
}

export function InventoryView() {
  const [orgId, setOrgId] = useState("");
  const [tab, setTab] = useState<Tab>("stock");
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("deku_active_org_id");
    if (saved) setOrgId(saved);
  }, []);

  const loadMasters = async () => {
    const [it, wh] = await Promise.all([catalogueApi.list(orgId), inventoryApi.warehouses(orgId)]);
    setItems((it.data || []).filter((i) => i.track_inventory));
    setWarehouses(wh.data || []);
  };

  useEffect(() => {
    if (orgId) loadMasters().catch(() => undefined);
  }, [orgId]);

  return (
    <div className="space-y-4 font-sans text-xs">
      <div role="tablist" className="flex gap-1 bg-surface p-1 rounded border border-line w-fit">
        {(
          [
            ["stock", "Stock summary"],
            ["adjust", "Opening stock & adjustments"],
            ["warehouses", "Warehouses"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded font-semibold ${tab === key ? "bg-brand text-white" : "text-ink-soft hover:bg-canvas"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "stock" && <StockTab orgId={orgId} />}
      {tab === "adjust" && <AdjustTab orgId={orgId} items={items} warehouses={warehouses} />}
      {tab === "warehouses" && <WarehousesTab orgId={orgId} warehouses={warehouses} reload={loadMasters} />}
    </div>
  );
}

function StockTab({ orgId }: { orgId: string }) {
  const [asOf, setAsOf] = useState("");
  const [rows, setRows] = useState<StockSummaryRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StockSummaryRow | null>(null);

  useEffect(() => setAsOf(today()), []);

  const load = async () => {
    if (!orgId || !asOf) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await inventoryApi.summary(orgId, asOf);
      setRows(res.data || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [orgId, asOf]);

  const columns: ColumnDef<StockSummaryRow>[] = [
    { header: "SKU", sortKey: (r) => r.sku ?? "", cell: (r) => <span className="font-mono font-bold text-ink">{r.sku ?? "–"}</span> },
    { header: "Item", sortKey: (r) => r.item_name, cell: (r) => <span className="font-semibold text-ink">{r.item_name}</span> },
    { header: "Warehouse", cell: (r) => <span className="text-ink-soft">{r.warehouse_name}</span> },
    {
      header: "Qty on hand",
      align: "right",
      sortKey: (r) => Number(r.qty_on_hand),
      cell: (r) => (
        <span className={`font-mono font-bold ${Number(r.qty_on_hand) < 0 ? "text-rose-700" : "text-ink"}`}>
          {Number(r.qty_on_hand)} {r.unit_code}
        </span>
      ),
    },
    {
      header: "FIFO value",
      align: "right",
      sortKey: (r) => Number(r.fifo_value),
      cell: (r) => <span className="font-mono font-bold text-ink">{formatINR(r.fifo_value)}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 bg-surface p-3 rounded border border-line">
        <div className="w-44">
          <Input label="As of" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-ink-muted">
            Total <span className="font-mono font-bold text-ink">{formatINR(totalValuePaise(rows) / 100)}</span>
          </span>
          <Button variant="outline" size="sm" onClick={load} isLoading={isLoading}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>
      <p className="text-ink-muted">
        Valued first-in first-out from the movements themselves. The balance sheet&apos;s Inventory ledger (1050) carries
        opening stock and adjustments; purchases and sales post to their own ledgers.
      </p>
      {error && <Message msg={{ ok: false, text: error }} />}
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        searchPlaceholder="Search item or SKU..."
        emptyMessage="No stock yet. Turn on Track inventory for a product, then record opening stock or a purchase bill with item lines."
        onRowClick={setSelected}
      />
      {selected && <LedgerPanel orgId={orgId} row={selected} asOf={asOf} onClose={() => setSelected(null)} />}
    </div>
  );
}

function LedgerPanel({ orgId, row, asOf, onClose }: { orgId: string; row: StockSummaryRow; asOf: string; onClose: () => void }) {
  const [from, setFrom] = useState("");
  const [rows, setRows] = useState<StockLedgerRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inventoryApi
      .ledger(orgId, row.item_id, { from: from || undefined, to: asOf })
      .then((res) => setRows(res.data || []))
      .catch((e) => setError((e as Error).message));
  }, [orgId, row.item_id, from, asOf]);

  return (
    <section className="bg-surface border border-line rounded-lg p-4 space-y-3" aria-label={`Stock ledger for ${row.item_name}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-ink">
            {row.item_name} <span className="font-mono text-ink-muted">{row.sku}</span>
          </h3>
          <p className="text-ink-muted">All warehouses, up to {asOf}. Outward values are the FIFO cost of goods issued.</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-40">
            <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
      {error && <Message msg={{ ok: false, text: error }} />}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="text-[10px] uppercase text-ink-muted border-b border-line">
            <tr>
              <th className="py-2 px-2">Date</th>
              <th className="py-2 px-2">Source</th>
              <th className="py-2 px-2">Warehouse</th>
              <th className="py-2 px-2 text-right">In</th>
              <th className="py-2 px-2 text-right">Out</th>
              <th className="py-2 px-2 text-right">Unit cost</th>
              <th className="py-2 px-2 text-right">Value</th>
              <th className="py-2 px-2 text-right">Balance qty</th>
              <th className="py-2 px-2 text-right">Balance value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((m) => (
              <tr key={m.movement_id}>
                <td className="py-1.5 px-2 font-mono">{m.movement_date}</td>
                <td className="py-1.5 px-2">
                  {SOURCE_LABEL[m.source_type]}
                  {m.reversal_of && <Badge variant="outline" className="ml-1">reversal</Badge>}
                  {m.narration && <span className="block text-[11px] text-ink-muted">{m.narration}</span>}
                </td>
                <td className="py-1.5 px-2 text-ink-soft">{m.warehouse_name}</td>
                <td className="py-1.5 px-2 text-right font-mono">{m.direction === "in" ? Number(m.qty) : ""}</td>
                <td className="py-1.5 px-2 text-right font-mono">{m.direction === "out" ? Number(m.qty) : ""}</td>
                <td className="py-1.5 px-2 text-right font-mono">{m.unit_cost == null ? "–" : formatINR(m.unit_cost, { showCurrencySymbol: false })}</td>
                <td className="py-1.5 px-2 text-right font-mono">{formatINR(m.value, { showCurrencySymbol: false })}</td>
                <td className="py-1.5 px-2 text-right font-mono font-bold">{Number(m.balance_qty)}</td>
                <td className="py-1.5 px-2 text-right font-mono font-bold">{formatINR(m.balance_value, { showCurrencySymbol: false })}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="py-4 text-center text-ink-muted">
                  No movements in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const emptyForm = (date: string): AdjustmentForm => ({
  item_id: "",
  kind: "opening",
  direction: "in",
  qty: "",
  unit_cost: "",
  date,
  warehouse_id: "",
  reason: "",
});

function AdjustTab({ orgId, items, warehouses }: { orgId: string; items: CatalogueItem[]; warehouses: Warehouse[] }) {
  const [form, setForm] = useState<AdjustmentForm>(emptyForm(""));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (patch: Partial<AdjustmentForm>) => setForm((f) => ({ ...f, ...patch }));
  useEffect(() => set({ date: today() }), []);
  const direction = form.kind === "opening" ? "in" : form.direction;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = adjustmentPayload(form);
    if ("error" in result) {
      setMsg({ ok: false, text: result.error });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await inventoryApi.adjust(orgId, result.payload);
      const status = res.data?.journal_status;
      setMsg({
        ok: true,
        text:
          status === "posted"
            ? `Recorded at ${formatINR(res.data.value)} and the journal is posted.`
            : status === "pending_approval"
              ? `Recorded at ${formatINR(res.data.value)}. The journal is waiting for an owner, CFO or admin to approve it.`
              : "Recorded. It has no value, so no journal was needed.",
      });
      setForm(emptyForm(today()));
    } catch (err) {
      setMsg({ ok: false, text: stockErrorMessage((err as Error).message) });
    } finally {
      setBusy(false);
    }
  };

  if (items.length === 0) {
    return (
      <p className="bg-surface border border-line rounded p-4 text-ink-muted">
        No product tracks inventory yet. Turn on Track inventory for goods in Masters → Catalogue.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="bg-surface border border-line rounded-lg p-4 space-y-3 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[10px] font-bold uppercase text-ink-muted mb-1">Item</span>
          <select value={form.item_id} onChange={(e) => set({ item_id: e.target.value })} className={selectClass} required>
            <option value="">Choose…</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.sku} · {i.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[10px] font-bold uppercase text-ink-muted mb-1">Warehouse</span>
          <select value={form.warehouse_id} onChange={(e) => set({ warehouse_id: e.target.value })} className={selectClass}>
            <option value="">Default</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[10px] font-bold uppercase text-ink-muted mb-1">Type</span>
          <select
            value={form.kind}
            onChange={(e) => set({ kind: e.target.value as AdjustmentForm["kind"] })}
            className={selectClass}
          >
            <option value="opening">Opening stock (Cr Opening Balance Equity)</option>
            <option value="adjustment">Adjustment (Inventory Adjustment ledger)</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-[10px] font-bold uppercase text-ink-muted mb-1">Direction</span>
          <select
            value={direction}
            disabled={form.kind === "opening"}
            onChange={(e) => set({ direction: e.target.value as AdjustmentForm["direction"] })}
            className={selectClass}
          >
            <option value="in">In (stock found / added)</option>
            <option value="out">Out (lost, damaged, written off)</option>
          </select>
        </label>
        <Input label="Quantity" type="number" step="0.001" min="0" value={form.qty} onChange={(e) => set({ qty: e.target.value })} required />
        {direction === "in" ? (
          <Input
            label="Unit cost (INR)"
            type="number"
            step="0.0001"
            min="0"
            value={form.unit_cost}
            onChange={(e) => set({ unit_cost: e.target.value })}
            required
          />
        ) : (
          <p className="self-end text-ink-muted">Stock going out is valued at FIFO cost by the server.</p>
        )}
        <Input label="Date" type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} required />
        <Input label="Reason" value={form.reason} onChange={(e) => set({ reason: e.target.value })} placeholder="e.g. physical count" />
      </div>
      <Message msg={msg} />
      <div className="flex justify-end border-t border-line pt-3">
        <Button type="submit" variant="tally" size="sm" isLoading={busy}>
          Record
        </Button>
      </div>
    </form>
  );
}

function WarehousesTab({ orgId, warehouses, reload }: { orgId: string; warehouses: Warehouse[]; reload: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [allowNegative, setAllowNegative] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    organisationsApi
      .get(orgId)
      .then((res) => setAllowNegative(res.data?.[0]?.allow_negative_stock ?? false))
      .catch(() => undefined);
  }, [orgId]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      await reload();
      setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const toggleNegative = (on: boolean) =>
    run(async () => {
      const res = await organisationsApi.updateSettings(orgId, { allow_negative_stock: on });
      setAllowNegative(res.data?.[0]?.allow_negative_stock ?? false);
    }, on ? "Invoices may now take stock below zero." : "Invoices can no longer take stock below zero.");

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-surface border border-line rounded-lg divide-y divide-line">
        {warehouses.map((w) => (
          <div key={w.id} className="flex items-center justify-between gap-3 p-3">
            <div>
              <span className="font-semibold text-ink">{w.name}</span>{" "}
              <span className="font-mono text-ink-muted">{w.code}</span>
              {w.is_default && <Badge variant="teal" className="ml-2">Default</Badge>}
            </div>
            {!w.is_default && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => run(() => inventoryApi.updateWarehouse(orgId, w.id, { is_default: true }), `${w.name} is now the default.`)}
                >
                  Make default
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy}
                  onClick={() => run(() => inventoryApi.removeWarehouse(orgId, w.id), `${w.name} deleted.`)}
                >
                  Delete
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => inventoryApi.createWarehouse(orgId, { name, code }), `${name} added.`).then(() => {
            setName("");
            setCode("");
          });
        }}
        className="bg-surface border border-line rounded-lg p-4 grid grid-cols-1 sm:grid-cols-[1fr_8rem_auto] gap-3 items-end"
      >
        <Input label="Warehouse name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required />
        <Button type="submit" variant="tally" size="sm" isLoading={busy} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </form>
      <label className="flex items-start gap-2 bg-surface border border-line rounded-lg p-4">
        <input
          type="checkbox"
          role="switch"
          checked={allowNegative}
          disabled={busy}
          onChange={(e) => toggleNegative(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-brand"
        />
        <span>
          <span className="font-semibold text-ink">Allow negative stock</span>
          <span className="block text-ink-muted">
            Off: an invoice that would take a tracked item below zero is refused. Owners and admins can change this.
          </span>
        </span>
      </label>
      <Message msg={msg} />
    </div>
  );
}
