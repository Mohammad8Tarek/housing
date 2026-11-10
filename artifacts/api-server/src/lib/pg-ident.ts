/**
 * Guards for values that must be interpolated into SQL as identifiers
 * (tenant schema names). Never interpolate an identifier that did not pass here.
 */
const PG_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;
/** Returns a validated schema name, falling back to "public" when empty. Throws on injection attempts. */
export function safeSchemaName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) return "public";
  if (!PG_IDENT.test(name)) {
    throw new Error(`Invalid schema name: ${name.slice(0, 32)}`);
  }
  return name;
}
