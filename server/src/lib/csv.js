/**
 * Minimal RFC 4180 CSV writer.
 * Also neutralises spreadsheet formula injection: a family could type "=HYPERLINK(...)"
 * in a comment, and Excel would execute it when ops opens the export.
 */
function escapeCell(value) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * @param {{ key: string, header: string }[]} columns
 * @param {Record<string, unknown>[]} rows
 */
export function toCsv(columns, rows) {
  const lines = [columns.map((c) => escapeCell(c.header)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(row[c.key])).join(','));
  }
  // BOM so Excel opens UTF-8 (names, Hindi text) correctly.
  return '﻿' + lines.join('\r\n') + '\r\n';
}
