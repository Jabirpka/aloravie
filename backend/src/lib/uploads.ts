import multer from "multer";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { env } from "../env.js";

// Where local-mode files live and are served from (dev only; a PaaS disk is
// wiped on every redeploy, so production uses STORAGE_DRIVER=s3).
export const UPLOADS_DIR = path.resolve("uploads");
mkdirSync(UPLOADS_DIR, { recursive: true });

// True when files are served by express.static rather than object storage.
export const servesUploadsLocally = env.STORAGE_DRIVER === "local";

function randomKey(originalname: string): string {
  const ext = path.extname(originalname).toLowerCase().slice(0, 10);
  return `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
}

// --- Storage engines ---

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => cb(null, randomKey(file.originalname)),
});

// S3-compatible engine (AWS S3 / Cloudflare R2). Buffers the stream, then PUTs.
function createS3Storage(): multer.StorageEngine {
  const client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
  const bucket = env.S3_BUCKET ?? "";

  return {
    _handleFile(_req, file, cb) {
      const key = randomKey(file.originalname);
      const chunks: Buffer[] = [];
      file.stream.on("data", (c: Buffer) => chunks.push(c));
      file.stream.on("error", cb);
      file.stream.on("end", () => {
        const body = Buffer.concat(chunks);
        client
          .send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: file.mimetype }))
          .then(() => cb(null, { filename: key, size: body.length }))
          .catch(cb);
      });
    },
    _removeFile(_req, file, cb) {
      client
        .send(new DeleteObjectCommand({ Bucket: bucket, Key: file.filename }))
        .then(() => cb(null))
        .catch(cb);
    },
  };
}

const storage: multer.StorageEngine = env.STORAGE_DRIVER === "s3" ? createS3Storage() : diskStorage;

// --- Upload middlewares ---

export const uploadImages = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

// Short voice notes for support chat.
export const uploadAudio = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/")) cb(null, true);
    else cb(new Error("Only audio files are allowed"));
  },
});

/** Public URL for a stored file: object-storage URL in s3 mode, /uploads path locally. */
export function fileUrl(name: string): string {
  if (env.STORAGE_DRIVER === "s3") return `${env.STORAGE_PUBLIC_URL}/${name}`;
  return `/uploads/${name}`;
}
