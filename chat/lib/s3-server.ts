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

/**
 * S3 returns 403 AccessDenied (not 404) for missing keys when the caller
 * has GetObject/HeadObject but not ListBucket. During ingestion polling the
 * processed/manifest objects often do not exist yet, so treat AccessDenied
 * as "not ready" rather than a hard IAM failure.
 */
function isAbsentObjectError(err: unknown): boolean {
  const e = err as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const status = e.$metadata?.httpStatusCode;
  return (
    e.name === "NotFound" ||
    e.Code === "NotFound" ||
    e.name === "NoSuchKey" ||
    e.Code === "NoSuchKey" ||
    e.name === "AccessDenied" ||
    e.Code === "AccessDenied" ||
    status === 404 ||
    status === 403
  );
}

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
    if (!isAbsentObjectError(err)) throw err;
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
    if (!isAbsentObjectError(err)) throw err;
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
