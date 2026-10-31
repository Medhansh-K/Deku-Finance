"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Check, RefreshCw, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { organisationsApi, OrgSummary } from "@/api/endpoints";
import { logUserActivity } from "@/lib/logging/activity-logger";

export function CompaniesView() {
  const router = useRouter();
  const [organisations, setOrganisations] = useState<OrgSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeOrgId, setActiveOrgId] = useState<string>("");

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [newOrgGstin, setNewOrgGstin] = useState("");
  const [newOrgPan, setNewOrgPan] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("deku_active_org_id");
      if (saved) setActiveOrgId(saved);
    }
    fetchOrgs();
  }, []);

  const fetchOrgs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await organisationsApi.list();
      setOrganisations(res.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to list organisations");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectOrg = (org: OrgSummary) => {
    const previousOrgName = typeof window !== "undefined" ? localStorage.getItem("deku_active_org_name") || "Previous Company" : "Previous Company";
    setActiveOrgId(org.id);
    if (typeof window !== "undefined") {
      localStorage.setItem("deku_active_org_id", org.id);
      localStorage.setItem("deku_active_org_name", org.name);
      window.dispatchEvent(new Event("deku_active_org_changed"));
    }

    logUserActivity({
      category: "SETTING",
      crud_type: "READ",
      action: "Company Workspace Shifted",
      description: `Shifted active accounting workspace from '${previousOrgName}' to '${org.name}' (F3)`,
      entity_type: "organisation",
      entity_id: org.id,
      organisation_id: org.id,
      status: "success",
    });

    router.push("/gateway");
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    const slug = newOrgSlug.trim() || newOrgName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    setIsSubmitting(true);
    try {
      await organisationsApi.create({
        name: newOrgName,
        slug,
        currency: "INR",
        timezone: "Asia/Kolkata",
        gstin: newOrgGstin || undefined,
        pan: newOrgPan || undefined,
        financial_year_start_month: 4,
      });

      logUserActivity({
        category: "SETTING",
        crud_type: "CREATE",
        action: "Company Registered",
        description: `Registered new accounting company '${newOrgName}' (GSTIN: ${newOrgGstin || "Unregistered"})`,
        entity_type: "organisation",
        entity_id: slug,
        status: "success",
        metadata: { name: newOrgName, slug, gstin: newOrgGstin, pan: newOrgPan },
      });

      setIsCreateOpen(false);
      setNewOrgName("");
      setNewOrgSlug("");
      setNewOrgGstin("");
      setNewOrgPan("");
      await fetchOrgs();
    } catch (err: any) {
      alert(err.message || "Failed to create organisation");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 font-sans text-xs">
      <div className="flex items-center justify-between bg-surface p-3 rounded border border-line">
        <div className="text-xs font-semibold text-ink-soft">
          Switch active company workspace or register a new accounting tenant
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchOrgs} isLoading={isLoading}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            variant="tally"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> New Company
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid of Organisations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {organisations.map((org) => {
          const isActive = org.id === activeOrgId;
          return (
            <div
              key={org.id}
              onClick={() => handleSelectOrg(org)}
              className={`p-4 rounded-lg border cursor-pointer transition-all bg-surface shadow-xs hover:border-brand ${
                isActive
                  ? "border-brand ring-2 ring-brand/20"
                  : "border-line-strong hover:bg-canvas"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-8 w-8 rounded flex items-center justify-center font-bold ${
                      isActive ? "bg-brand text-panel-deep" : "bg-canvas-sunken text-ink-soft"
                    }`}
                  >
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-ink">{org.name}</h3>
                    <span className="font-mono text-[10px] text-ink-subtle">
                      Slug: {org.slug}
                    </span>
                  </div>
                </div>
                {isActive && (
                  <Badge variant="success">Active Company</Badge>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-line grid grid-cols-2 gap-2 text-[11px] text-ink-soft">
                <div>
                  <span className="text-ink-subtle text-[10px] block">Regime / GSTIN</span>
                  {org.gstin ? (
                    <span className="font-mono font-bold text-emerald-800 block">
                      GST: {org.gstin}
                    </span>
                  ) : (
                    <span className="font-mono text-ink-soft block">
                      Sec 22 Exempt
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-ink-subtle text-[10px] block">Currency</span>
                  <span className="font-mono font-medium">{org.currency}</span>
                </div>
              </div>

              <div className="mt-3 pt-2 flex justify-end">
                <span className="text-[11px] font-bold text-brand flex items-center gap-1">
                  Select Workspace <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Company Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Organisation"
        description="Provision a new accounting tenant in PostgreSQL"
      >
        <form onSubmit={handleCreateOrg} className="space-y-3 font-sans text-xs">
          <Input
            label="Company / Business Name"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            placeholder="e.g. Acme Financials Pvt Ltd"
            required
          />
          <Input
            label="Unique Identifier / Slug"
            value={newOrgSlug}
            onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase())}
            placeholder="e.g. acme-fin"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="GSTIN"
              value={newOrgGstin}
              onChange={(e) => setNewOrgGstin(e.target.value.toUpperCase())}
              placeholder="27AAACD1234E1Z5"
              maxLength={15}
            />
            <Input
              label="PAN"
              value={newOrgPan}
              onChange={(e) => setNewOrgPan(e.target.value.toUpperCase())}
              placeholder="AAACD1234E"
              maxLength={10}
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
              Create Organisation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
