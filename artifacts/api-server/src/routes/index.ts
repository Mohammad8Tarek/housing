import { Router, type IRouter } from "express";
import { loginRateLimit, portalRateLimit } from "../middlewares/rate-limit.js";

import healthRouter from "./health";
import authRouter from "./auth";
import propertiesRouter from "./properties";
import buildingsRouter from "./buildings";
import floorsRouter from "./floors";
import roomsRouter from "./rooms";
import profilesRouter from "./profiles";
import assignmentsRouter from "./assignments";
import reservationsRouter from "./reservations";
import hostingsRouter from "./hostings";
import maintenanceRouter from "./maintenance";
import usersRouter from "./users";
import activityLogsRouter from "./activity_logs";
import settingsRouter from "./settings";
import dashboardRouter from "./dashboard";
import lookupValuesRouter from "./lookup_values";
import notificationsRouter from "./notifications";
import hrSyncRouter from "./hr-sync";
import evaluationsRouter from "./evaluations";
import documentsRouter from "./documents.js";
import activitiesRouter from "./activities.js";
import portalContactsAdminRouter from "./portal-contacts.js";
import smartLockRouter from "./smart-lock.js";
import userSignatureRouter from "./user-signature.js";
import hostingRequestsRouter from "./hosting-requests.js";
import hotekConfigRouter from "./hotek-config.js";
import jobsRouter from "./jobs.js";

import reportsRouter from "./reports.js";
import roomImportRouter from "./room-import.js";

// ✅ Portal Imports
import portalAuthRouter from "./portal-auth.js";
import portalDataRouter from "./portal-data.js";
import portalAnalyticsRouter from "./portal-analytics.js";
import portalNotificationsRouter from "./portal-notifications.js";
import portalCategoriesRouter from "./portal-categories.js";
import portalFeedbackRouter from "./portal-feedback.js";
import portalReportsRouter from "./portal-reports.js";
import portalScheduleRouter from "./portal-schedule.js";
import pushNotificationsRouter from "./push-notifications.js";
import portalFoodTransportRouter from "./portal-food-transport.js";
import portalChatRouter from "./portal-chat.js";

const router: IRouter = Router();

// ─── 2. Core Admin API Routes ────────────────────────────────
router.use(healthRouter);
// ✅ loginRateLimit properly applied BEFORE the auth handler
router.post("/auth/login", loginRateLimit);
router.use(authRouter);

// Profile portal routes use their own portal session. Admin-only portal
// maintenance actions add permission checks inside portal-auth.ts.
router.use("/portal-auth", portalAuthRouter);
router.use("/portal-data", portalRateLimit, portalDataRouter);

// Portal management routes (use their own portal session)
router.use("/portal-analytics", portalRateLimit, portalAnalyticsRouter);
router.use("/portal-notifications", portalRateLimit, portalNotificationsRouter);
router.use("/portal-categories", portalRateLimit, portalCategoriesRouter);
router.use("/portal-feedback", portalRateLimit, portalFeedbackRouter);
router.use("/portal-reports", portalRateLimit, portalReportsRouter);
router.use("/portal-schedule", portalRateLimit, portalScheduleRouter);
router.use("/push", portalRateLimit, pushNotificationsRouter);
router.use("/portal-food", portalRateLimit, portalFoodTransportRouter);
router.use("/portal-chat", portalRateLimit, portalChatRouter);

router.use((req, res, next) => {
  // Allow HR sync webhook endpoints that authenticate via x-api-key
  if (req.path.startsWith("/hr-sync/") && req.headers["x-api-key"]) {
    return next();
  }
  // @ts-ignore
  if (req.session?.userId) next();
  else res.status(401).json({ success: false, message: "Unauthorized" });
});

// Property and settings GET routes are needed for app context/chrome. Writes
// are protected inside each router with exact create/edit/delete permissions.
router.use(propertiesRouter);
router.use(settingsRouter);
router.use(buildingsRouter);
router.use(floorsRouter);
router.use(roomsRouter);
router.use(profilesRouter);
router.use(assignmentsRouter);
router.use(reservationsRouter);
router.use(hostingsRouter);
router.use(maintenanceRouter);
router.use(usersRouter);
router.use(activityLogsRouter);
router.use(dashboardRouter);
router.use(lookupValuesRouter);
router.use(notificationsRouter);
router.use("/hr-sync", hrSyncRouter);
router.use(evaluationsRouter);
router.use("/documents", documentsRouter);
router.use(activitiesRouter);
router.use(portalContactsAdminRouter);
router.use("/hotek", hotekConfigRouter);
router.use(smartLockRouter);
router.use(userSignatureRouter);
router.use(hostingRequestsRouter);
router.use("/jobs", jobsRouter);
router.use("/reports", reportsRouter);
router.use(roomImportRouter);

export default router;
