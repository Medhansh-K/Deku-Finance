"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { accountingApi, catalogueApi, ImportJob, importsApi, partiesApi } from "@/api/endpoints";
import { formatINR } from "@/lib/formatters/currency";
import { decodeTallyBytes, parseTallyXml, tallyToBatch, unmappedGroups } from "@/lib/import/tally";
import { CSV_FIELDS, csvHeaders, CsvMapping, csvUnmappedGroups, parseCsv, suggestMapping } from "@/lib/import/csv";
import { ALERX_GROUPS, GroupTarget, IMPORT_ORDER, ImportBatch, ImportKind, KIND_LABELS, Masters, validateBatch } from "@/lib/import/validate";

const STEPS = ["Upload", "Detect", "Map", "Validate", "Review", "Apply"] as const;
const fieldClass =
  "w-full h-9 rounded-md border border-line-strong bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20";
const labelClass = "block text-xs font-medium text-ink-soft";
const card = "rounded-xl border border-line bg-surface p-4 shadow-card space-y-4";

const BATCH_KEY: Record<ImportKind, keyof Pick<ImportBatch, "accounts" | "parties" | "items" | "openings" | "vouchers">> = {
  chart_of_accounts: "accounts",
  parties: "parties",
  items: "items",
  opening_balances: "openings",
  vouchers: "vouchers",
};

const TARGETS = [...ALERX_GROUPS, "customer", "vendor", "skip"] as const;
const TARGET_LABELS: Record<(typeof TARGETS)[number], string> = {
  asset: "Asset account",
  liability: "Liability account",
  equity: "Equity account",
  revenue: "Revenue account",
  expense: "Expense account",
  customer: "Customers (debtors)",
  vendor: "Vendors (creditors)",
  skip: "Leave out",
};
function toTarget(v: (typeof TARGETS)[number], group: string): GroupTarget {
  if (v === "skip") return { kind: "skip" };
  if (v === "customer" || v === "vendor") return { kind: "party", party_type: v };
  return { kind: "account", account_group: v, ledger: group, sub_ledger: group };
}

const targetValue = (t?: GroupTarget) =>
  !t ? "" : t.kind === "skip" ? "skip" : t.kind === "party" ? t.party_type : t.account_group;

interface Loaded {
  name: string;
  text: string;
  tally: boolean;
}
type Result = { kind: ImportKind; job?: ImportJob; error?: string };

