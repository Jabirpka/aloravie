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
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // File storage
  // local = write to ./uploads and serve at /uploads (dev only; disk is ephemeral on PaaS)
  // s3    = upload to an S3-compatible bucket (AWS S3 / Cloudflare R2) and serve from STORAGE_PUBLIC_URL
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_ENDPOINT: z.string().optional(), // e.g. https://<account>.r2.cloudflarestorage.com
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_PUBLIC_URL: z.string().optional(), // public base URL for stored files (no trailing slash)

  // Pricing rules (minor units / paise)
  SHIPPING_FLAT_MINOR: z.coerce.number().int().nonnegative().default(9900),
  FREE_SHIP_THRESHOLD_MINOR: z.coerce.number().int().nonnegative().default(149900),

  // Fulfilment / courier
  COURIER_MODE: z.enum(["mock", "shiprocket"]).default("mock"),
  SHIPROCKET_EMAIL: z.string().optional(),
  SHIPROCKET_PASSWORD: z.string().optional(),
  SHIPROCKET_PICKUP_LOCATION: z.string().optional(),

  // Marketplace sync
  // mock = simulate inventory push + generate sample marketplace orders (dev)
  // live = use real seller connectors (require each marketplace's credentials)
  MARKETPLACE_MODE: z.enum(["mock", "live"]).default("mock"),

  // Notifications (email / SMS / WhatsApp)
  // mock = log + record notifications without sending; live = use the providers below
  NOTIFY_MODE: z.enum(["mock", "live"]).default("mock"),
  SENDGRID_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_SMS_FROM: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),

  // Seller identity (printed on invoices / delivery notes / labels)
  SELLER_NAME: z.string().default("Aloravie"),
  SELLER_GSTIN: z.string().default(""),
  SELLER_ADDRESS: z.string().default("Bengaluru, Karnataka, India"),
  SELLER_STATE: z.string().default("Karnataka"),
  SELLER_EMAIL: z.string().default("care@aloravie.example"),
  SELLER_PHONE: z.string().default(""),
}).superRefine((val, ctx) => {
  if (val.PAYMENT_MODE === "razorpay" && (!val.RAZORPAY_KEY_ID || !val.RAZORPAY_KEY_SECRET)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["RAZORPAY_KEY_ID"],
      message: "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required when PAYMENT_MODE=razorpay",
    });
  }
  if (val.COURIER_MODE === "shiprocket" && (!val.SHIPROCKET_EMAIL || !val.SHIPROCKET_PASSWORD)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["SHIPROCKET_EMAIL"],
      message: "SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD are required when COURIER_MODE=shiprocket",
    });
  }
  const fail = (path: string, message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

  // S3 storage needs its full credential set.
  if (val.STORAGE_DRIVER === "s3") {
    if (!val.S3_ENDPOINT || !val.S3_BUCKET || !val.S3_ACCESS_KEY_ID || !val.S3_SECRET_ACCESS_KEY || !val.STORAGE_PUBLIC_URL) {
      fail("S3_BUCKET", "S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and STORAGE_PUBLIC_URL are required when STORAGE_DRIVER=s3");
    }
  }

  // Production hardening: refuse to boot with dev-only defaults that would be unsafe live.
  if (val.NODE_ENV === "production") {
    if (val.PAYMENT_MODE !== "razorpay") fail("PAYMENT_MODE", "PAYMENT_MODE must be 'razorpay' in production (mock payments are disabled)");
    if (val.RAZORPAY_WEBHOOK_SECRET == null || val.RAZORPAY_WEBHOOK_SECRET.length < 1) fail("RAZORPAY_WEBHOOK_SECRET", "RAZORPAY_WEBHOOK_SECRET is required in production");
    if (val.STORAGE_DRIVER !== "s3") fail("STORAGE_DRIVER", "STORAGE_DRIVER must be 's3' in production (local disk is wiped on redeploy)");
    if (val.JWT_ACCESS_SECRET.length < 32) fail("JWT_ACCESS_SECRET", "JWT_ACCESS_SECRET must be at least 32 chars in production");
    if (val.JWT_REFRESH_SECRET.length < 32) fail("JWT_REFRESH_SECRET", "JWT_REFRESH_SECRET must be at least 32 chars in production");
    if (val.JWT_ACCESS_SECRET === val.JWT_REFRESH_SECRET) fail("JWT_REFRESH_SECRET", "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ");
    const origins = val.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
    if (origins.some((o) => /localhost|127\.0\.0\.1/.test(o))) fail("CORS_ORIGINS", "CORS_ORIGINS must not include localhost in production");
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
