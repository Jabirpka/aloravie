import type { RequestHandler } from "express";
import { hasAccess, type Feature } from "../lib/access.js";
import { forbidden, unauthorized } from "../lib/http.js";

// Gate a route by feature. Use after `authenticate`. OWNER/ADMIN always pass;
// STAFF pass only when one of their departments grants the feature.
export function requireAccess(feature: Feature): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!hasAccess({ role: req.user.role, departments: req.user.departments ?? [] }, feature)) {
      throw forbidden("Your departments don't grant access to this area");
    }
    next();
  };
}
