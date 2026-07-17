import {
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getS3Client } from "@/lib/s3-client";
import { documentId, getBucketName } from "@/lib/upload-config";

export type IngestionStatus = {
  processedKey: string;
  intakeKey: string;
  documentId: string;
  manifestStatus: string | null;
  processedExists: boolean;
  ready: boolean;
  error: string | null;
};

export async function getIngestionStatus(
  processedKey: string,
  intakeKey: string,
): Promise<IngestionStatus> {
  const bucket = getBucketName();
  const docId = documentId(bucket, intakeKey);
  const s3 = getS3Client();

  let manifestStatus: string | null = null;
  let error: string | null = null;

  try {
    const manifestObj = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: `manifest/${docId}.json`,
      }),
    );
    const body = await manifestObj.Body?.transformToString();
    if (body) {
      const manifest = JSON.parse(body) as {
        status?: string | null;
        error?: string | null;
      };
      manifestStatus = manifest.status ?? null;
      error = manifest.error ?? null;
    }
  } catch (err) {
    const e = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
    const notFound =
      e.name === "NoSuchKey" ||
      e.Code === "NoSuchKey" ||
      e.$metadata?.httpStatusCode === 404;
    if (!notFound) throw err;
  }

  let processedExists = false;
  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: processedKey,
      }),
    );
    processedExists = true;
  } catch (err) {
    const e = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
    const notFound =
      e.name === "NotFound" ||
      e.Code === "NotFound" ||
      e.name === "NoSuchKey" ||
      e.$metadata?.httpStatusCode === 404;
    if (!notFound) throw err;
  }

  return {
    processedKey,
    intakeKey,
    documentId: docId,
    manifestStatus,
    processedExists,
    ready: manifestStatus === "COMPLETE" && processedExists,
    error: manifestStatus === "FAILED" ? error : null,
  };
}
