"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DataTable, ColumnDef } from "@/components/data-table/DataTable";
import { Plus, RefreshCw, Users, AlertCircle, Building, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { partiesApi } from "@/api/endpoints";
import { Party, PartyType } from "@/types/accounting";
import { logUserActivity } from "@/lib/logging/activity-logger";

export function PartiesView() {
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type");

  const [parties, setParties] = useState<Party[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "customer" | "vendor">(() => {
    if (initialType === "customer" || initialType === "vendor") return initialType;
    return "all";
  });

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    type: "customer" as PartyType,
    legal_name: "",
    display_name: "",
    gstin: "",
    pan: "",
    email: "",
    phone: "",
    state: "Maharashtra",
    city: "",
  });

  const [orgId, setOrgId] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("deku_active_org_id");
      if (saved) setOrgId(saved);
    }
  }, []);

  const fetchParties = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await partiesApi.list(orgId);
      setParties(res.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load counterparty records");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    fetchParties();
  }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.legal_name.trim()) {
      alert("Legal name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await partiesApi.create(orgId, {
        type: formData.type,
        legal_name: formData.legal_name,
        display_name: formData.display_name || formData.legal_name,
        gstin: formData.gstin || null,
        pan: formData.pan || null,
        email: formData.email || null,
        phone: formData.phone || null,
        billing_address: {
          city: formData.city,
          state: formData.state,
          country: "India",
        },
      });

      logUserActivity({
        category: "MASTER",
        crud_type: "CREATE",
        action: "Counterparty Registered",
        description: `Registered new ${formData.type.toUpperCase()} '${formData.legal_name}' (GSTIN: ${formData.gstin || "Unregistered / Consumer"})`,
        entity_type: "party",
        entity_id: formData.gstin || formData.legal_name,
        organisation_id: orgId,
        status: "success",
        metadata: {
          partyType: formData.type,
          legalName: formData.legal_name,
          gstin: formData.gstin,
          city: formData.city,
          state: formData.state,
        },
      });

      setIsCreateOpen(false);
      setFormData({
        type: "customer",
        legal_name: "",
        display_name: "",
        gstin: "",
        pan: "",
        email: "",
        phone: "",
        state: "Maharashtra",
        city: "",
      });
      await fetchParties();
    } catch (err: any) {
      alert(err.message || "Failed to create counterparty");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredParties = parties.filter((p) => {
    if (activeTab === "all") return true;
    return p.type === activeTab;
  });

  const columns: ColumnDef<Party>[] = [
    {
      header: "Type",
      sortKey: (p) => p.type,
      cell: (p) => (
        <Badge variant={p.type === "customer" ? "teal" : "default"} className="capitalize">
          {p.type}
        </Badge>
      ),
    },
    {
      header: "Legal and trade name",
      sortKey: (p) => p.legal_name,
      cell: (p) => (
        <div>
          <span className="font-medium text-ink block">
            {p.legal_name}
          </span>
          {p.display_name && p.display_name !== p.legal_name && (
            <span className="text-[12.5px] text-ink-muted">
              {p.display_name}
            </span>
          )}
        </div>
      ),
    },
    {
      header: "GSTIN",
      sortKey: (p) => p.gstin || "",
      cell: (p) => (
        <span className={p.gstin ? "font-mono text-[13px] text-ink-soft" : "text-ink-muted"}>
          {p.gstin || "Unregistered"}
        </span>
      ),
    },
    {
      header: "PAN",
      cell: (p) => (
        <span className="font-mono text-[13px] text-ink-soft">{p.pan || "–"}</span>
      ),
    },
    {
      header: "Location",
      cell: (p) => {
        const addr = p.billing_address;
        return (
          <span className="text-ink-soft">
            {addr?.city ? `${addr.city}, ` : ""}
            {addr?.state || "India"}
          </span>
        );
      },
    },
    {
      header: "Contact",
      cell: (p) => (
        <div className="text-[12.5px] text-ink-muted">
          <div>{p.email || "–"}</div>
          <div>{p.phone || ""}</div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-0.5 rounded-ctl bg-canvas-sunken p-[3px]">
          {(["all", "customer", "vendor"] as const).map((tab) => (
            <button
              key={tab}
              suppressHydrationWarning
              onClick={() => setActiveTab(tab)}
              className={`inline-flex h-[30px] items-center px-3 rounded-[7px] text-[13.5px] capitalize transition-colors ${
                activeTab === tab
                  ? "bg-surface text-ink font-medium shadow-[0_0_0_1px_var(--color-line),0_1px_2px_rgb(14_27_25/0.06)]"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {tab === "all" ? "All parties" : `${tab}s`}
            </button>
          ))}
          </div>

          {activeTab === "customer" && (
            <Link
              href="/reports/debtors"
              className="inline-flex h-8 items-center gap-1.5 rounded-ctl px-3 text-[13px] font-medium text-brand-strong hover:bg-brand-wash transition-colors"
              title="Track Days Sales Outstanding (DSO) & unpaid invoices owed by customers"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Customer DSO ageing</span>
            </Link>
          )}

          {activeTab === "vendor" && (
            <Link
              href="/reports/creditors"
              className="inline-flex h-8 items-center gap-1.5 rounded-ctl px-3 text-[13px] font-medium text-brand-strong hover:bg-brand-wash transition-colors"
              title="Track Days Payable Outstanding (DPO) & vendor bills we owe"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Vendor DPO bills</span>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchParties}
            isLoading={isLoading}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            variant="tally"
            size="sm"
            data-tour="parties-new" onClick={() => setIsCreateOpen(true)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> New party
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-ctl bg-bad-wash border border-bad/25 text-[13px] text-bad flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <button suppressHydrationWarning onClick={fetchParties} className="underline font-semibold ml-2">
            Retry
          </button>
        </div>
      )}

      {/* Parties Table */}
      <DataTable
        columns={columns}
        data={filteredParties}
        searchPlaceholder="Search by name, GSTIN, PAN or location..."
        isLoading={isLoading}
        emptyMessage="No parties registered in this category."
      />

      {/* Create Party Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create new counterparty"
        description="Add a customer or vendor to your accounting masters"
      >
        <form onSubmit={handleCreate} className="space-y-3 font-sans text-[13.5px]">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-ink-soft mb-1.5">
                Party type
              </label>
              <select
                suppressHydrationWarning
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as PartyType })
                }
                className="w-full h-9 rounded-ctl border border-line-strong bg-surface px-2.5 text-[13.5px] text-ink focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20"
              >
                <option value="customer">Customer (Debtor)</option>
                <option value="vendor">Vendor / Supplier (Creditor)</option>
              </select>
            </div>
            <Input
              label="Legal name"
              value={formData.legal_name}
              onChange={(e) =>
                setFormData({ ...formData, legal_name: e.target.value })
              }
              placeholder="e.g. Acme Global India Pvt Ltd"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Display / trade name"
              value={formData.display_name}
              onChange={(e) =>
                setFormData({ ...formData, display_name: e.target.value })
              }
              placeholder="e.g. Acme Global"
            />
            <Input
              label="GSTIN (15 digits)"
              value={formData.gstin}
              onChange={(e) =>
                setFormData({ ...formData, gstin: e.target.value.toUpperCase() })
              }
              placeholder="27ABCDE1234F1Z5"
              maxLength={15}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="PAN"
              value={formData.pan}
              onChange={(e) =>
                setFormData({ ...formData, pan: e.target.value.toUpperCase() })
              }
              placeholder="ABCDE1234F"
              maxLength={10}
            />
            <Input
              label="State / place of supply"
              value={formData.state}
              onChange={(e) =>
                setFormData({ ...formData, state: e.target.value })
              }
              placeholder="e.g. Maharashtra"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="finance@company.com"
            />
            <Input
              label="Phone"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder="+91 98765 43210"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-line">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="tally"
              size="sm"
              isLoading={isSubmitting}
            >
              Save counterparty
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
