// Loads the raw lists a report is built from, by calling this server's own
// list endpoints with the caller's credentials. That keeps the rows identical
// to what the browser used to build (same JSON shapes) and keeps every list's
// own permission checks. Results are cached briefly per caller + property so
// paging/sorting does not reload them.
import { createHash } from "node:crypto";
import type { Request } from "express";
import type { ReportDatasets } from "@workspace/report-rows";

type DatasetKey = Exclude<keyof ReportDatasets, "settings">;

const SOURCES: Record<
  DatasetKey,
  { path: string; pageSize: number; extra?: Record<string, string> }
> = {
  buildings: { path: "/buildings", pageSize: 1000 },
  floors: { path: "/floors", pageSize: 5000 },
  rooms: { path: "/rooms", pageSize: 5000 },
  profiles: { path: "/profiles", pageSize: 5000 },
  assignments: {
    path: "/assignments",
    pageSize: 5000,
    extra: { status: "ALL" },
  },
  reservations: { path: "/reservations", pageSize: 5000 },
  maintenance: { path: "/maintenance", pageSize: 5000 },
  hostings: { path: "/hostings", pageSize: 5000 },
  equipmentInventory: { path: "/room-inventory", pageSize: 5000 },
  gateLogs: { path: "/gate/logs", pageSize: 2000 },
  vacations: { path: "/reports/vacations", pageSize: 5000 },
};

const FORWARD_HEADERS = [
  "cookie",
  "authorization",
  "x-session-id",
  "x-property-id",
  "accept-language",
  "user-agent",
];
const TTL_MS = 15_000;
const MAX_PAGES = 200;
const cache = new Map<string, { at: number; rows: Promise<any> }>();

/** Drop cached lists; called after every successful write so reports never lag behind. */
export function clearReportDatasetCache(): void {
  cache.clear();
}

function rowsOf(body: any): any[] {
  if (Array.isArray(body)) return body;
  return body?.data ?? body?.logs ?? [];
}

function callerKey(req: Request): string {
  const h = createHash("sha256");
  for (const name of ["cookie", "authorization", "x-session-id"])
    h.update(String(req.headers[name] ?? "") + "\n");
  return h.digest("hex");
}

async function fetchAll(
  req: Request,
  key: DatasetKey,
  propertyId: number,
): Promise<any[]> {
  const src = SOURCES[key];
  const base = `http://127.0.0.1:${process.env.PORT || 4000}/api`;
  const headers: Record<string, string> = { accept: "application/json" };
  for (const name of FORWARD_HEADERS) {
    const v = req.headers[name];
    if (typeof v === "string") headers[name] = v;
  }
  const url = (page: number) => {
    const qs = new URLSearchParams({
      propertyId: String(propertyId),
      ...src.extra,
      page: String(page),
      limit: String(src.pageSize),
    });
    return `${base}${src.path}?${qs}`;
  };
  // A failing list counts as empty, as it did in the browser.
  const get = async (page: number): Promise<any> => {
    const r = await fetch(url(page), { headers });
    return r.ok ? r.json() : [];
  };

  const first = await get(1);
  const rows = rowsOf(first);
  const total = Array.isArray(first)
    ? NaN
    : Number(first?.pagination?.total ?? first?.total);
  if (
    !Number.isFinite(total) ||
    rows.length >= total ||
    rows.length < src.pageSize
  )
    return rows;
  const pages = Math.min(Math.ceil(total / src.pageSize), MAX_PAGES);
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) => get(i + 2)),
  );
  const seen = new Set<unknown>();
  return rows.concat(...rest.map(rowsOf)).filter((r: any) => {
    if (r?.id == null) return true;
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

async function fetchSettings(req: Request, propertyId: number): Promise<any> {
  const headers: Record<string, string> = { accept: "application/json" };
  for (const name of FORWARD_HEADERS) {
    const v = req.headers[name];
    if (typeof v === "string") headers[name] = v;
  }
  const r = await fetch(
    `http://127.0.0.1:${process.env.PORT || 4000}/api/settings?propertyId=${propertyId}`,
    { headers },
  );
  return r.ok ? r.json() : {};
}

export type ReportDatasetKey = DatasetKey | "settings";

export async function loadReportDatasets(
  req: Request,
  propertyId: number,
  keys: readonly ReportDatasetKey[],
): Promise<ReportDatasets> {
  const now = Date.now();
  for (const [k, v] of cache) if (now - v.at > TTL_MS) cache.delete(k);
  const who = callerKey(req);

  const out: any = { settings: {} };
  for (const k of Object.keys(SOURCES) as DatasetKey[]) out[k] = [];
  await Promise.all(
    keys.map(async (k) => {
      const ck = `${who}|${propertyId}|${k}`;
      let entry = cache.get(ck);
      if (!entry) {
        entry = {
          at: now,
          rows:
            k === "settings"
              ? fetchSettings(req, propertyId)
              : fetchAll(req, k, propertyId),
        };
        cache.set(ck, entry);
        entry.rows.catch(() => cache.delete(ck));
      }
      out[k] = await entry.rows;
    }),
  );
  return out as ReportDatasets;
}
