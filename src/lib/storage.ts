import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Cloudflare R2 — endpoint de upload e URL pública são diferentes.
// Endpoint de upload: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
// URL pública:        R2_PUBLIC_URL (ex: https://pub-xxxx.r2.dev)
const accountId   = process.env.R2_ACCOUNT_ID!;
const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
const secretKey   = process.env.R2_SECRET_ACCESS_KEY!;

const s3 = new S3Client({
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  region: 'auto',
  credentials: { accessKeyId, secretAccessKey: secretKey },
  forcePathStyle: true,
});

const BUCKET     = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL!; // https://pub-xxxx.r2.dev

/**
 * Faz upload de um buffer para o R2 e retorna a URL pública.
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
      // R2 não usa ACL — acesso público é configurado no dashboard
    })
  );
  // URL pública via domínio r2.dev (ou custom domain)
  return `${PUBLIC_URL}/${key}`;
}

/**
 * Remove um arquivo do R2 pelo key (caminho relativo ao bucket).
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
 * Extrai o key R2 a partir de uma URL pública.
 * Ex: "https://pub-xxx.r2.dev/banners/foo.jpg" → "banners/foo.jpg"
 */
export function keyFromUrl(url: string): string {
  const prefix = `${PUBLIC_URL}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : url;
}

export { s3 };
