import "server-only";

import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "node:crypto";
import sharp from "sharp";
import {
  r2BucketName,
  r2Client,
  r2PublicBucketUrl,
} from "@/lib/r2-client";

type ProcessResult = {
  buffer: Buffer;
  contentType: string;
};

function buildObjectKey(menuItemId: string) {
  return `menu/${menuItemId}/${crypto.randomUUID()}.webp`;
}

function normalizePublicUrl(key: string) {
  return `${r2PublicBucketUrl.replace(/\/+$/, "")}/${key}`;
}

async function processImage(buffer: Buffer): Promise<ProcessResult> {
  const image = sharp(buffer, { failOnError: false }).rotate();

  // Light optimization: convert to WebP with moderate quality.
  const processedBuffer = await image.webp({ quality: 90 }).toBuffer();

  return {
    buffer: processedBuffer,
    contentType: "image/webp",
  };
}

export async function uploadMenuImage(
  menuItemId: string,
  originalBuffer: Buffer
) {
  const { buffer, contentType } = await processImage(originalBuffer);
  const key = buildObjectKey(menuItemId);

  await r2Client.send(
    new PutObjectCommand({
      Bucket: r2BucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public,max-age=31536000,immutable",
    })
  );

  return {
    key,
    url: normalizePublicUrl(key),
  };
}

export async function deleteMenuImageByKey(key: string) {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: r2BucketName,
      Key: key,
    })
  );
}

export function parseMenuImageKey(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  const normalizedUrl = url.trim();
  if (!normalizedUrl) {
    return null;
  }

  const base = r2PublicBucketUrl.replace(/\/+$/, "");
  if (!normalizedUrl.startsWith(base)) {
    return null;
  }

  const key = normalizedUrl.slice(base.length).replace(/^\/+/, "");
  return key || null;
}
