import multer from "multer";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

// Local-disk storage for uploaded images (return photos, etc.).
// Production should swap this for object storage (S3/GCS) — only this file changes.
export const UPLOADS_DIR = path.resolve("uploads");
mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
    cb(null, `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`);
  },
});

export const uploadImages = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

/** Public path for an uploaded file (served by express.static at /uploads). */
export function fileUrl(filename: string): string {
  return `/uploads/${filename}`;
}
