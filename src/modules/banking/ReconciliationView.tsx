"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, FilePlus2, Undo2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { accountingApi, bankingApi, BankReconciliation, partiesApi } from "@/api/endpoints";
import { Account, JournalEntry } from "@/types/accounting";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally } from "@/lib/formatters/date";
import { parseStatement, ParsedStatement, StatementLine } from "@/lib/bank/statement-parser";
import { CandidateLine, matchStatement, ScoredCandidate } from "@/lib/bank/matcher";

type Tab = "matched" | "suggested" | "unmatched";

const toPaise = (v: number | string) => Math.round(Number(v) * 100);
const signedPaise = (l: StatementLine) => (l.direction === "in" ? l.amountPaise : -l.amountPaise);
const lineKey = (date: string, paise: number, ref: string, narration: string) => `${date}|${paise}|${ref}|${narration}`;

function totals(lines: StatementLine[]) {
  let inP = 0;
  let outP = 0;
  for (const l of lines) {
    if (l.direction === "in") inP += l.amountPaise;
    else outP += l.amountPaise;
  }
  return { count: lines.length, inP, outP };
}

function voucherHref(line: StatementLine, bankAccountId: string) {
  const params = new URLSearchParams({
    amount: (line.amountPaise / 100).toFixed(2),
    date: line.date,
    narration: line.narration,
    reference: line.reference,
    bank_account_id: bankAccountId,
  });
  return `/vouchers/${line.direction === "in" ? "receipt" : "payment"}?${params}`;
}

