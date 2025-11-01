import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
const rawEndpoint = process.env.R2_S3_ENDPOINT;
const publicOverride = process.env.R2_PUBLIC_BUCKET_URL?.trim();

if (!accessKeyId || !secretAccessKey || !bucket || !rawEndpoint) {
  throw new Error(
    "Missing Cloudflare R2 configuration. Ensure R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, and R2_S3_ENDPOINT are set."
  );
}

const normalizedEndpoint = (() => {
  const trimmed = rawEndpoint.replace(/\/+$/, "");
  const suffix = `/${bucket}`;
  if (trimmed.endsWith(suffix)) {
    return trimmed.slice(0, -suffix.length);
  }
  return trimmed;
})();

const publicEndpoint = (() => {
  if (publicOverride) {
    return publicOverride.replace(/\/+$/, "");
  }
  const trimmed = rawEndpoint.replace(/\/+$/, "");
  const suffix = `/${bucket}`;
  if (trimmed.endsWith(suffix)) {
    return trimmed;
  }
  return `${trimmed}${suffix}`;
})();

export const r2BucketName = bucket;
export const r2PublicBucketUrl = publicEndpoint;

export const r2Client = new S3Client({
  region: "auto",
  endpoint: normalizedEndpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});
