import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/http.js";
import { authenticate } from "../../middleware/auth.js";
import { requireAccess } from "../../middleware/access.js";
import * as returns from "./returns.service.js";

// Returns approval queue (RETURNS department), mounted under /api/admin.
export const returnAdminRouter: Router = Router();

returnAdminRouter.use(authenticate);
const guard = requireAccess("returns");

const idParam = z.object({ id: z.string().min(1) });
const noteBody = z.object({ note: z.string().optional() });

returnAdminRouter.get(
  "/returns",
  guard,
  asyncHandler(async (req, res) => {
    const { status } = z
      .object({ status: z.enum(["REQUESTED", "APPROVED", "REJECTED", "REFUNDED"]).optional() })
      .parse(req.query);
    res.json({ returns: await returns.adminList(status) });
  }),
);

returnAdminRouter.get(
  "/returns/:id",
  guard,
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json({ return: await returns.adminGet(id) });
  }),
);

returnAdminRouter.post(
  "/returns/:id/approve",
  guard,
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { note } = noteBody.parse(req.body ?? {});
    res.json({ return: await returns.approveReturn(id, note) });
  }),
);

returnAdminRouter.post(
  "/returns/:id/reject",
  guard,
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { note } = noteBody.parse(req.body ?? {});
    res.json({ return: await returns.rejectReturn(id, note) });
  }),
);

returnAdminRouter.post(
  "/returns/:id/pickup",
  guard,
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json({ return: await returns.bookPickup(id) });
  }),
);

returnAdminRouter.post(
  "/returns/:id/sync",
  guard,
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json({ return: await returns.syncReturnTracking(id) });
  }),
);

returnAdminRouter.post(
  "/returns/:id/receive",
  guard,
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json({ return: await returns.markReceived(id) });
  }),
);

returnAdminRouter.post(
  "/returns/:id/inspect",
  guard,
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { passed, note } = z.object({ passed: z.boolean(), note: z.string().optional() }).parse(req.body ?? {});
    res.json({ return: await returns.inspectReturn(id, passed, note) });
  }),
);
