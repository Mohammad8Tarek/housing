// HTML escaping for documents we build as strings (print windows, report HTML).
// React escapes what it renders; these strings bypass React, so any value that
// can contain user-entered text (names, notes, room numbers, titles…) must go
// through escapeHtml() before being interpolated into markup.

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape a value for use as HTML text or inside a quoted attribute. null/undefined → "". */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/**
 * Markup produced by our own code (badges, checkmarks) that must be inserted as-is.
 * Pass it as a report cell/value; plain strings are always escaped.
 */
export class TrustedHtml {
  constructor(readonly html: string) {}
  toString(): string {
    return this.html;
  }
}

export const trustedHtml = (html: string): TrustedHtml => new TrustedHtml(html);
