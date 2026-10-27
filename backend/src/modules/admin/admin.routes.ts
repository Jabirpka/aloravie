import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/http.js";
import { authenticate } from "../../middleware/auth.js";
import { requireAccess } from "../../middleware/access.js";
import * as admin from "./admin.service.js";

export const adminRouter: Router = Router();

// Signed-in staff; each route below is further gated to a department feature.
adminRouter.use(authenticate);

const orderStatus = z.enum([
  "PENDING",
  "CONFIRMED",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
]);
const productStatus = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);

adminRouter.get(
  "/summary",
  requireAccess("dashboard"),
  asyncHandler(async (_req, res) => {
    res.json(await admin.getSummary());
  }),
);

// Orders
adminRouter.get(
  "/orders",
  requireAccess("orders.view"),
  asyncHandler(async (req, res) => {
    const { status } = z.object({ status: orderStatus.optional() }).parse(req.query);
    res.json({ orders: await admin.listOrders({ status }) });
  }),
);

adminRouter.get(
  "/orders/:orderNumber",
  requireAccess("orders.view"),
  asyncHandler(async (req, res) => {
    const { orderNumber } = z.object({ orderNumber: z.string().min(1) }).parse(req.params);
    res.json({ order: await admin.getOrder(orderNumber) });
  }),
);

adminRouter.patch(
  "/orders/:id/status",
  requireAccess("orders.fulfil"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const { status } = z.object({ status: orderStatus }).parse(req.body);
    res.json({ order: await admin.updateOrderStatus(id, status) });
  }),
);

// Inventory
adminRouter.get(
  "/inventory",
  requireAccess("inventory"),
  asyncHandler(async (req, res) => {
    const q = z
      .object({ lowStock: z.enum(["true", "false"]).optional(), threshold: z.coerce.number().int().optional() })
      .parse(req.query);
    res.json({
      inventory: await admin.listInventory({
        lowStockOnly: q.lowStock === "true",
        ...(q.threshold != null ? { threshold: q.threshold } : {}),
      }),
    });
  }),
);

adminRouter.post(
  "/inventory/adjust",
  requireAccess("inventory"),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        variantId: z.string().min(1),
        locationId: z.string().optional(),
        setOnHand: z.number().int().nonnegative().optional(),
        delta: z.number().int().optional(),
      })
      .refine((v) => v.setOnHand != null || v.delta != null, {
        message: "Provide setOnHand or delta",
        path: ["setOnHand"],
      })
      .parse(req.body);
    res.json({ inventory: await admin.adjustInventory(input) });
  }),
);

// Products
adminRouter.get(
  "/products",
  requireAccess("catalog"),
  asyncHandler(async (_req, res) => {
    res.json({ products: await admin.listProducts() });
  }),
);

adminRouter.patch(
  "/products/:id",
  requireAccess("catalog"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const data = z
      .object({
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        status: productStatus.optional(),
        categoryId: z.string().nullable().optional(),
      })
      .parse(req.body);
    res.json({ product: await admin.updateProduct(id, data) });
  }),
);

// Customers (CRM)
adminRouter.get(
  "/customers",
  requireAccess("customers"),
  asyncHandler(async (req, res) => {
    const { q } = z.object({ q: z.string().optional() }).parse(req.query);
    res.json({ customers: await admin.listCustomers(q) });
  }),
);

adminRouter.get(
  "/customers/:id",
  requireAccess("customers"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    res.json({ customer: await admin.getCustomer(id) });
  }),
);
