// Verifies S3 / Cloudflare R2 storage is correctly configured end to end:
// uploads a small test object, reads it back through the PUBLIC url, then deletes it.
// Run on the server after setting the S3_* env vars:  npm run check-storage
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../src/env.js";

async function main() {
  if (env.STORAGE_DRIVER !== "s3") {
    console.error(`STORAGE_DRIVER is "${env.STORAGE_DRIVER}", not "s3" — nothing to check.`);
    console.error("Set STORAGE_DRIVER=s3 (and the S3_* / STORAGE_PUBLIC_URL vars) to test R2.");
    process.exit(1);
  }

  const client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });

  const key = `healthcheck/${Date.now()}.txt`;
  const body = `aloravie storage check ${new Date().toISOString()}`;
  let publicReadOk = false;

  // 1. Upload (proves endpoint + bucket + credentials).
  await client.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: "text/plain" }));
  console.log("✓ upload OK            ", key);

  // 2. Read back through the public URL (proves the bucket is public + STORAGE_PUBLIC_URL is right).
  const url = `${env.STORAGE_PUBLIC_URL}/${key}`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    if (res.ok && text === body) {
      publicReadOk = true;
      console.log("✓ public read OK       ", url);
    } else {
      console.error(`✗ public read FAILED (HTTP ${res.status}) at ${url}`);
      console.error("  → Check the bucket has public access enabled and STORAGE_PUBLIC_URL matches it.");
    }
  } catch (err) {
    console.error("✗ public read FAILED   ", (err as Error).message, "at", url);
  }

  // 3. Clean up.
  await client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  console.log("✓ delete OK");

  if (publicReadOk) {
    console.log("\nR2 / S3 storage is correctly configured. ✅");
  } else {
    console.log("\nUpload + delete work, but the public read failed — fix public access before relying on s3.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("\n✗ storage check failed:", (e as Error).message);
  console.error("  → Verify S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
  process.exit(1);
});
