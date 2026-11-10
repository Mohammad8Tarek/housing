import { Router } from "express";
import queriesRouter from "./queries.js";
import createRouter from "./create.js";
import checkoutRouter from "./checkout.js";
import transferRouter from "./transfer.js";
import manageRouter from "./manage.js";

// Mounted in the original registration order of the routes.
const router: Router = Router();
router.use(queriesRouter);
router.use(createRouter);
router.use(checkoutRouter);
router.use(transferRouter);
router.use(manageRouter);

export default router;
