import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,       // https://t3.storageapi.dev
  region: process.env.S3_REGION ?? 'auto',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET_NAME!;
const ENDPOINT = process.env.S3_ENDPOINT!;

/**
 * Faz upload de um buffer para o S3 e retorna a URL pública.
 */
export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
    })
  );
  return `${ENDPOINT}/${BUCKET}/${key}`;
}

/**
 * Remove um arquivo do S3 pelo key (caminho relativo ao bucket).
 */
export async function deleteFile(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}

/**
 * Extrai o key S3 a partir de uma URL pública.
 * Ex: "https://t3.storageapi.dev/bucket/banners/foo.jpg" → "banners/foo.jpg"
 */
export function keyFromUrl(url: string): string {
  const prefix = `${ENDPOINT}/${BUCKET}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : url;
}

export { s3 };
