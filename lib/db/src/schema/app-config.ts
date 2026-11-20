import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

// Global (public-schema) key/value store for app-wide configuration that is
// NOT per-tenant — e.g. the single Web Push VAPID key pair shared by the whole
// PWA. Values are JSON so a key can hold a small object.
export const appConfigTable = pgTable("app_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type AppConfig = typeof appConfigTable.$inferSelect;
