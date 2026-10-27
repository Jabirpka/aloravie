import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/http.js";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { connectChannel, getChannel, listChannels, pullOrders, pushInventory } from "./sync.service.js";

export const marketplaceRouter: Router = Router();

marketplaceRouter.use(authenticate, requireRole("OWNER", "ADMIN", "STAFF"));

const idParam = z.object({ id: z.string().min(1) });

marketplaceRouter.get(
  "/channels",
  asyncHandler(async (_req, res) => {
    res.json({ channels: await listChannels() });
  }),
);

marketplaceRouter.get(
  "/channels/:id",
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json({ channel: await getChannel(id) });
  }),
);

marketplaceRouter.post(
  "/channels/:id/connect",
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json({ channel: await connectChannel(id) });
  }),
);

marketplaceRouter.post(
  "/channels/:id/push-inventory",
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json(await pushInventory(id));
  }),
);

marketplaceRouter.post(
  "/channels/:id/pull-orders",
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json(await pullOrders(id));
  }),
);
