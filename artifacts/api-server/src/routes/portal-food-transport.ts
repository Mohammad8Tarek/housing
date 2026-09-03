import { Router } from "express";
import {
  withTenant,
  portalFoodMenuTable,
  portalMealOrdersTable,
  portalTransportSchedulesTable,
  portalTransportBookingsTable,
} from "@workspace/db";
import { eq, and, desc, sql, or, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/permissions.js";
import { requirePortalAuth, portalSession } from "./portal-auth.js";
import { logActivity } from "../lib/activity-logger.js";
import { getTenantId, su } from "../lib/request-utils.js";

const router: Router = Router();

const FoodMenuSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  price: z.string().optional(),
  mealType: z.enum(["daily", "weekly", "special"]).default("daily"),
  category: z.enum(["main", "side", "drink", "dessert"]).default("main"),
  date: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().nullable().optional(),
  ),
  available: z.boolean().default(true),
  imageUrl: z.string().optional(),
});

const TransportScheduleSchema = z.object({
  route: z.string().min(1),
  routeAr: z.string().optional(),
  location: z.string().optional(),
  locationAr: z.string().optional(),
  departure: z.string().min(1),
  arrival: z.string().optional(),
  days: z.string().default("daily"),
  customDays: z.string().optional(),
  capacity: z.number().default(20),
  notes: z.string().optional(),
  notesAr: z.string().optional(),
  active: z.boolean().default(true),
});

// ─── FOOD: Profile-facing ─────────────────────────────────────

// GET /portal-food/menu — قائمة الطعام
// @ts-ignore
router.get("/menu", requirePortalAuth, async (req, res, next) => {
  try {
    const sess = portalSession(req)!;
    const type = (req.query.type as string) || "daily";
    const date =
      (req.query.date as string) || new Date().toISOString().split("T")[0];

    const items = await withTenant(sess.propertyId, async (tenantDb) => {
      return await tenantDb
        .select()
        .from(portalFoodMenuTable)
        .where(
          and(
            eq(portalFoodMenuTable.propertyId, sess.propertyId),
            eq(portalFoodMenuTable.available, true),
            eq(portalFoodMenuTable.mealType, type),
            or(
              eq(portalFoodMenuTable.date, date),
              isNull(portalFoodMenuTable.date),
            ),
          ),
        )
        .orderBy(portalFoodMenuTable.category);
    });

    res.json({ success: true, items });
  } catch (err) {
    next(err);
  }
});

// GET /portal-food/my-orders — طلباتي
// @ts-ignore
router.get("/my-orders", requirePortalAuth, async (req, res, next) => {
  try {
    const sess = portalSession(req)!;
    const orders = await withTenant(sess.propertyId, async (tenantDb) => {
      return await tenantDb
        .select()
        .from(portalMealOrdersTable)
        .where(
          and(
            eq(portalMealOrdersTable.profileId, sess.profileDbId),
            eq(portalMealOrdersTable.propertyId, sess.propertyId),
          ),
        )
        .orderBy(desc(portalMealOrdersTable.createdAt));
    });
    res.json({ success: true, orders });
  } catch (err) {
    next(err);
  }
});

