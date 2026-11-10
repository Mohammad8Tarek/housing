import { Router } from "express";
import ratingsRouter from "./ratings.js";
import operationsRouter from "./operations.js";
import customRouter from "./custom.js";

// Mounted in the original registration order of the routes.
const router: Router = Router();
router.use(ratingsRouter);
router.use(operationsRouter);
router.use(customRouter);

export default router;
