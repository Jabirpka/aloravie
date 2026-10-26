import { Router } from "express";
import { z } from "zod";
import { asyncHandler, unauthorized } from "../../lib/http.js";
import { authenticateCustomer } from "../../middleware/customer-auth.js";
import { confirmMockPayment, paymentMode, verifyRazorpayAndConfirm } from "./payments.service.js";

export const paymentRouter: Router = Router();

// Tells the storefront which flow to render.
paymentRouter.get("/mode", (_req, res) => {
  res.json({ mode: paymentMode() });
});

const verifySchema = z.object({
  orderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

paymentRouter.post(
  "/razorpay/verify",
  authenticateCustomer,
  asyncHandler(async (req, res) => {
    if (!req.customer) throw unauthorized();
    const order = await verifyRazorpayAndConfirm(req.customer.sub, verifySchema.parse(req.body));
    res.json({ order });
  }),
);

const mockSchema = z.object({ orderId: z.string().min(1) });

paymentRouter.post(
  "/mock/confirm",
  authenticateCustomer,
  asyncHandler(async (req, res) => {
    if (!req.customer) throw unauthorized();
    const order = await confirmMockPayment(req.customer.sub, mockSchema.parse(req.body).orderId);
    res.json({ order });
  }),
);
