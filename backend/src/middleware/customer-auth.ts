import type { RequestHandler } from "express";
import { verifyCustomerAccessToken, type CustomerTokenPayload } from "../lib/auth.js";
import { unauthorized } from "../lib/http.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      customer?: CustomerTokenPayload;
    }
  }
}

export const authenticateCustomer: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw unauthorized("Missing bearer token");
  try {
    req.customer = verifyCustomerAccessToken(header.slice("Bearer ".length).trim());
  } catch {
    throw unauthorized("Invalid or expired token");
  }
  next();
};