// POST /portal-food/order — طلب وجبة
// @ts-ignore
router.post("/order", requirePortalAuth, async (req, res, next) => {
  try {
    const sess = portalSession(req)!;
    const { menuItemId, quantity, orderDate, notes } = req.body;
    if (!menuItemId || !orderDate) {
      return res
        .status(400)
        .json({ success: false, message: "menuItemId and orderDate required" });
    }

    const [order] = await withTenant(sess.propertyId, async (tenantDb) => {
      return await tenantDb
        .insert(portalMealOrdersTable)
        .values({
          propertyId: sess.propertyId,
          profileId: sess.profileDbId,
          menuItemId,
          quantity: quantity || 1,
          orderDate,
          notes: notes || null,
        })
        .returning();
    });

    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
});

// PUT /portal-food/order/:id/cancel — إلغاء طلب
// @ts-ignore
router.put("/order/:id/cancel", requirePortalAuth, async (req, res, next) => {
  try {
    const sess = portalSession(req)!;
    const id = Number(req.params.id);
    await withTenant(sess.propertyId, async (tenantDb) => {
      await tenantDb
        .update(portalMealOrdersTable)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(portalMealOrdersTable.id, id),
            eq(portalMealOrdersTable.profileId, sess.profileDbId),
          ),
        );
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── TRANSPORT: Profile-facing ─────────────────────────────────

// GET /portal-transport/schedules — مواعيد المواصلات
// @ts-ignore
router.get("/schedules", requirePortalAuth, async (req, res, next) => {
  try {
    const sess = portalSession(req)!;
    const schedules = await withTenant(sess.propertyId, async (tenantDb) => {
      return await tenantDb
        .select()
        .from(portalTransportSchedulesTable)
        .where(
          and(
            eq(portalTransportSchedulesTable.propertyId, sess.propertyId),
            eq(portalTransportSchedulesTable.active, true),
          ),
        )
        .orderBy(portalTransportSchedulesTable.departure);
    });
    res.json({ success: true, schedules });
  } catch (err) {
    next(err);
  }
});

// GET /portal-transport/my-bookings — حجوزاتي
// @ts-ignore
router.get("/my-bookings", requirePortalAuth, async (req, res, next) => {
  try {
    const sess = portalSession(req)!;
    const bookings = await withTenant(sess.propertyId, async (tenantDb) => {
      return await tenantDb
        .select()
        .from(portalTransportBookingsTable)
        .where(
          and(
            eq(portalTransportBookingsTable.profileId, sess.profileDbId),
            eq(portalTransportBookingsTable.propertyId, sess.propertyId),
          ),
        )
        .orderBy(desc(portalTransportBookingsTable.bookingDate));
    });
    res.json({ success: true, bookings });
  } catch (err) {
    next(err);
  }
});

// POST /portal-transport/book — حجز مواصلات
// @ts-ignore
router.post("/book", requirePortalAuth, async (req, res, next) => {
  try {
    const sess = portalSession(req)!;
    const { scheduleId, bookingDate } = req.body;
    if (!scheduleId || !bookingDate) {
      return res.status(400).json({
        success: false,
        message: "scheduleId and bookingDate required",
      });
    }

    const [booking] = await withTenant(sess.propertyId, async (tenantDb) => {
      return await tenantDb
        .insert(portalTransportBookingsTable)
        .values({
          propertyId: sess.propertyId,
          profileId: sess.profileDbId,
          scheduleId,
          bookingDate,
        })
        .returning();
    });

    res.json({ success: true, booking });
  } catch (err) {
    next(err);
  }
});

// PUT /portal-transport/booking/:id/cancel — إلغاء حجز
// @ts-ignore
router.put("/booking/:id/cancel", requirePortalAuth, async (req, res, next) => {
  try {
    const sess = portalSession(req)!;
    const id = Number(req.params.id);
    await withTenant(sess.propertyId, async (tenantDb) => {
      await tenantDb
        .update(portalTransportBookingsTable)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(portalTransportBookingsTable.id, id),
            eq(portalTransportBookingsTable.profileId, sess.profileDbId),
          ),
        );
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── ADMIN: Food Menu CRUD ──────────────────────────────────────

// @ts-ignore
router.get("/admin/menu", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId)
      return res
        .status(400)
        .json({ success: false, message: "propertyId required" });
    const items = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .select()
        .from(portalFoodMenuTable)
        .where(eq(portalFoodMenuTable.propertyId, propertyId))
        .orderBy(desc(portalFoodMenuTable.date));
    });
    res.json({ success: true, items });
  } catch (err) {
    next(err);
  }
});

// @ts-ignore
router.post("/admin/menu", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    const userId = (req.session as any)?.userId;
    if (!propertyId || !userId)
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    const validated = FoodMenuSchema.parse(req.body);
    const [item] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .insert(portalFoodMenuTable)
        .values({ ...validated, propertyId, createdBy: userId })
        .returning();
    });
    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `إضافة وجبة: ${validated.name}`,
      actionType: "CREATE",
      module: "portal_food_transport",
    });
    res.json({ success: true, item });
  } catch (err) {
    next(err);
  }
});

