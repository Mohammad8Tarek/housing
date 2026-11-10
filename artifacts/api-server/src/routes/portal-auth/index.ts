import { Router } from "express";
import sessionRouter from "./session.js";
import adminRouter from "./admin.js";
import recoveryRouter from "./recovery.js";

// Mounted in the original registration order of the routes.
const router: Router = Router();
router.use(sessionRouter);
router.use(adminRouter);
router.use(recoveryRouter);

export default router;
