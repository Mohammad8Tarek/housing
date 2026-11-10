import { Router } from "express";
import createRouter from "./create.js";
import queriesRouter from "./queries.js";
import workflowRouter from "./workflow.js";
import manageRouter from "./manage.js";

// Mounted in the original registration order of the routes.
const router: Router = Router();
router.use(createRouter);
router.use(queriesRouter);
router.use(workflowRouter);
router.use(manageRouter);

export default router;
