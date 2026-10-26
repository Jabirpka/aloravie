import { Router } from "express";
import { z } from "zod";
import { asyncHandler, unauthorized } from "../../lib/http.js";
import { authenticateCustomer } from "../../middleware/customer-auth.js";
import * as customers from "./customers.service.js";

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
  asyncHandler(async (req, res) => {
    const result = await customers.register(registerSchema.parse(req.body));
    res.status(201).json(result);
  }),
);

customerRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    res.json(await customers.login(loginSchema.parse(req.body)));
  }),
);

customerRouter.post(
  "/refresh",
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
