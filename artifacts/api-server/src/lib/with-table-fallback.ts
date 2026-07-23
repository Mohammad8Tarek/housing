/**
 * Wraps a DB query to gracefully return fallback data when tables don't exist yet.
 */
function collectErrorMessages(err: any): string {
  const parts: string[] = [];
  let current = err;
  for (let i = 0; i < 5 && current; i++) {
    if (typeof current.message === "string") parts.push(current.message);
    if (typeof current.detail === "string") parts.push(current.detail);
    if (typeof current === "string") parts.push(current);
    current = current.cause;
  }
  return parts.join(" ").toLowerCase();
}

export async function withTableFallback<T>(
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const msg = collectErrorMessages(err);
    if (
      msg.includes("does not exist") ||
      msg.includes("relation") ||
      msg.includes("no table") ||
      msg.includes("42p01") ||
      msg.includes("not found")
    ) {
      return fallback;
    }
    throw err;
  }
}
