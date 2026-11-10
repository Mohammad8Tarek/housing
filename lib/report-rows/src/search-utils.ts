/**
 * Global Search & Text Normalization Utilities
 * Supports:
 * - Arabic normalization: alef variants (أ, إ, آ, ٱ -> ا), taa marbuta (ة -> ه), alif maqsura (ى -> ي), stripping diacritics/tashkeel.
 * - Case-insensitive & trimmed matching.
 * - Multi-token matching: e.g. "102 أحمد" matches a row with room 102 and resident أحمد across different fields.
 */

export function normalizeSearchText(text: any): string {
  if (text == null) return "";
  let s = String(text).trim().toLowerCase();

  // 1. Remove Arabic Tashkeel / Diacritics
  // Harakat: \u064B (Fathatan) to \u0652 (Sukun), \u0653-\u065F, \u0670 (Superscript Alef)
  s = s.replace(/[\u064B-\u065F\u0670]/g, "");

  // 2. Normalize Alef variants
  s = s.replace(/[أإآٱ]/g, "ا");

  // 3. Normalize Taa Marbuta & Haa
  s = s.replace(/ة/g, "ه");

  // 4. Normalize Alif Maqsura & Yaa
  s = s.replace(/ى/g, "ي");

  // 5. Normalize Persian / Urdu characters if present
  s = s.replace(/ك/g, "ك").replace(/ی/g, "ي");

  // 6. Collapse multiple spaces
  s = s.replace(/\s+/g, " ");

  return s;
}

/**
 * Checks whether an item's searchable fields match all tokens of a search query.
 *
 * @param fields Array of string/number values from the item
 * @param searchQuery The query entered by the user
 * @returns boolean
 */
export function matchesSearch(
  fields: (string | number | null | undefined)[],
  searchQuery: string,
): boolean {
  if (!searchQuery || !searchQuery.trim()) return true;

  const normalizedQuery = normalizeSearchText(searchQuery);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  // Normalize and join all candidate fields into a single searchable buffer
  const joinedNormalizedFields = fields
    .filter((f) => f != null)
    .map((f) => normalizeSearchText(f))
    .join(" ");

  // Every token in the search query must be present in the joined fields
  return tokens.every((tok) => joinedNormalizedFields.includes(tok));
}
