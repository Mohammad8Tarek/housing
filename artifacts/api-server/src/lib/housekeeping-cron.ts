import cron from "node-cron";
import { logger } from "./logger.js";
import { db, propertiesTable, roomsTable, withTenant } from "@workspace/db";
import { inArray, notInArray, eq } from "drizzle-orm";
import { broadcastToProperty } from "./websocket.js";

export function initHousekeepingCron() {
  logger.info("Initializing daily housekeeping cron job (runs at 00:00)");

  cron.schedule("0 0 * * *", async () => {
    logger.info("Starting daily housekeeping room status reset...");
    try {
      const allProperties = await db.select({ id: propertiesTable.id }).from(propertiesTable);

      for (const prop of allProperties) {
        try {
          await withTenant(prop.id, async (tenantDb) => {
            
            await tenantDb
              .update(roomsTable)
              .set({ status: "dirty" })
              .where(inArray(roomsTable.status, ["available", "clean", "vacant_dirty"]));
              
            await tenantDb
              .update(roomsTable)
              .set({ status: "occupied_dirty" })
              .where(inArray(roomsTable.status, ["occupied", "occupied_clean", "occupied_dirty"]));

            logger.info({ propertyId: prop.id }, "Reset rooms to dirty for housekeeping");
            broadcastToProperty(prop.id, { module: "rooms", action: "sync" });
            broadcastToProperty(prop.id, { module: "dashboard", action: "sync" });
          });
        } catch (err) {
          logger.error({ err, propertyId: prop.id }, "Failed to run housekeeping cron for property");
        }
      }
      logger.info("Daily housekeeping room status reset complete.");
    } catch (err) {
      logger.error({ err }, "Global failure in daily housekeeping cron");
    }
  });
}
