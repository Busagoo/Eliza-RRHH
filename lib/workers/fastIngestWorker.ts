import { gmail_v1 } from "googleapis";
import { prisma } from "../db";
import { getGmailMessageDetails, listGmailMessages } from "../gmail/service";
import { EmailStatus, SyncStatus } from "@prisma/client";

export interface FastIngestBatchResult {
  status: SyncStatus;
  ingestedCount: number;
  pendingCount: number;
  discardedCount: number;
  nextPageToken: string | null;
  hasMore: boolean;
  message?: string;
}

const CV_EXTENSIONS = [".pdf", ".docx", ".doc", ".png", ".jpg", ".jpeg", ".webp"];

const SPAM_KEYWORDS = [
  "newsletter",
  "security alert",
  "alerta de seguridad",
  "verify your email",
  "código de verificación",
  "verification code",
  "tu código de",
  "uber receipts",
  "recibo de uber",
  "notificación de inicio de sesión",
  "sign-in attempt",
  "promoción",
  "ofertas de la semana",
];

/**
 * PHASE 1: Fast Email Ingestion Worker
 * Rapidly fetches and registers emails and attachments into the database WITHOUT calling AI.
 * Completes within 2-4 seconds, eliminating timeouts and token consumption.
 */
export async function fastIngestEmailBatch(
  gmail: gmail_v1.Gmail,
  options: {
    accountId?: string;
    accountEmail?: string;
    queryFilter?: string;
    pageToken?: string;
    batchSize?: number;
  }
): Promise<FastIngestBatchResult> {
  const query = options.queryFilter || "in:inbox";
  const batchSize = Math.min(30, Math.max(5, options.batchSize || 15));

  console.log(`[FastIngest] Fetching page of Gmail messages (size: ${batchSize})...`);
  const listRes = await listGmailMessages(gmail, {
    q: query,
    pageToken: options.pageToken,
    maxResults: batchSize,
  });

  const messages = listRes.messages || [];
  const nextPageToken = listRes.nextPageToken || null;

  if (messages.length === 0) {
    return {
      status: SyncStatus.COMPLETED,
      ingestedCount: 0,
      pendingCount: 0,
      discardedCount: 0,
      nextPageToken: null,
      hasMore: false,
    };
  }

  let ingestedCount = 0;
  let pendingCount = 0;
  let discardedCount = 0;

  for (const msgRef of messages) {
    if (!msgRef.id) continue;

    // Check if email already registered in DB
    const existing = await prisma.email.findUnique({
      where: { gmailMessageId: msgRef.id },
      select: { id: true, status: true },
    });

    if (existing) {
      ingestedCount++;
      if (existing.status === EmailStatus.PENDING) pendingCount++;
      if (existing.status === EmailStatus.DISCARDED) discardedCount++;
      continue;
    }

    try {
      const details = await getGmailMessageDetails(gmail, msgRef.id);
      const effectiveAccountEmail = options.accountEmail || details.recipient || undefined;

      // Check for CV attachments (PDF, DOCX, PNG, JPG, JPEG)
      const primaryAttachment =
        details.attachments.find((att) =>
          CV_EXTENSIONS.some((ext) => att.filename.toLowerCase().endsWith(ext))
        ) || details.attachments[0];

      const hasCvAttachment =
        Boolean(primaryAttachment) &&
        CV_EXTENSIONS.some((ext) => primaryAttachment.filename.toLowerCase().endsWith(ext));

      // Fast triage without AI
      const subjectLower = (details.subject || "").toLowerCase();
      const snippetLower = (details.snippet || "").toLowerCase();
      const isSpamSender = SPAM_KEYWORDS.some(
        (kw) => subjectLower.includes(kw) || snippetLower.includes(kw)
      );

      let initialStatus: EmailStatus = EmailStatus.PENDING;
      let discardReason: string | null = null;

      if (!hasCvAttachment && isSpamSender) {
        initialStatus = EmailStatus.DISCARDED;
        discardReason = "Notificación automática o boletín sin currículum adjunto.";
        discardedCount++;
      } else if (!hasCvAttachment && details.attachments.length === 0 && details.bodyText.length < 40) {
        initialStatus = EmailStatus.DISCARDED;
        discardReason = "Correo breve sin archivo adjunto ni datos de postulación.";
        discardedCount++;
      } else {
        // Candidate email ready for AI processing
        initialStatus = EmailStatus.PENDING;
        pendingCount++;
      }

      await prisma.email.create({
        data: {
          gmailMessageId: msgRef.id,
          gmailThreadId: details.threadId,
          accountEmail: effectiveAccountEmail,
          sender: details.sender,
          senderEmail: details.senderEmail,
          senderName: details.senderName,
          recipient: details.recipient,
          subject: details.subject,
          snippet: details.snippet,
          bodyText: details.bodyText,
          receivedAt: details.receivedAt,
          status: initialStatus,
          hasAttachment: details.attachments.length > 0,
          attachmentFilename: primaryAttachment?.filename,
          attachmentMimeType: primaryAttachment?.mimeType,
          attachmentSize: primaryAttachment?.size,
          discardReason,
        },
      });

      ingestedCount++;
    } catch (msgErr: any) {
      console.warn(`[FastIngest] Failed to ingest message ${msgRef.id}:`, msgErr.message);
    }
  }

  return {
    status: nextPageToken ? SyncStatus.RUNNING : SyncStatus.COMPLETED,
    ingestedCount,
    pendingCount,
    discardedCount,
    nextPageToken,
    hasMore: Boolean(nextPageToken),
  };
}
