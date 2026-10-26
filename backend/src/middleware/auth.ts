import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { UserRole } from "@prisma/client";
import { verifyAccessToken, type AccessTokenPayload } from "../lib/auth.js";
import { unauthorized, forbidden } from "../lib/http.js";

// Augment Express's Request with the authenticated user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export const authenticate: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw unauthorized("Missing bearer token");
  }
  const token = header.slice("Bearer ".length).trim();
  try {
    req.user = verifyAccessToken(token);
  } catch {
    throw unauthorized("Invalid or expired token");
  }
  next();
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden("Insufficient role");
    next();
  };
}
