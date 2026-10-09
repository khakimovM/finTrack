/**
 * Spreadsheet apps execute cells starting with = + - @ (CSV/formula injection). A leading
 * apostrophe makes Excel and LibreOffice treat the cell as plain text.
 */
export function neutralizeFormula(field: string): string {
  return /^[=+\-@\t\r]/.test(field) ? `'${field}` : field;
}

export function escapeCsvField(field: string): string {
  const safe = neutralizeFormula(field);
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/** CRLF rows with a UTF-8 BOM, so Excel detects the encoding of Uzbek text. */
export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(','));
  return `\uFEFF${lines.join('\r\n')}`;
}
