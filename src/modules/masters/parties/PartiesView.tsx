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
    city: "Mumbai",
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
        city: "Mumbai",
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
        <Badge variant={p.type === "customer" ? "teal" : "warning"}>
          {p.type}
        </Badge>
      ),
    },
    {
      header: "Legal & Trade Name",
      sortKey: (p) => p.legal_name,
      cell: (p) => (
        <div>
          <span className="font-bold text-slate-900 block">
            {p.legal_name}
          </span>
          {p.display_name && p.display_name !== p.legal_name && (
            <span className="text-[11px] text-slate-500">
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
        <span className="font-mono text-slate-700">
          {p.gstin || "Unregistered"}
        </span>
      ),
    },
    {
      header: "PAN",
      cell: (p) => (
        <span className="font-mono text-slate-700">{p.pan || "—"}</span>
      ),
    },
    {
      header: "Location / State",
      cell: (p) => {
        const addr = p.billing_address;
        return (
          <span className="text-slate-600">
            {addr?.city ? `${addr.city}, ` : ""}
            {addr?.state || "India"}
          </span>
        );
      },
    },
    {
      header: "Contact",
      cell: (p) => (
        <div className="text-[11px] text-slate-500">
          <div>{p.email || "—"}</div>
          <div>{p.phone || ""}</div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["all", "customer", "vendor"] as const).map((tab) => (
            <button
              key={tab}
              suppressHydrationWarning
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded capitalize transition-colors ${
                activeTab === tab
                  ? "bg-panel text-white font-bold"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab === "all" ? "All Parties" : `${tab}s`}
            </button>
          ))}

          {activeTab === "customer" && (
            <Link
              href="/reports/debtors"
              className="ml-2 text-xs font-mono font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded border border-amber-300 transition-colors flex items-center gap-1 shadow-2xs"
              title="Track Days Sales Outstanding (DSO) & unpaid invoices owed by customers"
            >
              <Clock className="h-3 w-3 text-amber-700" />
              <span>Customer DSO Aging Tracker →</span>
            </Link>
          )}

          {activeTab === "vendor" && (
            <Link
              href="/reports/creditors"
              className="ml-2 text-xs font-mono font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded border border-slate-300 transition-colors flex items-center gap-1 shadow-2xs"
              title="Track Days Payable Outstanding (DPO) & vendor bills we owe"
            >
              <Clock className="h-3 w-3 text-slate-700" />
              <span>Vendor DPO Bills Tracker →</span>
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
            onClick={() => setIsCreateOpen(true)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> New Party
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <button suppressHydrationWarning onClick={fetchParties} className="underline font-bold ml-2">
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
        title="Create New Counterparty"
        description="Add a verified customer or vendor to your accounting masters"
      >
        <form onSubmit={handleCreate} className="space-y-3 font-sans text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Party Type
              </label>
              <select
                suppressHydrationWarning
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as PartyType })
                }
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand focus:outline-none"
              >
                <option value="customer">Customer (Debtor)</option>
                <option value="vendor">Vendor / Supplier (Creditor)</option>
              </select>
            </div>
            <Input
              label="Legal Name"
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
              label="Display / Trade Name"
              value={formData.display_name}
              onChange={(e) =>
                setFormData({ ...formData, display_name: e.target.value })
              }
              placeholder="e.g. Acme Global"
            />
            <Input
              label="GSTIN (15 Digits)"
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
              label="State / Place of Supply"
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

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
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
              Save Counterparty
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
