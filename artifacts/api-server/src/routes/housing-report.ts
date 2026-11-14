// Daily housing operations report: today's check-ins, room transfers and
// check-outs, plus everyone currently living in breach of the housing policy.
// Preview (html/json/csv) and "send now". Settings use housingReport* columns.
import { Router } from "express";
import {
  requireAnyPermission,
  requirePermission,
} from "../middlewares/permissions.js";
import { validate } from "../middlewares/validate.js";
import {
  MaintenanceDailyReportQuery,
  MaintenanceDailyReportSendBody,
} from "../validation/schemas.js";
import { getTenantId } from "../lib/request-utils.js";
import { cairoToday } from "../lib/maintenance-daily-report.js";
import {
  buildHousingDailyReport,
  renderHousingDailyCsv,
  renderHousingDailyHtml,
  sendHousingDailyReport,
} from "../lib/housing-daily-report.js";

const router: Router = Router();

// GET /housing/daily-report?date=YYYY-MM-DD&format=html|json|csv
router.get(
  "/housing/daily-report",
  requireAnyPermission(
    ["accommodation", "view"],
    ["reports", "view"],
    ["dashboard", "view"],
  ),
  validate({ query: MaintenanceDailyReportQuery }),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res
          .status(400)
          .json({ success: false, message: "propertyId required" });
        return;
      }
      const date = (req.query.date as string) || cairoToday();
      const report = await buildHousingDailyReport(propertyId, date);
      const format = (req.query.format as string) || "json";
      if (format === "html") {
        res.type("html").send(renderHousingDailyHtml(report));
      } else if (format === "csv") {
        const [y, m, d] = date.split("-");
        res
          .type("text/csv; charset=utf-8")
          .attachment(`Housing_Daily_${d}-${m}-${y}.csv`)
          .send(renderHousingDailyCsv(report));
      } else {
        res.json({ success: true, ...report });
      }
    } catch (err) {
      next(err);
    }
  },
);

// POST /housing/daily-report/send — email today's report now
router.post(
  "/housing/daily-report/send",
  requireAnyPermission(["accommodation", "edit"], ["settings", "edit"]),
  validate({ body: MaintenanceDailyReportSendBody }),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res
          .status(400)
          .json({ success: false, message: "propertyId required" });
        return;
      }
      const date = req.body.date || cairoToday();
      const result = await sendHousingDailyReport(
        propertyId,
        date,
        req.body.recipients,
      );
      if (!result.sent) {
        res.status(400).json({
          success: false,
          message:
            result.reason === "SMTP not configured"
              ? "إعدادات البريد (SMTP) غير مكتملة / Email (SMTP) is not configured"
              : "لا توجد إيميلات مستلمين / No recipient emails configured",
          ...result,
        });
        return;
      }
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },
);

void requirePermission;
export default router;
