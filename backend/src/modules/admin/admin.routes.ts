import { Router } from "express";
import { z } from "zod";
import { asyncHandler, badRequest } from "../../lib/http.js";
import { authenticate } from "../../middleware/auth.js";
import { requireAccess } from "../../middleware/access.js";
import { uploadImages, fileUrl } from "../../lib/uploads.js";
import * as admin from "./admin.service.js";
import * as products from "../products/products.service.js";
import * as customerAccounts from "../customers/customers.service.js";

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

// An image URL is either a full http(s) URL (object storage) or a local /uploads path.
const imageUrl = z
  .string()
  .min(1)
  .refine((v) => /^https?:\/\//.test(v) || v.startsWith("/uploads/"), "Image URL must be a full URL or an /uploads path");

const createProductSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and hyphens"),
  description: z.string().optional(),
  status: productStatus.optional(),
  categoryId: z.string().optional(),
  images: z
    .array(z.object({ url: imageUrl, alt: z.string().optional(), position: z.number().int().optional() }))
    .optional(),
  variants: z
    .array(
      z.object({
        sku: z.string().min(1),
        name: z.string().min(1),
        priceMinor: z.number().int().nonnegative(),
        currency: z.string().length(3).optional(),
        barcode: z.string().optional(),
        stock: z.number().int().nonnegative().optional(),
      }),
    )
    .min(1, "Add at least one option (size/variant)"),
});

adminRouter.post(
  "/products",
  requireAccess("catalog"),
  asyncHandler(async (req, res) => {
    const input = createProductSchema.parse(req.body);
    res.status(201).json({ product: await products.createProduct(input) });
  }),
);

// Staff image upload (product photos). Returns stored URLs to attach on create.
adminRouter.post(
  "/uploads",
  requireAccess("catalog"),
  uploadImages.array("images", 8),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) throw badRequest("No images uploaded");
    res.json({ urls: files.map((f) => fileUrl(f.filename)) });
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

// Customer-care password reset: issues a temporary password for a locked-out
// customer. Returned once for the agent to pass on; recorded in the audit log.
adminRouter.post(
  "/customers/:id/reset-password",
  requireAccess("customers"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    res.json(await customerAccounts.adminResetCustomerPassword(id));
  }),
);

// Customer care fixes a saved address for a customer (e.g. a typo on a call).
const addressPatchSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(6).optional(),
  line1: z.string().min(1).optional(),
  line2: z.string().optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit PIN code").optional(),
});

adminRouter.patch(
  "/customers/:id/addresses/:addressId",
  requireAccess("customers"),
  asyncHandler(async (req, res) => {
    const { id, addressId } = z.object({ id: z.string().min(1), addressId: z.string().min(1) }).parse(req.params);
    const address = await customerAccounts.updateAddress(id, addressId, addressPatchSchema.parse(req.body));
    res.json({ address });
  }),
);
