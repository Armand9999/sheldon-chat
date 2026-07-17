import { createHash } from "crypto";

export function getBucketName(): string {
  const bucket = process.env.S3_BUCKET_NAME ?? "";
  if (!bucket) {
    throw new Error("S3_BUCKET_NAME is not configured");
  }
  return bucket;
}

export function getRegion(): string {
  return (
    process.env.NEXT_PUBLIC_AWS_REGION ??
    process.env.AWS_REGION ??
    "us-east-1"
  );
}

export function documentId(bucket: string, intakeKey: string): string {
  return createHash("sha256").update(`${bucket}/${intakeKey}`).digest("hex").slice(0, 32);
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "document.pdf";
  const cleaned = base.replace(/[^\w.\-() ]+/g, "_").trim();
  return cleaned || "document.pdf";
}

export function buildUploadKeys(fileName: string): {
  intakeKey: string;
  processedKey: string;
  storedName: string;
} {
  const storedName = `${Date.now()}-${sanitizeFileName(fileName)}`;
  return {
    storedName,
    intakeKey: `intake/native/${storedName}`,
    processedKey: `processed/${storedName}`,
  };
}

export const ALLOWED_UPLOAD_TYPES = new Set([
  "application/pdf",
]);

export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 15 * 1024 * 1024);
