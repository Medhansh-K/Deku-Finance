"use client";

import React, { useState } from "react";
import {
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Plus,
  ArrowRight,
  ShieldAlert,
  Calendar as CalendarIcon,
  ShoppingBag,
  Send,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally, toISODateString } from "@/lib/formatters/date";
import type { Party } from "@/types/accounting";

// Purchase Order Record
export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_name: string;
  supplier_gstin?: string;
  po_date: string;
  delivery_date: string;
  subtotal: number;
  tax_total: number;
  grand_total: number;
  status: "draft" | "pending_approval" | "approved" | "partially_billed" | "completed";
}

// Material Requisition Record
export interface MaterialRequest {
  id: string;
  request_number: string;
  department_name: string;
  requested_by_name: string;
  purpose: string;
  urgency: "normal" | "high" | "critical";
  status: "draft" | "submitted" | "approved" | "po_created" | "rejected";
  created_at: string;
}

// AP Outflow Scheduled Item
export interface ScheduledPayable {
  id: string;
  vendor_name: string;
  bill_number: string;
  bill_date: string;
  due_date: string;
  amount: number;
  is_msme: boolean;
  msme_due_date: string;
  days_remaining: number;
}

export function PurchaseOrdersTab({
  parties,
  onConvertToBill,
}: {
  parties: Party[];
  onConvertToBill: (po: PurchaseOrder) => void;
}) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([
    {
      id: "po-1",
      po_number: "PO-2026-0081",
      supplier_name: "Tata Steel Tubes & Pipes Division",
      supplier_gstin: "27AAACT2727Q1ZB",
      po_date: "2026-10-18",
      delivery_date: "2026-11-05",
      subtotal: 650000,
      tax_total: 117000,
      grand_total: 767000,
      status: "approved",
    },
    {
      id: "po-2",
      po_number: "PO-2026-0082",
      supplier_name: "Schneider Electric Components",
      supplier_gstin: "29AABCS1429B1Z2",
      po_date: "2026-10-24",
      delivery_date: "2026-11-12",
      subtotal: 240000,
      tax_total: 43200,
      grand_total: 283200,
      status: "approved",
    },
    {
      id: "po-3",
      po_number: "PO-2026-0083",
      supplier_name: "Shree Ganesh Precision Tools (MSME)",
      supplier_gstin: "27AAYPG3311K1ZX",
      po_date: "2026-11-01",
      delivery_date: "2026-11-15",
      subtotal: 95000,
      tax_total: 17100,
      grand_total: 112100,
      status: "pending_approval",
    },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    supplier_name: "",
    po_number: `PO-${Date.now().toString().slice(-4)}`,
    po_date: toISODateString(),
    delivery_date: "",
    subtotal: "",
    tax_total: "",
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const sub = Number(form.subtotal) || 0;
    const tax = Number(form.tax_total) || 0;
    const newPo: PurchaseOrder = {
      id: "po-" + Date.now(),
      po_number: form.po_number,
      supplier_name: form.supplier_name,
      po_date: form.po_date,
      delivery_date: form.delivery_date || form.po_date,
      subtotal: sub,
      tax_total: tax,
      grand_total: sub + tax,
      status: "approved",
    };
    setOrders([newPo, ...orders]);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4 font-sans text-[13.5px]">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-[15px] font-semibold text-ink">Purchase Orders (PO)</h3>
          <p className="text-[13px] text-ink-muted">Authorized procurement orders issued to approved vendors</p>
        </div>
        <Button variant="tally" size="sm" onClick={() => setIsModalOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Purchase Order
        </Button>
      </div>

      <div className="rounded-panel border border-line bg-surface overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13.5px]">
          <thead className="bg-[#fafbfa] text-[12.5px] text-ink-muted">
            <tr>
              <th className="deku-table-th">PO Number</th>
              <th className="deku-table-th">Supplier</th>
              <th className="deku-table-th">PO Date</th>
              <th className="deku-table-th">Delivery Date</th>
              <th className="deku-table-th">Status</th>
              <th className="deku-table-th !text-right">Subtotal</th>
              <th className="deku-table-th !text-right">Tax</th>
              <th className="deku-table-th !text-right">Grand Total</th>
              <th className="deku-table-th !text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((po) => (
              <tr key={po.id} className="border-t border-line hover:bg-canvas">
                <td className="deku-table-td font-mono font-medium text-ink">{po.po_number}</td>
                <td className="deku-table-td font-medium text-ink">{po.supplier_name}</td>
                <td className="deku-table-td text-ink-soft">{formatDateTally(po.po_date)}</td>
                <td className="deku-table-td text-ink-soft">{formatDateTally(po.delivery_date)}</td>
                <td className="deku-table-td">
                  <Badge
                    variant={
                      po.status === "approved" ? "success" : po.status === "pending_approval" ? "warning" : "default"
                    }
                    className="capitalize"
                  >
                    {po.status.replace("_", " ")}
                  </Badge>
                </td>
                <td className="deku-table-td text-right tabular-nums">{formatINR(po.subtotal)}</td>
                <td className="deku-table-td text-right tabular-nums text-ink-soft">{formatINR(po.tax_total)}</td>
                <td className="deku-table-td text-right tabular-nums font-semibold text-ink">
                  {formatINR(po.grand_total)}
                </td>
                <td className="deku-table-td text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onConvertToBill(po)}
                    className="text-brand font-medium hover:text-brand-strong"
                  >
                    Convert to Bill &rarr;
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Issue Purchase Order"
        description="Creates an authorized purchase order for vendor material dispatch."
      >
        <form onSubmit={handleCreate} className="space-y-3 text-[13.5px]">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="PO Number"
              value={form.po_number}
              onChange={(e) => setForm({ ...form, po_number: e.target.value })}
              required
            />
            <Input
              label="Supplier / Vendor"
              placeholder="Vendor Name"
              value={form.supplier_name}
              onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="PO Date"
              type="date"
              value={form.po_date}
              onChange={(e) => setForm({ ...form, po_date: e.target.value })}
              required
            />
            <Input
              label="Expected Delivery Date"
              type="date"
              value={form.delivery_date}
              onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Taxable Subtotal"
              type="number"
              prefixSymbol="₹"
              value={form.subtotal}
              onChange={(e) => setForm({ ...form, subtotal: e.target.value })}
              required
            />
            <Input
              label="GST Tax Total"
              type="number"
              prefixSymbol="₹"
              value={form.tax_total}
              onChange={(e) => setForm({ ...form, tax_total: e.target.value })}
              required
            />
          </div>
          <div className="pt-4 flex justify-end gap-2 border-t border-line">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="tally" size="sm">
              Save &amp; Issue PO
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function MaterialRequestsTab() {
  const [requests, setRequests] = useState<MaterialRequest[]>([
    {
      id: "mr-1",
      request_number: "REQ-2026-0012",
      department_name: "Manufacturing Unit A",
      requested_by_name: "Ramesh Sharma",
      purpose: "Cold-rolled structural steel coils (Grade 304)",
      urgency: "high",
      status: "approved",
      created_at: "2026-10-25",
    },
    {
      id: "mr-2",
      request_number: "REQ-2026-0013",
      department_name: "Quality Assurance & Lab",
      requested_by_name: "Pooja Varma",
      purpose: "Calibration gases and high-temp sensors",
      urgency: "critical",
      status: "submitted",
      created_at: "2026-11-02",
    },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [urgency, setUrgency] = useState<MaterialRequest["urgency"]>("normal");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const newReq: MaterialRequest = {
      id: "mr-" + Date.now(),
      request_number: `REQ-${Date.now().toString().slice(-4)}`,
      department_name: deptName || "General Operations",
      requested_by_name: "Current User",
      purpose,
      urgency,
      status: "submitted",
      created_at: toISODateString(),
    };
    setRequests([newReq, ...requests]);
    setIsModalOpen(false);
    setDeptName("");
    setPurpose("");
  };

  return (
    <div className="space-y-4 font-sans text-[13.5px]">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-[15px] font-semibold text-ink">Material Requisitions</h3>
          <p className="text-[13px] text-ink-muted">Internal purchase indents and approval before PO issuance</p>
        </div>
        <Button variant="tally" size="sm" onClick={() => setIsModalOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Requisition
        </Button>
      </div>

      <div className="rounded-panel border border-line bg-surface overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13.5px]">
          <thead className="bg-[#fafbfa] text-[12.5px] text-ink-muted">
            <tr>
              <th className="deku-table-th">Requisition #</th>
              <th className="deku-table-th">Department</th>
              <th className="deku-table-th">Requested By</th>
              <th className="deku-table-th">Purpose / Materials</th>
              <th className="deku-table-th">Urgency</th>
              <th className="deku-table-th">Status</th>
              <th className="deku-table-th">Date</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-t border-line hover:bg-canvas">
                <td className="deku-table-td font-mono font-medium text-ink">{r.request_number}</td>
                <td className="deku-table-td font-medium text-ink">{r.department_name}</td>
                <td className="deku-table-td text-ink-soft">{r.requested_by_name}</td>
                <td className="deku-table-td text-ink">{r.purpose}</td>
                <td className="deku-table-td">
                  <Badge
                    variant={r.urgency === "critical" ? "danger" : r.urgency === "high" ? "warning" : "default"}
                    className="capitalize"
                  >
                    {r.urgency}
                  </Badge>
                </td>
                <td className="deku-table-td">
                  <Badge variant={r.status === "approved" ? "success" : "teal"} className="capitalize">
                    {r.status}
                  </Badge>
                </td>
                <td className="deku-table-td text-ink-soft">{formatDateTally(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Raise Material Request"
        description="Internal procurement indent submitted for HOD / Manager approval."
      >
        <form onSubmit={handleCreate} className="space-y-3 text-[13.5px]">
          <Input
            label="Requesting Department"
            placeholder="e.g. Production Line 2"
            value={deptName}
            onChange={(e) => setDeptName(e.target.value)}
            required
          />
          <Input
            label="Material Purpose &amp; Specifications"
            placeholder="e.g. 50 units high-temp thermal relays"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            required
          />
          <div>
            <label className="block text-[13px] font-medium text-ink-soft mb-1">Urgency</label>
            <select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as any)}
              className="w-full h-9 rounded-ctl border border-line bg-surface px-3 text-[13.5px] text-ink"
            >
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical (Line Shutdown Risk)</option>
            </select>
          </div>
          <div className="pt-4 flex justify-end gap-2 border-t border-line">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="tally" size="sm">
              Submit Requisition
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function ApPaymentCalendarTab() {
  const payables: ScheduledPayable[] = [
    {
      id: "sp-1",
      vendor_name: "Shree Ganesh Precision Tools (MSME)",
      bill_number: "BILL-2026-091",
      bill_date: "2026-10-05",
      due_date: "2026-11-19",
      amount: 112100,
      is_msme: true,
      msme_due_date: "2026-11-19", // 45 days max under Section 43B(h)
      days_remaining: 5,
    },
    {
      id: "sp-2",
      vendor_name: "Tata Steel Tubes & Pipes Division",
      bill_number: "TS-B-9981",
      bill_date: "2026-10-15",
      due_date: "2026-11-25",
      amount: 767000,
      is_msme: false,
      msme_due_date: "2026-11-29",
      days_remaining: 11,
    },
    {
      id: "sp-3",
      vendor_name: "Apex Industrial Logistics LLP (MSME)",
      bill_number: "APX-5512",
      bill_date: "2026-10-02",
      due_date: "2026-11-16",
      amount: 45000,
      is_msme: true,
      msme_due_date: "2026-11-16",
      days_remaining: 2,
    },
  ];

  const totalPayable = payables.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-4 font-sans text-[13.5px]">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-surface rounded-panel border border-line">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-bad-wash text-bad flex items-center justify-center shrink-0">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-ink text-[14.5px]">
              Section 43B(h) MSME Compliance Payment Watch
            </div>
            <p className="text-[12.5px] text-ink-muted">
              Suppliers registered under UDYAM must be paid within 45 days (or agreement duration, whichever is
              shorter), failing which the unpaid expense is disallowed for Income Tax computation.
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[12px] text-ink-muted">Total Upcoming Payables</span>
          <p className="text-[20px] font-semibold text-ink tabular-nums">{formatINR(totalPayable)}</p>
        </div>
      </div>

      <div className="rounded-panel border border-line bg-surface overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13.5px]">
          <thead className="bg-[#fafbfa] text-[12.5px] text-ink-muted">
            <tr>
              <th className="deku-table-th">Vendor / Supplier</th>
              <th className="deku-table-th">Bill Reference</th>
              <th className="deku-table-th">Bill Date</th>
              <th className="deku-table-th">Payment Due Date</th>
              <th className="deku-table-th">MSME Compliance Status</th>
              <th className="deku-table-th !text-right">Amount Payable</th>
              <th className="deku-table-th !text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {payables.map((p) => (
              <tr key={p.id} className="border-t border-line hover:bg-canvas">
                <td className="deku-table-td font-medium text-ink">{p.vendor_name}</td>
                <td className="deku-table-td font-mono text-[12.5px]">{p.bill_number}</td>
                <td className="deku-table-td text-ink-soft">{formatDateTally(p.bill_date)}</td>
                <td className="deku-table-td font-medium text-ink">{formatDateTally(p.due_date)}</td>
                <td className="deku-table-td">
                  {p.is_msme ? (
                    <Badge variant={p.days_remaining <= 5 ? "danger" : "warning"} className="gap-1">
                      <Clock className="h-3 w-3" />
                      Section 43B(h): {p.days_remaining}d remaining
                    </Badge>
                  ) : (
                    <Badge variant="outline">Standard Vendor</Badge>
                  )}
                </td>
                <td className="deku-table-td text-right tabular-nums font-semibold text-ink">
                  {formatINR(p.amount)}
                </td>
                <td className="deku-table-td text-right">
                  <Button
                    variant="tally"
                    size="sm"
                    onClick={() => {
                      window.location.href = "/vouchers?mode=payment";
                    }}
                  >
                    Pay (F5)
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
