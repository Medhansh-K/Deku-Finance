"use client";

import React, { useState, useEffect } from "react";
import { DataTable, ColumnDef } from "@/components/data-table/DataTable";
import { Plus, RefreshCw, ShoppingBag, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { catalogueApi } from "@/api/endpoints";
import { CatalogueItem, CatalogueItemType } from "@/types/accounting";
import { formatINR } from "@/lib/formatters/currency";
import { logUserActivity } from "@/lib/logging/activity-logger";
import { HsnCombobox } from "@/modules/hsn/HsnCombobox";
import { hsnCodeError } from "@/modules/hsn/hsn";

export function ProductsServicesView() {
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    type: "services" as CatalogueItemType,
    name: "",
    sku: "",
    description: "",
    hsn_sac_code: "",
    unit_code: "OTH",
    default_unit_price: 0,
    default_gst_rate: 18,
    is_taxable: true,
    track_inventory: false,
  });

  const [orgId, setOrgId] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("deku_active_org_id");
      if (saved) setOrgId(saved);
    }
  }, []);

  const fetchItems = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await catalogueApi.list(orgId);
      setItems(res.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load catalogue items");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    fetchItems();
  }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.sku.trim()) {
      alert("Name and SKU are required");
      return;
    }
    const hsnError = hsnCodeError(formData.hsn_sac_code);
    if (hsnError) {
      alert(hsnError);
      return;
    }

    setIsSubmitting(true);
    try {
      await catalogueApi.create(orgId, {
        type: formData.type,
        name: formData.name,
        sku: formData.sku,
        description: formData.description || null,
        hsn_sac_code: formData.hsn_sac_code || null,
        unit_code: formData.unit_code,
        default_unit_price: Number(formData.default_unit_price),
        default_gst_rate: Number(formData.default_gst_rate),
        is_taxable: formData.is_taxable,
        track_inventory: formData.type === "goods" && formData.track_inventory,
      });

      logUserActivity({
        category: "MASTER",
        crud_type: "CREATE",
        action: "Catalogue Item Created",
        description: `Created new ${formData.type === "services" ? "Service" : "Goods"} item '${formData.name}' (SKU: ${formData.sku}, Rate: ₹${formData.default_unit_price})`,
        entity_type: "item",
        entity_id: formData.sku,
        organisation_id: orgId,
        status: "success",
        metadata: {
          sku: formData.sku,
          name: formData.name,
          type: formData.type,
          price: formData.default_unit_price,
          gstRate: formData.default_gst_rate,
        },
      });

      setIsCreateOpen(false);
      setFormData({
        type: "services",
        name: "",
        sku: "",
        description: "",
        hsn_sac_code: "",
        unit_code: "OTH",
        default_unit_price: 0,
        default_gst_rate: 18,
        is_taxable: true,
        track_inventory: false,
      });
      await fetchItems();
    } catch (err: any) {
      alert(err.message || "Failed to create catalogue item");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTracking = async (item: CatalogueItem, on: boolean) => {
    try {
      await catalogueApi.setTrackInventory(orgId, item.id, on);
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, track_inventory: on } : it)));
    } catch (err: any) {
      alert(err.message || "Failed to change inventory tracking");
    }
  };

  const columns: ColumnDef<CatalogueItem>[] = [
    {
      header: "SKU",
      sortKey: (it) => it.sku,
      cell: (it) => (
        <span className="font-mono text-[13px] font-medium text-ink">
          {it.sku}
        </span>
      ),
    },
    {
      header: "Item or service",
      sortKey: (it) => it.name,
      cell: (it) => (
        <div>
          <span className="font-medium text-ink block">
            {it.name}
          </span>
          {it.description && (
            <span className="text-[12.5px] text-ink-muted">
              {it.description}
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Type",
      sortKey: (it) => it.type,
      cell: (it) => (
        <Badge variant={it.type === "services" ? "teal" : "default"} className="capitalize">
          {it.type}
        </Badge>
      ),
    },
    {
      header: "HSN/SAC",
      cell: (it) => (
        <span className="font-mono text-[13px] text-ink-soft">
          {it.hsn_sac_code || "–"}
        </span>
      ),
    },
    {
      header: "Standard price",
      align: "right",
      sortKey: (it) => it.default_unit_price,
      cell: (it) => (
        <span className="font-medium text-ink">
          {formatINR(it.default_unit_price)}
        </span>
      ),
    },
    {
      header: "Default GST rate",
      align: "right",
      cell: (it) => (
        <span className="text-ink-soft">
          {it.default_gst_rate}%
        </span>
      ),
    },
    {
      header: "Unit",
      cell: (it) => (
        <span className="font-mono text-[12.5px] text-ink-muted">
          {it.unit_code}
        </span>
      ),
    },
    {
      header: "Track inventory",
      cell: (it) =>
        it.type === "goods" ? (
          <input
            type="checkbox"
            role="switch"
            aria-label={`Track inventory for ${it.name}`}
            checked={!!it.track_inventory}
            onChange={(e) => toggleTracking(it, e.target.checked)}
            className="h-4 w-4 accent-brand"
          />
        ) : (
          <span className="text-ink-subtle">–</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-[13.5px] text-ink-muted">
          Product SKUs and GST SAC catalogue
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchItems}
            isLoading={isLoading}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            variant="tally"
            size="sm"
            data-tour="products-new" onClick={() => setIsCreateOpen(true)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> New catalogue item
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-ctl bg-bad-wash border border-bad/25 text-[13px] text-bad flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <button onClick={fetchItems} className="underline font-semibold ml-2">
            Retry
          </button>
        </div>
      )}

      {/* Catalogue Table */}
      <DataTable
        columns={columns}
        data={items}
        searchPlaceholder="Search by SKU, name, HSN/SAC code..."
        isLoading={isLoading}
        emptyMessage="No catalogue items found."
      />

      {/* Create Item Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add catalogue item"
        description="Configure product or service with HSN/SAC tax classifications"
      >
        <form onSubmit={handleCreate} className="space-y-3 font-sans text-[13.5px]">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-ink-soft mb-1.5">
                Item classification
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as CatalogueItemType,
                  })
                }
                className="w-full h-9 rounded-ctl border border-line-strong bg-surface px-2.5 text-[13.5px] text-ink focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20"
              >
                <option value="services">Services (SAC code)</option>
                <option value="goods">Goods / products (HSN code)</option>
              </select>
            </div>
            <Input
              label="SKU / item code"
              value={formData.sku}
              onChange={(e) =>
                setFormData({ ...formData, sku: e.target.value.toUpperCase() })
              }
              placeholder="e.g. SRV-CLOUD-01"
              required
            />
          </div>

          <Input
            label="Name / title"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Cloud Security Audit Retainer"
            required
          />

          <Input
            label="Description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Line item description on invoices"
          />

          <div className="grid grid-cols-3 gap-3">
            <HsnCombobox
              label="HSN / SAC code"
              value={formData.hsn_sac_code}
              onChange={(code) => setFormData({ ...formData, hsn_sac_code: code })}
              inputClassName="w-full h-9 rounded-ctl border border-line-strong bg-surface px-3 text-[13.5px] text-ink placeholder-ink-subtle focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20"
              inputProps={{ placeholder: "Code or description" }}
            />
            <Input
              label="Unit (UQC)"
              value={formData.unit_code}
              onChange={(e) =>
                setFormData({ ...formData, unit_code: e.target.value.toUpperCase() })
              }
              placeholder="OTH, NOS, HRS"
            />
            <Input
              label="Default GST rate (%)"
              type="number"
              value={formData.default_gst_rate}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  default_gst_rate: Number(e.target.value),
                })
              }
              placeholder="18"
            />
          </div>

          <Input
            label="Default unit price (INR)"
            type="number"
            value={formData.default_unit_price}
            onChange={(e) =>
              setFormData({
                ...formData,
                default_unit_price: Number(e.target.value),
              })
            }
            prefixSymbol="₹"
            isNumeric
          />

          {formData.type === "goods" && (
            <label className="flex items-center gap-2 text-ink">
              <input
                type="checkbox"
                role="switch"
                checked={formData.track_inventory}
                onChange={(e) => setFormData({ ...formData, track_inventory: e.target.checked })}
                className="h-4 w-4 accent-brand"
              />
              <span className="font-medium">Track inventory</span>
              <span className="text-ink-muted">Issued invoices and purchase bills move its stock.</span>
            </label>
          )}

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
              Save item
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
