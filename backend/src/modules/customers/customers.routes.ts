import { Router } from "express";
import { z } from "zod";
import { asyncHandler, unauthorized } from "../../lib/http.js";
import { authenticateCustomer } from "../../middleware/customer-auth.js";
import * as customers from "./customers.service.js";
import * as wishlist from "../wishlist/wishlist.service.js";
import { authLimiter } from "../../middleware/rate-limit.js";

export const customerRouter: Router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1),
  phone: z.string().min(6).optional(),
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const refreshSchema = z.object({ refreshToken: z.string().min(1) });

const addressSchema = z.object({
  type: z.enum(["SHIPPING", "BILLING"]).optional(),
  name: z.string().min(1),
  phone: z.string().min(6),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit PIN code"),
  country: z.string().length(2).optional(),
  isDefault: z.boolean().optional(),
});

customerRouter.post(
  "/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const result = await customers.register(registerSchema.parse(req.body));
    res.status(201).json(result);
  }),
);

customerRouter.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    res.json(await customers.login(loginSchema.parse(req.body)));
  }),
);

customerRouter.post(
  "/refresh",
  authLimiter,
  asyncHandler(async (req, res) => {
    res.json(await customers.refresh(refreshSchema.parse(req.body).refreshToken));
  }),
);

customerRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await customers.logout(refreshSchema.parse(req.body).refreshToken);
    res.status(204).send();
  }),
);

customerRouter.get(
  "/me",
  authenticateCustomer,
  asyncHandler(async (req, res) => {
    if (!req.customer) throw unauthorized();
    res.json({ customer: await customers.getCustomerById(req.customer.sub) });
  }),
);

customerRouter.get(
  "/me/addresses",
  authenticateCustomer,
  asyncHandler(async (req, res) => {
    if (!req.customer) throw unauthorized();
    res.json({ addresses: await customers.listAddresses(req.customer.sub) });
  }),
);

customerRouter.post(
  "/me/addresses",
  authenticateCustomer,
  asyncHandler(async (req, res) => {
    if (!req.customer) throw unauthorized();
    const address = await customers.createAddress(req.customer.sub, addressSchema.parse(req.body));
    res.status(201).json({ address });
  }),
);

const idParam = z.object({ id: z.string().min(1) });

customerRouter.delete(
  "/me/addresses/:id",
  authenticateCustomer,
  asyncHandler(async (req, res) => {
    if (!req.customer) throw unauthorized();
    await customers.deleteAddress(req.customer.sub, idParam.parse(req.params).id);
    res.status(204).send();
  }),
);

// --- Wishlist ---

const productIdBody = z.object({ productId: z.string().min(1) });
const productIdParam = z.object({ productId: z.string().min(1) });

customerRouter.get(
  "/me/wishlist",
  authenticateCustomer,
  asyncHandler(async (req, res) => {
    if (!req.customer) throw unauthorized();
    res.json({ products: await wishlist.listWishlist(req.customer.sub) });
  }),
);

customerRouter.post(
  "/me/wishlist",
  authenticateCustomer,
  asyncHandler(async (req, res) => {
    if (!req.customer) throw unauthorized();
    await wishlist.addToWishlist(req.customer.sub, productIdBody.parse(req.body).productId);
    res.status(201).json({ ok: true });
  }),
);

customerRouter.delete(
  "/me/wishlist/:productId",
  authenticateCustomer,
  asyncHandler(async (req, res) => {
    if (!req.customer) throw unauthorized();
    await wishlist.removeFromWishlist(req.customer.sub, productIdParam.parse(req.params).productId);
    res.status(204).send();
  }),
);
