import rateLimit from "express-rate-limit";

// Throttle credential endpoints (login / register / refresh) to blunt brute-force
// and credential-stuffing. Keyed by IP; needs `trust proxy` set behind a PaaS.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many attempts. Please try again later." } },
});
