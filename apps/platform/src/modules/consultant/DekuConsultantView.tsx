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
    <div className="flex h-full w-full bg-canvas text-ink font-sans select-none overflow-hidden">
      {/* Left panel: workbenches, ledger snapshot, account */}
      <aside className="w-64 xl:w-72 bg-surface border-r border-line flex flex-col justify-between shrink-0">
        <div className="p-4 space-y-5 overflow-y-auto">
          <button
            onClick={handleStartNewChat}
            className="w-full h-9 bg-ink hover:bg-ink-soft text-white font-medium text-[13.5px] px-3.5 rounded-ctl flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New chat</span>
          </button>

          {/* Workbenches / Organisation Tenants */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 px-2 text-[12.5px] font-medium text-ink-muted">
              <Building2 className="h-3.5 w-3.5" />
              Workbenches
            </div>

            <div className="space-y-0.5">
              {orgList.map((org) => {
                const isActive = org.id === activeOrgId;
                return (
                  <button
                    key={org.id}
                    onClick={() => handleSelectOrg(org)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-[8px] text-[13.5px] flex items-center justify-between transition-colors cursor-pointer ${
                      isActive
                        ? "bg-brand-wash text-ink font-medium shadow-[inset_3px_0_0_var(--color-brand)]"
                        : "text-ink-soft hover:text-ink hover:bg-canvas-sunken"
                    }`}
                  >
                    <span className="truncate">{org.name}</span>
                    {isActive && (
                      <span className="text-xs font-medium text-brand-strong shrink-0 ml-2">
                        Active
                      </span>
                    )}
                  </button>
                );
              })}

              <Link
                href="/companies"
                className="w-full text-left px-2.5 py-1.5 text-[13px] font-medium text-brand-strong hover:text-ink flex items-center gap-1 transition-colors"
              >
                <span>View all companies</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Ledger snapshot */}
          <div className="bg-canvas border border-line rounded-panel p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-[12.5px] font-medium text-ink-muted">
              <span>Ledger snapshot</span>
              {contextFailed && <span className="text-bad">Couldn&apos;t load</span>}
            </div>
            <div className="space-y-1.5 text-[13px] tabular-nums">
              <div className="flex justify-between">
                <span className="text-ink-muted">Turnover</span>
                <span className="font-medium text-ink">{prof.total_revenue == null ? "–" : formatINR(prof.total_revenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Net margin</span>
                <span className="font-medium text-ink">{prof.net_margin_pct == null ? "–" : `${prof.net_margin_pct}%`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Runway</span>
                <span className="font-medium text-ink">{runway.cash_runway_months == null ? "–" : `${runway.cash_runway_months} mo`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Debtors DSO</span>
                <span className="font-medium text-ink">{dso == null ? "–" : `${dso} days`}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Left panel footer: account and settings */}
        <div className="p-3 space-y-2 border-t border-line">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="h-7 w-7 rounded-full bg-brand-wash-strong flex items-center justify-center font-semibold text-xs text-brand-strong shrink-0">
              {userName.charAt(0)}
            </div>
            <div className="truncate text-left leading-tight">
              <div className="text-[13px] font-medium text-ink truncate">{userName}</div>
              <div className="text-xs text-ink-muted truncate">{user?.email}</div>
            </div>
          </div>

          <div className="flex items-center justify-between px-2 text-[13px] text-ink-muted">
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
              <kbd className="font-mono text-[11px] leading-none px-1.5 pt-[3px] pb-[2px] rounded-[5px] border border-line-strong border-b-2 bg-surface text-ink-muted">Esc</kbd>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main column: empty state or conversation */}
      <main className="flex-1 flex flex-col justify-between overflow-hidden relative bg-canvas">
        <header className="h-14 px-6 flex items-center justify-between shrink-0 bg-surface border-b border-line z-10">
          <div className="flex items-center gap-2.5">
            <DekuLogo size={24} />
            <span className="font-semibold text-[15px] tracking-tight text-ink">Deku Consultant</span>
          </div>

          <div className="inline-flex items-center gap-2 h-8 px-3 rounded-ctl text-[13px] bg-brand-wash text-brand-strong border border-brand-wash-strong">
            <span className="h-[7px] w-[7px] rounded-full bg-brand inline-block" />
            <span>Ledger analyst · on-premise</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6 flex flex-col items-center">
          {messages.length === 0 ? (
            <div className="w-full max-w-4xl flex flex-col items-center space-y-7 my-auto">
              <div className="flex flex-col items-center text-center space-y-2">
                <DekuLogo size={56} className="mb-2" />
                <h1 className="text-[28px] font-semibold text-ink tracking-[-0.03em]">
                  Welcome back, {userName}
                </h1>
                <p className="text-[14px] text-ink-muted max-w-lg">
                  Ask Deku Consultant about your books. Answers are grounded in your ledger.
                </p>
              </div>

              <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {promptCards.map((card, idx) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(card.prompt)}
                      className="bg-surface border border-line hover:border-line-strong hover:bg-canvas rounded-panel p-4 text-left transition-colors group flex flex-col justify-between min-h-[120px] cursor-pointer"
                    >
                      <div className="flex items-center justify-between w-full mb-3">
                        <span
                          className={`inline-flex items-center h-[22px] px-2 rounded-chip text-xs font-medium ${card.categoryBadge}`}
                        >
                          {card.category}
                        </span>
                        <div className="h-8 w-8 rounded-[8px] bg-canvas-sunken text-ink-soft grid place-items-center group-hover:text-brand-strong transition-colors">
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-[14px] font-[550] text-ink">
                          {card.title}
                        </h4>
                        <p className="text-[12.5px] text-ink-muted line-clamp-2 leading-relaxed">
                          {card.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="w-full max-w-4xl space-y-5 pb-6">
              <div className="flex items-center justify-between border-b border-line pb-3 mb-2">
                <div>
                  <h2 className="text-[15px] font-semibold text-ink tracking-tight">
                    Chat
                  </h2>
                  <p className="text-[13px] text-ink-muted">
                    Early preview, grounded in the Universal Ledger. Double-check critical outputs.
                  </p>
                </div>

                <div className="relative w-48 sm:w-64">
                  <Search className="h-3.5 w-3.5 text-ink-subtle absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search messages"
                    className="w-full h-8 pl-8 pr-3 bg-surface border border-line-strong rounded-ctl text-[13px] text-ink placeholder:text-ink-subtle focus:outline-none focus:border-brand"
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
                      <DekuLogo size={30} className="shrink-0 mt-0.5" />
                    )}

                    <div
                      className={`max-w-[95%] sm:max-w-[90%] px-4 py-3 text-[13.5px] leading-relaxed ${
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
                        className={`flex items-center justify-between gap-4 mt-2.5 pt-2 text-xs border-t ${
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
                  <DekuLogo size={30} className="shrink-0 mt-0.5" />
                  <div className="rounded-panel px-4 py-3 text-[13.5px] text-ink-muted flex items-center gap-2 bg-surface border border-line">
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
        <div className="px-4 pb-4 pt-2 lg:px-6 lg:pb-5 w-full flex flex-col items-center shrink-0 bg-canvas">
          <div className="w-full max-w-3xl bg-surface border border-line-strong rounded-panel p-2 shadow-pop flex flex-col gap-2 focus-within:border-brand transition-colors">
            <div className="flex items-center gap-1 px-1">
              <button
                type="button"
                onClick={() => router.push("/vouchers")}
                className="h-8 w-8 grid place-items-center rounded-ctl text-ink-muted hover:text-ink hover:bg-canvas-sunken transition-colors cursor-pointer"
                title="Upload a bill: it is read on this device, never uploaded"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => loadContext(activeOrgId)}
                className="h-8 w-8 grid place-items-center rounded-ctl text-brand-strong hover:bg-canvas-sunken transition-colors cursor-pointer"
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
                className="flex-1 h-9 bg-transparent text-[14px] text-ink placeholder:text-ink-subtle focus:outline-none px-2"
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
          </div>

          <div className="w-full max-w-3xl flex items-center justify-between mt-2 px-2 text-xs text-ink-subtle">
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
