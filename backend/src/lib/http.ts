import type { Request, Response, NextFunction, RequestHandler } from "express";

// Consistent application error with an HTTP status and a stable machine code.
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown) =>
  new AppError(400, "BAD_REQUEST", msg, details);
export const unauthorized = (msg = "Not authenticated") =>
  new AppError(401, "UNAUTHORIZED", msg);
export const forbidden = (msg = "Not allowed") => new AppError(403, "FORBIDDEN", msg);
export const notFound = (msg = "Not found") => new AppError(404, "NOT_FOUND", msg);
export const conflict = (msg: string, details?: unknown) =>
  new AppError(409, "CONFLICT", msg, details);

// Wrap async route handlers so thrown/rejected errors reach the error middleware.
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