export function ReconciliationView() {
  const [orgId, setOrgId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [partyNames, setPartyNames] = useState<Record<string, string>>({});
  const [recs, setRecs] = useState<BankReconciliation[]>([]);
  const [recsError, setRecsError] = useState<string | null>(null);
  const [statement, setStatement] = useState<ParsedStatement | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("suggested");

  useEffect(() => {
    const saved = localStorage.getItem("deku_active_org_id");
    if (saved) setOrgId(saved);
  }, []);

  useEffect(() => {
    if (!orgId) return;
    accountingApi
      .listAccounts(orgId)
      .then((res) => setAccounts((res.data || []).filter((a) => a.is_postable && a.type === "asset")))
      .catch((err) => setError(err.message || "Failed to load accounts"));
  }, [orgId]);

  useEffect(() => {
    if (!orgId || !accountId) return;
    setIsLoading(true);
    setError(null);
    setRecsError(null);
    // shortcut: loads every journal and filters to this account in the browser; add a server-side
    // filtered endpoint when an organisation's journal count makes this slow.
    Promise.all([accountingApi.listJournals(orgId), partiesApi.list(orgId)])
      .then(([jRes, pRes]) => {
        setJournals(jRes.data || []);
        setPartyNames(Object.fromEntries((pRes.data || []).map((p) => [p.id, p.display_name || p.legal_name])));
      })
      .catch((err) => setError(err.message || "Failed to load journal entries"))
      .finally(() => setIsLoading(false));
    bankingApi
      .listReconciliations(orgId, accountId)
      .then((res) => setRecs(res.data || []))
      .catch((err) => {
        setRecs([]);
        setRecsError(err.message || "Saved reconciliations could not be loaded");
      });
  }, [orgId, accountId]);

  // Posted journal lines on the chosen bank account, keyed by line id.
  const bookLines = useMemo(() => {
    const map = new Map<string, CandidateLine>();
    for (const e of journals) {
      if (e.status !== "posted") continue;
      for (const l of e.journal_entry_lines || []) {
        if (l.account_id !== accountId || !l.id) continue;
        const debit = toPaise(l.debit || 0);
        map.set(l.id, {
          id: l.id,
          date: e.entry_date,
          amountPaise: debit > 0 ? debit : toPaise(l.credit || 0),
          direction: debit > 0 ? "in" : "out",
          entryNumber: e.entry_number,
          reference: e.reference,
          narration: [e.narration, l.description].filter(Boolean).join(" "),
          partyName: l.party_id ? partyNames[l.party_id] : null,
        });
      }
    }
    return map;
  }, [journals, accountId, partyNames]);

  const { matched, results } = useMemo(() => {
    const pool = new Map<string, BankReconciliation[]>();
    for (const r of recs) {
      const k = lineKey(r.statement_date, toPaise(r.statement_amount), r.statement_reference || "", r.statement_narration || "");
      pool.set(k, [...(pool.get(k) || []), r]);
    }
    const matched: { line: StatementLine; rec: BankReconciliation }[] = [];
    const open: StatementLine[] = [];
    for (const line of statement?.lines || []) {
      const rec = pool.get(lineKey(line.date, signedPaise(line), line.reference, line.narration))?.shift();
      if (rec) matched.push({ line, rec });
      else open.push(line);
    }
    const reconciled = new Set(recs.map((r) => r.journal_entry_line_id));
    const candidates = [...bookLines.values()].filter((c) => !reconciled.has(c.id));
    return { matched, results: matchStatement(open, candidates) };
  }, [statement, recs, bookLines]);

  const suggested = results.filter((r) => r.status !== "unmatched");
  const unmatched = results.filter((r) => r.status === "unmatched");

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setStatement(parseStatement(await file.text()));
    setTab("suggested");
  };

  const confirm = async (line: StatementLine, c: CandidateLine) => {
    setBusyId(c.id);
    setError(null);
    try {
      const res = await bankingApi.reconcile(orgId, {
        bank_account_id: accountId,
        statement_date: line.date,
        statement_amount: signedPaise(line) / 100,
        statement_reference: line.reference,
        statement_narration: line.narration,
        journal_entry_line_id: c.id,
      });
      setRecs((prev) => [...prev, ...(res.data || [])]);
    } catch (err: any) {
      setError(err.message || "Failed to save reconciliation");
    } finally {
      setBusyId(null);
    }
  };

  const undo = async (rec: BankReconciliation) => {
    setBusyId(rec.id);
    setError(null);
    try {
      await bankingApi.unreconcile(orgId, rec.id);
      setRecs((prev) => prev.filter((r) => r.id !== rec.id));
    } catch (err: any) {
      setError(err.message || "Failed to undo reconciliation");
    } finally {
      setBusyId(null);
    }
  };

  const tabs: { id: Tab; label: string; lines: StatementLine[] }[] = [
    { id: "matched", label: "Matched", lines: matched.map((m) => m.line) },
    { id: "suggested", label: "Suggested", lines: suggested.map((r) => r.line) },
    { id: "unmatched", label: "Unmatched", lines: unmatched.map((r) => r.line) },
  ];
  const activeTotals = totals(tabs.find((t) => t.id === tab)!.lines);

  const candidateCell = (line: StatementLine, s: ScoredCandidate) => (
    <div key={s.candidate.id} className="flex items-start justify-between gap-3 py-1">
      <div>
        <span className="font-mono font-bold">{s.candidate.entryNumber}</span>{" "}
        <span className="text-ink-muted">{formatDateTally(s.candidate.date)}</span>
        <span className="ml-2 font-mono text-[10px] text-ink-muted">score {s.score}</span>
        <p className="text-[11px] text-ink-muted">{s.reasons.join(" · ")}</p>
      </div>
      <Button size="sm" variant="outline" isLoading={busyId === s.candidate.id} onClick={() => confirm(line, s.candidate)}>
        <Check className="h-3.5 w-3.5" /> Confirm
      </Button>
    </div>
  );

  const statementCells = (line: StatementLine) => (
    <>
      <td className="py-2 px-3 font-mono whitespace-nowrap align-top">{formatDateTally(line.date)}</td>
      <td className="py-2 px-3 align-top">
        <span className="block break-words">{line.narration || "—"}</span>
        {line.reference && <span className="font-mono text-[10px] text-ink-muted">Ref {line.reference}</span>}
        {line.balanceMismatch && (
          <Badge variant="warning" className="ml-2">Balance break</Badge>
        )}
      </td>
      <td className={`py-2 px-3 text-right font-mono whitespace-nowrap align-top ${line.direction === "in" ? "text-emerald-700" : "text-rose-700"}`}>
        {line.direction === "in" ? "+" : "−"}
        {formatINR(line.amountPaise / 100, { showCurrencySymbol: false })}
      </td>
    </>
  );

  return (
    <div className="space-y-4 font-sans text-xs">
      <div className="flex flex-col md:flex-row md:items-end gap-3 bg-surface p-3 rounded border border-line">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[11px] text-ink-muted">Bank account</span>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="border border-line-strong rounded px-2 py-1.5 text-xs min-w-64 bg-surface"
          >
            <option value="">Select a bank account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[11px] text-ink-muted">Statement (CSV)</span>
          <span className="inline-flex items-center gap-2 border border-dashed border-line-strong rounded px-3 py-1.5 cursor-pointer hover:bg-canvas">
            <UploadCloud className="h-4 w-4 text-ink-muted" />
            {fileName || "Choose file"}
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              disabled={!accountId}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </span>
        </label>
        <p className="text-[11px] text-ink-muted md:ml-auto max-w-sm">
          The statement is read in your browser and is not uploaded anywhere. Matches are only
          suggestions until you confirm them.
        </p>
      </div>

      {(error || recsError) && (
        <div className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div>
            {error && <p>{error}</p>}
            {recsError && <p>Saved reconciliations unavailable: {recsError}</p>}
          </div>
        </div>
      )}

      {statement && statement.errors.length > 0 && (
        <div className="p-3 rounded bg-amber-50 border border-amber-300 text-amber-800">
          <p className="font-bold mb-1">
            {statement.errors.length} row{statement.errors.length === 1 ? "" : "s"} could not be read and were not matched
          </p>
          <ul className="space-y-0.5 font-mono text-[11px]">
            {statement.errors.map((e) => (
              <li key={e.row}>
                {e.row > 0 && `Row ${e.row}: `}
                {e.reason}
                {e.raw && <span className="text-amber-700/70"> — {e.raw}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {statement && (
        <div className="bg-surface border border-line rounded-lg overflow-hidden">
          <div className="flex flex-wrap items-center gap-1 border-b border-line px-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${
                  tab === t.id ? "border-[var(--deku-teal)] text-ink" : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {t.label} <span className="font-mono">({t.lines.length})</span>
              </button>
            ))}
            <div className="ml-auto py-2 px-2 font-mono text-[11px] text-ink-soft">
              In {formatINR(activeTotals.inP / 100)} · Out {formatINR(activeTotals.outP / 100)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-canvas-sunken border-b border-line-strong font-mono text-[11px] text-ink-soft">
                  <th className="py-2 px-3 w-28">Date</th>
                  <th className="py-2 px-3">Statement narration</th>
                  <th className="py-2 px-3 text-right w-36">Amount (₹)</th>
                  <th className="py-2 px-3 w-[40%]">
                    {tab === "matched" ? "Journal entry" : tab === "suggested" ? "Proposed match" : "Action"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {isLoading && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-ink-muted">Loading journal entries…</td>
                  </tr>
                )}
                {!isLoading && tab === "matched" &&
                  matched.map(({ line, rec }) => {
                    const book = bookLines.get(rec.journal_entry_line_id);
                    return (
                      <tr key={line.row}>
                        {statementCells(line)}
                        <td className="py-2 px-3 align-top">
                          <div className="flex items-start justify-between gap-3">
                            <span>
                              <span className="font-mono font-bold">{book?.entryNumber || rec.journal_entry_line_id}</span>
                              <span className="block text-[11px] text-ink-muted">
                                Reconciled {formatDateTally(rec.reconciled_at)}
                              </span>
                            </span>
                            <Button size="sm" variant="ghost" isLoading={busyId === rec.id} onClick={() => undo(rec)}>
                              <Undo2 className="h-3.5 w-3.5" /> Undo
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                {!isLoading && tab === "suggested" &&
                  suggested.map((r) => (
                    <tr key={r.line.row}>
                      {statementCells(r.line)}
                      <td className="py-2 px-3 align-top">
                        {r.status === "suggested" && candidateCell(r.line, r.best)}
                        {r.status === "ambiguous" && (
                          <>
                            <Badge variant="warning">Tie: pick one</Badge>
                            {r.candidates.map((c) => candidateCell(r.line, c))}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                {!isLoading && tab === "unmatched" &&
                  unmatched.map((r) => (
                    <tr key={r.line.row}>
                      {statementCells(r.line)}
                      <td className="py-2 px-3 align-top">
                        <Link
                          href={voucherHref(r.line, accountId)}
                          className="inline-flex items-center gap-1.5 font-medium underline text-ink"
                        >
                          <FilePlus2 className="h-3.5 w-3.5" />
                          Create {r.line.direction === "in" ? "receipt" : "payment"} voucher
                        </Link>
                      </td>
                    </tr>
                  ))}
                {!isLoading && activeTotals.count === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-ink-muted">Nothing here.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
