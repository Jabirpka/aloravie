import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/http.js";
import { authenticate } from "../../middleware/auth.js";
import { requireAccess } from "../../middleware/access.js";
import * as support from "./support.service.js";
import { listNotifications } from "../notifications/notifications.service.js";

// Support inbox (customer-care dept) + notification log, mounted under /api/admin.
export const supportAdminRouter: Router = Router();

supportAdminRouter.use(authenticate);

const idParam = z.object({ id: z.string().min(1) });

supportAdminRouter.get(
  "/support",
  requireAccess("support"),
  asyncHandler(async (req, res) => {
    const { status } = z.object({ status: z.enum(["OPEN", "CLOSED"]).optional() }).parse(req.query);
    res.json({ conversations: await support.adminList(status) });
  }),
);

supportAdminRouter.get(
  "/support/:id",
  requireAccess("support"),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json({ conversation: await support.adminGet(id) });
  }),
);

supportAdminRouter.post(
  "/support/:id/reply",
  requireAccess("support"),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { body } = z.object({ body: z.string().min(1) }).parse(req.body);
    res.json({ conversation: await support.adminReply(id, body) });
  }),
);

supportAdminRouter.post(
  "/support/:id/close",
  requireAccess("support"),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json({ conversation: await support.adminClose(id) });
  }),
);

supportAdminRouter.get(
  "/notifications",
  requireAccess("notifications"),
  asyncHandler(async (_req, res) => {
    res.json({ notifications: await listNotifications() });
  }),
);
