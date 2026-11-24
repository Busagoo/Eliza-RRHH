import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedGmailClient } from "@/lib/gmail/client";
import { getGmailMessageDetails, downloadGmailAttachment } from "@/lib/gmail/service";

export const dynamic = "force-dynamic";

/**
 * On-demand Resume Streamer
 * Streams the candidate's original resume (PDF, DOCX, PNG, JPG) directly from Gmail API
 * or redirects to external cloud storage if configured.
 *
 * CRITICAL BENEFIT: Eliminates multi-megabyte Base64 strings from PostgreSQL,
 * keeping the database size tiny and completely immune to storage limits.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const identifier = params.id;
    if (!identifier) {
      return NextResponse.json({ error: "Falta el identificador del candidato." }, { status: 400 });
    }

    // 1. Look up candidate by candidate ID or by email ID
    let candidate = await prisma.candidate.findFirst({
      where: {
        OR: [
          { id: identifier },
          { emailId: identifier },
        ],
      },
      include: {
        email: true,
      },
    });

    // Fallback: check if identifier matches gmailMessageId directly
    if (!candidate) {
      const emailRecord = await prisma.email.findUnique({
        where: { gmailMessageId: identifier },
        include: { candidate: true },
      });
      if (emailRecord?.candidate) {
        candidate = {
          ...emailRecord.candidate,
          email: emailRecord,
        } as any;
      }
    }

    if (!candidate) {
      return NextResponse.json({ error: "Candidato o currículum no encontrado." }, { status: 404 });
    }

    // 2. If resumeFileUrl is an external cloud storage URL (e.g. Supabase Storage / S3), redirect directly
    if (
      candidate.resumeFileUrl &&
      (candidate.resumeFileUrl.startsWith("http://") || candidate.resumeFileUrl.startsWith("https://")) &&
      !candidate.resumeFileUrl.includes("/api/candidates/")
    ) {
      return NextResponse.redirect(candidate.resumeFileUrl);
    }

    // 3. Handle legacy Base64 data URLs if any exist in the database
    if (candidate.resumeFileUrl && candidate.resumeFileUrl.startsWith("data:")) {
      try {
        const matches = candidate.resumeFileUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches && matches[2]) {
          const mimeType = matches[1] || "application/pdf";
          const buffer = Buffer.from(matches[2], "base64");
          return new NextResponse(new Uint8Array(buffer), {
            headers: {
              "Content-Type": mimeType,
              "Content-Disposition": `inline; filename="CV-${encodeURIComponent(candidate.fullName)}.pdf"`,
              "Cache-Control": "public, max-age=86400",
            },
          });
        }
      } catch (err: any) {
        console.warn("[ResumeRoute] Failed to parse legacy base64 data:", err.message);
      }
    }

    // 4. On-demand streaming from Gmail API
    const messageId = candidate.email?.gmailMessageId;
    if (!messageId) {
      // If no Gmail message is associated, generate clean HTML fallback view
      return generateHtmlFallbackResponse(candidate);
    }

    const accountEmail = candidate.accountEmail || candidate.email.accountEmail || undefined;
    const gmail = await getAuthenticatedGmailClient(accountEmail);
    const messageDetails = await getGmailMessageDetails(gmail, messageId);

    if (!messageDetails.attachments || messageDetails.attachments.length === 0) {
      // No attachment on this email; render candidate text summary
      return generateHtmlFallbackResponse(candidate);
    }

    // Priority: find attachment matching email record filename, or CV extension, or first attachment
    const cvExtensions = [".pdf", ".docx", ".doc", ".png", ".jpg", ".jpeg", ".webp"];
    const targetAttachment =
      messageDetails.attachments.find((att) => att.filename === candidate.email.attachmentFilename) ||
      messageDetails.attachments.find((att) =>
        cvExtensions.some((ext) => att.filename.toLowerCase().endsWith(ext))
      ) ||
      messageDetails.attachments[0];

    if (!targetAttachment || !targetAttachment.attachmentId) {
      return generateHtmlFallbackResponse(candidate);
    }

    // Download the attachment binary from Gmail API
    const fileBuffer = await downloadGmailAttachment(
      gmail,
      messageId,
      targetAttachment.attachmentId
    );

    const mimeType = targetAttachment.mimeType || "application/pdf";
    const safeFilename = encodeURIComponent(
      targetAttachment.filename || `CV-${candidate.fullName}.pdf`
    );

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${safeFilename}"`,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error: any) {
    console.error("[ResumeRoute] Error streaming resume:", error);
    return NextResponse.json(
      {
        error: "No se pudo recuperar el archivo del currículum.",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

function generateHtmlFallbackResponse(candidate: any) {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Currículum - ${candidate.fullName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 2.5rem 2rem;
      max-width: 800px;
      margin: 0 auto;
      color: #1e293b;
      line-height: 1.6;
      background: #f8fafc;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 1rem;
      padding: 2.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    h1 {
      margin: 0 0 0.5rem 0;
      color: #0f172a;
      font-size: 1.75rem;
    }
    .badge {
      display: inline-block;
      background: #e0e7ff;
      color: #3730a3;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .meta {
      color: #64748b;
      font-size: 0.9rem;
      margin-top: 0.5rem;
      margin-bottom: 1.5rem;
    }
    .section-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      font-weight: 700;
      margin-top: 1.5rem;
      margin-bottom: 0.5rem;
    }
    .skills-container {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .skill-pill {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 0.5rem;
      padding: 0.2rem 0.6rem;
      font-size: 0.85rem;
    }
    .content-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      padding: 1.25rem;
      white-space: pre-wrap;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85rem;
      color: #334155;
      max-height: 500px;
      overflow-y: auto;
    }
  </style>
</head>
<body>
  <div class="card">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <h1>${candidate.fullName}</h1>
        <div class="meta">
          <strong>Email:</strong> ${candidate.contactEmail || candidate.email?.senderEmail || "No especificado"} &bull;
          <strong>Tel:</strong> ${candidate.phone || "No especificado"} &bull;
          <strong>Ubicación:</strong> ${candidate.location || "Argentina / Remoto"}
        </div>
      </div>
      <span class="badge">${candidate.seniority || "Candidato"} (${candidate.experienceYears || 0} años)</span>
    </div>

    ${
      candidate.skills && candidate.skills.length > 0
        ? `<div class="section-title">Habilidades Detectadas</div>
           <div class="skills-container">
             ${candidate.skills.map((s: string) => `<span class="skill-pill">${s}</span>`).join("")}
           </div>`
        : ""
    }

    <div class="section-title">Texto del Currículum / Postulación</div>
    <div class="content-box">${candidate.resumeText || candidate.email?.bodyText || "Sin contenido de texto disponible."}</div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
