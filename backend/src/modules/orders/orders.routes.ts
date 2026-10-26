import { Router } from "express";
import { z } from "zod";
import { asyncHandler, unauthorized } from "../../lib/http.js";
import { authenticateCustomer } from "../../middleware/customer-auth.js";
import { getOrderForCustomer, listOrdersForCustomer } from "./orders.service.js";

export const orderRouter: Router = Router();

orderRouter.get(
  "/",
  authenticateCustomer,
  asyncHandler(async (req, res) => {
    if (!req.customer) throw unauthorized();
    res.json({ orders: await listOrdersForCustomer(req.customer.sub) });
  }),
);

const numberParam = z.object({ orderNumber: z.string().min(1) });

orderRouter.get(
  "/:orderNumber",
  authenticateCustomer,
  asyncHandler(async (req, res) => {
    if (!req.customer) throw unauthorized();
    const { orderNumber } = numberParam.parse(req.params);
    res.json({ order: await getOrderForCustomer(req.customer.sub, orderNumber) });
  }),
);
