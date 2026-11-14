import { gmail_v1 } from "googleapis";

export interface ExtractedAttachmentMeta {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface ParsedGmailMessage {
  id: string;
  threadId: string;
  sender: string;
  senderEmail: string;
  senderName: string;
  recipient: string;
  subject: string;
  snippet: string;
  bodyText: string;
  receivedAt: Date;
  attachments: ExtractedAttachmentMeta[];
}

/**
 * Lists messages from Gmail with optional query and pageToken
 */
export async function listGmailMessages(
  gmail: gmail_v1.Gmail,
  options: {
    q?: string;
    pageToken?: string;
    maxResults?: number;
  }
) {
  const res = await gmail.users.messages.list({
    userId: "me",
    q: options.q,
    pageToken: options.pageToken,
    maxResults: options.maxResults || 20,
    includeSpamTrash: false,
  });

  return {
    messages: res.data.messages || [],
    nextPageToken: res.data.nextPageToken || null,
    resultSizeEstimate: res.data.resultSizeEstimate || 0,
  };
}

/**
 * Fetches full message payload and parses headers, body, and attachments
 */
export async function getGmailMessageDetails(
  gmail: gmail_v1.Gmail,
  messageId: string
): Promise<ParsedGmailMessage> {
  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const msg = res.data;
  const headers = msg.payload?.headers || [];

  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

  const subject = getHeader("Subject") || "Sin Asunto";
  const fromRaw = getHeader("From") || "Desconocido";
  const to = getHeader("To") || "";
  const dateRaw = getHeader("Date");
  const receivedAt = dateRaw ? new Date(dateRaw) : new Date(Number(msg.internalDate || Date.now()));

  // Parse sender name & email
  const emailMatch = fromRaw.match(/<([^>]+)>/);
  const senderEmail = emailMatch ? emailMatch[1].trim() : fromRaw.trim();
  const senderName = fromRaw.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || senderEmail;

  // Extract body and attachments recursively from MIME tree
  const attachments: ExtractedAttachmentMeta[] = [];
  const bodyTexts: string[] = [];

  function traverseParts(part: gmail_v1.Schema$MessagePart) {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        size: part.body.size || 0,
      });
    }

    if (part.mimeType === "text/plain" && part.body?.data) {
      const decoded = Buffer.from(part.body.data, "base64url").toString("utf-8");
      bodyTexts.push(decoded);
    }

    if (part.parts && part.parts.length > 0) {
      for (const subPart of part.parts) {
        traverseParts(subPart);
      }
    }
  }

  if (msg.payload) {
    traverseParts(msg.payload);
  }

  return {
    id: msg.id!,
    threadId: msg.threadId || msg.id!,
    sender: fromRaw,
    senderEmail,
    senderName,
    recipient: to,
    subject,
    snippet: msg.snippet || "",
    bodyText: bodyTexts.join("\n\n").trim(),
    receivedAt,
    attachments,
  };
}

/**
 * Downloads binary attachment data from Gmail
 */
export async function downloadGmailAttachment(
  gmail: gmail_v1.Gmail,
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  const res = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  });

  const base64Data = res.data.data;
  if (!base64Data) {
    throw new Error(`Attachment ${attachmentId} in message ${messageId} returned empty data`);
  }

  return Buffer.from(base64Data, "base64url");
}
