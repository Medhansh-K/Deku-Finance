/** Save text as a file in the browser (client-side Blob, nothing is uploaded). */
export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const downloadJson = (name: string, json: unknown) =>
  downloadFile(name, JSON.stringify(json, null, 2), "application/json");

function csvCell(v: string | number) {
  // Text starting with = + - @ would run as a formula in Excel.
  let s = typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v);
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const toCsv = (rows: (string | number)[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
