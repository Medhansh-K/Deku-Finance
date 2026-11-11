"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, FilePlus2, Undo2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { accountingApi, bankingApi, BankPosition, BankReconciliation, partiesApi, ReconciliationStatement } from "@/api/endpoints";
import { Account, JournalEntry } from "@/types/accounting";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally } from "@/lib/formatters/date";
import { parseStatement, ParsedStatement, StatementLine } from "@/lib/bank/statement-parser";
import { CandidateLine, matchStatement, ScoredCandidate } from "@/lib/bank/matcher";
import { summariseStatement } from "@/lib/bank/reconciliation";

type Tab = "matched" | "suggested" | "unmatched";

const TH = "px-3.5 py-2.5 text-[12.5px] font-medium text-ink-muted bg-canvas-sunken/50 border-b border-line whitespace-nowrap";

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
  const [statements, setStatements] = useState<ReconciliationStatement[]>([]);
  const [statementDate, setStatementDate] = useState("");
  const [closing, setClosing] = useState("");
  const [position, setPosition] = useState<BankPosition | null>(null);
  // The amount the user ticked, so a figure that moves afterwards needs ticking again.
  const [acceptedPaise, setAcceptedPaise] = useState<number | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("deku_active_org_id");
    if (saved) setOrgId(saved);
  }, []);

  useEffect(() => {
    if (!orgId) return;
    bankingApi
      .listStatements(orgId)
      .then((res) => setStatements(res.data || []))
      .catch((err) => setError(err.message || "Completed reconciliations could not be loaded"));
  }, [orgId]);

  // Depends on recs so the figures follow each Confirm and Undo.
  useEffect(() => {
    setPosition(null);
    if (!orgId || !accountId || !statementDate) return;
    let stale = false;
    bankingApi
      .position(orgId, accountId, statementDate)
      .then((res) => {
        if (!stale) setPosition(res.data);
      })
      .catch((err) => {
        if (!stale) setError(err.message || "The book balance could not be loaded");
      });
    return () => {
      stale = true;
    };
  }, [orgId, accountId, statementDate, recs]);

  useEffect(() => {
    if (!orgId) return;
    accountingApi
      .listAccounts(orgId)
      .then((res) => setAccounts((res.data || []).filter((a) => a.is_postable && a.ledger === "Cash & Liquid Capital" && a.type === "asset")))
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

  const closingPaise = closing.trim() === "" || isNaN(Number(closing)) ? null : Math.round(Number(closing) * 100);
  const summary =
    position && closingPaise !== null
      ? summariseStatement(position, closingPaise, results.map((r) => r.line), statementDate)
      : null;
  const alreadyCompleted = statements.some((s) => s.bank_account_id === accountId && s.statement_date === statementDate);
  const visibleStatements = accountId ? statements.filter((s) => s.bank_account_id === accountId) : statements;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseStatement(await file.text());
    setFileName(file.name);
    setStatement(parsed);
    setTab("suggested");
    if (!statementDate && parsed.lines.length) {
      setStatementDate(parsed.lines.map((l) => l.date).sort().at(-1)!);
    }
  };

  const complete = async () => {
    if (!summary || closingPaise === null) return;
    setIsCompleting(true);
    setError(null);
    try {
      const res = await bankingApi.completeStatement(orgId, {
        bank_account_id: accountId,
        statement_date: statementDate,
        closing_balance: closingPaise / 100,
        statement_only_amount: summary.statementOnlyPaise / 100,
        accepted_difference: summary.unexplainedPaise === 0 ? null : summary.unexplainedPaise / 100,
      });
      setClosing("");
      setAcceptedPaise(null);
      setStatements((prev) =>
        [...(res.data || []), ...prev].sort((a, b) => b.statement_date.localeCompare(a.statement_date))
      );
    } catch (err: any) {
      setError(err.message || "Failed to complete the reconciliation");
    } finally {
      setIsCompleting(false);
    }
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
        <span className="font-mono text-[12.5px] font-medium">{s.candidate.entryNumber}</span>{" "}
        <span className="text-ink-muted">{formatDateTally(s.candidate.date)}</span>
        <span className="ml-2 text-[12.5px] text-ink-muted">Score {s.score}</span>
        <p className="text-[12.5px] text-ink-muted">{s.reasons.join(" · ")}</p>
      </div>
      <Button size="sm" variant="secondary" isLoading={busyId === s.candidate.id} onClick={() => confirm(line, s.candidate)}>
        <Check className="h-3.5 w-3.5" /> Confirm
      </Button>
    </div>
  );

  const statementCells = (line: StatementLine) => (
    <>
      <td className="px-3.5 py-2.5 whitespace-nowrap align-top">{formatDateTally(line.date)}</td>
      <td className="px-3.5 py-2.5 align-top">
        <span className="block break-words">{line.narration || "—"}</span>
        {line.reference && <span className="text-[12.5px] text-ink-muted">Ref <span className="font-mono">{line.reference}</span></span>}
        {line.balanceMismatch && (
          <Badge variant="warning" className="ml-2">Balance break</Badge>
        )}
      </td>
      <td className={`px-3.5 py-2.5 text-right tabular-nums whitespace-nowrap align-top ${line.direction === "in" ? "text-ok" : "text-bad"}`}>
        {line.direction === "in" ? "+" : "−"}
        {formatINR(line.amountPaise / 100, { showCurrencySymbol: false })}
      </td>
    </>
  );

  return (
    <div className="space-y-4 text-[13.5px] text-ink">
      <div data-tour="recon-controls" className="flex flex-col md:flex-row md:items-end gap-3 rounded-panel border border-line bg-surface px-5 py-4">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-ink-soft">Bank account</span>
          <select
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setClosing("");
              setAcceptedPaise(null);
            }}
            className="h-9 rounded-ctl border border-line-strong bg-surface px-3 text-[13.5px] text-ink focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20 min-w-64"
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
          <span className="text-[13px] font-medium text-ink-soft">Statement (CSV)</span>
          <span data-tour="recon-statement" className="inline-flex items-center gap-2 h-9 border border-dashed border-line-strong rounded-ctl px-3 text-ink-soft cursor-pointer hover:bg-canvas">
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
        <p className="text-[12.5px] text-ink-muted md:ml-auto max-w-sm">
          The statement is read in your browser and is not uploaded anywhere. Matches are only
          suggestions until you confirm them.
        </p>
      </div>

      {(error || recsError) && (
        <div role="alert" className="px-5 py-3.5 rounded-panel bg-bad-wash border border-bad/25 text-bad flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div>
            {error && <p>{error}</p>}
            {recsError && <p>Saved reconciliations unavailable: {recsError}</p>}
          </div>
        </div>
      )}

      {statement && statement.errors.length > 0 && (
        <div className="px-5 py-3.5 rounded-panel bg-warn-wash border border-warn/25 text-warn">
          <p className="font-semibold mb-1">
            {statement.errors.length} row{statement.errors.length === 1 ? "" : "s"} could not be read and were not matched
          </p>
          <ul className="space-y-0.5 text-[12.5px]">
            {statement.errors.map((e) => (
              <li key={e.row}>
                {e.row > 0 && `Row ${e.row}: `}
                {e.reason}
                {e.raw && <span className="font-mono opacity-75"> — {e.raw}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {statement && (
        <div className="rounded-panel border border-line bg-surface overflow-hidden">
          <div data-tour="recon-tabs" className="flex flex-wrap items-center gap-1 border-b border-line px-3">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-2.5 text-[13.5px] border-b-2 -mb-px transition-colors ${
                  tab === t.id ? "border-brand text-ink font-medium" : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {t.label} <span className={tab === t.id ? "text-brand-strong" : "text-ink-subtle"}>{t.lines.length}</span>
              </button>
            ))}
            <div className="ml-auto py-2 px-2 text-[12.5px] text-ink-muted tabular-nums">
              In {formatINR(activeTotals.inP / 100)} · Out {formatINR(activeTotals.outP / 100)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className={`${TH} w-28`}>Date</th>
                  <th className={TH}>Statement narration</th>
                  <th className={`${TH} text-right w-36`}>Amount (₹)</th>
                  <th className={`${TH} w-[40%]`}>
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
                        <td className="px-3.5 py-2.5 align-top">
                          <div className="flex items-start justify-between gap-3">
                            <span>
                              <span className="font-mono text-[12.5px] font-medium">{book?.entryNumber || rec.journal_entry_line_id}</span>
                              <span className="block text-[12.5px] text-ink-muted">
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
                      <td className="px-3.5 py-2.5 align-top">
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
                      <td className="px-3.5 py-2.5 align-top">
                        <Link
                          href={voucherHref(r.line, accountId)}
                          className="inline-flex items-center gap-1.5 font-medium text-brand-strong hover:underline"
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

      {accountId && (
        <div data-tour="recon-complete" className="rounded-panel border border-line bg-surface p-5 space-y-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">Finish this statement</h2>
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-medium text-ink-soft">Statement date</span>
              <input
                type="date"
                value={statementDate}
                onChange={(e) => setStatementDate(e.target.value)}
                className="h-9 rounded-ctl border border-line-strong bg-surface px-3 text-[13.5px] text-ink focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-medium text-ink-soft">Closing balance on the statement (₹)</span>
              <input
                type="number"
                step="0.01"
                value={closing}
                onChange={(e) => setClosing(e.target.value)}
                className="h-9 rounded-ctl border border-line-strong bg-surface px-3 text-[13.5px] text-ink focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20 text-right tabular-nums"
              />
            </label>
          </div>

          {!summary && (
            <p className="text-ink-muted">Enter the statement date and closing balance to compare them with your books.</p>
          )}
          {summary && (
            <>
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                {[
                  { label: "Book balance at this date", paise: summary.bookPaise },
                  { label: "Matched", paise: summary.matchedPaise },
                  { label: "In the books, not on the statement", paise: summary.unclearedPaise },
                  { label: "On the statement, not matched", paise: summary.statementOnlyPaise },
                  { label: "Difference (closing less book)", paise: summary.differencePaise },
                  { label: "Unexplained", paise: summary.unexplainedPaise },
                ].map((f) => (
                  <div key={f.label}>
                    <dt className="text-[13px] text-ink-muted">{f.label}</dt>
                    <dd className="text-[15px] font-semibold tabular-nums">{formatINR(f.paise / 100)}</dd>
                  </div>
                ))}
              </dl>
              {!statement && (
                <p className="text-[12.5px] text-ink-muted">No statement is loaded, so no statement lines are counted as unmatched.</p>
              )}
              {summary.unexplainedPaise !== 0 && !alreadyCompleted && (
                <label className="flex items-start gap-2 px-4 py-3 rounded-ctl bg-warn-wash border border-warn/25 text-warn">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-brand"
                    checked={acceptedPaise === summary.unexplainedPaise}
                    onChange={(e) => setAcceptedPaise(e.target.checked ? summary.unexplainedPaise : null)}
                  />
                  <span>
                    {formatINR(summary.unexplainedPaise / 100)} is not explained by the matched and unmatched amounts. Record
                    this reconciliation with that difference showing. It can&apos;t be changed afterwards.
                  </span>
                </label>
              )}
              {alreadyCompleted ? (
                <p className="text-ink-muted">This bank account already has a completed reconciliation for this date.</p>
              ) : (
                <Button
                  variant="tally"
                  isLoading={isCompleting}
                  disabled={summary.unexplainedPaise !== 0 && acceptedPaise !== summary.unexplainedPaise}
                  onClick={complete}
                >
                  <Check className="h-4 w-4" /> Complete reconciliation
                </Button>
              )}
            </>
          )}
        </div>
      )}

      <div data-tour="recon-history" className="rounded-panel border border-line bg-surface overflow-hidden">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink px-5 pt-4 pb-3">Completed reconciliations</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className={TH}>Statement date</th>
                <th className={TH}>Bank account</th>
                <th className={`${TH} text-right`}>Closing balance (₹)</th>
                <th className={`${TH} text-right`}>Book balance (₹)</th>
                <th className={`${TH} text-right`}>Difference (₹)</th>
                <th className={TH}>Status</th>
                <th className={TH}>Recorded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visibleStatements.map((s) => {
                const account = accounts.find((a) => a.id === s.bank_account_id);
                return (
                  <tr key={s.id}>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">{formatDateTally(s.statement_date)}</td>
                    <td className="px-3.5 py-2.5">{account ? `${account.code} · ${account.name}` : "—"}</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums whitespace-nowrap">{formatINR(s.closing_balance, { showCurrencySymbol: false })}</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums whitespace-nowrap">{formatINR(s.book_balance, { showCurrencySymbol: false })}</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums whitespace-nowrap">{formatINR(s.difference, { showCurrencySymbol: false })}</td>
                    <td className="px-3.5 py-2.5">
                      {Number(s.unexplained_difference) === 0 ? (
                        <Badge variant="success">Explained</Badge>
                      ) : (
                        <Badge variant="warning">{formatINR(s.unexplained_difference)} unexplained</Badge>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5">
                      {s.recorded_by_name || "—"}
                      <span className="block text-[12.5px] text-ink-muted">{formatDateTally(s.recorded_at)}</span>
                    </td>
                  </tr>
                );
              })}
              {visibleStatements.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-ink-muted">No reconciliations completed yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
