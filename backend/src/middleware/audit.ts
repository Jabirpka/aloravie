import type { RequestHandler } from "express";
import { describeAction, recordAudit } from "../modules/audit/audit.service.js";

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

// Logs every successful mutating admin request. Mounted on /api/admin BEFORE
// the routers, so req.path here is relative to that mount; req.user is read on
// `finish`, by which point the router's authenticate has populated it.
export const auditMiddleware: RequestHandler = (req, res, next) => {
  if (!MUTATING.has(req.method)) return next();
  const method = req.method;
  const path = req.path;

  res.on("finish", () => {
    if (res.statusCode >= 400) return;
    const user = req.user;
    if (!user) return;
    const info = describeAction(method, path);
    void recordAudit({
      actorId: user.sub,
      actorName: user.email,
      actorEmail: user.email,
      action: info.action,
      summary: info.summary,
      entity: info.entity,
      entityId: info.entityId,
      method,
      path,
    });
  });

  next();
};
