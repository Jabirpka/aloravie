import { Router } from "express";
import { asyncHandler } from "../../lib/http.js";
import { authenticate } from "../../middleware/auth.js";
import { requireAccess } from "../../middleware/access.js";
import { listAudit } from "./audit.service.js";

// Audit log view (OWNER/ADMIN only), mounted under /api/admin.
export const auditAdminRouter: Router = Router();

auditAdminRouter.use(authenticate);

auditAdminRouter.get(
  "/audit",
  requireAccess("employees"),
  asyncHandler(async (_req, res) => {
    res.json({ entries: await listAudit() });
  }),
);
