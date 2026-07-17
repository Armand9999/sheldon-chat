import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getRegion } from "@/lib/upload-config";

let client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!client) {
    client = new S3Client({ region: getRegion() });
  }
  return client;
}

export { PutObjectCommand };
