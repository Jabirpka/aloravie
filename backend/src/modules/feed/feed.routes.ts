import { Router } from "express";
import { asyncHandler } from "../../lib/http.js";
import { buildMetaFeed } from "./feed.service.js";

// Public product feed for Meta Commerce Manager (Instagram/Facebook Shopping).
// Mounted at /api/feed, so the feed URL is <host>/api/feed/meta.xml.
export const feedRouter: Router = Router();

feedRouter.get(
  "/meta.xml",
  asyncHandler(async (_req, res) => {
    const xml = await buildMetaFeed();
    res.type("application/xml").send(xml);
  }),
);
