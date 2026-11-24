import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import path from "path";
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
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    getEnv("SUPABASE_KEY");

  let supabaseUrl = getEnv("SUPABASE_URL") || getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const dbUrl = getEnv("DATABASE_URL") || process.env.DATABASE_URL || "";
  const directUrl = getEnv("DIRECT_URL") || process.env.DIRECT_URL || "";

  // Auto-derive Supabase REST URL if not explicitly provided
  if (!supabaseUrl) {
    const candidateUrls = [dbUrl, directUrl];
    for (const u of candidateUrls) {
      if (!u) continue;
      // Direct format: postgresql://...@db.olforouckwdxumfxared.supabase.co:...
      const matchDirect = u.match(/@db\.([a-z0-9]+)\.supabase\.co/);
      if (matchDirect && matchDirect[1]) {
        supabaseUrl = `https://${matchDirect[1]}.supabase.co`;
        break;
      }
      // Pooler format: postgresql://postgres.olforouckwdxumfxared:...@...pooler.supabase.com:...
      const matchPooler = u.match(/postgres\.([a-z0-9]+):/);
      if (matchPooler && matchPooler[1]) {
        supabaseUrl = `https://${matchPooler[1]}.supabase.co`;
        break;
      }
    }
  }

  const bucket =
    getEnv("SUPABASE_STORAGE_BUCKET") ||
    getEnv("S3_BUCKET_NAME") ||
    "resumes";

  return { supabaseKey, supabaseUrl, bucket };
}

/**
 * Uploads a candidate resume attachment (PDF, DOCX, or Image) to Supabase Storage or S3/R2.
 * If external cloud storage is unconfigured, returns null.
 * CRITICAL ARCHITECTURAL GUARANTEE: NEVER returns Base64 data URLs.
 * Resumes are streamed on demand from the Gmail API via /api/candidates/[id]/resume,
 * keeping database storage at 0 bytes for file attachments!
 */
export async function uploadResume(
  buffer: Buffer,
  originalFilename: string,
  mimeType: string
): Promise<string | null> {
  const extension = path.extname(originalFilename).toLowerCase() || ".pdf";
  const uniqueKey = `cv-${Date.now()}-${crypto.randomBytes(6).toString("hex")}${extension}`;

  // 1. Supabase Native REST Storage (Preferred if keys are provided)
  const { supabaseKey, supabaseUrl, bucket } = getSupabaseConfig();
  if (supabaseKey && supabaseUrl) {
    try {
      const uploadEndpoint = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${bucket}/${uniqueKey}`;
      const response = await fetch(uploadEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
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
        console.warn(`[Storage] Supabase upload returned ${response.status}: ${errorMsg}`);
      }
    } catch (err: any) {
      console.warn("[Storage] Error uploading to Supabase Storage:", err.message);
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
    } catch (error: any) {
      console.warn("[Storage] S3 upload error:", error.message);
    }
  }

  // 3. Fallback: No external bucket configured.
  // Return null so the candidate uses the lightweight on-demand streaming route /api/candidates/[id]/resume.
  // This stores ZERO file bytes in PostgreSQL!
  return null;
}
