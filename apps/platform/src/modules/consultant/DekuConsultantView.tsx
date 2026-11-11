"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Sparkles,
  Send,
  AlertTriangle,
  ShieldAlert,
  Clock,
  TrendingUp,
  PieChart,
  ArrowRight,
  User,
  Paperclip,
  Database,
  Plus,
  Settings,
  Activity,
  Building2,
  Copy,
  Check,
  Search,
} from "lucide-react";
import { consultantApi, organisationsApi, OrgSummary } from "@/api/endpoints";
import { formatINR } from "@/lib/formatters/currency";
import { setActiveOrg } from "@/lib/organisation/active-org";
import { DekuLogo } from "@/components/ui/DekuLogo";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  model?: string;
}

// =============================================================================
// FINANCIAL TABLE COMPONENT 
// =============================================================================
function FinancialTable({
  categoryNumber,
  categoryTitle,
  headers,
  rows,
}: {
  categoryNumber?: string;
  categoryTitle?: string;
  headers: string[];
  rows: string[][];
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyToExcel = () => {
    // Generate clean TSV (Tab-Separated Values) format for direct Excel / Google Sheets pasting
    const tsvHeader = headers.join("\t");
    const tsvRows = rows
      .map((row) =>
        row
          .map((cell) => cell.replace(/\*\*/g, "").trim())
          .join("\t")
      )
      .join("\n");
    const fullTsv = `${categoryTitle ? `${categoryTitle}\n` : ""}${tsvHeader}\n${tsvRows}`;

    if (navigator?.clipboard) {
      navigator.clipboard.writeText(fullTsv).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }
  };

  return (
    <div className="my-3 rounded-panel border border-line bg-surface overflow-hidden">
      {/* Top Table Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-canvas border-b border-line">
        <div className="flex items-center gap-2">
          {categoryNumber && (
            <span className="h-5 min-w-5 px-1 rounded-chip bg-brand-wash text-brand-strong font-mono text-xs font-medium flex items-center justify-center shrink-0">
              {categoryNumber}
            </span>
          )}
          <span className="font-semibold text-[13.5px] text-ink tracking-tight">
            {categoryTitle || "Financial statement rollup"}
          </span>
        </div>

        {/* Copy to Excel Button (Matching Glowing Button from Reference) */}
        <button
          onClick={handleCopyToExcel}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-ctl text-[12.5px] font-medium transition-colors cursor-pointer border border-line-strong bg-surface text-ink-soft hover:bg-canvas-sunken hover:text-ink"
          title="Copy structured financial table directly to Excel / Google Sheets"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-ok" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy to Excel</span>
            </>
          )}
        </button>
      </div>

      {/* Structured Multi-Column Accounting Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px] border-collapse tabular-nums">
          <thead>
            <tr className="border-b border-line bg-[#fafbfa] text-[12.5px] font-medium text-ink-muted">
              {headers.map((h, idx) => (
                <th
                  key={idx}
                  className={`py-2 px-4 ${
                    idx === 0 ? "text-left" : "text-right"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, rowIdx) => {
              const isGroupRow =
                row[0]?.startsWith("**") && row[0]?.endsWith("**");
              return (
                <tr
                  key={rowIdx}
                  className={`transition-colors hover:bg-canvas/80 ${
                    isGroupRow
                      ? "bg-canvas/70 font-semibold text-ink"
                      : "text-ink-soft"
                  }`}
                >
                  {row.map((cell, colIdx) => {
                    const cleanCell = cell.replace(/\*\*/g, "").trim();
                    const isNil = cleanCell === "-" || cleanCell === "";
                    return (
                      <td
                        key={colIdx}
                        className={`py-2 px-4 whitespace-nowrap ${
                          colIdx === 0
                            ? isGroupRow
                              ? "font-semibold text-ink"
                              : "text-ink"
                            : "text-right"
                        } ${isNil ? "text-ink-subtle font-normal" : ""}`}
                      >
                        {cleanCell}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =============================================================================
// FINANCIAL MESSAGE RENDERER (PARSES MARKDOWN TABLES & FORMATS)
// =============================================================================
function FinancialMessageRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: Array<
    | { type: "text"; text: string }
    | { type: "heading"; level: number; text: string; badgeNumber?: string }
    | {
        type: "table";
        categoryNumber?: string;
        categoryTitle?: string;
        headers: string[];
        rows: string[][];
      }
  > = [];

  let currentTextLines: string[] = [];
  let currentTableLines: string[] = [];
  let pendingCategory: { number?: string; title: string } | null = null;

  const flushText = () => {
    if (currentTextLines.length > 0) {
      const text = currentTextLines.join("\n").trim();
      if (text) {
        blocks.push({ type: "text", text });
      }
      currentTextLines = [];
    }
  };

  const flushTable = () => {
    if (currentTableLines.length >= 2) {
      const headerLine = currentTableLines[0];
      const headers = headerLine
        .split("|")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const rows: string[][] = [];
      for (let i = 2; i < currentTableLines.length; i++) {
        const rowLine = currentTableLines[i].trim();
        if (rowLine.startsWith("|") && rowLine.endsWith("|")) {
          const cells = rowLine
            .split("|")
            .slice(1, -1)
            .map((s) => s.trim());
          if (cells.length > 0) {
            rows.push(cells);
          }
        }
      }

      if (headers.length > 0 && rows.length > 0) {
        blocks.push({
          type: "table",
          categoryNumber: pendingCategory?.number,
          categoryTitle: pendingCategory?.title,
          headers,
          rows,
        });
        pendingCategory = null;
      } else {
        currentTextLines.push(...currentTableLines);
      }
      currentTableLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if it's a category header like "### 2 Assets" or "### 1 Treasury"
    const headingMatch = trimmed.match(/^#{2,4}\s+(?:(\d+)\s+)?(.*)$/);
    if (headingMatch && !trimmed.startsWith("|")) {
      flushTable();
      flushText();
      const badgeNumber = headingMatch[1];
      const title = headingMatch[2].replace(/\*\*/g, "").trim();

      // Check if following lines are a markdown table
      let hasTableBelow = false;
      for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
        if (lines[j].trim().startsWith("|")) {
          hasTableBelow = true;
          break;
        } else if (lines[j].trim().length > 0 && !lines[j].trim().startsWith("|")) {
          break;
        }
      }

      if (hasTableBelow) {
        pendingCategory = { number: badgeNumber, title };
      } else {
        blocks.push({
          type: "heading",
          level: trimmed.startsWith("####") ? 4 : 3,
          text: title,
          badgeNumber,
        });
      }
      continue;
    }

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushText();
      currentTableLines.push(trimmed);
    } else {
      if (currentTableLines.length > 0) {
        flushTable();
      }
      currentTextLines.push(line);
    }
  }

  flushTable();
  flushText();

  return (
    <div className="space-y-2.5 font-sans text-[13.5px] leading-relaxed">
      {blocks.map((block, idx) => {
        if (block.type === "table") {
          return (
            <FinancialTable
              key={idx}
              categoryNumber={block.categoryNumber}
              categoryTitle={block.categoryTitle}
              headers={block.headers}
              rows={block.rows}
            />
          );
        }

        if (block.type === "heading") {
          return (
            <div key={idx} className="flex items-center gap-2 pt-2 pb-1">
              {block.badgeNumber && (
                <span className="h-5 min-w-5 px-1 rounded-chip bg-brand-wash text-brand-strong font-mono text-xs font-medium flex items-center justify-center shrink-0">
                  {block.badgeNumber}
                </span>
              )}
              <h4 className="font-semibold text-[14px] text-ink tracking-tight">
                {block.text}
              </h4>
            </div>
          );
        }

        // Text block formatting
        const textLines = block.text.split("\n");
        return (
          <div key={idx} className="space-y-1">
            {textLines.map((l, lIdx) => {
              const trimmed = l.trim();
              if (!trimmed) return <div key={lIdx} className="h-1" />;

              if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                const bulletContent = trimmed.substring(2);
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand mt-2 shrink-0" />
                    <span>{renderInlineMarkdown(bulletContent)}</span>
                  </div>
                );
              }

              if (trimmed.match(/^\d+\.\s+/)) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-1">
                    <span className="font-medium tabular-nums text-[13px] text-brand-strong shrink-0">
                      {trimmed.match(/^\d+\./)?.[0]}
                    </span>
                    <span>{renderInlineMarkdown(trimmed.replace(/^\d+\.\s+/, ""))}</span>
                  </div>
                );
              }

              return <p key={lIdx}>{renderInlineMarkdown(trimmed)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

// Inline Markdown Bold & Code Parser
function renderInlineMarkdown(str: string): React.ReactNode {
  const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={idx}
          className="font-mono text-[12.5px] bg-canvas-sunken text-ink px-1 rounded-[4px] border border-line"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// =============================================================================
// MAIN DEKU CONSULTANT VIEW COMPONENT
// =============================================================================
export function DekuConsultantView() {
  const router = useRouter();

  // Organizations / Workbenches
  const [orgList, setOrgList] = useState<OrgSummary[]>([]);

  const [activeOrgId, setActiveOrgId] = useState<string>("");
  const [activeOrgName, setActiveOrgName] = useState<string>("");
  const [contextData, setContextData] = useState<any>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [contextFailed, setContextFailed] = useState(false);

  // Chat conversation state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Typewriter state for greeting
  const { user } = useAuth();
  const userName = user?.full_name || user?.email || "";

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync active org from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedId = localStorage.getItem("deku_active_org_id");
      const savedName = localStorage.getItem("deku_active_org_name");
      if (savedId) setActiveOrgId(savedId);
      if (savedName) setActiveOrgName(savedName);
    }
  }, []);

  // Fetch all organisations
  useEffect(() => {
    organisationsApi
      .list()
      .then((res) => {
        if (res.data && res.data.length > 0) {
          setOrgList(res.data);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch grounding context from backend
  const loadContext = async (orgIdToLoad: string) => {
    if (!orgIdToLoad) return;
    setIsLoadingContext(true);
    setContextFailed(false);
    try {
      const res = await consultantApi.getContext(orgIdToLoad);
      if (res.context) {
        setContextData(res.context);
      }
    } catch {
      setContextFailed(true);
    } finally {
      setIsLoadingContext(false);
    }
  };

  useEffect(() => {
    loadContext(activeOrgId);
  }, [activeOrgId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  // Handle switching workbenches
  const handleSelectOrg = (org: OrgSummary) => {
    setActiveOrgId(org.id);
    setActiveOrgName(org.name);
    setActiveOrg(org);
    setMessages([]); // reset conversation for fresh workbench session
  };

  const handleStartNewChat = () => {
    setMessages([]);
    setInputQuery("");
    setSearchFilter("");
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isSending) return;

    setInputQuery("");
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));

      const res = await consultantApi.chat(activeOrgId, {
        message: query,
        history: historyPayload,
      });

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: res.response,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        model: res.model_used || "Deku Ledger Analyst (on-premise)",
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `assistant-err-${Date.now()}`,
        role: "assistant",
        content:
          "Could not reach the Deku backend. Check that it is running and that you are signed in.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  // Suggested prompts shown in the empty state
  const promptCards = [
    {
      category: "Warnings",
      categoryBadge: "bg-warn-wash text-warn",
      icon: AlertTriangle,
      title: "Expense spikes",
      description: "Identify any unusual expense spikes or unbudgeted OPEX this month",
      prompt: "Identify any unusual expense spikes or cost abnormalities in our accounts this month.",
    },
    {
      category: "Exceptions",
      categoryBadge: "bg-bad-wash text-bad",
      icon: ShieldAlert,
      title: "Overdue payments",
      description: "Are there any overdue invoices or bills? Check DSO velocity & aging",
      prompt: "Are there any overdue invoices or bills? What is our current Accounts Receivable aging and DSO?",
    },
    {
      category: "Warnings",
      categoryBadge: "bg-warn-wash text-warn",
      icon: Clock,
      title: "Budget limits",
      description: "Highlight department budget categories nearing or exceeding limits",
      prompt: "Highlight which departmental budget categories are running nearest to their limits or over-budget.",
    },
    {
      category: "Growth",
      categoryBadge: "bg-ok-wash text-ok",
      icon: TrendingUp,
      title: "Top revenue",
      description: "What are our most profitable revenue streams and product margins?",
      prompt: "What are our most profitable revenue streams, top clients, and gross profit margins?",
    },
    {
      category: "Clarity",
      categoryBadge: "bg-brand-wash text-brand-strong",
      icon: Activity,
      title: "Performance summary",
      description: "Summarize financial performance, net profit, and cash runway for the quarter",
      prompt: "Summarize our complete financial performance, net profit margin, and treasury cash runway for this quarter.",
    },
    {
      category: "Clarity",
      categoryBadge: "bg-brand-wash text-brand-strong",
      icon: PieChart,
      title: "Operating expenses",
      description: "Provide a detailed breakdown of operating expenses across departments",
      prompt: "Provide a comprehensive breakdown of our operating expenses (OPEX) and departmental cost centers.",
    },
  ];

  // Only ledger figures from the backend; anything missing shows "–".
  const fpa = contextData?.fpa_metrics || {};
  const prof = fpa.profitability || {};
  const runway = fpa.treasury_and_runway || {};
  const aging = contextData?.ar_ap_aging || {};
  const dso = aging.accounts_receivable?.dso_days;

  // Filter messages if search query exists
  const filteredMessages = searchFilter.trim()
    ? messages.filter((m) =>
        m.content.toLowerCase().includes(searchFilter.toLowerCase().trim())
      )
    : messages;

  return (
    <div className="flex h-full min-h-0 w-full bg-canvas text-ink font-sans overflow-hidden">
      {/* Left panel: workbenches, ledger snapshot, account */}
      <aside className="hidden md:flex w-60 lg:w-64 bg-surface border-r border-line flex-col justify-between shrink-0 min-h-0 select-none">
        <div className="p-3 space-y-4 overflow-y-auto min-h-0">
          <button
            onClick={handleStartNewChat}
            className="w-full h-8 bg-ink hover:bg-ink-soft text-white font-medium text-[13px] px-3 rounded-ctl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New chat</span>
          </button>

          {/* Workbenches / Organisation Tenants */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
              <Building2 className="h-3 w-3" />
              Workbenches
            </div>

            <div className="space-y-0.5">
              {orgList.map((org) => {
                const isActive = org.id === activeOrgId;
                return (
                  <button
                    key={org.id}
                    onClick={() => handleSelectOrg(org)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-[8px] text-[13px] flex items-center justify-between transition-colors cursor-pointer ${
                      isActive
                        ? "bg-brand-wash text-ink font-medium shadow-[inset_3px_0_0_var(--color-brand)]"
                        : "text-ink-soft hover:text-ink hover:bg-canvas-sunken"
                    }`}
                  >
                    <span className="truncate">{org.name}</span>
                    {isActive && (
                      <span className="text-[11px] font-medium text-brand-strong shrink-0 ml-2">
                        Active
                      </span>
                    )}
                  </button>
                );
              })}

              <Link
                href="/companies"
                className="w-full text-left px-2.5 py-1 text-[12.5px] font-medium text-brand-strong hover:text-ink flex items-center gap-1 transition-colors"
              >
                <span>View all companies</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Ledger snapshot */}
          <div className="bg-canvas/70 border border-line rounded-panel p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
                Ledger snapshot
              </span>
              {contextFailed ? (
                <span className="text-[11px] text-bad">Couldn&apos;t load</span>
              ) : isLoadingContext ? (
                <span className="text-[11px] text-ink-subtle">Syncing…</span>
              ) : null}
            </div>
            <div className="divide-y divide-line/60 text-[12.5px] tabular-nums">
              <div className="flex justify-between py-1 first:pt-0">
                <span className="text-ink-muted">Turnover</span>
                <span className="font-semibold text-ink">{prof.total_revenue == null ? "–" : formatINR(prof.total_revenue)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-ink-muted">Net margin</span>
                <span className="font-semibold text-ink">{prof.net_margin_pct == null ? "–" : `${prof.net_margin_pct}%`}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-ink-muted">Runway</span>
                <span className="font-semibold text-ink">{runway.cash_runway_months == null ? "–" : `${runway.cash_runway_months} mo`}</span>
              </div>
              <div className="flex justify-between py-1 last:pb-0">
                <span className="text-ink-muted">Debtors DSO</span>
                <span className="font-semibold text-ink">{dso == null ? "–" : `${dso} days`}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Left panel footer: account and settings */}
        <div className="p-2.5 space-y-1.5 border-t border-line shrink-0">
          {userName && (
            <div className="flex items-center gap-2 px-1.5 py-1">
              <div className="h-6 w-6 rounded-full bg-brand-wash-strong flex items-center justify-center font-semibold text-[11px] text-brand-strong shrink-0">
                {userName.charAt(0)}
              </div>
              <div className="truncate text-left leading-tight">
                <div className="text-[12.5px] font-medium text-ink truncate">{userName}</div>
                {user?.email && <div className="text-[11px] text-ink-muted truncate">{user.email}</div>}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-1.5 pt-0.5 text-[12px] text-ink-muted">
            <Link
              href="/settings"
              className="flex items-center gap-1.5 hover:text-ink transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Settings</span>
            </Link>
            <Link
              href="/gateway"
              className="flex items-center gap-1.5 hover:text-ink transition-colors"
            >
              <span>Gateway</span>
              <kbd className="font-mono text-[10.5px] leading-none px-1.5 pt-[3px] pb-[2px] rounded-[5px] border border-line-strong border-b-2 bg-surface text-ink-muted">Esc</kbd>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main column: empty state or conversation */}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative bg-canvas">
        <header className="h-11 px-4 sm:px-6 flex items-center justify-between shrink-0 bg-surface border-b border-line z-10 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <DekuLogo size={20} />
            <span className="font-semibold text-[14px] tracking-tight text-ink">Deku Consultant</span>
            {activeOrgName && (
              <span className="hidden sm:inline-flex items-center text-[11.5px] text-ink-muted border-l border-line pl-2.5 truncate">
                {activeOrgName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleStartNewChat}
              className="md:hidden inline-flex items-center gap-1 h-7 px-2.5 rounded-ctl border border-line-strong bg-surface text-[12px] font-medium text-ink"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New</span>
            </button>
            <div className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-ctl text-[12px] bg-brand-wash text-brand-strong border border-brand-wash-strong">
              <span className="h-1.5 w-1.5 rounded-full bg-brand inline-block" />
              <span>Ledger analyst · on-premise</span>
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 sm:px-6 flex flex-col items-center">
          {messages.length === 0 ? (
            <div className="w-full max-w-4xl flex flex-col items-center space-y-4 my-auto py-1">
              <div className="flex flex-col items-center text-center space-y-1">
                <div className="flex items-center gap-2">
                  <DekuLogo size={32} />
                  <h1 className="text-[20px] sm:text-[22px] font-semibold text-ink tracking-[-0.025em]">
                    {userName ? `Welcome back, ${userName}` : "Welcome to Deku Consultant"}
                  </h1>
                </div>
                <p className="text-[13px] text-ink-muted max-w-lg">
                  Ask Deku Consultant about your books. Answers are grounded directly in your ledger.
                </p>
              </div>

              <div data-tour="consultant-prompts" className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {promptCards.map((card, idx) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(card.prompt)}
                      className="bg-surface border border-line hover:border-line-strong hover:bg-surface/90 hover:shadow-xs rounded-panel p-3 text-left transition-all group flex flex-col justify-between gap-2 cursor-pointer"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`inline-flex items-center h-5 px-2 rounded-chip text-[11px] font-medium ${card.categoryBadge}`}
                        >
                          {card.category}
                        </span>
                        <div className="h-6 w-6 rounded-[6px] bg-canvas-sunken text-ink-soft grid place-items-center group-hover:text-brand-strong transition-colors">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <h4 className="text-[13px] font-semibold text-ink leading-snug">
                          {card.title}
                        </h4>
                        <p className="text-[11.5px] text-ink-muted line-clamp-2 leading-snug">
                          {card.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="w-full max-w-4xl space-y-4 pb-4">
              <div className="flex items-center justify-between border-b border-line pb-2.5 mb-1">
                <div>
                  <h2 className="text-[14px] font-semibold text-ink tracking-tight">
                    Chat
                  </h2>
                  <p className="text-[12px] text-ink-muted">
                    Early preview, grounded in the Universal Ledger. Double-check critical outputs.
                  </p>
                </div>

                <div className="relative w-44 sm:w-60">
                  <Search className="h-3.5 w-3.5 text-ink-subtle absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search messages"
                    className="w-full h-8 pl-8 pr-3 bg-surface border border-line-strong rounded-ctl text-[12.5px] text-ink placeholder:text-ink-subtle focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              {filteredMessages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={m.id}
                    className={`flex items-start gap-3 ${
                      isUser ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {isUser ? (
                      <div className="h-8 w-8 rounded-full bg-canvas-sunken text-ink-soft flex items-center justify-center shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                    ) : (
                      <DekuLogo size={28} className="shrink-0 mt-0.5" />
                    )}

                    <div
                      className={`max-w-[95%] sm:max-w-[90%] px-4 py-2.5 text-[13.5px] leading-relaxed ${
                        isUser
                          ? "bg-ink text-white rounded-[14px]"
                          : "bg-surface text-ink rounded-panel border border-line"
                      }`}
                    >
                      {isUser ? (
                        <div className="whitespace-pre-wrap font-sans">{m.content}</div>
                      ) : (
                        <FinancialMessageRenderer content={m.content} />
                      )}

                      <div
                        className={`flex items-center justify-between gap-4 mt-2 pt-1.5 text-[11px] border-t ${
                          isUser ? "border-white/15 text-white/60" : "border-line text-ink-muted"
                        }`}
                      >
                        <span>{m.timestamp}</span>
                        {m.model && <span>{m.model}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isSending && (
                <div className="flex items-start gap-3">
                  <DekuLogo size={28} className="shrink-0 mt-0.5" />
                  <div className="rounded-panel px-4 py-2.5 text-[13px] text-ink-muted flex items-center gap-2 bg-surface border border-line">
                    <Sparkles className="h-3.5 w-3.5 animate-spin text-brand-strong" />
                    <span>Reading the ledger and preparing an answer…</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Prompt bar */}
        <div className="px-4 py-2.5 sm:px-6 w-full flex flex-col items-center shrink-0 border-t border-line/70 bg-surface/60">
          <div data-tour="consultant-composer" className="w-full max-w-3xl bg-surface border border-line-strong rounded-panel px-2 py-1.5 shadow-sm flex items-center gap-1 focus-within:border-brand transition-colors">
            <button
              type="button"
              onClick={() => router.push("/vouchers")}
              className="h-8 w-8 grid place-items-center rounded-ctl text-ink-muted hover:text-ink hover:bg-canvas-sunken transition-colors cursor-pointer shrink-0"
              title="Upload a bill: it is read on this device, never uploaded"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => loadContext(activeOrgId)}
              className="h-8 w-8 grid place-items-center rounded-ctl text-brand-strong hover:bg-canvas-sunken transition-colors cursor-pointer shrink-0"
              title="Reload ledger context"
            >
              <Database className="h-4 w-4" />
            </button>

            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask Deku Consultant anything, or upload a bill to begin"
              className="flex-1 h-8 bg-transparent text-[13.5px] text-ink placeholder:text-ink-subtle focus:outline-none px-2 min-w-0"
              disabled={isSending}
            />

            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={isSending || !inputQuery.trim()}
              className={`h-8 w-8 rounded-ctl flex items-center justify-center transition-colors shrink-0 ${
                inputQuery.trim()
                  ? "bg-ink hover:bg-ink-soft text-white cursor-pointer"
                  : "bg-canvas-sunken text-ink-subtle cursor-not-allowed"
              }`}
              aria-label="Send"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="w-full max-w-3xl flex items-center justify-between mt-1.5 px-1 text-[11px] text-ink-subtle">
            <span>
              Answers are grounded in the active ledger. Double-check critical statutory filings.
            </span>
            <span className="tabular-nums">{inputQuery.length} / 2000</span>
          </div>
        </div>
      </main>
    </div>
  );
}
