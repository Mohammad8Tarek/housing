import { Router } from "express";
import { requirePortalAuth } from "../portal-auth/shared.js";
import profileRouter from "./profile.js";
import feedRouter from "./feed.js";
import maintenanceRouter from "./maintenance.js";
import activitiesRouter from "./activities.js";
import evaluationsRouter from "./evaluations.js";

// Mounted in the original registration order of the routes.
const router: Router = Router();
// Router-level middleware that preceded every route in the original file
router.use(requirePortalAuth);
router.use(profileRouter);
router.use(feedRouter);
router.use(maintenanceRouter);
router.use(activitiesRouter);
router.use(evaluationsRouter);

export default router;
