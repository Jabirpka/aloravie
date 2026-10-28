import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/http.js";
import { authenticate } from "../../middleware/auth.js";
import { requireAccess } from "../../middleware/access.js";
import { adminList, setStatus } from "./reviews.service.js";

// Review moderation (part of the catalog feature), mounted under /api/admin.
export const reviewAdminRouter: Router = Router();

reviewAdminRouter.use(authenticate);
const guard = requireAccess("catalog");

reviewAdminRouter.get(
  "/reviews",
  guard,
  asyncHandler(async (req, res) => {
    const { status } = z.object({ status: z.enum(["PUBLISHED", "HIDDEN"]).optional() }).parse(req.query);
    res.json({ reviews: await adminList(status) });
  }),
);

reviewAdminRouter.patch(
  "/reviews/:id",
  guard,
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const { status } = z.object({ status: z.enum(["PUBLISHED", "HIDDEN"]) }).parse(req.body);
    res.json({ review: await setStatus(id, status) });
  }),
);
