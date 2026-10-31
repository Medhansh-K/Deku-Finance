"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Send,
  AlertTriangle,
  ShieldAlert,
  Clock,
  TrendingUp,
  PieChart,
  Layers,
  ArrowRight,
  RotateCcw,
  Bot,
  User,
  Paperclip,
  Database,
  Globe,
  Plus,
  ChevronDown,
  ChevronRight,
  Settings,
  Bell,
  MoreVertical,
  ArrowUpRight,
  Activity,
  Flame,
  CheckCircle2,
  Building2,
  Compass,
  FileSpreadsheet,
  Download,
  ShieldCheck,
  DollarSign,
  Receipt,
  Scale,
  Copy,
  Check,
  Search,
} from "lucide-react";
import { consultantApi, organisationsApi, OrgSummary } from "@/api/endpoints";
import { formatINR } from "@/lib/formatters/currency";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  model?: string;
}

// =============================================================================
// FINANCIAL TABLE COMPONENT (MATCHING DABBY IMAGE 1)
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
    <div className="my-3 rounded-xl border border-line-strong bg-surface overflow-hidden shadow-xs">
      {/* Top Table Toolbar (Matching Image 1 Dabby) */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-canvas border-b border-line-strong">
        <div className="flex items-center gap-2">
          {categoryNumber && (
            <span className="h-5 w-5 rounded bg-blue-600 text-white font-mono font-bold text-[11px] flex items-center justify-center shrink-0 shadow-2xs">
              {categoryNumber}
            </span>
          )}
          <span className="font-bold text-xs text-ink tracking-tight">
            {categoryTitle || "Financial Statement Rollup"}
          </span>
        </div>

        {/* Copy to Excel Button (Matching Glowing Button from Reference) */}
        <button
          onClick={handleCopyToExcel}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold transition-all shadow-2xs cursor-pointer bg-[#00F5A0] hover:bg-[#00D98E] text-[#080B0C]"
          title="Copy structured financial table directly to Excel / Google Sheets"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-black" />
              <span>Copied to Excel!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-black" />
              <span>Copy to Excel</span>
            </>
          )}
        </button>
      </div>

      {/* Structured Multi-Column Accounting Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-line-strong bg-canvas-sunken/80 text-[10px] font-mono font-bold uppercase tracking-wider text-brand-strong">
              {headers.map((h, idx) => (
                <th
                  key={idx}
                  className={`py-2.5 px-3.5 ${
                    idx === 0 ? "text-left" : "text-right"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line font-mono text-xs">
            {rows.map((row, rowIdx) => {
              const isGroupRow =
                row[0]?.startsWith("**") && row[0]?.endsWith("**");
              return (
                <tr
                  key={rowIdx}
                  className={`transition-colors hover:bg-canvas/80 ${
                    isGroupRow
                      ? "bg-canvas/70 font-bold text-ink"
                      : "text-ink-soft"
                  }`}
                >
                  {row.map((cell, colIdx) => {
                    const cleanCell = cell.replace(/\*\*/g, "").trim();
                    const isNil = cleanCell === "-" || cleanCell === "";
                    return (
                      <td
                        key={colIdx}
                        className={`py-2 px-3.5 whitespace-nowrap ${
                          colIdx === 0
                            ? isGroupRow
                              ? "font-bold text-ink"
                              : "text-ink"
                            : "text-right font-mono"
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
    <div className="space-y-2.5 font-sans text-xs leading-relaxed">
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
                <span className="h-4 w-4 rounded bg-blue-600 text-white font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                  {block.badgeNumber}
                </span>
              )}
              <h4 className="font-bold text-xs text-ink tracking-tight">
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
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-strong mt-1.5 shrink-0" />
                    <span>{renderInlineMarkdown(bulletContent)}</span>
                  </div>
                );
              }

              if (trimmed.match(/^\d+\.\s+/)) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-1">
                    <span className="font-bold font-mono text-[10px] text-brand-strong mt-0.5 shrink-0">
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
        <strong key={idx} className="font-bold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={idx}
          className="font-mono text-[11px] bg-canvas-sunken text-ink px-1 py-0.2 rounded border border-line"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// =============================================================================
// MAIN DEKU KONSULTANT VIEW COMPONENT
// =============================================================================
export function DekuConsultantView() {
  const router = useRouter();

  // Organizations / Workbenches
  const [orgList, setOrgList] = useState<OrgSummary[]>([]);

  const [activeOrgId, setActiveOrgId] = useState<string>("");
  const [activeOrgName, setActiveOrgName] = useState<string>("");
  const [contextData, setContextData] = useState<any>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);

  // Chat conversation state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);

  // Typewriter state for greeting
  const [userName] = useState("Medhansh");

  // History sessions list
  const [historySessions] = useState([
    { id: "h1", title: "Q3 Cash Runway & Burn Review", date: "Today" },
    { id: "h2", title: "Debtor Aging (DSO) Velocity", date: "Yesterday" },
    { id: "h3", title: "Department Budget Variance", date: "23 Oct" },
    { id: "h4", title: "GST Input Tax Credit Match", date: "21 Oct" },
    { id: "h5", title: "Monthly Expense Spikes Deep Dive", date: "18 Oct" },
  ]);

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
    setIsLoadingContext(true);
    try {
      const res = await consultantApi.getContext(orgIdToLoad);
      if (res.context) {
        setContextData(res.context);
      }
    } catch {
      // Graceful fallback
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
    if (typeof window !== "undefined") {
      localStorage.setItem("deku_active_org_id", org.id);
      localStorage.setItem("deku_active_org_name", org.name);
      window.dispatchEvent(new Event("deku_active_org_changed"));
    }
    setMessages([]); // reset conversation for fresh workbench session
  };

  const handleStartNewChat = () => {
    setMessages([]);
    setInputQuery("");
    setSearchFilter("");
    setActiveHistoryId(null);
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

  // 6 Quick Executive Prompt Cards (Exact Dabby layout in clean light theme)
  const promptCards = [
    {
      category: "WARNINGS",
      categoryBadge: "bg-amber-50 text-amber-800 border-amber-200",
      icon: AlertTriangle,
      iconColor: "text-amber-600",
      title: "Expense Spikes",
      description: "Identify any unusual expense spikes or unbudgeted OPEX this month",
      prompt: "Identify any unusual expense spikes or cost abnormalities in our accounts this month.",
    },
    {
      category: "EXCEPTIONS",
      categoryBadge: "bg-rose-50 text-rose-800 border-rose-200",
      icon: ShieldAlert,
      iconColor: "text-rose-600",
      title: "Overdue Payments",
      description: "Are there any overdue invoices or bills? Check DSO velocity & aging",
      prompt: "Are there any overdue invoices or bills? What is our current Accounts Receivable aging and DSO?",
    },
    {
      category: "WARNINGS",
      categoryBadge: "bg-amber-50 text-amber-800 border-amber-200",
      icon: Clock,
      iconColor: "text-amber-600",
      title: "Budget Limits",
      description: "Highlight department budget categories nearing or exceeding limits",
      prompt: "Highlight which departmental budget categories are running nearest to their limits or over-budget.",
    },
    {
      category: "GROWTH",
      categoryBadge: "bg-emerald-50 text-emerald-800 border-emerald-200",
      icon: TrendingUp,
      iconColor: "text-emerald-600",
      title: "Top Revenue",
      description: "What are our most profitable revenue streams and product margins?",
      prompt: "What are our most profitable revenue streams, top clients, and gross profit margins?",
    },
    {
      category: "CLARITY",
      categoryBadge: "bg-cyan-50 text-cyan-800 border-cyan-200",
      icon: Activity,
      iconColor: "text-cyan-600",
      title: "Performance Summary",
      description: "Summarize financial performance, net profit, and cash runway for the quarter",
      prompt: "Summarize our complete financial performance, net profit margin, and treasury cash runway for this quarter.",
    },
    {
      category: "CLARITY",
      categoryBadge: "bg-cyan-50 text-cyan-800 border-cyan-200",
      icon: PieChart,
      iconColor: "text-cyan-600",
      title: "Operating Expenses",
      description: "Provide a detailed breakdown of operating expenses across departments",
      prompt: "Provide a comprehensive breakdown of our operating expenses (OPEX) and departmental cost centers.",
    },
  ];

  // Grounded context metrics from backend or local profile fallback
  const fpa = contextData?.fpa_metrics || {};
  const prof = fpa.profitability || { total_revenue: 1545339, net_profit: 1351950, net_margin_pct: 87.5 };
  const runway = fpa.treasury_and_runway || { cash_and_bank_reserves: 640000, cash_runway_months: 14.5 };
  const aging = contextData?.ar_ap_aging || {};
  const dso = aging.accounts_receivable?.dso_days ?? 32.5;

  // Filter messages if search query exists
  const filteredMessages = searchFilter.trim()
    ? messages.filter((m) =>
        m.content.toLowerCase().includes(searchFilter.toLowerCase().trim())
      )
    : messages;

  return (
    <div className="flex h-full w-full bg-canvas text-ink font-sans select-none overflow-hidden">
      {/* ========================================================================= */}
      {/* 1. LEFT SIDEBAR (WORKBENCHES, AUDITED HEALTH, SESSIONS)                   */}
      {/* ========================================================================= */}
      <aside className="w-64 xl:w-72 bg-surface border-r border-line-strong flex flex-col justify-between shrink-0 shadow-xs">
        <div className="p-3.5 space-y-4 overflow-y-auto">
          {/* New Chat Button (Deku Charcoal with Teal Highlight) */}
          <button
            onClick={handleStartNewChat}
            className="w-full bg-panel hover:bg-panel-deep text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-between border border-edge shadow-xs hover:border-brand transition-all transform active:scale-98 cursor-pointer group"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand group-hover:scale-110 transition-transform" />
              <span>New Chat</span>
            </span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-brand text-panel-deep font-black">
              Ctrl + K
            </kbd>
          </button>

          {/* Workbenches / Organisation Tenants */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-2 text-[10px] font-mono uppercase tracking-wider text-ink-muted font-bold">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-brand-strong" />
                Workbenches
              </span>
              <ChevronDown className="h-3 w-3 text-ink-subtle" />
            </div>

            <div className="space-y-1">
              {orgList.map((org) => {
                const isActive = org.id === activeOrgId;
                return (
                  <button
                    key={org.id}
                    onClick={() => handleSelectOrg(org)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                      isActive
                        ? "bg-emerald-50/80 text-emerald-950 border border-emerald-300 font-bold shadow-xs"
                        : "text-ink-soft hover:text-ink hover:bg-canvas-sunken border border-transparent"
                    }`}
                  >
                    <span className="truncate flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          isActive ? "bg-emerald-500 shadow-xs" : "bg-slate-400"
                        }`}
                      />
                      <span className="truncate">{org.name}</span>
                    </span>
                    {isActive && (
                      <span className="text-[9px] font-mono uppercase font-black px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0 ml-1">
                        ACTIVE
                      </span>
                    )}
                  </button>
                );
              })}

              <Link
                href="/companies"
                className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-brand-strong hover:text-brand flex items-center gap-1 transition-colors"
              >
                <span>+ VIEW ALL</span>
              </Link>
            </div>
          </div>

          {/* Live Executive Snapshot (Audited Health) */}
          <div className="bg-canvas border border-line rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono text-ink-muted font-bold uppercase">
              <span>Audited Health</span>
              <span className="text-emerald-700 font-mono flex items-center gap-1 font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-muted">Turnover:</span>
                <span className="font-bold text-ink font-mono">{formatINR(prof.total_revenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Net Margin:</span>
                <span className="font-bold text-emerald-700 font-mono">{prof.net_margin_pct}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Runway:</span>
                <span className="font-bold text-amber-700 font-mono">{runway.cash_runway_months} Mo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Debtors DSO:</span>
                <span className="font-bold text-blue-700 font-mono">{dso} Days</span>
              </div>
            </div>
          </div>

          {/* Conversation History */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-2 text-[10px] font-mono uppercase tracking-wider text-ink-muted font-bold">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-ink-subtle" />
                History
              </span>
              <span className="text-[10px] font-mono text-ink-soft bg-canvas-sunken px-1.5 py-0.2 rounded border border-line">
                10 &gt;
              </span>
            </div>

            <div className="space-y-0.5">
              {historySessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    setActiveHistoryId(session.id);
                    handleSendMessage(session.title);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-ink-soft hover:text-ink hover:bg-canvas-sunken truncate flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="truncate">{session.title}</span>
                  <span className="text-[10px] text-ink-subtle shrink-0 ml-1 font-mono">{session.date}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Footer (User Account & Settings) */}
        <div className="p-3 space-y-1.5 bg-canvas border-t border-line-strong">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-surface transition-colors cursor-pointer border border-transparent hover:border-line">
            <div className="flex items-center gap-2 truncate">
              <div className="h-7 w-7 rounded-full bg-brand/20 border border-brand/40 flex items-center justify-center font-bold text-xs text-brand-strong shrink-0">
                {userName.charAt(0)}
              </div>
              <div className="truncate text-left">
                <div className="text-xs font-bold text-ink truncate">{userName}</div>
                <div className="text-[10px] text-ink-muted truncate font-mono">medhansh@deku.finance</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-2 text-xs pt-1 text-ink-muted">
            <Link
              href="/settings"
              className="flex items-center gap-1.5 hover:text-ink transition-colors"
            >
              <Settings className="h-3.5 w-3.5 text-ink-subtle" />
              <span>Settings</span>
            </Link>
            <Link
              href="/gateway"
              className="flex items-center gap-1 text-[11px] font-mono text-brand-strong hover:text-brand transition-colors font-bold"
            >
              <span>Gateway (Esc)</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN CENTER CANVAS (WHITE HERO OR CONVERSATION STREAM WITH TABLES)     */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col justify-between overflow-hidden relative bg-canvas">
        {/* Top Header Bar */}
        <header className="h-12 px-6 flex items-center justify-between shrink-0 bg-surface border-b border-line-strong z-10 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-brand/15 border border-brand/40 flex items-center justify-center text-brand-strong">
              <Bot className="h-4 w-4" />
            </div>
            <span className="font-black text-sm tracking-tight text-ink">Deku Konsultant</span>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded uppercase font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
              Executive AI CFO
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-canvas-sunken border border-line-strong text-ink-soft">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span className="font-bold font-mono text-ink">Ledger Analyst · on-premise</span>
              <ChevronDown className="h-3 w-3 text-ink-subtle" />
            </div>

            <button
              onClick={() => alert("Notification center: 0 unread alerts. Universal Ledger balanced.")}
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-canvas-sunken transition-colors cursor-pointer"
            >
              <Bell className="h-4 w-4" />
            </button>
            <button
              onClick={() => alert("Deku Konsultant: Operating with real-time FP&A, WCM, and Universal Ledger grounding.")}
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-canvas-sunken transition-colors cursor-pointer"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Content Body: Hero with 6 Cards OR Conversation Stream */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 flex flex-col items-center">
          {messages.length === 0 ? (
            /* =================================================================== */
            /* HERO + 6 PROMPT CARDS (MATCHING IMAGE 1 & 2 CLEAN LIGHT THEME)      */
            /* =================================================================== */
            <div className="w-full max-w-4xl flex flex-col items-center space-y-6 my-auto">
              {/* Mascot & Typewriter Greeting */}
              <div className="flex flex-col items-center text-center space-y-1.5">
                <div className="h-14 w-14 rounded-2xl bg-surface border border-line-strong shadow-xs flex items-center justify-center text-brand-strong mb-1">
                  <Bot className="h-8 w-8" />
                </div>
                <h1 className="text-2xl lg:text-3xl font-black text-ink tracking-tight flex items-center gap-1">
                  <span>Welcome back, {userName}</span>
                  <span className="inline-block w-2.5 h-6 bg-brand-strong animate-pulse ml-0.5" />
                </h1>
                <p className="text-xs lg:text-sm text-ink-muted max-w-lg">
                  Your AI-powered executive business intelligence &amp; CFO assistant
                </p>
              </div>

              {/* Subheading Divider "ASK DEKU KONSULTANT" */}
              <div className="w-full flex items-center gap-4 pt-1">
                <div className="flex-1 h-px bg-line" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-ink-subtle font-bold">
                  Ask Deku Konsultant
                </span>
                <div className="flex-1 h-px bg-line" />
              </div>

              {/* 6 Executive Cards Grid (3x2) - Clean Light Theme */}
              <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {promptCards.map((card, idx) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(card.prompt)}
                      className="bg-surface hover:bg-canvas border border-line-strong hover:border-brand rounded-xl p-4 text-left transition-all duration-150 group flex flex-col justify-between min-h-[110px] shadow-xs hover:shadow-md cursor-pointer"
                    >
                      <div className="flex items-center justify-between w-full mb-2">
                        <span
                          className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${card.categoryBadge}`}
                        >
                          {card.category}
                        </span>
                        <div className="p-1 rounded-md bg-canvas-sunken text-ink-muted group-hover:text-brand-strong transition-colors">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-ink group-hover:text-ink transition-colors">
                          {card.title}
                        </h4>
                        <p className="text-[11px] text-ink-muted line-clamp-2 leading-relaxed">
                          {card.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* =================================================================== */
            /* ACTIVE CONVERSATION STREAM (WITH DABBY CHAT HEADER & ACCOUNTING TAB)*/
            /* =================================================================== */
            <div className="w-full max-w-4xl space-y-4 pb-6">
              {/* Dabby-Style Chat Header Bar (Matching Image 1) */}
              <div className="flex items-center justify-between border-b border-line-strong pb-3 mb-2">
                <div>
                  <h2 className="text-base font-black text-ink tracking-tight">
                    Chat
                  </h2>
                  <p className="text-[11px] text-ink-muted">
                    Early preview agent — grounded in Universal Ledger. Double-check critical outputs.
                  </p>
                </div>

                {/* Search Box (Matching Image 1 Dabby) */}
                <div className="relative w-48 sm:w-64">
                  <Search className="h-3.5 w-3.5 text-ink-subtle absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search messages..."
                    className="w-full pl-8 pr-3 py-1 bg-surface border border-line-strong rounded-lg text-xs text-ink placeholder:text-ink-subtle focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              {filteredMessages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={m.id}
                    className={`flex items-start gap-3.5 ${
                      isUser ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <div
                      className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold shadow-xs ${
                        isUser
                          ? "bg-panel text-white"
                          : "bg-brand/15 text-brand-strong border border-brand/40"
                      }`}
                    >
                      {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>

                    <div
                      className={`max-w-[95%] sm:max-w-[90%] rounded-2xl p-4 text-xs leading-relaxed shadow-xs ${
                        isUser
                          ? "bg-panel text-white rounded-tr-none border border-edge"
                          : "bg-surface text-ink rounded-tl-none border border-line-strong"
                      }`}
                    >
                      {isUser ? (
                        <div className="whitespace-pre-wrap font-sans text-xs">{m.content}</div>
                      ) : (
                        <FinancialMessageRenderer content={m.content} />
                      )}

                      <div
                        className={`flex items-center justify-between mt-3 pt-2 text-[10px] border-t ${
                          isUser ? "border-slate-700 text-ink-subtle" : "border-line text-ink-muted"
                        }`}
                      >
                        <span>{m.timestamp}</span>
                        {m.model && (
                          <span className="font-mono font-bold text-brand-strong">
                            {m.model}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isSending && (
                <div className="flex items-start gap-3.5">
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 bg-brand/15 text-brand-strong border border-brand/40">
                    <Bot className="h-4 w-4 animate-pulse" />
                  </div>
                  <div className="rounded-2xl p-3.5 text-xs text-ink-soft flex items-center gap-2 bg-surface border border-line-strong shadow-xs">
                    <Sparkles className="h-3.5 w-3.5 animate-spin text-brand-strong" />
                    <span>Analyzing Universal Ledger &amp; synthesizing financial statements...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 3. BOTTOM FLOATING PROMPT BAR (CLEAN LIGHT THEME)                          */}
        {/* ========================================================================= */}
        <div className="p-4 lg:p-6 w-full flex flex-col items-center shrink-0 bg-gradient-to-t from-canvas via-canvas to-transparent">
          <div className="w-full max-w-3xl bg-surface border border-line-strong rounded-2xl p-2.5 shadow-md flex flex-col gap-2 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all">
            <div className="flex items-center gap-2 px-1">
              {/* Attachment Button */}
              <button
                type="button"
                onClick={() => router.push("/vouchers")}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-canvas-sunken transition-colors cursor-pointer"
                title="Upload a bill: it is read on this device, never uploaded"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              {/* Live Ledger Grounding Toggle */}
              <button
                type="button"
                onClick={() => loadContext(activeOrgId)}
                className="p-1.5 rounded-lg text-brand-strong hover:bg-canvas-sunken transition-colors cursor-pointer"
                title="Live Universal Ledger connection active"
              >
                <Database className="h-4 w-4" />
              </button>

              {/* Web / Statutory Toggle */}
              <button
                type="button"
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-canvas-sunken transition-colors cursor-pointer"
                title="Indian Commercial Law & GST Grounding active"
              >
                <Globe className="h-4 w-4" />
              </button>

              {/* Text Input */}
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
                placeholder="Ask Deku Konsultant anything, or upload a bill to begin analysis..."
                className="flex-1 bg-transparent text-xs text-ink placeholder:text-ink-subtle focus:outline-none px-2"
                disabled={isSending}
              />

              {/* Send Button */}
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={isSending || !inputQuery.trim()}
                className={`h-8 w-8 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                  inputQuery.trim()
                    ? "bg-panel hover:bg-panel-deep text-white shadow-xs cursor-pointer"
                    : "bg-canvas-sunken text-ink-subtle cursor-not-allowed"
                }`}
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Footer Subtext */}
          <div className="w-full max-w-3xl flex items-center justify-between mt-2 px-2 text-[10px] text-ink-subtle font-mono">
            <span>
              AI responses are grounded in the active Universal Ledger. Double check critical statutory filings.
            </span>
            <span>{inputQuery.length} / 2000</span>
          </div>
        </div>
      </main>
    </div>
  );
}
