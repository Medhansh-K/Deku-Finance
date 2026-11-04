import { Account, Party } from "@/types/accounting";
import { VoucherMode } from "@/modules/vouchers/VoucherWorkspace";
import { parseInvoiceText } from "@/lib/vouchers/invoice-text-parser";

/**
 * Turns an invoice document into a draft voucher. Everything runs in the browser:
 * the document is never uploaded to a third party. Values that could not be read
 * stay blank and are listed in `missingFields` for the user to fill in.
 */
export interface ExtractedVoucherData {
  documentName: string;
  documentSize: string;
  detectedType: VoucherMode;
  reference: string | null;
  date: string | null;
  partyName?: string;
  partyId?: string;
  partyGstin?: string;
  totalAmount: number | null;
  narration: string;
  missingFields: string[];
  warnings: string[];
  lines: {
    dr_cr: "Dr" | "Cr";
    accountId: string;
    partyId?: string;
    description: string;
    amount: string;
  }[];
}

const postable = (accounts: Account[]) => accounts.filter((a) => a.is_postable !== false);
const accountId = (accounts: Account[], re: RegExp) => postable(accounts).find((a) => re.test(a.name))?.id ?? "";
const money = (n: number | null) => (n === null ? "" : n.toFixed(2));

/** Builds a draft voucher only from values actually read from the text. */
export function buildVoucherFromText(
  text: string,
  documentName: string,
  documentSize: string,
  accounts: Account[],
  parties: Party[],
  orgGstin?: string | null
): ExtractedVoucherData {
  const inv = parseInvoiceText(text, orgGstin);
  const isSales = inv.direction === "sales";
  const party = inv.counterpartyGstin
    ? parties.find((p) => p.gstin?.toUpperCase() === inv.counterpartyGstin)
    : undefined;
  const taxSide: "Dr" | "Cr" = isSales ? "Cr" : "Dr";
  const prefix = isSales ? "Output" : "Input";

  const counterLine = {
    dr_cr: (isSales ? "Dr" : "Cr") as "Dr" | "Cr",
    accountId: accountId(accounts, isSales ? /receivable|debtor/i : /trade creditor|accounts payable|sundry creditor/i),
    partyId: party?.id ?? "",
    description: isSales ? "Receivable from customer" : "Payable to supplier",
    amount: money(inv.total),
  };
  const baseLine = {
    dr_cr: taxSide,
    // Expense head depends on what was bought, so the user chooses it for purchases.
    accountId: isSales ? (postable(accounts).find((a) => a.account_group === "revenue" && /sales/i.test(a.name))?.id ?? "") : "",
    partyId: "self",
    description: isSales ? "Sales value (taxable)" : "Purchase value (taxable) - choose expense account",
    amount: money(inv.taxable),
  };
  const taxLines = (["cgst", "sgst", "igst"] as const)
    .filter((k) => (inv[k] ?? 0) > 0)
    .map((k) => ({
      dr_cr: taxSide,
      accountId: accountId(accounts, new RegExp(`${prefix}\\s*${k}`, "i")),
      partyId: "self",
      description: `${prefix} ${k.toUpperCase()}`,
      amount: money(inv[k]),
    }));

  return {
    documentName,
    documentSize,
    detectedType: isSales ? "sales" : "purchase",
    reference: inv.invoiceNumber,
    date: inv.invoiceDate,
    partyName: party?.legal_name,
    partyId: party?.id,
    partyGstin: inv.counterpartyGstin ?? undefined,
    totalAmount: inv.total,
    narration: `${isSales ? "Sales" : "Purchase"} invoice ${inv.invoiceNumber ?? "(number not read)"} from ${documentName}`,
    missingFields: [...inv.missing, ...(inv.counterpartyGstin && !party ? ["Party (GSTIN not in Parties master)"] : [])],
    warnings: inv.warnings,
    lines: isSales ? [counterLine, baseLine, ...taxLines] : [baseLine, ...taxLines, counterLine],
  };
}

async function ocr(image: File | HTMLCanvasElement): Promise<string> {
  // Runs in the browser. Only the engine and language files are downloaded; the document stays local.
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    return (await worker.recognize(image)).data.text;
  } finally {
    await worker.terminate();
  }
}

async function readPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = "";
  // shortcut: reads the first 5 pages only; raise if multi-page bills need more.
  for (let p = 1; p <= Math.min(pdf.numPages, 5); p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((i) => ("str" in i ? i.str + (i.hasEOL ? "\n" : " ") : ""))
      .join("");
    if (pageText.trim()) {
      text += pageText + "\n";
      continue;
    }
    // Scanned page: no text layer, so render it and OCR it.
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
    text += (await ocr(canvas)) + "\n";
  }
  return text;
}

export async function readDocumentText(file: File): Promise<string> {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return readPdfText(file);
  if (file.type.startsWith("image/")) return ocr(file);
  return file.text();
}

export async function extractFromFile(
  file: File,
  accounts: Account[],
  parties: Party[],
  orgGstin?: string | null
): Promise<ExtractedVoucherData> {
  const text = await readDocumentText(file);
  const kb = Math.max(1, Math.round(file.size / 1024));
  const size = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
  return buildVoucherFromText(text, file.name, size, accounts, parties, orgGstin);
}
