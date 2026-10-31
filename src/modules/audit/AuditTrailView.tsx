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
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            CREATE
          </span>
        );
      case "UPDATE":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
            UPDATE
          </span>
        );
      case "DELETE":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
            DELETE
          </span>
        );
      case "READ":
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-100 text-sky-800 border border-sky-300">
            READ
          </span>
        );
    }
  };

  // Category badge helper
  const renderCategoryBadge = (category: ActivityCategory) => {
    switch (category) {
      case "VOUCHER":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <Receipt className="h-2.5 w-2.5" /> VOUCHER
          </span>
        );
      case "MASTER":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-800 border border-purple-300">
            <BookOpen className="h-2.5 w-2.5" /> MASTER
          </span>
        );
      case "DOCUMENT":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-100 text-teal-800 border border-teal-300">
            <FileText className="h-2.5 w-2.5" /> DOCUMENT
          </span>
        );
      case "DEPARTMENT":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
            <Users className="h-2.5 w-2.5" /> DEPARTMENT
          </span>
        );
      case "SETTING":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300">
            <Settings className="h-2.5 w-2.5" /> SETTING
          </span>
        );
    }
  };

  // Status icon helper
  const renderStatusIcon = (status: ActivityStatus) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />;
      case "warning":
        return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
      case "error":
        return <AlertCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />;
      case "info":
      default:
        return <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
    }
  };

  return (
    <div className="space-y-3 font-sans text-xs pb-10">
      {/* ========================================================================= */}
      {/* 1. Header Banner & Live Sync Status                                       */}
      {/* ========================================================================= */}
      <div className="bg-white p-3 rounded-lg border border-line-strong shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-panel border border-edge flex items-center justify-center text-brand">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm text-ink tracking-tight">
                User Activity Logs &amp; Audit Trail
              </h2>
              <kbd className="font-mono text-[10px] font-bold text-brand bg-panel px-1.5 py-0.2 rounded border border-edge">
                Shortcut: L
              </kbd>
            </div>
            <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
              <span>Organisation: <strong>{orgName}</strong></span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                Live User Activity Capture Active
              </span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDbAudit}
            isLoading={isLoadingDb}
            title="Refresh activity logs"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>

          {/* Export Dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              className="text-xs"
            >
              <Download className="h-3 w-3" /> Export Logs <ChevronDown className="h-3 w-3 ml-0.5" />
            </Button>
            {isExportMenuOpen && (
              <div
                className="absolute right-0 mt-1 w-44 bg-white border border-line-strong rounded shadow-lg z-20 py-1 text-xs"
                onClick={() => setIsExportMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => downloadSecureAuditExport(orgId, "json", orgName)}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center justify-between text-slate-700"
                >
                  <span>Export Verified JSON</span>
                  <span className="font-mono text-[9px] text-slate-400">.json</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadSecureAuditExport(orgId, "csv", orgName)}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center justify-between text-slate-700"
                >
                  <span>Export Verified CSV</span>
                  <span className="font-mono text-[9px] text-slate-400">.csv</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {dbError && (
        <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5" /> {dbError}
        </p>
      )}

      {/* ========================================================================= */}
      {/* 2. Top Statistics Cards (Pure CRUD Operations)                           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="bg-white p-2.5 rounded-lg border border-line-strong shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-500 uppercase font-semibold">
              Total CRUD Operations
            </span>
            <Database className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-bold font-mono text-ink mt-1">
            {stats.total}
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Pure ledger &amp; data modifications
          </span>
        </div>

        <div className="bg-white p-2.5 rounded-lg border border-line-strong shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-emerald-600 uppercase font-semibold">
              Created (C)
            </span>
            <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
            {stats.createCount}
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            New vouchers, masters &amp; records
          </span>
        </div>

        <div className="bg-white p-2.5 rounded-lg border border-line-strong shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-amber-600 uppercase font-semibold">
              Updated (U)
            </span>
            <RefreshCw className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-700 mt-1">
            {stats.updateCount}
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Status, permissions &amp; limit revisions
          </span>
        </div>

        <div className="bg-white p-2.5 rounded-lg border border-line-strong shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-rose-600 uppercase font-semibold">
              Deleted / Purged (D)
            </span>
            <Trash2 className="h-3.5 w-3.5 text-rose-500" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-700 mt-1">
            {stats.deleteCount}
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Archived accounts &amp; catalog items
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. Search Bar & Filter Categories                                         */}
      {/* ========================================================================= */}
      <div className="bg-white p-3 rounded-lg border border-line-strong shadow-2xs space-y-2.5">
        <div className="flex flex-col md:flex-row items-center gap-2">
          {/* Live Search */}
          <div className="relative flex-1 w-full">
            <Search className="h-4 w-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search CRUD events by action, description, actor, entity ID, or module..."
              className="w-full bg-slate-50 border border-slate-300 rounded pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-brand focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-mono"
              >
                ✕
              </button>
            )}
          </div>

          {/* Time Filter Pill Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded border border-slate-200 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setTimeFilter("ALL")}
              className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold transition-colors ${
                timeFilter === "ALL"
                  ? "bg-panel text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter("TODAY")}
              className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold transition-colors ${
                timeFilter === "TODAY"
                  ? "bg-panel text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter("7DAYS")}
              className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold transition-colors ${
                timeFilter === "7DAYS"
                  ? "bg-panel text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Last 7 Days
            </button>
          </div>

          {/* Status Dropdown */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-slate-700 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-brand shrink-0"
            title="Filter by status"
          >
            <option value="ALL">All Statuses</option>
            <option value="success">Success</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>

        {/* CRUD Operation Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-t border-slate-100 pt-2">
          <span className="text-[10px] font-mono uppercase font-bold text-slate-400 mr-1 shrink-0">
            CRUD Op:
          </span>
          {[
            { id: "ALL", label: "All CRUD Operations" },
            { id: "CREATE", label: "CREATE", color: "hover:border-emerald-300" },
            { id: "UPDATE", label: "UPDATE", color: "hover:border-amber-300" },
            { id: "DELETE", label: "DELETE", color: "hover:border-rose-300" },
            { id: "READ", label: "READ", color: "hover:border-sky-300" },
          ].map((op) => {
            const isSelected = selectedCrud === op.id;
            return (
              <button
                key={op.id}
                type="button"
                onClick={() => setSelectedCrud(op.id)}
                className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold whitespace-nowrap transition-colors border ${
                  isSelected
                    ? "bg-panel text-brand-soft border-edge shadow-2xs"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {op.label}
              </button>
            );
          })}
        </div>

        {/* Module Category Filter Tabs (Navigation removed) */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs border-t border-slate-100 pt-2">
          <span className="text-[10px] font-mono uppercase font-bold text-slate-400 mr-1 shrink-0">
            Module:
          </span>
          {[
            { id: "ALL", label: "All Modules" },
            { id: "VOUCHER", label: "Vouchers & Journal" },
            { id: "MASTER", label: "Chart of Accounts & Masters" },
            { id: "DOCUMENT", label: "Document Builder" },
            { id: "DEPARTMENT", label: "Departments & Payroll" },
            { id: "SETTING", label: "Company & Settings" },
          ].map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-colors border ${
                  isSelected
                    ? "bg-panel text-brand-soft border-edge font-bold shadow-2xs"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. Activity Logs Feed / Table                                             */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-lg border border-line-strong shadow-2xs overflow-hidden">
        {/* Table Header Bar */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-brand" />
            <span className="font-mono text-xs font-bold text-slate-800 uppercase tracking-wide">
              CRUD Activity Stream ({filteredLogs.length} events)
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Press <strong>L</strong> anywhere in Deku Finance to jump here
          </span>
        </div>

        {/* Log Entries List */}
        <div className="divide-y divide-slate-100">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

              return (
                <div
                  key={log.id}
                  className={`p-3 transition-colors ${
                    isExpanded ? "bg-slate-50/80" : "hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    {/* Left: Icon, CRUD Op, Category, Action, Description */}
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="pt-0.5">{renderStatusIcon(log.status)}</div>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center flex-wrap gap-1.5">
                          {renderCrudBadge(log.crudType)}
                          {renderCategoryBadge(log.category)}
                          <span className="font-bold text-slate-900 text-xs">
                            {log.action}
                          </span>
                          {log.source === "database" && (
                            <span className="px-1.5 py-0.2 rounded font-mono text-[9px] bg-slate-100 text-slate-600 border border-slate-300">
                              PostgreSQL Trigger
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-700 leading-relaxed font-normal">
                          {log.description}
                        </p>

                        <div className="flex items-center flex-wrap gap-2 text-[10px] font-mono text-slate-500 pt-0.5">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            Target: <strong>{log.entityType}</strong> ({log.entityId})
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="flex items-center gap-1 text-slate-600">
                            <UserCheck className="h-3 w-3 text-slate-400" />
                            {log.actor} ({log.role})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Timestamp & Details toggle */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1 shrink-0 pt-0.5">
                      <span
                        className="font-mono text-[11px] font-semibold text-slate-700 cursor-default"
                        title={new Date(log.timestamp).toLocaleString()}
                      >
                        {formatTimeAgo(log.timestamp)}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
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
                          className="mt-1 text-[10px] font-mono text-brand-strong hover:text-brand flex items-center gap-0.5 font-semibold"
                        >
                          {isExpanded ? (
                            <>Hide Payload <ChevronDown className="h-3 w-3" /></>
                          ) : (
                            <>Inspect Payload <ChevronRight className="h-3 w-3" /></>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable Metadata Payload */}
                  {isExpanded && hasMetadata && (
                    <div className="mt-2.5 p-2.5 bg-ink text-emerald-400 rounded-md font-mono text-[10px] border border-slate-700 overflow-x-auto shadow-inner">
                      <div className="flex items-center justify-between text-slate-400 border-b border-slate-700 pb-1 mb-1.5">
                        <span>Structured Audit Event Payload</span>
                        <span>Log ID: {log.id}</span>
                      </div>
                      <pre className="whitespace-pre-wrap leading-tight">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-xs text-slate-500 space-y-2">
              <Clock className="h-8 w-8 text-slate-300 mx-auto" />
              <div className="font-semibold text-slate-700">
                No activity log records matched your query.
              </div>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Try clearing your search query or switching categories. Every action you perform in Deku Finance is logged automatically.
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
                className="mt-2 text-xs"
              >
                Reset Filters
              </Button>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2 font-mono">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-brand" />
            <span>Section 128(5) &amp; Rule 3(1) Companies (Accounts) Rules Compliance Verified</span>
          </div>
          <div className="text-slate-400">
            Append-only • Non-repudiation audit trail
          </div>
        </div>
      </div>
    </div>
  );
}
