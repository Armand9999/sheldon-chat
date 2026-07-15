import { NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { isAuthError, requireBearerToken } from "@/lib/auth-server";
import {
  ALLOWED_UPLOAD_TYPES,
  buildUploadKeys,
  documentId,
  getBucketName,
  getRegion,
  MAX_UPLOAD_BYTES,
} from "@/lib/upload-config";

export const runtime = "nodejs";

const s3 = new S3Client({ region: getRegion() });

export async function POST(request: Request) {
  const token = requireBearerToken(request);
  if (isAuthError(token)) return token;

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required." }, { status: 400 });
    }

    const contentType =
      file.type ||
      (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");

    if (!ALLOWED_UPLOAD_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: "Only PDF uploads are supported." },
        { status: 415 },
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `File exceeds maximum size of ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`,
        },
        { status: 400 },
      );
    }

    const bucket = getBucketName();
    const { intakeKey, processedKey } = buildUploadKeys(file.name);
    const bytes = Buffer.from(await file.arrayBuffer());

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: intakeKey,
        Body: bytes,
        ContentType: contentType,
      }),
    );

    return NextResponse.json({
      intakeKey,
      processedKey,
      documentId: documentId(bucket, intakeKey),
      contentType,
      fileName: file.name,
      size: file.size,
    });
  } catch (err) {
    const e = err as { message?: string; name?: string };
    console.error("upload_error", err);
    return NextResponse.json(
      { error: e.message || "Failed to upload file." },
      { status: 500 },
    );
  }
}
