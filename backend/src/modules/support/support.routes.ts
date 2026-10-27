import { Router } from "express";
import { z } from "zod";
import { asyncHandler, unauthorized } from "../../lib/http.js";
import { authenticateCustomer } from "../../middleware/customer-auth.js";
import * as support from "./support.service.js";

export const supportRouter: Router = Router();

supportRouter.use(authenticateCustomer);

const idParam = z.object({ id: z.string().min(1) });

supportRouter.get(
  "/conversations",
  asyncHandler(async (req, res) => {
    if (!req.customer) throw unauthorized();
    res.json({ conversations: await support.listForCustomer(req.customer.sub) });
  }),
);

supportRouter.post(
  "/conversations",
  asyncHandler(async (req, res) => {
    if (!req.customer) throw unauthorized();
    const { subject, body } = z.object({ subject: z.string().default(""), body: z.string().min(1) }).parse(req.body);
    res.status(201).json({ conversation: await support.createConversation(req.customer.sub, subject, body) });
  }),
);

supportRouter.get(
  "/conversations/:id",
  asyncHandler(async (req, res) => {
    if (!req.customer) throw unauthorized();
    const { id } = idParam.parse(req.params);
    res.json({ conversation: await support.getForCustomer(req.customer.sub, id) });
  }),
);

supportRouter.post(
  "/conversations/:id/messages",
  asyncHandler(async (req, res) => {
    if (!req.customer) throw unauthorized();
    const { id } = idParam.parse(req.params);
    const { body } = z.object({ body: z.string().min(1) }).parse(req.body);
    res.status(201).json({ conversation: await support.addCustomerMessage(req.customer.sub, id, body) });
  }),
);
