"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Briefcase,
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  PieChart,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally, toISODateString } from "@/lib/formatters/date";

export interface Project {
  id: string;
  project_code: string;
  project_name: string;
  client_name?: string;
  department_name?: string;
  start_date: string;
  end_date: string;
  budgeted_cost: number;
  budgeted_revenue: number;
  actual_revenue: number;
  actual_cost: number;
  status: "planning" | "in_progress" | "completed" | "on_hold" | "cancelled";
  description?: string;
}

export function ProjectCostingView() {
  const [orgId, setOrgId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Form State
  const [form, setForm] = useState({
    project_code: "",
    project_name: "",
    client_name: "",
    start_date: toISODateString(),
    end_date: "",
    budgeted_cost: "",
    budgeted_revenue: "",
    status: "in_progress" as Project["status"],
    description: "",
  });

  useEffect(() => {
    const saved = localStorage.getItem("deku_active_org_id") || "";
    setOrgId(saved);

    // Initial demo project portfolio
    setProjects([
      {
        id: "proj-1",
        project_code: "PRJ-2026-ALPHA",
        project_name: "Automated Solar Warehouse EPC",
        client_name: "Adani Green Solutions Ltd",
        department_name: "EPC Projects",
        start_date: "2026-04-01",
        end_date: "2026-12-31",
        budgeted_cost: 3200000,
        budgeted_revenue: 4500000,
        actual_revenue: 2800000,
        actual_cost: 1950000,
        status: "in_progress",
        description: "Turnkey engineering, procurement, and construction of 500kW rooftop solar grid.",
      },
      {
        id: "proj-2",
        project_code: "PRJ-2026-BETA",
        project_name: "Supply Chain IoT Monitoring Nodes",
        client_name: "Flipkart Logistics",
        department_name: "Hardware R&D",
        start_date: "2026-06-15",
        end_date: "2026-10-31",
        budgeted_cost: 850000,
        budgeted_revenue: 1400000,
        actual_revenue: 1400000,
        actual_cost: 780000,
        status: "completed",
        description: "Delivery of 2,000 GPS temperature-telemetry smart sensors.",
      },
      {
        id: "proj-3",
        project_code: "PRJ-2026-GAMMA",
        project_name: "Cloud Ledger Migration & ERP Rollout",
        client_name: "Tata Precision Forge",
        department_name: "Consulting",
        start_date: "2026-08-01",
        end_date: "2027-02-28",
        budgeted_cost: 1200000,
        budgeted_revenue: 1800000,
        actual_revenue: 600000,
        actual_cost: 450000,
        status: "in_progress",
        description: "Core accounting migration from legacy on-premise ledger into Deku Finance.",
      },
    ]);
  }, []);

  const aggregates = useMemo(() => {
    const rev = projects.reduce((s, p) => s + p.actual_revenue, 0);
    const cost = projects.reduce((s, p) => s + p.actual_cost, 0);
    const net = rev - cost;
    const margin = rev > 0 ? Math.round((net / rev) * 100) : 0;
    return { rev, cost, net, margin, count: projects.length };
  }, [projects]);

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    const newProj: Project = {
      id: "proj-" + Date.now(),
      project_code: form.project_code.trim() || `PRJ-${Date.now().toString().slice(-4)}`,
      project_name: form.project_name.trim(),
      client_name: form.client_name.trim() || "General Client",
      start_date: form.start_date,
      end_date: form.end_date || toISODateString(),
      budgeted_cost: Number(form.budgeted_cost) || 0,
      budgeted_revenue: Number(form.budgeted_revenue) || 0,
      actual_revenue: 0,
      actual_cost: 0,
      status: form.status,
      description: form.description.trim(),
    };

    setProjects([newProj, ...projects]);
    setIsAddModalOpen(false);
    setMessage({ ok: true, text: `Project ${newProj.project_code} created successfully.` });
    setForm({
      project_code: "",
      project_name: "",
      client_name: "",
      start_date: toISODateString(),
      end_date: "",
      budgeted_cost: "",
      budgeted_revenue: "",
      status: "in_progress",
      description: "",
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans text-[13.5px]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-ink flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-brand-strong" /> Project &amp; Job Costing Finance
          </h2>
          <p className="text-[13px] text-ink-muted mt-0.5">
            Project-level budget tracking, income &amp; expense allocation, and real-time job profitability margins
          </p>
        </div>

        <Button variant="tally" size="sm" onClick={() => setIsAddModalOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Project
        </Button>
      </div>

      {message && (
        <div
          role={message.ok ? "status" : "alert"}
          className={`p-3.5 rounded-ctl border text-[13px] flex items-center gap-2 ${
            message.ok ? "bg-ok-wash border-ok/30 text-ok" : "bg-bad-wash border-bad/30 text-bad"
          }`}
        >
          {message.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface border border-line rounded-panel p-4">
          <span className="text-[12.5px] text-ink-muted">Invoiced Revenue</span>
          <p className="text-[22px] font-semibold tracking-tight text-ink mt-1 tabular-nums">
            {formatINR(aggregates.rev)}
          </p>
        </div>
        <div className="bg-surface border border-line rounded-panel p-4">
          <span className="text-[12.5px] text-ink-muted">Incurred Project Costs</span>
          <p className="text-[22px] font-semibold tracking-tight text-amber-600 mt-1 tabular-nums">
            {formatINR(aggregates.cost)}
          </p>
        </div>
        <div className="bg-surface border border-line rounded-panel p-4">
          <span className="text-[12.5px] text-ink-muted">Net Project Margin</span>
          <p className="text-[22px] font-semibold tracking-tight text-ok mt-1 tabular-nums">
            {formatINR(aggregates.net)} ({aggregates.margin}%)
          </p>
        </div>
        <div className="bg-surface border border-line rounded-panel p-4">
          <span className="text-[12.5px] text-ink-muted">Active Projects</span>
          <p className="text-[22px] font-semibold tracking-tight text-ink mt-1 tabular-nums">
            {aggregates.count}
          </p>
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-surface border border-line rounded-panel overflow-hidden">
        <div className="px-5 py-3 border-b border-line flex items-center justify-between">
          <span className="font-semibold text-ink">Project Directory</span>
          <span className="text-[12.5px] text-ink-muted">
            Transactions tagged via Voucher Dimension <span className="font-mono text-brand font-medium">project_id</span>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="deku-table-th">Project Code</th>
                <th className="deku-table-th">Project Name &amp; Client</th>
                <th className="deku-table-th">Status</th>
                <th className="deku-table-th !text-right">Budget Cost</th>
                <th className="deku-table-th !text-right">Actual Cost</th>
                <th className="deku-table-th !text-right">Invoiced Rev</th>
                <th className="deku-table-th !text-right">Net Margin</th>
                <th className="deku-table-th !text-right">Burn %</th>
                <th className="deku-table-th !text-right">Detail</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((proj) => {
                const margin = proj.actual_revenue - proj.actual_cost;
                const marginPct =
                  proj.actual_revenue > 0 ? Math.round((margin / proj.actual_revenue) * 100) : 0;
                const burnPct =
                  proj.budgeted_cost > 0 ? Math.round((proj.actual_cost / proj.budgeted_cost) * 100) : 0;

                return (
                  <tr key={proj.id} className="hover:bg-canvas">
                    <td className="deku-table-td font-mono font-medium text-ink">{proj.project_code}</td>
                    <td className="deku-table-td">
                      <div className="font-medium text-ink">{proj.project_name}</div>
                      <div className="text-[12px] text-ink-muted">{proj.client_name}</div>
                    </td>
                    <td className="deku-table-td">
                      <Badge
                        variant={
                          proj.status === "completed"
                            ? "success"
                            : proj.status === "in_progress"
                            ? "teal"
                            : "default"
                        }
                        className="capitalize"
                      >
                        {proj.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="deku-table-td text-right tabular-nums text-ink-soft">
                      {formatINR(proj.budgeted_cost)}
                    </td>
                    <td className="deku-table-td text-right tabular-nums font-medium text-amber-600">
                      {formatINR(proj.actual_cost)}
                    </td>
                    <td className="deku-table-td text-right tabular-nums font-medium text-ink">
                      {formatINR(proj.actual_revenue)}
                    </td>
                    <td className="deku-table-td text-right tabular-nums font-semibold text-ok">
                      {formatINR(margin)} ({marginPct}%)
                    </td>
                    <td className="deku-table-td text-right tabular-nums">
                      <span className={burnPct > 90 ? "text-bad font-semibold" : "text-ink-soft"}>
                        {burnPct}%
                      </span>
                    </td>
                    <td className="deku-table-td text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedProject(proj)}
                        className="gap-1"
                      >
                        View <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Project Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create New Project"
        description="Creates an accounting dimension for tracking project revenue, purchase bills, and direct timesheet costs."
      >
        <form onSubmit={handleCreateProject} className="space-y-3 font-sans text-[13.5px]">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Project Code"
              placeholder="e.g. PRJ-2026-DELTA"
              value={form.project_code}
              onChange={(e) => setForm({ ...form, project_code: e.target.value })}
              required
            />
            <Input
              label="Client / Party Name"
              placeholder="e.g. Reliance Retail"
              value={form.client_name}
              onChange={(e) => setForm({ ...form, client_name: e.target.value })}
            />
          </div>

          <Input
            label="Project Title"
            placeholder="e.g. Hyderabad Data Centre HVAC Overhaul"
            value={form.project_name}
            onChange={(e) => setForm({ ...form, project_name: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              required
            />
            <Input
              label="Estimated End Date"
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Budgeted Cost"
              type="number"
              min={0}
              prefixSymbol="₹"
              value={form.budgeted_cost}
              onChange={(e) => setForm({ ...form, budgeted_cost: e.target.value })}
              required
            />
            <Input
              label="Budgeted Contract Revenue"
              type="number"
              min={0}
              prefixSymbol="₹"
              value={form.budgeted_revenue}
              onChange={(e) => setForm({ ...form, budgeted_revenue: e.target.value })}
              required
            />
          </div>

          <Input
            label="Scope / Description"
            placeholder="Key deliverables and job milestones"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <div className="pt-4 flex justify-end gap-2 border-t border-line">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="tally" size="sm">
              Create Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* Project Financial Summary Drawer */}
      {selectedProject && (
        <Modal
          isOpen={!!selectedProject}
          onClose={() => setSelectedProject(null)}
          title={`Financial Health: ${selectedProject.project_code}`}
          description={selectedProject.project_name}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 p-3 bg-canvas rounded-ctl text-[12.5px]">
              <div>
                <span className="text-ink-muted block">Client</span>
                <span className="font-semibold text-ink">{selectedProject.client_name}</span>
              </div>
              <div>
                <span className="text-ink-muted block">Timeline</span>
                <span className="font-semibold text-ink">
                  {formatDateTally(selectedProject.start_date)} – {formatDateTally(selectedProject.end_date)}
                </span>
              </div>
              <div>
                <span className="text-ink-muted block">Status</span>
                <Badge variant="teal" className="capitalize">
                  {selectedProject.status.replace("_", " ")}
                </Badge>
              </div>
            </div>

            <div className="space-y-2 border-t border-line pt-3">
              <span className="font-semibold text-ink">Profit &amp; Loss Breakdown</span>
              <div className="space-y-1.5 text-[13px]">
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-ink-soft">Contract Invoiced Revenue</span>
                  <span className="font-semibold text-ink tabular-nums">
                    {formatINR(selectedProject.actual_revenue)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-ink-soft">Incurred Direct Expenses (PO / Bills)</span>
                  <span className="font-medium text-amber-600 tabular-nums">
                    - {formatINR(selectedProject.actual_cost)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 font-semibold text-[14px]">
                  <span className="text-ink">Net Project Margin</span>
                  <span className="text-ok tabular-nums">
                    {formatINR(selectedProject.actual_revenue - selectedProject.actual_cost)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-brand/5 border border-brand/20 rounded-ctl text-[12.5px] text-ink-soft">
              <span className="font-semibold text-brand-strong block mb-0.5">Double-Entry Allocation</span>
              All vouchers tagged with this project in the Voucher Workspace (<kbd>F4</kbd>–<kbd>F9</kbd>) and Document Builder automatically update this balance in real-time.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
