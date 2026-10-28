import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { UPLOADS_DIR, servesUploadsLocally } from "./lib/uploads.js";
import { notFoundHandler, errorHandler } from "./middleware/error.js";
import { authLimiter } from "./middleware/rate-limit.js";
import { handleRazorpayWebhook } from "./modules/payments/payments.service.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { productRouter } from "./modules/products/products.routes.js";
import { customerRouter } from "./modules/customers/customers.routes.js";
import { checkoutRouter } from "./modules/checkout/checkout.routes.js";
import { paymentRouter } from "./modules/payments/payments.routes.js";
import { orderRouter } from "./modules/orders/orders.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { fulfilmentRouter } from "./modules/fulfilment/fulfilment.routes.js";
import { marketplaceRouter } from "./modules/marketplace/marketplace.routes.js";
import { supportRouter } from "./modules/support/support.routes.js";
import { supportAdminRouter } from "./modules/support/support.admin.routes.js";
import { employeeRouter } from "./modules/employees/employees.routes.js";
import { returnRouter } from "./modules/returns/returns.routes.js";
import { returnAdminRouter } from "./modules/returns/returns.admin.routes.js";
import { couponRouter } from "./modules/coupons/coupons.routes.js";
import { couponAdminRouter } from "./modules/coupons/coupons.admin.routes.js";
import { categoryAdminRouter } from "./modules/categories/categories.admin.routes.js";
import { reviewAdminRouter } from "./modules/reviews/reviews.admin.routes.js";
import { reportAdminRouter } from "./modules/reports/reports.admin.routes.js";
import { auditAdminRouter } from "./modules/audit/audit.admin.routes.js";
import { auditMiddleware } from "./middleware/audit.js";

export function createApp(): Express {
  const app = express();

  // Behind a PaaS proxy in production so rate-limit / logging see the real client IP.
  if (env.isProd) app.set("trust proxy", 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );

  // Razorpay webhook needs the raw body for signature verification, so it is
  // mounted before the JSON body parser.
  app.post("/api/payments/webhook", express.raw({ type: "*/*" }), (req, res, next) => {
    handleRazorpayWebhook(req.body as Buffer, req.header("x-razorpay-signature") ?? undefined)
      .then(() => res.json({ ok: true }))
      .catch(next);
  });

  app.use(express.json({ limit: "1mb" }));

  // Uploaded images (return photos, etc.). Served locally in dev; in production
  // STORAGE_DRIVER=s3 serves them straight from object storage instead.
  if (servesUploadsLocally) app.use("/uploads", express.static(UPLOADS_DIR));
  app.use(pinoHttp({ logger }));

  // Routes
  app.use("/", healthRouter);
  app.use("/api/auth", authLimiter, authRouter);
  app.use("/api/products", productRouter);
  app.use("/api/customers", customerRouter);
  app.use("/api/checkout", checkoutRouter);
  app.use("/api/payments", paymentRouter);
  app.use("/api/orders", orderRouter);
  // Records every successful admin mutation; must run before the admin routers.
  app.use("/api/admin", auditMiddleware);
  app.use("/api/admin", adminRouter);
  app.use("/api/admin", fulfilmentRouter);
  app.use("/api/admin", marketplaceRouter);
  app.use("/api/admin", supportAdminRouter);
  app.use("/api/admin", employeeRouter);
  app.use("/api/admin", returnAdminRouter);
  app.use("/api/admin", couponAdminRouter);
  app.use("/api/admin", categoryAdminRouter);
  app.use("/api/admin", reviewAdminRouter);
  app.use("/api/admin", reportAdminRouter);
  app.use("/api/admin", auditAdminRouter);
  app.use("/api/support", supportRouter);
  app.use("/api/returns", returnRouter);
  app.use("/api/coupons", couponRouter);

  // Fallbacks
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
