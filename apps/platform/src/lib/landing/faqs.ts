export interface LandingFaqItem {
  q: string;
  a: string;
}

export const LANDING_FAQS: LandingFaqItem[] = [
  {
    q: "How does Deku Finance keep a growing business organised without accounting complexity?",
    a: "Invoicing, UPI collections, expenses and profit reports live in one workspace. Every invoice or payment you record is a double-entry voucher, so the Balance Sheet, Profit & Loss and cash position are always computed from the same books instead of separate spreadsheets.",
  },
  {
    q: "Can I start lean as a small business or freelancer and grow into it?",
    a: "Yes. Without GST you send clean bills of supply with a UPI QR and no tax lines. A registration limit tracker shows how close your turnover is to the ₹20 lakh or ₹40 lakh limit (general guidance; your own position can differ). When you register, switch the company to GST and turn on team workflows.",
  },
  {
    q: "How does the UPI QR on bills help me get paid?",
    a: "Each bill can carry a QR made from your UPI ID with the amount and bill reference filled in. Customers scan it with any UPI app, so there's nothing to type and less back-and-forth about how to pay.",
  },
  {
    q: "How does Deku help me follow up on unpaid invoices?",
    a: "Collections groups unpaid invoices by how long they've been due and flags amounts owed to micro and small enterprises for more than 45 days. A WhatsApp button opens your own WhatsApp with a polite reminder, the amount and your UPI ID written in. Deku doesn't send messages itself.",
  },
  {
    q: "Can I create quotations, estimates and proforma invoices before the final bill?",
    a: "Yes. The document builder makes quotations, proforma invoices, delivery challans and estimates. When the client agrees, convert the document into a sales invoice without typing the lines again.",
  },
  {
    q: "How do maker-checker approvals protect my business?",
    a: "Staff and bookkeepers draft entries; an owner, CFO or admin approves them before they post to the ledger. Each voucher keeps its trail: who created it, who submitted it and who approved it.",
  },
  {
    q: "How does bank reconciliation work?",
    a: "Choose the bank account and a statement CSV. The file is read in your browser and matched against the bank ledger by date, reference and amount. Matches are suggestions until you confirm them, and the completed reconciliation is recorded with who did it.",
  },
  {
    q: "Does Deku handle GST invoicing and returns?",
    a: "Once GST is on, Deku splits CGST and SGST or IGST from the place of supply, tracks eligible input tax credit from your purchase register, and prepares GSTR-1 and GSTR-3B summaries with offline JSON to upload on the portal. Filing directly from Deku, e-invoices and e-way bills need a GST Suvidha Provider connection.",
  },
  {
    q: "What is the ALERX chart of accounts?",
    a: "ALERX organises every account under Assets, Liabilities, Equity, Revenue and Expenses, in four tiers from group down to the label you post to. Every company starts with a standard chart, so cash, bank, receivables and expenses are structured from day one.",
  },
  {
    q: "How is our financial and employee data kept private?",
    a: "Deku runs in your own deployment, so your books stay there. Deku Consultant answers from your ledger with fixed logic and doesn't send figures to an outside AI service. Seven roles control who can see and post what, including payroll figures.",
  },
  {
    q: "Can I export my data whenever I want?",
    a: "Yes. Reports, registers and ledgers download as CSV, and GST returns as JSON. Your data belongs to you.",
  },
];

