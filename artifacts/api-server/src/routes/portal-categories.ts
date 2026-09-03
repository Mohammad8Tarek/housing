import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/permissions.js";
import { logActivity } from "../lib/activity-logger.js";
import { broadcastToProperty } from "../lib/websocket.js";
import {
  addPortalCategory,
  getActivityStatuses,
  getPortalCategories,
} from "../lib/portal-catalog.js";
import { getTenantId } from "../lib/request-utils.js";

const router: Router = Router();

const CategorySchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().min(1),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .default("#0F2A44"),
  icon: z.string().default("folder"),
  key: z.string().optional(),
  contentTypes: z
    .array(z.enum(["activities", "evaluations", "documents"]))
    .default(["activities"]),
});

const TagSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().min(1),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .default("#C9A24D"),
  description: z.string().optional(),
});

const DEFAULT_TAGS = [
  { id: 1, name: "Important", nameAr: "مهم", color: "#EF4444" },
  { id: 2, name: "Trending", nameAr: "رائج", color: "#EC4899" },
  { id: 3, name: "Mandatory", nameAr: "إلزامي", color: "#F59E0B" },
  { id: 4, name: "Optional", nameAr: "اختياري", color: "#10B981" },
  { id: 5, name: "Archived", nameAr: "مؤرشف", color: "#9CA3AF" },
];

// GET / — portal categories (optional ?type=activities|evaluations)
// @ts-ignore
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId)
      return res
        .status(400)
        .json({ success: false, message: "propertyId required" });

    const type = req.query.type as string | undefined;
    const categories = getPortalCategories(propertyId, type);
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// GET /statuses — activity statuses shared with profile portal
// @ts-ignore
router.get("/statuses", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId)
      return res
        .status(400)
        .json({ success: false, message: "propertyId required" });
    res.json(getActivityStatuses());
  } catch (err) {
    next(err);
  }
});

// POST / — create custom category (in-memory until DB table exists)
// @ts-ignore
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId)
      return res
        .status(400)
        .json({ success: false, message: "propertyId required" });

    const validated = CategorySchema.parse(req.body);
    const category = addPortalCategory(propertyId, validated);

    await logActivity({
      req,
      propertyId,
      username: (req.session as any)?.username ?? "system",
      userId: (req.session as any)?.userId,
      action: `Created portal category: ${validated.name}`,
      actionType: "CREATE",
      module: "portal_categories",
    });
    await broadcastToProperty(propertyId, {
      type: "data_updated",
      module: "notifications",
      action: "created",
      data: category,
    });

    res.json(category);
  } catch (err) {
    next(err);
  }
});

// GET /tags
// @ts-ignore
router.get("/tags", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId)
      return res
        .status(400)
        .json({ success: false, message: "propertyId required" });
    res.json(DEFAULT_TAGS);
  } catch (err) {
    next(err);
  }
});

// POST /tags
// @ts-ignore
router.post("/tags", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId)
      return res
        .status(400)
        .json({ success: false, message: "propertyId required" });

    const validated = TagSchema.parse(req.body);
    const tag = {
      id: Date.now(),
      ...validated,
      propertyId,
      createdAt: new Date(),
    };

    await logActivity({
      req,
      propertyId,
      username: (req.session as any)?.username ?? "system",
      userId: (req.session as any)?.userId,
      action: `Created portal tag: ${validated.name}`,
      actionType: "CREATE",
      module: "portal_tags",
    });
    await broadcastToProperty(propertyId, {
      type: "data_updated",
      module: "notifications",
      action: "created",
      data: tag,
    });

    res.json(tag);
  } catch (err) {
    next(err);
  }
});

// GET /search — placeholder
// @ts-ignore
router.get("/search", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    const { q } = req.query;
    if (!propertyId || !q)
      return res
        .status(400)
        .json({ success: false, message: "propertyId and query required" });
    res.json({ activities: [], evaluations: [], documents: [] });
  } catch (err) {
    next(err);
  }
});

export default router;
