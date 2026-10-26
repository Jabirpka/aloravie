import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { notFoundHandler, errorHandler } from "./middleware/error.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { productRouter } from "./modules/products/products.routes.js";
import { customerRouter } from "./modules/customers/customers.routes.js";
import { checkoutRouter } from "./modules/checkout/checkout.routes.js";
import { paymentRouter } from "./modules/payments/payments.routes.js";
import { orderRouter } from "./modules/orders/orders.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { fulfilmentRouter } from "./modules/fulfilment/fulfilment.routes.js";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(pinoHttp({ logger }));

  // Routes
  app.use("/", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/products", productRouter);
  app.use("/api/customers", customerRouter);
  app.use("/api/checkout", checkoutRouter);
  app.use("/api/payments", paymentRouter);
  app.use("/api/orders", orderRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/admin", fulfilmentRouter);

  // Fallbacks
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
