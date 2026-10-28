import { Router } from "express";
import { z } from "zod";
import { asyncHandler, unauthorized } from "../../lib/http.js";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { authenticateCustomer } from "../../middleware/customer-auth.js";
import * as productService from "./products.service.js";
import * as reviews from "../reviews/reviews.service.js";

export const productRouter: Router = Router();

const statusEnum = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);

const listQuerySchema = z.object({
  status: statusEnum.optional(),
});

const createSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, numbers and hyphens"),
  description: z.string().optional(),
  status: statusEnum.optional(),
  categoryId: z.string().optional(),
  images: z
    .array(z.object({ url: z.string().url(), alt: z.string().optional(), position: z.number().int().optional() }))
    .optional(),
  variants: z
    .array(
      z.object({
        sku: z.string().min(1),
        name: z.string().min(1),
        priceMinor: z.number().int().nonnegative(),
        currency: z.string().length(3).optional(),
        barcode: z.string().optional(),
      }),
    )
    .min(1, "At least one variant is required"),
});

// Public: storefront reads the active catalog.
productRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status } = listQuerySchema.parse(req.query);
    const products = await productService.listProducts({ status });
    res.json({ products });
  }),
);

const slugParamSchema = z.object({ slug: z.string().min(1) });

// Reviews for a product (public read). Defined before "/:slug" is irrelevant
// since paths differ, but kept together for clarity.
productRouter.get(
  "/:slug/reviews",
  asyncHandler(async (req, res) => {
    const { slug } = slugParamSchema.parse(req.params);
    res.json(await reviews.listPublished(slug));
  }),
);

// Write a review (signed-in customer).
productRouter.post(
  "/:slug/reviews",
  authenticateCustomer,
  asyncHandler(async (req, res) => {
    if (!req.customer) throw unauthorized();
    const { slug } = slugParamSchema.parse(req.params);
    const input = z
      .object({ rating: z.number().int().min(1).max(5), title: z.string().optional(), body: z.string().optional() })
      .parse(req.body);
    res.status(201).json({ review: await reviews.createReview(req.customer.sub, slug, input) });
  }),
);

productRouter.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const { slug } = slugParamSchema.parse(req.params);
    const product = await productService.getProductBySlug(slug);
    res.json({ product });
  }),
);

// Staff only: create a product.
productRouter.post(
  "/",
  authenticate,
  requireRole("OWNER", "ADMIN", "STAFF"),
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const product = await productService.createProduct(input);
    res.status(201).json({ product });
  }),
);