// @ts-ignore
router.delete("/admin/menu/:id", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    const id = Number(req.params.id);
    await withTenant(propertyId, async (tenantDb) => {
      await tenantDb
        .delete(portalFoodMenuTable)
        .where(
          and(
            eq(portalFoodMenuTable.id, id),
            eq(portalFoodMenuTable.propertyId, propertyId),
          ),
        );
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// @ts-ignore
router.put("/admin/menu/:id", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    const id = Number(req.params.id);
    const validated = FoodMenuSchema.partial().parse(req.body);
    await withTenant(propertyId, async (tenantDb) => {
      await tenantDb
        .update(portalFoodMenuTable)
        .set(validated)
        .where(
          and(
            eq(portalFoodMenuTable.id, id),
            eq(portalFoodMenuTable.propertyId, propertyId),
          ),
        );
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── ADMIN: Transport Schedules CRUD ────────────────────────────

// @ts-ignore
router.get("/admin/schedules", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId)
      return res
        .status(400)
        .json({ success: false, message: "propertyId required" });
    const schedules = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .select()
        .from(portalTransportSchedulesTable)
        .where(eq(portalTransportSchedulesTable.propertyId, propertyId))
        .orderBy(portalTransportSchedulesTable.departure);
    });
    res.json({ success: true, schedules });
  } catch (err) {
    next(err);
  }
});

// @ts-ignore
router.post("/admin/schedules", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    const userId = (req.session as any)?.userId;
    if (!propertyId || !userId)
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    const validated = TransportScheduleSchema.parse(req.body);
    const [schedule] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .insert(portalTransportSchedulesTable)
        .values({ ...validated, propertyId, createdBy: userId })
        .returning();
    });
    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `إضافة موعد مواصلات: ${validated.route}`,
      actionType: "CREATE",
      module: "portal_food_transport",
    });
    res.json({ success: true, schedule });
  } catch (err) {
    next(err);
  }
});

// @ts-ignore
router.delete("/admin/schedules/:id", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    const id = Number(req.params.id);
    await withTenant(propertyId, async (tenantDb) => {
      await tenantDb
        .delete(portalTransportSchedulesTable)
        .where(
          and(
            eq(portalTransportSchedulesTable.id, id),
            eq(portalTransportSchedulesTable.propertyId, propertyId),
          ),
        );
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// @ts-ignore
router.put("/admin/schedules/:id", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    const id = Number(req.params.id);
    const validated = TransportScheduleSchema.partial().parse(req.body);
    await withTenant(propertyId, async (tenantDb) => {
      await tenantDb
        .update(portalTransportSchedulesTable)
        .set(validated)
        .where(
          and(
            eq(portalTransportSchedulesTable.id, id),
            eq(portalTransportSchedulesTable.propertyId, propertyId),
          ),
        );
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── ADMIN: Stats ───────────────────────────────────────────────

// @ts-ignore
router.get("/admin/stats", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId)
      return res
        .status(400)
        .json({ success: false, message: "propertyId required" });
    const stats = await withTenant(propertyId, async (tenantDb) => {
      const [menuCount] = await tenantDb
        .select({ count: sql`COUNT(*)` })
        .from(portalFoodMenuTable)
        .where(eq(portalFoodMenuTable.propertyId, propertyId));
      const [orderCount] = await tenantDb
        .select({ count: sql`COUNT(*)` })
        .from(portalMealOrdersTable)
        .where(eq(portalMealOrdersTable.propertyId, propertyId));
      const [scheduleCount] = await tenantDb
        .select({ count: sql`COUNT(*)` })
        .from(portalTransportSchedulesTable)
        .where(eq(portalTransportSchedulesTable.propertyId, propertyId));
      return {
        menuItems: Number(menuCount?.count || 0),
        totalOrders: Number(orderCount?.count || 0),
        schedules: Number(scheduleCount?.count || 0),
      };
    });
    res.json({ success: true, ...stats });
  } catch (err) {
    next(err);
  }
});

export default router;
