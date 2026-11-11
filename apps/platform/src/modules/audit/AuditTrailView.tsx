"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Clock,
  Search,
  Filter,
  Download,
  Trash2,
  CheckCircle2,
  Info,
  AlertTriangle,
  Receipt,
  BookOpen,
  FileText,
  Users,
  Settings,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Database,
  UserCheck,
  Zap,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { auditApi } from "@/api/endpoints";
import { AuditEvent } from "@/types/accounting";
import {
  ActivityCategory,
  ActivityStatus,
  CrudOperation,
  inferCrudType,
  downloadSecureAuditExport,
} from "@/lib/logging/activity-logger";
import Link from "next/link";

interface UnifiedLogItem {
  id: string;
  timestamp: string;
  crudType: CrudOperation;
  category: ActivityCategory;
  action: string;
  description: string;
  entityType: string;
  entityId: string;
  actor: string;
  role: string;
  status: ActivityStatus;
  metadata?: Record<string, any>;
  source: "user_action" | "system_event" | "database";
}

export function AuditTrailView() {
  const [orgId, setOrgId] = useState<string>("");
  const [orgName, setOrgName] = useState<string>("");
  const [dbEvents, setDbEvents] = useState<AuditEvent[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedCrud, setSelectedCrud] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [timeFilter, setTimeFilter] = useState<"ALL" | "TODAY" | "7DAYS">("ALL");

  // Selected item for detail inspector
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // Sync org from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedId = localStorage.getItem("deku_active_org_id");
      const savedName = localStorage.getItem("deku_active_org_name");
      if (savedId) setOrgId(savedId);
      if (savedName) setOrgName(savedName);
    }
  }, []);

  // Fetch PostgreSQL audit_events from backend
  const fetchDbAudit = async () => {
    setIsLoadingDb(true);
    setDbError(null);
    try {
      const res = await auditApi.list(orgId);
      setDbEvents(res.data || []);
    } catch (err: any) {
      setDbError(err.message || "Could not load the audit log");
    } finally {
      setIsLoadingDb(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    fetchDbAudit();
  }, [orgId]);

  // Listen to live activity logging events
  useEffect(() => {
    if (!orgId) return;
    const handleNewActivity = () => {
      fetchDbAudit();
    };

    window.addEventListener("deku_activity_logged", handleNewActivity);
    window.addEventListener("deku_active_org_changed", handleNewActivity);

    return () => {
      window.removeEventListener("deku_activity_logged", handleNewActivity);
      window.removeEventListener("deku_active_org_changed", handleNewActivity);
    };
  }, [orgId]);

  // Merge User Activity logs with PostgreSQL audit events
  const unifiedLogs: UnifiedLogItem[] = useMemo(() => {
    const list: UnifiedLogItem[] = [];

    // Add database audit events (map database structure to unified view)
    for (const db of dbEvents) {
      // The API returns user_activity_logs rows when there are any, else raw audit_events.
      const u = db as any;
      if (typeof u.description === "string" && u.category) {
        list.push({
          id: u.id,
          timestamp: u.created_at,
          crudType: u.metadata?.crud_type || inferCrudType(u.action || ""),
          category: u.category,
          action: u.action,
          description: u.description,
          entityType: u.entity_type || "general",
          entityId: u.entity_id || "-",
          actor: u.actor_name || "-",
          role: u.actor_role || "-",
          status: u.status || "success",
          metadata: u.metadata,
          source: "database",
        });
        continue;
      }
      let cat: ActivityCategory = "SETTING";
      const res = (db.resource_type || "").toLowerCase();
      if (res.includes("voucher") || res.includes("journal")) cat = "VOUCHER";
      else if (res.includes("account") || res.includes("party") || res.includes("item") || res.includes("product")) cat = "MASTER";
      else if (res.includes("invoice") || res.includes("builder") || res.includes("doc")) cat = "DOCUMENT";
      else if (res.includes("dept") || res.includes("member") || res.includes("task") || res.includes("payroll")) cat = "DEPARTMENT";

      const crudType: CrudOperation = inferCrudType(db.event_type || "");

      const resourceId = db.resource_id || "";
      const resourceType = db.resource_type || "ledger_record";

      list.push({
        id: db.id,
        timestamp: db.created_at,
        crudType,
        category: cat,
        action: db.event_type || "Database System Event",
        description: resourceId
          ? `Authoritative ledger event recorded for ${resourceType} (UUID: ${resourceId.slice(0, 8)}...)`
          : `Authoritative ledger event recorded for ${resourceType}`,
        entityType: resourceType,
        entityId: resourceId || "-",
        actor: db.actor_id || "System Trigger",
        role: "Database Engine",
        status: "success",
        metadata: db.metadata,
        source: "database",
      });
    }

    // Sort newest first
    return list.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [dbEvents]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return unifiedLogs.filter((log) => {
      // Category filter
      if (selectedCategory !== "ALL" && log.category !== selectedCategory) {
        return false;
      }

      // CRUD operation filter
      if (selectedCrud !== "ALL" && log.crudType !== selectedCrud) {
        return false;
      }

      // Status filter
      if (selectedStatus !== "ALL" && log.status !== selectedStatus) {
        return false;
      }

      // Time filter
      if (timeFilter !== "ALL") {
        const logDate = new Date(log.timestamp);
        const now = new Date();
        if (timeFilter === "TODAY") {
          const isToday =
            logDate.getDate() === now.getDate() &&
            logDate.getMonth() === now.getMonth() &&
            logDate.getFullYear() === now.getFullYear();
          if (!isToday) return false;
        } else if (timeFilter === "7DAYS") {
          const diffMs = now.getTime() - logDate.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays > 7) return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const match =
          log.action.toLowerCase().includes(query) ||
          log.description.toLowerCase().includes(query) ||
          log.entityType.toLowerCase().includes(query) ||
          log.entityId.toLowerCase().includes(query) ||
          log.actor.toLowerCase().includes(query) ||
          log.role.toLowerCase().includes(query) ||
          log.crudType.toLowerCase().includes(query) ||
          log.category.toLowerCase().includes(query);
        if (!match) return false;
      }

      return true;
    });
  }, [unifiedLogs, selectedCategory, selectedCrud, selectedStatus, timeFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = unifiedLogs.length;
    const createCount = unifiedLogs.filter((l) => l.crudType === "CREATE").length;
    const updateCount = unifiedLogs.filter((l) => l.crudType === "UPDATE").length;
    const deleteCount = unifiedLogs.filter((l) => l.crudType === "DELETE").length;

    return { total, createCount, updateCount, deleteCount };
  }, [unifiedLogs]);

  // Helper for relative time string
  const formatTimeAgo = (isoString: string) => {
    const diff = Date.now() - new Date(isoString).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 15) return "Just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // CRUD Operation badge helper
  const renderCrudBadge = (crud: CrudOperation) => {
    switch (crud) {
      case "CREATE":
        return <Badge variant="success">Create</Badge>;
      case "UPDATE":
        return <Badge variant="warning">Update</Badge>;
      case "DELETE":
        return <Badge variant="danger">Delete</Badge>;
      case "READ":
      default:
        return <Badge variant="teal">Read</Badge>;
    }
  };

  // Category badge helper
  const renderCategoryBadge = (category: ActivityCategory) => {
    switch (category) {
      case "VOUCHER":
        return (
          <Badge>
            <Receipt className="h-3 w-3" /> Voucher
          </Badge>
        );
      case "MASTER":
        return (
          <Badge>
            <BookOpen className="h-3 w-3" /> Master
          </Badge>
        );
      case "DOCUMENT":
        return (
          <Badge>
            <FileText className="h-3 w-3" /> Document
          </Badge>
        );
      case "DEPARTMENT":
        return (
          <Badge>
            <Users className="h-3 w-3" /> Department
          </Badge>
        );
      case "SETTING":
      default:
        return (
          <Badge>
            <Settings className="h-3 w-3" /> Setting
          </Badge>
        );
    }
  };

  // Status icon helper
  const renderStatusIcon = (status: ActivityStatus) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-ok shrink-0" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-warn shrink-0" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-bad shrink-0" />;
      case "info":
      default:
        return <Info className="h-4 w-4 text-brand-strong shrink-0" />;
    }
  };

  const segBtn = (on: boolean) =>
    `h-7 px-2.5 rounded-[7px] text-[13px] font-medium transition-colors ${
      on ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-ink-muted hover:text-ink"
    }`;
  const filterChip = (on: boolean) =>
    `h-7 px-2.5 rounded-chip text-[13px] whitespace-nowrap transition-colors border ${
      on
        ? "bg-brand-wash text-brand-strong border-brand-wash-strong font-medium"
        : "bg-surface text-ink-soft border-line hover:bg-canvas"
    }`;

  return (
    <div className="space-y-4 font-sans text-[13.5px] pb-10">
      {/* 1. Header and live capture status */}
      <div className="bg-surface px-5 py-4 rounded-panel border border-line flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-[8px] bg-canvas-sunken text-ink-soft grid place-items-center">
            <ShieldCheck className="h-[18px] w-[18px]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-[15px] text-ink tracking-tight">
                Activity log and audit trail
              </h2>
              <kbd className="font-mono text-[11px] leading-none px-1.5 pt-[3px] pb-[2px] rounded-[5px] border border-line-strong border-b-2 bg-surface text-ink-muted">L</kbd>
            </div>
            <p className="text-[13px] text-ink-muted flex items-center gap-1.5 mt-0.5">
              <span>Organisation: <span className="text-ink-soft font-medium">{orgName}</span></span>
              <span className="text-ink-subtle">·</span>
              <span className="flex items-center gap-1.5 text-ok">
                <span className="h-1.5 w-1.5 rounded-full bg-ok inline-block" />
                Capturing activity live
              </span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div data-tour="audit-actions" className="flex items-center flex-wrap gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDbAudit}
            isLoading={isLoadingDb}
            title="Refresh activity logs"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>

          {/* Export Dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
            >
              <Download className="h-3.5 w-3.5" /> Export logs <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
            </Button>
            {isExportMenuOpen && (
              <div
                className="absolute right-0 mt-1 w-44 bg-surface border border-line rounded-ctl shadow-pop z-20 p-1 text-[13.5px]"
                onClick={() => setIsExportMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => downloadSecureAuditExport(orgId, "json", orgName)}
                  className="w-full text-left px-2.5 py-1.5 rounded-[7px] hover:bg-brand-wash flex items-center justify-between text-ink"
                >
                  <span>Export JSON</span>
                  <span className="font-mono text-xs text-ink-subtle">.json</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadSecureAuditExport(orgId, "csv", orgName)}
                  className="w-full text-left px-2.5 py-1.5 rounded-[7px] hover:bg-brand-wash flex items-center justify-between text-ink"
                >
                  <span>Export CSV</span>
                  <span className="font-mono text-xs text-ink-subtle">.csv</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {dbError && (
        <p role="alert" className="text-[13px] text-bad flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4" /> {dbError}
        </p>
      )}

      {/* 2. Summary counts by operation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total operations", value: stats.total, note: "Ledger and data changes", icon: Database, tone: "text-ink" },
          { label: "Created", value: stats.createCount, note: "New vouchers, masters and records", icon: Sparkles, tone: "text-ok" },
          { label: "Updated", value: stats.updateCount, note: "Status, permission and limit changes", icon: RefreshCw, tone: "text-warn" },
          { label: "Deleted or purged", value: stats.deleteCount, note: "Archived accounts and catalogue items", icon: Trash2, tone: "text-bad" },
        ].map((k) => (
          <div key={k.label} className="bg-surface px-5 py-4 rounded-panel border border-line">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-ink-muted">{k.label}</span>
              <k.icon className="h-4 w-4 text-ink-subtle" />
            </div>
            <div className={`text-[26px] font-semibold tracking-[-0.035em] tabular-nums mt-1 ${k.tone}`}>
              {k.value}
            </div>
            <span className="text-[12.5px] text-ink-muted">{k.note}</span>
          </div>
        ))}
      </div>

      {/* 3. Search and filters */}
      <div data-tour="audit-filters" className="bg-surface p-4 rounded-panel border border-line space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-2">
          {/* Live Search */}
          <div className="relative flex-1 w-full">
            <Search className="h-4 w-4 text-ink-subtle absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by action, description, person, record ID or module"
              className="w-full h-9 bg-surface border border-line-strong rounded-ctl pl-9 pr-8 text-[13.5px] text-ink placeholder:text-ink-subtle focus:outline-none focus:border-brand transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink-soft"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Time Filter Pill Selector */}
          <div className="flex items-center gap-0.5 bg-canvas-sunken p-0.5 rounded-ctl shrink-0">
            <button type="button" onClick={() => setTimeFilter("ALL")} className={segBtn(timeFilter === "ALL")}>
              All time
            </button>
            <button type="button" onClick={() => setTimeFilter("TODAY")} className={segBtn(timeFilter === "TODAY")}>
              Today
            </button>
            <button type="button" onClick={() => setTimeFilter("7DAYS")} className={segBtn(timeFilter === "7DAYS")}>
              Last 7 days
            </button>
          </div>

          {/* Status Dropdown */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-9 bg-surface border border-line-strong text-ink-soft rounded-ctl px-2.5 text-[13.5px] focus:outline-none focus:border-brand shrink-0"
            title="Filter by status"
          >
            <option value="ALL">All statuses</option>
            <option value="success">Success</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>

        {/* CRUD Operation Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-line pt-3">
          <span className="text-[13px] text-ink-muted mr-1 shrink-0">Operation</span>
          {[
            { id: "ALL", label: "All operations" },
            { id: "CREATE", label: "Create" },
            { id: "UPDATE", label: "Update" },
            { id: "DELETE", label: "Delete" },
            { id: "READ", label: "Read" },
          ].map((op) => (
            <button
              key={op.id}
              type="button"
              onClick={() => setSelectedCrud(op.id)}
              className={filterChip(selectedCrud === op.id)}
            >
              {op.label}
            </button>
          ))}
        </div>

        {/* Module Category Filter Tabs (Navigation removed) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-line pt-3">
          <span className="text-[13px] text-ink-muted mr-1 shrink-0">Module</span>
          {[
            { id: "ALL", label: "All modules" },
            { id: "VOUCHER", label: "Vouchers and journal" },
            { id: "MASTER", label: "Chart of accounts and masters" },
            { id: "DOCUMENT", label: "Document builder" },
            { id: "DEPARTMENT", label: "Departments and payroll" },
            { id: "SETTING", label: "Company and settings" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={filterChip(selectedCategory === cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Activity feed */}
      <div className="bg-surface rounded-panel border border-line overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-line flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] font-semibold tracking-tight text-ink">Activity stream</span>
            <span className="text-[13px] text-ink-muted tabular-nums">{filteredLogs.length} events</span>
          </div>
          <span className="text-[12.5px] text-ink-muted inline-flex items-center gap-1.5">
            Press <kbd className="font-mono text-[11px] leading-none px-1.5 pt-[3px] pb-[2px] rounded-[5px] border border-line-strong border-b-2 bg-surface text-ink-muted">L</kbd> anywhere to jump here
          </span>
        </div>

        {/* Log Entries List */}
        <div className="divide-y divide-line">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

              return (
                <div
                  key={log.id}
                  className={`px-5 py-3.5 transition-colors ${
                    isExpanded ? "bg-brand-wash/60" : "hover:bg-canvas"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    {/* Left: Icon, CRUD Op, Category, Action, Description */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="pt-0.5">{renderStatusIcon(log.status)}</div>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center flex-wrap gap-1.5">
                          {renderCrudBadge(log.crudType)}
                          {renderCategoryBadge(log.category)}
                          <span className="font-[550] text-ink text-[14px]">
                            {log.action}
                          </span>
                          {log.source === "database" && (
                            <Badge variant="outline">Database trigger</Badge>
                          )}
                        </div>

                        <p className="text-[13.5px] text-ink-soft leading-relaxed">
                          {log.description}
                        </p>

                        <div className="flex items-center flex-wrap gap-2 text-[12.5px] text-ink-muted pt-0.5">
                          <span>
                            {log.entityType} <span className="font-mono text-ink-subtle">{log.entityId}</span>
                          </span>
                          <span className="text-ink-subtle">·</span>
                          <span className="flex items-center gap-1">
                            <UserCheck className="h-3.5 w-3.5 text-ink-subtle" />
                            {log.actor} ({log.role})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Timestamp & Details toggle */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-0.5 shrink-0 pt-0.5">
                      <span
                        className="text-[13px] font-medium text-ink-soft cursor-default tabular-nums"
                        title={new Date(log.timestamp).toLocaleString()}
                      >
                        {formatTimeAgo(log.timestamp)}
                      </span>
                      <span className="text-[12.5px] text-ink-subtle hidden sm:inline tabular-nums">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>

                      {hasMetadata && (
                        <button
                          type="button"
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="mt-1 text-[12.5px] text-brand-strong hover:text-ink flex items-center gap-0.5 font-medium"
                        >
                          {isExpanded ? (
                            <>Hide payload <ChevronDown className="h-3.5 w-3.5" /></>
                          ) : (
                            <>Inspect payload <ChevronRight className="h-3.5 w-3.5" /></>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable Metadata Payload */}
                  {isExpanded && hasMetadata && (
                    <div className="mt-3 p-3 bg-canvas-sunken text-ink-soft rounded-ctl border border-line overflow-x-auto">
                      <div className="flex items-center justify-between text-[12.5px] text-ink-muted border-b border-line pb-1.5 mb-2">
                        <span>Event payload</span>
                        <span>Log ID <span className="font-mono">{log.id}</span></span>
                      </div>
                      <pre className="font-mono text-[12.5px] whitespace-pre-wrap leading-snug">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-[13.5px] text-ink-muted space-y-2">
              <Clock className="h-8 w-8 text-ink-subtle mx-auto" />
              <div className="font-[550] text-ink">
                No activity matched your filters.
              </div>
              <p className="text-[12.5px] text-ink-muted max-w-sm mx-auto">
                Try clearing the search or switching categories. Every action in Deku Finance is logged automatically.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("ALL");
                  setSelectedStatus("ALL");
                  setTimeFilter("ALL");
                }}
                className="mt-2"
              >
                Reset filters
              </Button>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="px-5 py-3 bg-canvas border-t border-line flex flex-col sm:flex-row items-center justify-between text-[12.5px] text-ink-muted gap-2">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-strong" />
            <span>Kept for Section 128(5) and Rule 3(1), Companies (Accounts) Rules</span>
          </div>
          <div>Append-only, non-repudiable audit trail</div>
        </div>
      </div>
    </div>
  );
}
