// Shared CSV helpers for the portal's imports, exports and backups.
// RFC 4180: fields containing a comma, quote or newline are quoted and inner
// quotes doubled. Parsing accepts CRLF or LF and quoted fields spanning lines.

export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  // A leading =, +, - or @ makes spreadsheets evaluate the cell as a formula.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map((row) => row.map(escapeCsvField).join(',')).join('\r\n')
}

/** Build a CSV from objects, taking the column order from `headers`. */
export function objectsToCsv<T extends Record<string, unknown>>(
  headers: readonly { key: keyof T & string; label: string }[],
  rows: readonly T[],
): string {
  return toCsv([headers.map((h) => h.label), ...rows.map((r) => headers.map((h) => r[h.key]))])
}

/** Parse CSV text into a matrix of raw string cells. Blank trailing line ignored. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let i = 0
  // Strip a UTF-8 BOM, which Excel writes.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
  }

  while (i < src.length) {
    const c = src[i]!
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        quoted = false
        i += 1
        continue
      }
      field += c
      i += 1
      continue
    }
    if (c === '"') {
      quoted = true
      i += 1
      continue
    }
    if (c === ',') {
      endField()
      i += 1
      continue
    }
    if (c === '\r') {
      if (src[i + 1] === '\n') i += 1
      endRow()
      i += 1
      continue
    }
    if (c === '\n') {
      endRow()
      i += 1
      continue
    }
    field += c
    i += 1
  }
  if (field !== '' || row.length > 0) endRow()
  // Drop a single empty trailing row produced by a final newline.
  if (rows.length > 0 && rows[rows.length - 1]!.every((c) => c === '')) rows.pop()
  return rows
}

/**
 * Parse CSV into objects keyed by a normalised header name (lowercased,
 * non-alphanumerics collapsed to a single space) so "First Name", "first_name"
 * and "FIRSTNAME" all land on the same key.
 */
export function normaliseHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function parseCsvRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text)
  if (rows.length === 0) return []
  const headers = rows[0]!.map(normaliseHeader)
  return rows.slice(1).map((cells) => {
    const rec: Record<string, string> = {}
    headers.forEach((h, idx) => {
      if (h) rec[h] = (cells[idx] ?? '').trim()
    })
    return rec
  })
}

/** Wrap CSV text in the data URL a download link uses. */
export function csvDataUrl(csv: string): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent('﻿' + csv)}`
}
