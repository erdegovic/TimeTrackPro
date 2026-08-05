import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { requireBackupConfig } from "./config";

let client: S3Client | undefined;

function getClient() {
  const config = requireBackupConfig();
  if (!client) {
    client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return { client, config };
}

export async function uploadBackupObject(objectKey: string, payload: Buffer) {
  const { client: s3, config } = getClient();
  await s3.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: objectKey,
    Body: payload,
    ContentType: "application/octet-stream",
  }));
}

export async function downloadBackupObject(objectKey: string): Promise<Buffer> {
  const { client: s3, config } = getClient();
  const response = await s3.send(new GetObjectCommand({ Bucket: config.bucket, Key: objectKey }));
  if (!response.Body) {
    throw new Error("Backup object had no content");
  }
  return Buffer.from(await response.Body.transformToByteArray());
}

export async function deleteBackupObject(objectKey: string) {
  const { client: s3, config } = getClient();
  await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: objectKey }));
}

export async function listBackupObjects(prefix: string) {
  const { client: s3, config } = getClient();
  const objects: Array<{ key: string; lastModified: Date }> = [];
  let continuationToken: string | undefined;
  do {
    const response = await s3.send(new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    for (const object of response.Contents || []) {
      if (object.Key && object.LastModified) objects.push({ key: object.Key, lastModified: object.LastModified });
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
}
