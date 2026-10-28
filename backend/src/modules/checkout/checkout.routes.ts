import { Router } from "express";
import { z } from "zod";
import { asyncHandler, unauthorized } from "../../lib/http.js";
import { authenticateCustomer } from "../../middleware/customer-auth.js";
import { createCheckout } from "./checkout.service.js";

export const checkoutRouter: Router = Router();

const addressSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(6),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit PIN code"),
  country: z.string().length(2).optional(),
});

const checkoutSchema = z
  .object({
    items: z
      .array(z.object({ variantId: z.string().min(1), quantity: z.number().int().positive() }))
      .min(1, "Your bag is empty"),
    shippingAddressId: z.string().optional(),
    shippingAddress: addressSchema.optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    couponCode: z.string().optional(),
  })
  .refine((v) => v.shippingAddressId || v.shippingAddress, {
    message: "A shipping address is required",
    path: ["shippingAddress"],
  });

checkoutRouter.post(
  "/",
  authenticateCustomer,
  asyncHandler(async (req, res) => {
    if (!req.customer) throw unauthorized();
    const input = checkoutSchema.parse(req.body);
    const result = await createCheckout(req.customer.sub, input);
    res.status(201).json(result);
  }),
);
