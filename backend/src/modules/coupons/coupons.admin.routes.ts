import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/http.js";
import { authenticate } from "../../middleware/auth.js";
import { requireAccess } from "../../middleware/access.js";
import { createCoupon, listCoupons, updateCoupon } from "./coupons.service.js";

// Coupon management (OFFERS department), mounted under /api/admin.
export const couponAdminRouter: Router = Router();

couponAdminRouter.use(authenticate);
const guard = requireAccess("coupons");

const type = z.enum(["PERCENT", "FIXED"]);
const createSchema = z.object({
  code: z.string().min(1),
  description: z.string().optional(),
  type,
  value: z.number().int().positive(),
  minSpendMinor: z.number().int().nonnegative().optional(),
  maxDiscountMinor: z.number().int().nonnegative().nullable().optional(),
  active: z.boolean().optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
});

couponAdminRouter.get(
  "/coupons",
  guard,
  asyncHandler(async (_req, res) => {
    res.json({ coupons: await listCoupons() });
  }),
);

couponAdminRouter.post(
  "/coupons",
  guard,
  asyncHandler(async (req, res) => {
    res.status(201).json({ coupon: await createCoupon(createSchema.parse(req.body)) });
  }),
);

couponAdminRouter.patch(
  "/coupons/:id",
  guard,
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    res.json({ coupon: await updateCoupon(id, createSchema.partial().parse(req.body)) });
  }),
);
