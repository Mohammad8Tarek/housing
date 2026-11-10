import { Router } from "express";
import queriesRouter from "./queries.js";
import createRouter from "./create.js";
import bulkImportRouter from "./bulk-import.js";
import manageRouter from "./manage.js";
import vacationRouter from "./vacation.js";

// Mounted in the original registration order of the routes.
const router: Router = Router();
router.use(queriesRouter);
router.use(createRouter);
router.use(bulkImportRouter);
router.use(manageRouter);
router.use(vacationRouter);

export default router;
