import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/http.js";
import { authenticate } from "../../middleware/auth.js";
import { requireAccess } from "../../middleware/access.js";
import { getReports, exportReportCsv } from "./reports.service.js";
import { renderReportDoc } from "./report-doc.js";

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

// Printable report (styled HTML → Print / Save as PDF in the browser).
reportAdminRouter.get(
  "/reports/document",
  requireAccess("reports"),
  asyncHandler(async (req, res) => {
    const { days } = z.object({ days: z.coerce.number().int().positive().optional() }).parse(req.query);
    res.type("html").send(renderReportDoc(await getReports(days)));
  }),
);
