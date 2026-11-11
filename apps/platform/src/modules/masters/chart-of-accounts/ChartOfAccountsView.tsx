"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DataTable, ColumnDef } from "@/components/data-table/DataTable";
import {
  FolderTree,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Filter,
  Sparkles,
  ExternalLink,
  Trash2,
  Eye,
  AlertTriangle,
  Power,
  ShieldAlert,
  DollarSign,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { accountingApi, reportsApi } from "@/api/endpoints";
import { Account, AlerxGroup, CreateAccountRequest, AccountBalanceRow } from "@/types/accounting";
import { formatINR } from "@/lib/formatters/currency";
import { logUserActivity } from "@/lib/logging/activity-logger";

const COMMON_LEDGERS: Record<AlerxGroup, string[]> = {
  asset: [
    "Cash & Liquid Capital",
    "Current Assets & Receivables",
    "Bank Accounts",
    "Fixed Assets & Property",
    "Tax Assets & Input Credits",
    "Loans & Advances Given",
  ],
  liability: [
    "Current Liabilities & Payables",
    "Statutory & Tax Liabilities (Duties & Taxes)",
    "Loans & Borrowings",
    "Sundry Creditors",
    "Provisions & Accruals",
  ],
  equity: [
    "Owner / Contributed Capital",
    "Partner Capital",
    "Reserves & Retained Earnings",
    "Drawings",
  ],
  revenue: [
    "Operating Revenue / Sales",
    "Professional & Consulting Fees",
    "Direct Income",
    "Other Income & Receipts",
    "Interest Received",
  ],
  expense: [
    "Operating Overheads & Administration",
    "Cost of Sales / Direct Delivery",
    "Salaries & Employee Benefits",
    "Rent, Rates & Taxes",
    "Financial & Bank Charges",
    "Travel & Conveyance",
    "Advertising & Marketing",
    "Depreciation & Amortization",
  ],
};

export function ChartOfAccountsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialGroup = searchParams?.get("group");
  const initialFilter = searchParams?.get("filter");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>(() => {
    if (initialGroup && ["asset", "liability", "equity", "revenue", "expense"].includes(initialGroup.toLowerCase())) {
      return initialGroup.toLowerCase();
    }
    return "all";
  });
  const [liquidFilter, setLiquidFilter] = useState<boolean>(() => initialFilter === "liquid");
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Active Organisation (from localStorage or default)
  const [orgId, setOrgId] = useState<string>("");

  // Create Account Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState<AlerxGroup>("asset");
  const [newLedger, setNewLedger] = useState("Cash & Liquid Capital");
  const [newSubLedger, setNewSubLedger] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newIsPostable, setNewIsPostable] = useState(true);
  const [newDescription, setNewDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Delete / Remove Modal State
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("deku_active_org_id");
      if (saved) setOrgId(saved);
    }
  }, []);

  const fetchAccounts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [accountsRes, balancesRes] = await Promise.all([
        accountingApi.listAccounts(orgId),
        reportsApi.getAccountBalances(orgId).catch(() => ({ data: [] as AccountBalanceRow[] })),
      ]);

      const balanceMap = new Map<string, AccountBalanceRow>();
      if (balancesRes && balancesRes.data) {
        for (const b of balancesRes.data) {
          if (b.account_id) balanceMap.set(b.account_id, b);
          if (b.account_code) balanceMap.set(b.account_code, b);
        }
      }

      const rawAccounts: Account[] = accountsRes.data || [];
      const mapped: Account[] = rawAccounts.map((acc) => {
        const bal = balanceMap.get(acc.id) || balanceMap.get(acc.code);
        return {
          ...acc,
          units: bal?.units ?? bal?.state_changes ?? 0,
          value: bal?.value ?? bal?.natural_balance ?? 0,
          total_debit: bal?.total_debit ?? 0,
          total_credit: bal?.total_credit ?? 0,
        };
      });

      // Calculate rollups for summary group headers
      const finalAccounts = mapped.map((acc) => {
        if (!acc.is_postable && (acc.units === 0 || acc.units === undefined) && (acc.value === 0 || acc.value === undefined)) {
          const grp = (acc.account_group || acc.type).toLowerCase();
          const children = mapped.filter(
            (c) => (c.account_group || c.type).toLowerCase() === grp && c.is_postable
          );
          const rollupUnits = children.reduce((sum, c) => sum + (c.units || 0), 0);
          const rollupValue = children.reduce((sum, c) => sum + (c.value || 0), 0);
          const rollupDebit = children.reduce((sum, c) => sum + (c.total_debit || 0), 0);
          const rollupCredit = children.reduce((sum, c) => sum + (c.total_credit || 0), 0);
          return {
            ...acc,
            units: rollupUnits,
            value: rollupValue,
            total_debit: rollupDebit,
            total_credit: rollupCredit,
          };
        }
        return acc;
      });

      setAccounts(finalAccounts);
    } catch (err: any) {
      setError(err.message || "Failed to load Chart of Accounts from backend");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    fetchAccounts();
    const handleUpdate = () => fetchAccounts();
    window.addEventListener("deku_ledger_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("deku_ledger_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [orgId]);

  // Global hotkey listener for opening Add Account (Alt+C)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        openCreateModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [accounts]);

  const handleSeed = async () => {
    if (confirm("Seed default Indian GAAP ALERX Chart of Accounts for this organisation?")) {
      try {
        setIsLoading(true);
        await accountingApi.seedAccounts(orgId);
        await fetchAccounts();
      } catch (err: any) {
        alert(err.message || "Failed to seed default accounts");
        setIsLoading(false);
      }
    }
  };

  // Helper to suggest next available code when switching ALERX groups
  const suggestNextCode = (grp: AlerxGroup) => {
    const prefixes: Record<AlerxGroup, string> = {
      asset: "10",
      liability: "20",
      equity: "30",
      revenue: "40",
      expense: "50",
    };
    const prefix = prefixes[grp];
    const groupCodes = accounts
      .filter((a) => a.code.startsWith(prefix) && /^\d+$/.test(a.code))
      .map((a) => parseInt(a.code, 10))
      .sort((a, b) => b - a);

    if (groupCodes.length > 0) {
      return (groupCodes[0] + 10).toString();
    }
    return `${prefix}10`;
  };

  const openCreateModal = () => {
    const initialGrp: AlerxGroup =
      activeGroup !== "all" ? (activeGroup as AlerxGroup) : "asset";
    setNewGroup(initialGrp);
    setNewCode(suggestNextCode(initialGrp));
    setNewName("");
    setNewLabel("");
    setNewLedger(COMMON_LEDGERS[initialGrp][0]);
    setNewSubLedger("");
    setNewIsPostable(true);
    setNewDescription("");
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const handleGroupChange = (grp: AlerxGroup) => {
    setNewGroup(grp);
    setNewCode(suggestNextCode(grp));
    setNewLedger(COMMON_LEDGERS[grp][0]);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) {
      setCreateError("Account code is required.");
      return;
    }
    if (!newName.trim()) {
      setCreateError("Account name is required.");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    const payload: CreateAccountRequest = {
      code: newCode.trim(),
      name: newName.trim(),
      account_group: newGroup,
      ledger: newLedger.trim() || undefined,
      sub_ledger: newSubLedger.trim() || undefined,
      label: newLabel.trim() || newName.trim(),
      is_postable: newIsPostable,
      description: newDescription.trim() || undefined,
    };

    try {
      await accountingApi.createAccount(orgId, payload);

      logUserActivity({
        category: "MASTER",
        crud_type: "CREATE",
        action: "Ledger Account Created",
        description: `Created new ${newGroup.toUpperCase()} account '${newName}' (Code: ${newCode})`,
        entity_type: "account",
        entity_id: newCode,
        organisation_id: orgId,
        status: "success",
        metadata: {
          code: newCode,
          name: newName,
          group: newGroup,
          isPostable: newIsPostable,
        },
      });

      setIsCreateOpen(false);
      await fetchAccounts();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create account in PostgreSQL");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!accountToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await accountingApi.deleteAccount(orgId, accountToDelete.id);

      logUserActivity({
        category: "MASTER",
        crud_type: "DELETE",
        action: "Ledger Account Deleted",
        description: `Deleted ${(accountToDelete.type || accountToDelete.account_group).toUpperCase()} account '${accountToDelete.name}' (Code: ${accountToDelete.code})`,
        entity_type: "account",
        entity_id: accountToDelete.code,
        organisation_id: orgId,
        status: "success",
        metadata: {
          id: accountToDelete.id,
          code: accountToDelete.code,
          name: accountToDelete.name,
          account_group: accountToDelete.account_group,
          type: accountToDelete.type,
        },
      });

      setIsDeleteOpen(false);
      setIsDetailOpen(false);
      setAccountToDelete(null);
      await fetchAccounts();
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (account: Account) => {
    setIsDeactivating(true);
    setDeleteError(null);
    try {
      const nextActive = !account.is_active;
      await accountingApi.updateAccount(orgId, account.id, { is_active: nextActive });

      logUserActivity({
        category: "MASTER",
        crud_type: "UPDATE",
        action: nextActive ? "Ledger Account Activated" : "Ledger Account Deactivated",
        description: `Set account '${account.name}' (${account.code}) status to ${nextActive ? "Active" : "Archived/Inactive"}`,
        entity_type: "account",
        entity_id: account.code,
        organisation_id: orgId,
        status: "success",
        metadata: {
          id: account.id,
          code: account.code,
          is_active: nextActive,
        },
      });

      if (selectedAccount?.id === account.id) {
        setSelectedAccount({ ...account, is_active: nextActive });
      }
      setIsDeleteOpen(false);
      setAccountToDelete(null);
      await fetchAccounts();
    } catch (err: any) {
      setDeleteError(err.message || "Failed to update account status");
    } finally {
      setIsDeactivating(false);
    }
  };

  // Helper to identify liquid asset accounts (Cash, Bank Accounts, Petty Cash)
  const isLiquidAccount = (acc: Account) => {
    const grp = (acc.account_group || acc.type).toLowerCase();
    if (grp !== "asset") return false;
    return acc.ledger === "Cash & Liquid Capital";
  };

  const liquidAccounts = React.useMemo(() => {
    return accounts.filter((a) => isLiquidAccount(a) && a.is_postable);
  }, [accounts]);

  const liquidTotalUnits = React.useMemo(() => {
    return liquidAccounts.length;
  }, [liquidAccounts]);

  const liquidTotalValue = React.useMemo(() => {
    return liquidAccounts.reduce((sum, a) => sum + (a.value || 0), 0);
  }, [liquidAccounts]);

  // Filter accounts by active ALERX tab and liquid filter
  const filteredAccounts = React.useMemo(() => {
    return accounts.filter((acc) => {
      if (activeGroup === "asset" && liquidFilter) {
        return isLiquidAccount(acc);
      }
      if (activeGroup === "all") return true;
      const grp = (acc.account_group || acc.type).toLowerCase();
      return grp === activeGroup.toLowerCase();
    });
  }, [accounts, activeGroup, liquidFilter]);

  const columns: ColumnDef<Account>[] = [
    {
      header: "Code",
      sortKey: (acc) => acc.code,
      cell: (acc) => (
        <span className="font-mono text-[13px] font-medium text-ink">
          {acc.code}
        </span>
      ),
    },
    {
      header: "Account name / label",
      sortKey: (acc) => acc.name,
      cell: (acc) => {
        const isHeader = !acc.is_postable;
        return (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span
                className={`font-sans ${
                  isHeader ? "font-semibold text-ink" : "text-ink"
                }`}
              >
                {acc.name}
              </span>
              {!acc.is_active && (
                <span className="inline-flex items-center h-[20px] px-1.5 rounded-chip bg-warn-wash text-warn text-xs font-medium">
                  Inactive
                </span>
              )}
            </div>
            {acc.label && acc.label !== acc.name && (
              <span className="text-[12.5px] text-ink-muted">
                {acc.label}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: "ALERX group",
      sortKey: (acc) => acc.account_group || acc.type,
      cell: (acc) => {
        const grp = (acc.account_group || acc.type).toLowerCase();
        return <Badge variant={grp === "asset" ? "teal" : "default"} className="capitalize">{grp}</Badge>;
      },
    },
    {
      header: "Ledger",
      cell: (acc) => (
        <span className="text-ink-soft text-[13px]">
          {acc.ledger || "General"}
        </span>
      ),
    },
    {
      header: "Sub-ledger",
      cell: (acc) => (
        <span className="text-ink-soft text-[13px]">
          {acc.sub_ledger || "–"}
        </span>
      ),
    },
    {
      header: "Unit",
      sortKey: (acc) => acc.units ?? 0,
      cell: (acc) => {
        const units = acc.units ?? 0;
        const isHeader = !acc.is_postable;
        return (
          <div className="flex items-center gap-1 tabular-nums">
            <span
              className={`text-[13px] font-medium ${
                units > 0 ? "text-ink" : "text-ink-subtle"
              }`}
            >
              {units}
            </span>
            <span className="text-[12.5px] text-ink-subtle">
              {isHeader ? "total" : units === 1 ? "unit" : "units"}
            </span>
          </div>
        );
      },
    },
    {
      header: "Value (INR)",
      align: "right",
      sortKey: (acc) => acc.value ?? 0,
      cell: (acc) => {
        const val = acc.value ?? 0;
        const grp = (acc.account_group || acc.type).toLowerCase();
        const isHeader = !acc.is_postable;

        let drCr = "";
        if (val !== 0) {
          if (grp === "asset" || grp === "expense") {
            drCr = val >= 0 ? "Dr" : "Cr";
          } else {
            drCr = val >= 0 ? "Cr" : "Dr";
          }
        }

        return (
          <div className="text-right tabular-nums">
            <div className="flex items-center justify-end gap-1.5">
              <span
                className={`text-[13.5px] ${
                  isHeader
                    ? "font-semibold text-ink"
                    : val > 0
                    ? "text-ink"
                    : val < 0
                    ? "text-bad"
                    : "text-ink-subtle"
                }`}
              >
                {formatINR(Math.abs(val))}
              </span>
              {drCr && (
                <span
                  className={`inline-flex items-center h-[20px] px-1.5 rounded-chip text-xs font-medium ${
                    drCr === "Dr" ? "bg-canvas-sunken text-ink-soft" : "bg-brand-wash text-brand-strong"
                  }`}
                >
                  {drCr}
                </span>
              )}
            </div>
            {isHeader && (
              <span className="text-[12.5px] text-ink-subtle block">
                Group rollup
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: "Posting status",
      cell: (acc) =>
        acc.is_postable ? (
          <Badge variant="success">Postable leaf</Badge>
        ) : (
          <Badge variant="outline">Group header</Badge>
        ),
    },
    {
      header: "Actions",
      align: "center",
      cell: (acc) => (
        <div
          className="flex items-center justify-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setSelectedAccount(acc);
              setIsDetailOpen(true);
            }}
            title="View account details"
            className="p-1.5 text-ink-muted hover:text-ink hover:bg-canvas-sunken rounded-chip transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {!acc.is_system && (
            <button
              onClick={() => {
                setAccountToDelete(acc);
                setDeleteError(null);
                setIsDeleteOpen(true);
              }}
              title="Remove / delete account"
              className="p-1.5 text-ink-muted hover:text-bad hover:bg-bad-wash rounded-chip transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top Controls: Tab filters, Add Account, Refresh, and Seed */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* ALERX Tabs */}
        <div data-tour="coa-tabs" className="flex items-center gap-2 overflow-x-auto">
          <div className="inline-flex items-center gap-0.5 rounded-ctl bg-canvas-sunken p-[3px]">
          {[
            { id: "all", label: "All accounts" },
            { id: "asset", label: "Assets" },
            { id: "liability", label: "Liabilities" },
            { id: "equity", label: "Equity" },
            { id: "revenue", label: "Revenue" },
            { id: "expense", label: "Expenses" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveGroup(tab.id);
                if (tab.id !== "asset") setLiquidFilter(false);
              }}
              className={`inline-flex h-[30px] items-center px-3 rounded-[7px] text-[13.5px] transition-colors whitespace-nowrap ${
                activeGroup === tab.id
                  ? "bg-surface text-ink font-medium shadow-[0_0_0_1px_var(--color-line),0_1px_2px_rgb(14_27_25/0.06)]"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
          </div>
          {activeGroup === "asset" && (
            <button
              onClick={() => setLiquidFilter((prev) => !prev)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-ctl border px-3 text-[13px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                liquidFilter
                  ? "bg-brand-wash text-brand-strong border-brand/30"
                  : "bg-surface text-ink-soft border-line-strong hover:bg-canvas"
              }`}
              title="Filter to liquid funds (cash and bank ledgers)"
            >
              <DollarSign className="h-3.5 w-3.5" />
              <span>Liquid funds ({liquidTotalUnits} units)</span>
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="tally"
            size="sm"
            data-tour="coa-add-account" onClick={openCreateModal}
            className="gap-1.5"
            title="Create new accounting ledger (Alt+C)"
            shortcutHint="Alt+C"
          >
            <Plus className="h-3.5 w-3.5" /> Add account
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchAccounts}
            isLoading={isLoading}
            title="Refresh from PostgreSQL"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>

          {accounts.length === 0 && !isLoading && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSeed}
              className="gap-1"
            >
              <Sparkles className="h-3.5 w-3.5" /> Seed default COA
            </Button>
          )}
        </div>
      </div>

      {/* Liquid Funds Dedicated Drilldown Banner (When visiting from Business KPIs or toggled) */}
      {activeGroup === "asset" && liquidFilter && (
        <div className="rounded-panel border border-line bg-surface p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-[8px] bg-brand-wash text-brand-strong grid place-items-center shrink-0">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold tracking-tight text-ink">Liquid funds and immediate liquidity</span>
                <Badge variant="teal">ALERX asset sub-ledger</Badge>
              </div>
              <p className="text-[13px] text-ink-muted mt-0.5">
                Cash in hand, bank current accounts and other instantly liquid ledgers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right">
              <div className="text-[12.5px] text-ink-muted">Liquid units</div>
              <div className="text-[14px] font-medium tabular-nums text-ink">{liquidTotalUnits} active accounts</div>
            </div>
            <div className="h-8 w-px bg-line" />
            <div className="text-right">
              <div className="text-[12.5px] text-ink-muted">Total liquid value</div>
              <div className="text-[17px] font-semibold tracking-tight tabular-nums text-ink">
                <span className="ledger-total">{formatINR(Math.abs(liquidTotalValue))}</span> {liquidTotalValue >= 0 ? "Dr" : "Cr"}
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setLiquidFilter(false)}
              title="Show all asset accounts in the chart of accounts"
            >
              Show all assets
            </Button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3 rounded-ctl bg-bad-wash border border-bad/25 text-[13px] text-bad flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchAccounts}
            className="font-semibold underline ml-2 hover:text-bad"
          >
            Retry
          </button>
        </div>
      )}

      {/* Accounts Data Grid */}
      <DataTable
        columns={columns}
        data={filteredAccounts}
        searchPlaceholder="Search by code, account name, ledger or group..."
        isLoading={isLoading}
        emptyMessage="No accounts found in this group."
        onRowClick={(acc) => {
          setSelectedAccount(acc);
          setIsDetailOpen(true);
        }}
        pageSize={20}
      />

      {/* ------------------------------------------------------------- */}
      {/* 1. Add / Create Account Modal */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create new ledger account"
        description="Add an authoritative ledger account to the Indian GAAP ALERX hierarchy."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-[13.5px] font-sans">
          {createError && (
            <div className="p-2.5 rounded-ctl bg-bad-wash border border-bad/25 text-bad flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          {/* ALERX Classification Pills */}
          <div>
            <label className="block text-[13px] font-medium text-ink-soft mb-1.5">
              ALERX account group *
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {(["asset", "liability", "equity", "revenue", "expense"] as AlerxGroup[]).map(
                (grp) => (
                  <button
                    key={grp}
                    type="button"
                    onClick={() => handleGroupChange(grp)}
                    className={`h-9 px-2 text-center rounded-ctl border text-[13px] font-medium capitalize transition-colors ${
                      newGroup === grp
                        ? "bg-brand-wash text-brand-strong border-brand/40"
                        : "bg-surface text-ink-soft border-line-strong hover:bg-canvas"
                    }`}
                  >
                    {grp}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Account Code & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Input
                label="Account code *"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="e.g. 1040"
                className="font-mono"
                required
              />
              <span className="text-[12.5px] text-ink-muted block mt-1">
                Numeric code for fast Tally-style voucher entry
              </span>
            </div>
            <div className="sm:col-span-2">
              <Input
                label="Account name *"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (!newLabel) setNewLabel(e.target.value);
                }}
                placeholder="e.g. ICICI Current Account / Office Supplies"
                required
              />
            </div>
          </div>

          {/* Ledger Group & Sub-Ledger */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-ink-soft mb-1.5">
                Parent ledger group
              </label>
              <input
                type="text"
                list="ledger-options"
                value={newLedger}
                onChange={(e) => setNewLedger(e.target.value)}
                placeholder="Select or enter ledger"
                className="w-full h-9 rounded-ctl border border-line-strong bg-surface text-[13.5px] text-ink px-3 focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20"
              />
              <datalist id="ledger-options">
                {COMMON_LEDGERS[newGroup]?.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
            </div>
            <div>
              <Input
                label="Sub-ledger (optional)"
                value={newSubLedger}
                onChange={(e) => setNewSubLedger(e.target.value)}
                placeholder="e.g. Mumbai Branch / Operating"
              />
            </div>
          </div>

          {/* Label & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Input
                label="Display label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Invoice & statement label"
              />
            </div>
            <div>
              <Input
                label="Description / purpose"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Internal notes or GST classification"
              />
            </div>
          </div>

          {/* Postable Leaf Checkbox */}
          <div className="flex items-start gap-2.5 p-3 rounded-ctl bg-canvas border border-line">
            <input
              type="checkbox"
              id="is-postable-toggle"
              checked={newIsPostable}
              onChange={(e) => setNewIsPostable(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand"
            />
            <label htmlFor="is-postable-toggle" className="cursor-pointer select-none">
              <span className="font-medium text-ink block">
                Postable leaf account
              </span>
              <span className="text-[12.5px] text-ink-muted block">
                Allow journal entries, payment vouchers, and invoices to record lines directly
                to this account. (Uncheck if this is a header rollup group).
              </span>
            </label>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="tally"
              size="sm"
              isLoading={isCreating}
              className="gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Save account
            </Button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* 2. Remove / Delete Account Confirmation Modal */}
      {/* ------------------------------------------------------------- */}
      {accountToDelete && (
        <Modal
          isOpen={isDeleteOpen}
          onClose={() => {
            if (!isDeleting && !isDeactivating) {
              setIsDeleteOpen(false);
              setAccountToDelete(null);
            }
          }}
          title="Remove ledger account"
          description={`Confirm deletion or deactivation of account #${accountToDelete.code}`}
        >
          <div className="space-y-4 text-[13.5px] font-sans">
            <div className="p-3 bg-bad-wash border border-bad/25 rounded-ctl flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-bad shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-bad text-[14px]">
                  Delete account #{accountToDelete.code} — {accountToDelete.name}?
                </p>
                <p className="text-bad text-[13px] mt-1">
                  Accounting rules enforce data integrity: accounts with existing journal transactions
                  cannot be permanently deleted to protect the audit trail.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-warn-wash border border-warn/30 rounded-ctl space-y-2">
                <div className="flex items-center gap-2 text-warn font-medium">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-warn" />
                  <span>{deleteError}</span>
                </div>
                <div className="pt-2 border-t border-warn/30 flex justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleToggleActive(accountToDelete)}
                    isLoading={isDeactivating}
                    className="gap-1.5"
                  >
                    <Power className="h-3.5 w-3.5" /> Deactivate account instead
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 p-3 bg-canvas rounded-ctl border border-line text-[13px]">
              <div>
                <span className="text-[12.5px] text-ink-muted block">ALERX group</span>
                <span className="font-medium text-ink capitalize">
                  {accountToDelete.account_group || accountToDelete.type}
                </span>
              </div>
              <div>
                <span className="text-[12.5px] text-ink-muted block">Ledger group</span>
                <span className="font-medium text-ink">
                  {accountToDelete.ledger || "General Ledger"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-line">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsDeleteOpen(false);
                  setAccountToDelete(null);
                }}
                disabled={isDeleting || isDeactivating}
              >
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleActive(accountToDelete)}
                  isLoading={isDeactivating}
                  disabled={isDeleting}
                  className="gap-1"
                >
                  <Power className="h-3.5 w-3.5" />
                  {accountToDelete.is_active ? "Deactivate" : "Reactivate"}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={handleDeleteSubmit}
                  isLoading={isDeleting}
                  disabled={isDeactivating}
                  className="gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete permanently
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. Account Detail Drawer / Modal */}
      {/* ------------------------------------------------------------- */}
      {selectedAccount && (
        <Modal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={`Account #${selectedAccount.code} — ${selectedAccount.name}`}
          description={`ALERX classification: ${selectedAccount.account_group || selectedAccount.type}`}
        >
          <div className="space-y-4 text-[13.5px] font-sans">
            <div className="grid grid-cols-2 gap-3 p-4 bg-canvas rounded-ctl border border-line">
              <div>
                <span className="text-[12.5px] text-ink-muted block">
                  Account code
                </span>
                <span className="font-mono text-[13.5px] font-medium text-ink">
                  {selectedAccount.code}
                </span>
              </div>
              <div>
                <span className="text-[12.5px] text-ink-muted block">
                  Status
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant={selectedAccount.is_active ? "success" : "warning"}>
                    {selectedAccount.is_active ? "Active" : "Inactive"}
                  </Badge>
                  {selectedAccount.is_system && (
                    <Badge variant="outline">System core</Badge>
                  )}
                </div>
              </div>
              <div>
                <span className="text-[12.5px] text-ink-muted block">
                  Posting status
                </span>
                <span className="font-medium text-ink">
                  {selectedAccount.is_postable
                    ? "Postable (can receive journal lines)"
                    : "Header only (summary rollup)"}
                </span>
              </div>
              <div>
                <span className="text-[12.5px] text-ink-muted block">
                  Ledger group
                </span>
                <span className="font-medium text-ink">
                  {selectedAccount.ledger || "General Ledger"}
                </span>
              </div>

              {/* State Units and Monetary Value */}
              <div className="p-3 bg-surface rounded-ctl border border-line">
                <span className="text-[12.5px] text-ink-muted block">
                  State-change units
                </span>
                <div className="flex items-center gap-1.5 mt-0.5 tabular-nums">
                  <span className="font-semibold text-[15px] text-ink">
                    {selectedAccount.units ?? 0}
                  </span>
                  <span className="text-[12.5px] text-ink-muted">
                    {(selectedAccount.units ?? 0) === 1 ? "state mutation" : "state mutations"}
                  </span>
                </div>
              </div>
              <div className="p-3 bg-surface rounded-ctl border border-line">
                <span className="text-[12.5px] text-ink-muted block">
                  Current ledger value
                </span>
                <div className="flex items-center gap-1.5 mt-0.5 tabular-nums">
                  <span className="font-semibold text-[15px] text-ink">
                    {formatINR(Math.abs(selectedAccount.value ?? 0))}
                  </span>
                  <span className="text-[12.5px] text-ink-muted font-medium">
                    {(selectedAccount.account_group || selectedAccount.type) === "asset" || (selectedAccount.account_group || selectedAccount.type) === "expense"
                      ? ((selectedAccount.value ?? 0) >= 0 ? "Dr" : "Cr")
                      : ((selectedAccount.value ?? 0) >= 0 ? "Cr" : "Dr")}
                  </span>
                </div>
              </div>

              <div className="col-span-2">
                <span className="text-[12.5px] text-ink-muted block">
                  Sub-ledger
                </span>
                <span className="font-medium text-ink">
                  {selectedAccount.sub_ledger || "–"}
                </span>
              </div>
            </div>

            {selectedAccount.description && (
              <div>
                <span className="text-[12.5px] text-ink-muted block mb-1">
                  Description and purpose
                </span>
                <p className="text-ink-soft bg-surface p-3 rounded-ctl border border-line">
                  {selectedAccount.description}
                </p>
              </div>
            )}

            <div className="pt-3 flex flex-col sm:flex-row justify-between items-center gap-2 border-t border-line">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDetailOpen(false);
                  router.push(`/day-book?account_code=${selectedAccount.code}`);
                }}
                className="gap-1"
              >
                <ExternalLink className="h-3.5 w-3.5" /> View ledger transactions
              </Button>

              <div className="flex items-center gap-2">
                {!selectedAccount.is_system && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(selectedAccount)}
                      isLoading={isDeactivating}
                      className="gap-1 text-ink-soft"
                    >
                      <Power className="h-3.5 w-3.5" />
                      {selectedAccount.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setAccountToDelete(selectedAccount);
                        setDeleteError(null);
                        setIsDeleteOpen(true);
                      }}
                      className="gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  </>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsDetailOpen(false)}
                >
                  Close (Esc)
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
