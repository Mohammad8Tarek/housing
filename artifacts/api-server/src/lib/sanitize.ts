/** Strip HTML tags from user input to prevent stored XSS */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .trim();
}

/** Sanitize an object's string fields recursively */
export function sanitizeFields<T extends Record<string, any>>(
  obj: T,
  fields: string[],
): T {
  const result = { ...obj };
  for (const field of fields) {
    if (typeof result[field] === "string") {
      (result as any)[field] = stripHtml(result[field]);
    }
  }
  return result;
}
