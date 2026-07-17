import { NextResponse } from "next/server";
import { isAuthError, requireBearerToken } from "@/lib/auth-server";
import {
  ALLOWED_UPLOAD_TYPES,
  buildUploadKeys,
  documentId,
  getBucketName,
  MAX_UPLOAD_BYTES,
} from "@/lib/upload-config";

export const runtime = "nodejs";

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
    const { getS3Client, PutObjectCommand } = await import("@/lib/s3-client");

    await getS3Client().send(
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
    const e = err as { message?: string; name?: string; Code?: string };
    console.error("upload_error", err);
    const message =
      e.name === "AccessDenied" || e.Code === "AccessDenied"
        ? "Upload failed: S3 rejected PutObject (check Amplify compute role and bucket policy)."
        : e.message || "Failed to upload file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
