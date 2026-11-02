import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/http.js";
import { authenticate } from "../../middleware/auth.js";
import { requireAccess } from "../../middleware/access.js";
import { getReports, exportReportCsv } from "./reports.service.js";

// Reports / analytics (OWNER/ADMIN only), mounted under /api/admin.
export const reportAdminRouter: Router = Router();

reportAdminRouter.use(authenticate);

reportAdminRouter.get(
  "/reports",
  requireAccess("reports"),
  asyncHandler(async (req, res) => {
    const { days } = z.object({ days: z.coerce.number().int().positive().optional() }).parse(req.query);
    res.json(await getReports(days));
  }),
);

reportAdminRouter.get(
  "/reports/export.csv",
  requireAccess("reports"),
  asyncHandler(async (req, res) => {
    const { days } = z.object({ days: z.coerce.number().int().positive().optional() }).parse(req.query);
    const csv = await exportReportCsv(days);
    res.setHeader("Content-Disposition", `attachment; filename="aloravie-report${days ? `-${days}d` : ""}.csv"`);
    res.type("text/csv").send(csv);
  }),
);
