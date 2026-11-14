import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import { getEnv } from "./env";

function getS3Client(): S3Client | null {
  const accessKeyId = getEnv("S3_ACCESS_KEY_ID");
  const secretAccessKey = getEnv("S3_SECRET_ACCESS_KEY");
  const bucketName = getEnv("S3_BUCKET_NAME");

  if (!accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  return new S3Client({
    region: getEnv("S3_REGION") || "auto",
    endpoint: getEnv("S3_ENDPOINT") || undefined,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: getEnv("STORAGE_PROVIDER") === "supabase",
  });
}

// Supabase Native REST Storage Config
function getSupabaseConfig() {
  const supabaseKey =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    getEnv("SUPABASE_ANON_KEY") ||
    getEnv("SUPABASE_KEY");

  let supabaseUrl = getEnv("SUPABASE_URL");
  const dbUrl = getEnv("DATABASE_URL");
  if (!supabaseUrl && dbUrl) {
    const match = dbUrl.match(/@db\.([a-z0-9]+)\.supabase\.co/);
    if (match && match[1]) {
      supabaseUrl = `https://${match[1]}.supabase.co`;
    }
  }

  const bucket =
    getEnv("SUPABASE_STORAGE_BUCKET") ||
    getEnv("S3_BUCKET_NAME") ||
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
  if (getEnv("STORAGE_PROVIDER") === "supabase") {
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
  const s3Client = getS3Client();
  const s3Bucket = getEnv("S3_BUCKET_NAME") || "resumes";

  if (s3Client && s3Bucket) {
    try {
      const command = new PutObjectCommand({
        Bucket: s3Bucket,
        Key: uniqueKey,
        Body: buffer,
        ContentType: mimeType || "application/pdf",
        Metadata: {
          originalName: encodeURIComponent(originalFilename),
          uploadedAt: new Date().toISOString(),
        },
      });

      await s3Client.send(command);

      const publicUrl = getEnv("S3_PUBLIC_URL");
      if (publicUrl) {
        return `${publicUrl.replace(/\/$/, "")}/${uniqueKey}`;
      }

      const endpoint = getEnv("S3_ENDPOINT");
      if (endpoint) {
        return `${endpoint.replace(/\/$/, "")}/${s3Bucket}/${uniqueKey}`;
      }

      return `https://${s3Bucket}.s3.${getEnv("S3_REGION") || "us-east-1"}.amazonaws.com/${uniqueKey}`;
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
