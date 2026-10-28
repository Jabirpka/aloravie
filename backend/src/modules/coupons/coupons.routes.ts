import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/http.js";
import { previewCoupon } from "./coupons.service.js";

// Public: the storefront previews a code against the current subtotal.
export const couponRouter: Router = Router();

couponRouter.post(
  "/validate",
  asyncHandler(async (req, res) => {
    const { code, subtotalMinor } = z
      .object({ code: z.string().min(1), subtotalMinor: z.number().int().nonnegative() })
      .parse(req.body);
    res.json({ coupon: await previewCoupon(code, subtotalMinor) });
  }),
);
