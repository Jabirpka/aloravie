import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/http.js";
import { authenticate } from "../../middleware/auth.js";
import { requireAccess } from "../../middleware/access.js";
import { createCategory, deleteCategory, listCategories, updateCategory } from "./categories.service.js";

// Category management (part of the catalog feature), mounted under /api/admin.
export const categoryAdminRouter: Router = Router();

categoryAdminRouter.use(authenticate);
const guard = requireAccess("catalog");
const idParam = z.object({ id: z.string().min(1) });

categoryAdminRouter.get(
  "/categories",
  guard,
  asyncHandler(async (_req, res) => {
    res.json({ categories: await listCategories() });
  }),
);

categoryAdminRouter.post(
  "/categories",
  guard,
  asyncHandler(async (req, res) => {
    const input = z
      .object({ name: z.string().min(1), slug: z.string().min(1), parentId: z.string().nullable().optional() })
      .parse(req.body);
    res.status(201).json({ category: await createCategory(input) });
  }),
);

categoryAdminRouter.patch(
  "/categories/:id",
  guard,
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const input = z
      .object({
        name: z.string().min(1).optional(),
        slug: z.string().min(1).optional(),
        parentId: z.string().nullable().optional(),
      })
      .parse(req.body);
    res.json({ category: await updateCategory(id, input) });
  }),
);

categoryAdminRouter.delete(
  "/categories/:id",
  guard,
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    await deleteCategory(id);
    res.status(204).send();
  }),
);
