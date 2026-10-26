import { Router } from "express";

export const healthRouter: Router = Router();

// Liveness — intentionally does NOT touch the database, so it works before migration.
healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "aloravie-backend", time: new Date().toISOString() });
});
