import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

function settings() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_STATION_DATASETS_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Station dataset storage is not configured.");
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function client() {
  const config = settings();
  return {
    bucket: config.bucket,
    s3: new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }),
  };
}

export async function putStationDatasetSource({
  storageKey,
  body,
  contentType,
}: {
  storageKey: string;
  body: Uint8Array;
  contentType: string;
}) {
  const { s3, bucket } = client();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getStationDatasetSource(storageKey: string) {
  const { s3, bucket } = client();
  const response = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
  );
  if (!response.Body) throw new Error("Dataset source file is empty.");
  return {
    bytes: await response.Body.transformToByteArray(),
    contentType: response.ContentType ?? "application/geo+json",
  };
}

export async function deleteStationDatasetSource(storageKey: string) {
  const { s3, bucket } = client();
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
}
