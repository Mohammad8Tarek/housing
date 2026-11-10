import { Router } from "express";
import statsRouter from "./stats.js";
import activityRouter from "./activity.js";
import analyticsRouter from "./analytics.js";

// Mounted in the original registration order of the routes.
const router: Router = Router();
router.use(statsRouter);
router.use(activityRouter);
router.use(analyticsRouter);

export default router;