export function ImportView() {
  const [orgId, setOrgId] = useState("");
  const [masters, setMasters] = useState<Masters | null>(null);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [file, setFile] = useState<Loaded | null>(null);
  const [csvKind, setCsvKind] = useState<ImportKind>("chart_of_accounts");
  const [mapping, setMapping] = useState<CsvMapping>({});
  const [groupMap, setGroupMap] = useState<Record<string, GroupTarget>>({});
  const [excluded, setExcluded] = useState<Set<ImportKind>>(new Set());
  const [confirmDiff, setConfirmDiff] = useState(false);
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);

  useEffect(() => setOrgId(localStorage.getItem("deku_active_org_id") || ""), []);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const [a, p, i, j] = await Promise.all([
        accountingApi.listAccounts(orgId),
        partiesApi.list(orgId),
        catalogueApi.list(orgId),
        importsApi.list(orgId),
      ]);
      setMasters({ accounts: a.data || [], parties: p.data || [], items: i.data || [] });
      setJobs(j.data || []);
    } catch (e) {
      setLoadError((e as Error).message || "Could not load the existing masters");
    }
  }, [orgId]);
  useEffect(() => {
    load();
  }, [load]);

  const tally = useMemo(() => (file?.tally ? parseTallyXml(file.text) : null), [file]);
  const headers = useMemo(() => (file && !file.tally ? csvHeaders(file.text) : []), [file]);
  const batch = useMemo(() => {
    if (!file) return null;
    return tally ? tallyToBatch(tally, file.name, groupMap) : parseCsv(file.text, file.name, csvKind, mapping, groupMap);
  }, [file, tally, csvKind, mapping, groupMap]);
  const unmapped = useMemo(() => {
    if (!file) return [];
    if (tally) return unmappedGroups(tally, groupMap);
    return csvKind === "chart_of_accounts" ? csvUnmappedGroups(file.text, mapping, groupMap) : [];
  }, [file, tally, csvKind, mapping, groupMap]);
  const kinds = useMemo(
    () => (batch ? (tally ? IMPORT_ORDER.filter((k) => !excluded.has(k) && batch[BATCH_KEY[k]].length > 0) : [csvKind]) : []),
    [batch, tally, excluded, csvKind]
  );
  const validation = useMemo(
    () => (batch && masters ? validateBatch(batch, masters, new Set(kinds), confirmDiff) : null),
    [batch, masters, kinds, confirmDiff]
  );

  // Mapped groups stay listed so a choice can be changed.
  const groupRows = [...new Set([...Object.keys(groupMap), ...unmapped])];
  const missingColumns = file && !file.tally ? CSV_FIELDS[csvKind].filter((f) => f.required && !mapping[f.key]) : [];
  const step = results
    ? 5
    : !file
      ? 0
      : unmapped.length || missingColumns.length
        ? 2
        : validation?.errors.length
          ? 3
          : 4;

  if (!orgId) return <p className="text-sm text-ink-muted">Select a company to import data.</p>;

  const handleFile = async (f: File | undefined) => {
    if (!f) return;
    const text = decodeTallyBytes(await f.arrayBuffer());
    const isXml = /\.xml$/i.test(f.name) || text.trimStart().startsWith("<");
    setResults(null);
    setGroupMap({});
    setExcluded(new Set());
    setConfirmDiff(false);
    setFile({ name: f.name, text, tally: isXml });
    if (!isXml) setMapping(suggestMapping(csvKind, csvHeaders(text)));
  };

  const changeKind = (k: ImportKind) => {
    setCsvKind(k);
    setGroupMap({});
    if (file) setMapping(suggestMapping(k, headers));
  };

  // One job per kind, in dependency order; each is all or nothing and the run stops at the first failure.
  const apply = async () => {
    if (!file || !validation || validation.errors.length) return;
    setApplying(true);
    const done: Result[] = [];
    for (const kind of kinds) {
      const rows = validation.payload[kind] ?? [];
      if (!rows.length) continue;
      try {
        const created = await importsApi.create(orgId, {
          kind,
          source: tally ? "tally_xml" : "csv",
          filename: file.name,
          row_count: rows.length,
          errors: [],
          allow_opening_difference: kind === "opening_balances" && confirmDiff,
        });
        const job = (await importsApi.apply(orgId, created.data[0].id, rows)).data;
        done.push({ kind, job });
        if (job.status !== "applied") break;
      } catch (e) {
        done.push({ kind, error: (e as Error).message || "Import failed" });
        break;
      }
    }
    setResults(done);
    setFile(null);
    setApplying(false);
    window.dispatchEvent(new Event("deku_ledger_updated"));
    await load();
  };

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-xs" aria-label="Import steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined}>
            <Badge variant={i === step ? "teal" : i < step ? "success" : "outline"} size="md">
              {i + 1}. {s}
            </Badge>
          </li>
        ))}
      </ol>
      {loadError && (
        <p role="alert" className="rounded-lg border border-line bg-canvas p-3 text-sm text-ink">
          {loadError}
        </p>
      )}

      <section className={card}>
        <h2 className="text-sm font-semibold text-ink">Upload</h2>
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-line-strong px-3 py-2 text-sm text-ink hover:bg-canvas">
            <UploadCloud className="h-4 w-4 text-ink-muted" />
            {file?.name || "Choose a Tally XML export or a CSV file"}
            <input type="file" accept=".xml,.csv,text/xml,text/csv" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
          </label>
          <p className="max-w-xl text-xs text-ink-muted">
            The file is read in your browser and never uploaded. Only the rows you apply are sent to Deku. In Tally, use
            Export (Alt+E) with format XML for masters and for vouchers (Day Book).
          </p>
        </div>
      </section>

      {file && batch && (
        <section className={card}>
          <h2 className="text-sm font-semibold text-ink">Detect</h2>
          {tally ? (
            <p className="text-sm text-ink-soft">
              Tally XML: {tally.groups.length} groups, {tally.ledgers.length} ledgers, {tally.stockItems.length} stock items,{" "}
              {tally.vouchers.length} vouchers.
            </p>
          ) : (
            <div className="w-64">
              <label htmlFor="imp-kind" className={labelClass}>
                This CSV holds
              </label>
              <select id="imp-kind" className={`${fieldClass} mt-1`} value={csvKind} onChange={(e) => changeKind(e.target.value as ImportKind)}>
                {IMPORT_ORDER.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>
      )}

      {file && (!file.tally || groupRows.length > 0) && (
        <section className={card}>
          <h2 className="text-sm font-semibold text-ink">Map</h2>
          {!file.tally && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CSV_FIELDS[csvKind].map((f) => (
                <div key={f.key}>
                  <label htmlFor={`imp-map-${f.key}`} className={labelClass}>
                    {f.label}
                    {f.required ? " *" : ""}
                  </label>
                  <select
                    id={`imp-map-${f.key}`}
                    className={`${fieldClass} mt-1`}
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value || undefined }))}
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
          )}
          {groupRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-ink-muted">
                These groups are not standard Tally groups. Choose where their ledgers belong in Deku; nothing is guessed.
              </p>
              {groupRows.map((g) => (
                <div key={g} className="flex flex-wrap items-center gap-3">
                  <label htmlFor={`imp-group-${g}`} className="w-56 text-sm text-ink">
                    {g}
                  </label>
                  <select
                    id={`imp-group-${g}`}
                    className={`${fieldClass} max-w-xs`}
                    value={targetValue(groupMap[g])}
                    onChange={(e) => e.target.value && setGroupMap((m) => ({ ...m, [g]: toTarget(e.target.value as (typeof TARGETS)[number], g) }))}
                  >
                    <option value="">Choose…</option>
                    {TARGETS.map((t) => (
                      <option key={t} value={t}>
                        {TARGET_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {file && batch && validation && !unmapped.length && !missingColumns.length && (
        <section className={card}>
          <h2 className="text-sm font-semibold text-ink">Validate</h2>
          {validation.errors.length === 0 ? (
            <p className="text-sm text-ink-soft">
              <Badge variant="success">No problems found</Badge> GSTINs, duplicates, balances and account references were checked.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-ink">
                <Badge variant="danger">{validation.errors.length} to fix</Badge> Fix these in the file (or leave the section out) and choose it
                again. Row is the line in a CSV, or the position within its section in a Tally file.
              </p>
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-ink-muted">
                      <th className="py-1.5 pr-3 font-medium">Section</th>
                      <th className="py-1.5 pr-3 font-medium">Row</th>
                      <th className="py-1.5 font-medium">Problem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.errors.slice(0, 500).map((e, i) => (
                      <tr key={i} className="border-b border-line">
                        <td className="py-1.5 pr-3 text-ink-soft">{e.kind ? KIND_LABELS[e.kind] : "File"}</td>
                        <td className="py-1.5 pr-3 font-mono text-ink">{e.row || "–"}</td>
                        <td className="py-1.5 text-ink">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {file && batch && validation && !unmapped.length && !missingColumns.length && (
        <section className={card}>
          <h2 className="text-sm font-semibold text-ink">Review</h2>
          <ul className="space-y-1 text-sm">
            {IMPORT_ORDER.filter((k) => (tally ? batch[BATCH_KEY[k]].length > 0 : k === csvKind)).map((k) => (
              <li key={k} className="flex items-center gap-2 text-ink">
                {tally && (
                  <input
                    type="checkbox"
                    aria-label={`Import ${KIND_LABELS[k]}`}
                    checked={!excluded.has(k)}
                    onChange={(e) =>
                      setExcluded((s) => {
                        const n = new Set(s);
                        if (e.target.checked) n.delete(k);
                        else n.add(k);
                        return n;
                      })
                    }
                  />
                )}
                {KIND_LABELS[k]}: {(validation.payload[k] ?? batch[BATCH_KEY[k]]).length}
              </li>
            ))}
          </ul>
          {kinds.includes("opening_balances") && validation.openingDiffPaise !== 0 && (
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" className="mt-1" checked={confirmDiff} onChange={(e) => setConfirmDiff(e.target.checked)} />
              Opening debits and credits differ by {formatINR(Math.abs(validation.openingDiffPaise) / 100)}. Post the difference to an
              &quot;Opening Balance Difference&quot; equity account.
            </label>
          )}
          <p className="text-xs text-ink-muted">
            Each section is applied as one all-or-nothing job, in the order shown; if one fails, the later ones are not applied. Opening
            balances become one journal dated the first day of the current fiscal period. Vouchers are posted, or submitted for approval when
            maker-checker is on; an accountant&apos;s vouchers stay drafts for the owner, CFO or admin to post.
          </p>
          <Button variant="tally" isLoading={applying} disabled={validation.errors.length > 0 || kinds.length === 0} onClick={apply}>
            Apply import
          </Button>
        </section>
      )}

      {results && (
        <section className={card}>
          <h2 className="text-sm font-semibold text-ink">Apply</h2>
          <ul className="space-y-1 text-sm">
            {results.map((r) => (
              <li key={r.kind} className="text-ink">
                {KIND_LABELS[r.kind]}:{" "}
                {r.job?.status === "applied" ? (
                  <Badge variant="success">{r.job.row_count} imported</Badge>
                ) : (
                  <>
                    <Badge variant="danger">nothing imported</Badge>{" "}
                    {r.error ?? r.job?.errors.map((e) => `${e.row ? `Row ${e.row}: ` : ""}${e.message}`).join("; ")}
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={card}>
        <h2 className="text-sm font-semibold text-ink">Recent imports</h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-ink-muted">No imports yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  <th className="py-1.5 pr-3 font-medium">When</th>
                  <th className="py-1.5 pr-3 font-medium">What</th>
                  <th className="py-1.5 pr-3 font-medium">File</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Rows</th>
                  <th className="py-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-b border-line">
                    <td className="py-1.5 pr-3 text-ink-soft">{new Date(j.created_at).toLocaleString("en-IN")}</td>
                    <td className="py-1.5 pr-3 text-ink">{KIND_LABELS[j.kind]}</td>
                    <td className="py-1.5 pr-3 text-ink-soft">{j.filename ?? "–"}</td>
                    <td className="py-1.5 pr-3 text-right font-mono text-ink">{j.row_count}</td>
                    <td className="py-1.5">
                      <Badge variant={j.status === "applied" ? "success" : j.status === "failed" ? "danger" : "default"}>{j.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
