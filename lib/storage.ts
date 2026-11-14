import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";

// Configure S3 client if environment variables are provided
const s3Configured = Boolean(
  process.env.S3_ACCESS_KEY_ID &&
  process.env.S3_SECRET_ACCESS_KEY &&
  process.env.S3_BUCKET_NAME
);

const s3Client = s3Configured
  ? new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: process.env.STORAGE_PROVIDER === "supabase",
    })
  : null;

// Supabase Native REST Storage Config
function getSupabaseConfig() {
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY;

  let supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl && process.env.DATABASE_URL) {
    const match = process.env.DATABASE_URL.match(/@db\.([a-z0-9]+)\.supabase\.co/);
    if (match && match[1]) {
      supabaseUrl = `https://${match[1]}.supabase.co`;
    }
  }

  const bucket =
    process.env.SUPABASE_STORAGE_BUCKET ||
    process.env.S3_BUCKET_NAME ||
    "resumes";

  return { supabaseKey, supabaseUrl, bucket };
}

/**
 * Uploads a candidate resume attachment (PDF or DOCX) to S3/R2/Supabase,
 * or saves to a local public directory if S3 credentials are not yet set.
 * Returns the permanent public access URL.
 */
export async function uploadResume(
  buffer: Buffer,
  originalFilename: string,
  mimeType: string
): Promise<string> {
  const extension = path.extname(originalFilename).toLowerCase() || ".pdf";
  const uniqueKey = `cv-${Date.now()}-${crypto.randomBytes(6).toString("hex")}${extension}`;

  // 1. Supabase Native REST Storage
  if (process.env.STORAGE_PROVIDER === "supabase") {
    const { supabaseKey, supabaseUrl, bucket } = getSupabaseConfig();
    if (supabaseKey && supabaseUrl) {
      try {
        const uploadEndpoint = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${bucket}/${uniqueKey}`;
        const response = await fetch(uploadEndpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": mimeType || "application/pdf",
            "x-upsert": "true",
          },
          body: new Uint8Array(buffer),
        });

        if (response.ok) {
          const publicUrl = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${uniqueKey}`;
          console.log(`[Storage] Uploaded resume to Supabase Storage: ${publicUrl}`);
          return publicUrl;
        } else {
          const errorMsg = await response.text();
          console.error(`[Storage] Supabase upload returned ${response.status}: ${errorMsg}`);
        }
      } catch (err) {
        console.error("[Storage] Error uploading to Supabase Storage:", err);
      }
    }
  }

  // 2. S3 / R2 / S3-compatible Supabase endpoint

  if (s3Client && process.env.S3_BUCKET_NAME) {
    try {
      const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: uniqueKey,
        Body: buffer,
        ContentType: mimeType || "application/pdf",
        Metadata: {
          originalName: encodeURIComponent(originalFilename),
          uploadedAt: new Date().toISOString(),
        },
      });

      await s3Client.send(command);

      if (process.env.S3_PUBLIC_URL) {
        return `${process.env.S3_PUBLIC_URL.replace(/\/$/, "")}/${uniqueKey}`;
      }

      // Default S3 URL format
      if (process.env.S3_ENDPOINT) {
        return `${process.env.S3_ENDPOINT.replace(/\/$/, "")}/${process.env.S3_BUCKET_NAME}/${uniqueKey}`;
      }

      return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION || "us-east-1"}.amazonaws.com/${uniqueKey}`;
    } catch (error) {
      console.error("[Storage] S3 upload error, falling back to local storage:", error);
    }
  }

  // Fallback to local public storage: /public/uploads/resumes
  const localUploadDir = path.join(process.cwd(), "public", "uploads", "resumes");
  await fs.mkdir(localUploadDir, { recursive: true });

  const localFilename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${extension}`;
  const localFilePath = path.join(localUploadDir, localFilename);
  await fs.writeFile(localFilePath, buffer);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/uploads/resumes/${localFilename}`;
}
