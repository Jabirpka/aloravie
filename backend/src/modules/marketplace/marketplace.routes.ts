import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/http.js";
import { authenticate } from "../../middleware/auth.js";
import { requireAccess } from "../../middleware/access.js";
import { connectChannel, getChannel, listChannels, pullOrders, pushInventory } from "./sync.service.js";

export const marketplaceRouter: Router = Router();

// Per-route guards (this router shares the /api/admin mount with others).
marketplaceRouter.use(authenticate);
const channels = requireAccess("channels");

const idParam = z.object({ id: z.string().min(1) });

marketplaceRouter.get(
  "/channels",
  channels,
  asyncHandler(async (_req, res) => {
    res.json({ channels: await listChannels() });
  }),
);

marketplaceRouter.get(
  "/channels/:id",
  channels,
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json({ channel: await getChannel(id) });
  }),
);

marketplaceRouter.post(
  "/channels/:id/connect",
  channels,
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json({ channel: await connectChannel(id) });
  }),
);

marketplaceRouter.post(
  "/channels/:id/push-inventory",
  channels,
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json(await pushInventory(id));
  }),
);

marketplaceRouter.post(
  "/channels/:id/pull-orders",
  channels,
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json(await pullOrders(id));
  }),
);
