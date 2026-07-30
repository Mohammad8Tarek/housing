/**
 * lib/db/src/index.ts — Safe Drizzle DB Initialization
 *
 * Fixes:
 * 1. Singleton pattern — only one pool instance ever created
 * 2. Connection pool tuning (max, idle timeout, connect timeout)
 * 3. healthCheck() — used in index.ts before server starts
 * 4. Graceful shutdown hooks
 * 5. DATABASE_URL fallback instead of hard throw
 *    (the hard error is in index.ts where it can give a better message)
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Pool } = pg;

// ─── Singleton guard ───────────────────────────────────────────────────────
// In ESM, modules are cached, but during hot-reload dev tools may re-import.
// We store the pool on globalThis to guarantee exactly one Pool instance.
const POOL_KEY = Symbol.for("__sunrise_pg_pool__");
const DB_KEY = Symbol.for("__sunrise_drizzle__");

declare global {
  var __sunrise_pg_pool__: pg.Pool | undefined;
  var __sunrise_drizzle__: ReturnType<typeof drizzle> | undefined;
}

function getDatabaseUrl(): string {
  const url = process.env["DATABASE_URL"];
  if (url) return url;
  throw new Error(
    "[DB] DATABASE_URL environment variable is required.\n" +
      "  Create a .env file in the project root with:\n" +
      "  DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/staff-housing",
  );
}

const DATABASE_URL = getDatabaseUrl();

// ─── Create pool (singleton) ───────────────────────────────────────────────
if (!globalThis.__sunrise_pg_pool__) {
  const isLocalhost = DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1");
  globalThis.__sunrise_pg_pool__ = new Pool({
    connectionString: DATABASE_URL,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
    max: 50, // 🚀 OPTIMIZATION: Increased from 20 to handle 1000+ concurrent users
    min: 10, // Maintain minimum connections ready
    idleTimeoutMillis: 30_000, // release idle connections after 30s
    connectionTimeoutMillis: 10_000, // fail after 10s if DB unreachable
    allowExitOnIdle: false,
    statement_timeout: 30_000, // Kill long-running queries after 30s
    query_timeout: 30_000,
  });

  globalThis.__sunrise_pg_pool__.on("error", (err) => {
    console.error("[DB Pool] Unexpected idle client error:", err.message);
    // Don't crash — the pool will create a new connection on next query
  });

  globalThis.__sunrise_pg_pool__.on("connect", (client) => {
    // Force search_path to public for all new connections to fix Neon Pooler empty search_path bug
    client.query("SET search_path TO public").catch((err) => {
      console.error("[DB Pool] Failed to set search_path on connect:", err);
    });
  });
}

export const pool = globalThis.__sunrise_pg_pool__;

// ─── Create Drizzle instance (singleton) ──────────────────────────────────
if (!globalThis.__sunrise_drizzle__) {
  globalThis.__sunrise_drizzle__ = drizzle(pool, { schema });
}

export const db = globalThis.__sunrise_drizzle__ as ReturnType<
  typeof drizzle<typeof schema>
>;

// ─── Health Check ──────────────────────────────────────────────────────────
/** * Get connection pool statistics for monitoring
 * 🚀 OPTIMIZATION: Use this to monitor pool health
 */
export function getPoolStats() {
  return {
    totalConnections: pool.totalCount,
    availableConnections: pool.idleCount,
    waitingRequests: pool.waitingCount,
    max: 50,
    min: 10,
  };
}

/** * healthCheck — verifies DB is reachable.
 * Called in index.ts BEFORE server.listen().
 */
export async function healthCheck(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  let client: pg.PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query("SELECT 1");
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, latencyMs: Date.now() - start, error: message };
  } finally {
    client?.release();
  }
}

// ─── Graceful Shutdown ─────────────────────────────────────────────────────
async function shutdownPool(signal: string): Promise<void> {
  console.info(`[DB Pool] ${signal} — draining pool...`);
  try {
    await pool.end();
    console.info("[DB Pool] Pool drained.");
  } catch (err) {
    console.error("[DB Pool] Error draining pool:", err);
  }
}

// Only register once
if (!(globalThis as any).__sunrise_pool_shutdown_registered__) {
  (globalThis as any).__sunrise_pool_shutdown_registered__ = true;
  process.once("SIGTERM", () => shutdownPool("SIGTERM"));
  process.once("SIGINT", () => shutdownPool("SIGINT"));
}

// ─── Multi-Tenant Manager ──────────────────────────────────────────────────
const schemaCache = new Map<number, string>();

/** Invalidate schema cache for a specific property or all properties */
export function invalidateSchemaCache(propertyId?: number): void {
  if (propertyId !== undefined) {
    schemaCache.delete(propertyId);
  } else {
    schemaCache.clear();
  }
}

/**
 * withTenant — ينفذ أي استعلامات داخل الـ Schema الخاص بـ property محددة.
 * يستخدم transaction (مع SET LOCAL) لضمان أن الاتصال داخل الـ Pool
 * لا يتسرب إليه الـ search_path الخاص بـ request آخر.
 */
export async function withTenant<T>(
  propertyId: number | string,
  callback: (tenantDb: typeof db) => Promise<T>,
): Promise<T> {
  const pId = Number(propertyId);
  if (!Number.isInteger(pId) || pId <= 0) {
    throw new Error("Invalid tenant property id");
  }
  let schemaName = schemaCache.get(pId);

  // إذا لم يكن اسم السكيما في الكاش، نجلبه من قاعدة البيانات ونحفظه
  if (!schemaName) {
    const res = await pool.query(
      "SELECT schema_name FROM public.properties WHERE id = $1",
      [pId],
    );
    if (res.rows[0]?.schema_name) {
      schemaName = String(res.rows[0].schema_name);
      schemaCache.set(pId, schemaName);
    } else {
      schemaName = `prop_${pId}`; // Fallback in case schema_name is null
      schemaCache.set(pId, schemaName);
    }
  }

  // باستخدام transaction، نضمن أن التعديل على search_path مؤقت وينتهي بانتهاء المعاملة
  return await db.transaction(async (tx) => {
    // إعداد مسار البحث (Search Path) ليقرأ ويكتب في سكيما الـ Property أولاً، ثم الـ public
    await tx.execute(
      sql`SET LOCAL search_path TO ${sql.identifier(schemaName as string)}, public`,
    );

    // تنفيذ الـ Callback وتمرير الـ Transaction وكأنه الـ db الأساسي
    // الـ Type assertion ضروري هنا لأن tx تتصرف كنسخة من الـ db لكن ضمن context
    return await callback(tx as unknown as typeof db);
  });
}

// ─── Re-export schema ──────────────────────────────────────────────────────
export * from "./schema/index.js";
export { portalDocumentsTable as documentsTable } from "./schema/documents.js";
