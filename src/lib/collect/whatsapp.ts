/** WhatsApp click-to-chat links. The user's own WhatsApp sends the message; Deku sends nothing. */
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally } from "@/lib/formatters/date";

export type PhoneCheck = { ok: true; waNumber: string } | { ok: false; reason: string };

/** Accepts +91 / 0091 / 91 / 0 prefixes and common separators; Indian mobiles start with 6-9. */
export function checkIndianMobile(raw: string | null | undefined): PhoneCheck {
  if (!raw?.trim()) return { ok: false, reason: "No phone number saved for this customer" };
  let d = raw.trim();
  if (!/^\+?[\d\s\-().]+$/.test(d)) return { ok: false, reason: `"${raw}" is not a valid Indian mobile number` };
  d = d.replace(/\D/g, "");
  if (d.length === 14 && d.startsWith("0091")) d = d.slice(4);
  else if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (!/^[6-9]\d{9}$/.test(d)) return { ok: false, reason: `"${raw}" is not a valid Indian mobile number` };
  return { ok: true, waNumber: `91${d}` };
}

const UPI_RE = /^[\w.-]{2,256}@[a-zA-Z][\w.-]{1,63}$/;

export interface ReminderInput {
  companyName?: string | null;
  customerName: string;
  invoiceNumber: string;
  amountDuePaise: number;
  dueDate: string | null;
  upiId?: string | null;
  msme45: boolean;
}

export function reminderMessage(m: ReminderInput): string {
  const lines = [
    `Dear ${m.customerName},`,
    `This is a reminder that ${formatINR(m.amountDuePaise / 100)} is due on invoice ${m.invoiceNumber}` +
      (m.dueDate ? ` (due date ${formatDateTally(m.dueDate)}).` : "."),
  ];
  const upi = m.upiId?.trim();
  if (upi && UPI_RE.test(upi)) lines.push(`You can pay by UPI to ${upi}.`);
  if (m.msme45)
    lines.push(
      "Under Sec 43B(h) of the Income-tax Act, amounts owed to a micro or small enterprise for more than 45 days can be deducted by the buyer only when paid."
    );
  lines.push(m.companyName ? `Thank you,\n${m.companyName}` : "Thank you.");
  return lines.join("\n");
}

export const whatsappUrl = (waNumber: string, text: string) =>
  `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
