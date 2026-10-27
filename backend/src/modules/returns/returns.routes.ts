import { Router } from "express";
import { z } from "zod";
import { asyncHandler, badRequest, unauthorized } from "../../lib/http.js";
import { authenticateCustomer } from "../../middleware/customer-auth.js";
import { uploadImages, fileUrl } from "../../lib/uploads.js";
import * as returns from "./returns.service.js";

export const returnRouter: Router = Router();

returnRouter.use(authenticateCustomer);

const reason = z.enum(["WRONG_SIZE", "DAMAGED", "NOT_AS_DESCRIBED", "CHANGED_MIND", "OTHER"]);

// Create a return — multipart so photos upload in the same request.
returnRouter.post(
  "/",
  uploadImages.array("photos", 5),
  asyncHandler(async (req, res) => {
    if (!req.customer) throw unauthorized();
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    let parsedItems: unknown;
    try {
      parsedItems = JSON.parse(typeof req.body.items === "string" ? req.body.items : "[]");
    } catch {
      throw badRequest("Invalid items payload");
    }
    const input = z
      .object({
        orderId: z.string().min(1),
        reason,
        comment: z.string().optional(),
        items: z.array(z.object({ orderItemId: z.string().min(1), quantity: z.number().int().positive() })).min(1),
      })
      .parse({
        orderId: req.body.orderId,
        reason: req.body.reason,
        comment: req.body.comment || undefined,
        items: parsedItems,
      });
    const photoUrls = files.map((f) => fileUrl(f.filename));
    const created = await returns.createReturn(req.customer.sub, { ...input, photoUrls });
    res.status(201).json({ return: created });
  }),
);

returnRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.customer) throw unauthorized();
    res.json({ returns: await returns.listForCustomer(req.customer.sub) });
  }),
);

returnRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!req.customer) throw unauthorized();
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    res.json({ return: await returns.getForCustomer(req.customer.sub, id) });
  }),
);
