import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 chars"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 chars"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3001,http://localhost:5173"),

  // Payments
  PAYMENT_MODE: z.enum(["mock", "razorpay"]).default("mock"),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),

  // Pricing rules (minor units / paise)
  SHIPPING_FLAT_MINOR: z.coerce.number().int().nonnegative().default(9900),
  FREE_SHIP_THRESHOLD_MINOR: z.coerce.number().int().nonnegative().default(149900),
}).superRefine((val, ctx) => {
  if (val.PAYMENT_MODE === "razorpay" && (!val.RAZORPAY_KEY_ID || !val.RAZORPAY_KEY_SECRET)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["RAZORPAY_KEY_ID"],
      message: "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required when PAYMENT_MODE=razorpay",
    });
  }
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with a readable message rather than a cryptic runtime crash later.
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProd: raw.NODE_ENV === "production",
  corsOrigins: raw.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
};

export type Env = typeof env;
