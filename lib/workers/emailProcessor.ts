import { gmail_v1 } from "googleapis";
import { prisma } from "../db";
import {
  getGmailMessageDetails,
  downloadGmailAttachment,
  ParsedGmailMessage,
} from "../gmail/service";
import { classifyEmailForResume } from "../ai/classifier";
import { parseResumeText } from "../ai/parser";
import {
  generateEmbedding,
  buildCandidateEmbeddingText,
  formatVectorForPg,
} from "../ai/embeddings";
import { extractTextFromDocument } from "../parser/document";
import { uploadResume } from "../storage";
import { EmailStatus } from "@prisma/client";

export interface ProcessEmailResult {
  messageId: string;
  status: EmailStatus;
  isResume: boolean;
  candidateId?: string;
  error?: string;
}

/**
 * Executes the full end-to-end processing pipeline for a single Gmail message:
 * 1. Metadata extraction & deduplication
 * 2. Step 1: Fast triage classification
 * 3. Step 2: Attachment download, permanent storage upload, text extraction
 * 4. Step 3: LLM structured profile extraction (JSON schema)
 * 5. Step 4: 1536-dim vector embedding generation and Candidate persistence
 */
export async function processSingleEmail(
  gmail: gmail_v1.Gmail,
  messageId: string,
  preloadedDetails?: ParsedGmailMessage
): Promise<ProcessEmailResult> {
  // 1. Check if email already processed or dismissed
  const existingEmail = await prisma.email.findUnique({
    where: { gmailMessageId: messageId },
    include: { candidate: true },
  });

  if (existingEmail) {
    if (existingEmail.isDismissed) {
      return {
        messageId,
        status: existingEmail.status,
        isResume: existingEmail.status === EmailStatus.PROCESSED,
      };
    }

    if (existingEmail.status === EmailStatus.PROCESSED && existingEmail.candidate) {
      return {
        messageId,
        status: EmailStatus.PROCESSED,
        isResume: true,
        candidateId: existingEmail.candidate.id,
      };
    }

    if (existingEmail.status === EmailStatus.DISCARDED) {
      return {
        messageId,
        status: EmailStatus.DISCARDED,
        isResume: false,
      };
    }
  }

  // 2. Fetch full message details
  const details = preloadedDetails || (await getGmailMessageDetails(gmail, messageId));

  // Determine primary CV attachment if available
  const cvExtensions = [".pdf", ".docx", ".doc"];
  const primaryAttachment =
    details.attachments.find((att) =>
      cvExtensions.some((ext) => att.filename.toLowerCase().endsWith(ext))
    ) || details.attachments[0];

  // Upsert initial Email record with status PROCESSING
  const emailRecord = await prisma.email.upsert({
    where: { gmailMessageId: messageId },
    create: {
      gmailMessageId: messageId,
      gmailThreadId: details.threadId,
      sender: details.sender,
      senderEmail: details.senderEmail,
      senderName: details.senderName,
      recipient: details.recipient,
      subject: details.subject,
      snippet: details.snippet,
      bodyText: details.bodyText,
      receivedAt: details.receivedAt,
      status: EmailStatus.PROCESSING,
      hasAttachment: details.attachments.length > 0,
      attachmentFilename: primaryAttachment?.filename,
      attachmentMimeType: primaryAttachment?.mimeType,
      attachmentSize: primaryAttachment?.size,
    },
    update: {
      status: EmailStatus.PROCESSING,
    },
  });

  try {
    // -------------------------------------------------------------------------
    // STEP 1: FAST CLASSIFIER (Economical LLM / Heuristic)
    // -------------------------------------------------------------------------
    const classification = await classifyEmailForResume({
      subject: details.subject,
      sender: details.sender,
      snippet: details.snippet,
      bodyPreview: details.bodyText,
      attachmentName: primaryAttachment?.filename,
      hasAttachment: details.attachments.length > 0,
    });

    if (!classification.isResume) {
      await prisma.email.update({
        where: { id: emailRecord.id },
        data: {
          status: EmailStatus.DISCARDED,
          discardReason: classification.reason,
        },
      });

      return {
        messageId,
        status: EmailStatus.DISCARDED,
        isResume: false,
      };
    }

    // -------------------------------------------------------------------------
    // STEP 2: ATTACHMENT EXTRACTION & STORAGE UPLOAD
    // -------------------------------------------------------------------------
    let resumeText = "";
    let resumeFileUrl: string | null = null;

    if (primaryAttachment) {
      try {
        const fileBuffer = await downloadGmailAttachment(
          gmail,
          messageId,
          primaryAttachment.attachmentId
        );

        // Upload to S3 / Cloudflare R2 / Local Storage for permanent access
        resumeFileUrl = await uploadResume(
          fileBuffer,
          primaryAttachment.filename,
          primaryAttachment.mimeType
        );

        // Extract plain text from PDF or DOCX
        resumeText = await extractTextFromDocument(
          fileBuffer,
          primaryAttachment.filename,
          primaryAttachment.mimeType
        );
      } catch (attErr: any) {
        console.warn(`[EmailProcessor] Failed to download or parse attachment for ${messageId}:`, attErr.message);
      }
    }

    // Fallback: If no attachment text, use email body
    if (!resumeText || resumeText.length < 50) {
      resumeText = details.bodyText || details.snippet || "Sin texto extraído.";
    }

    // -------------------------------------------------------------------------
    // STEP 3: STRUCTURED RESUME PARSING (JSON Schema via LLM)
    // -------------------------------------------------------------------------
    const parsedProfile = await parseResumeText(resumeText, {
      sender: details.sender,
      subject: details.subject,
      senderEmail: details.senderEmail,
    });

    // -------------------------------------------------------------------------
    // STEP 4: VECTOR EMBEDDING GENERATION
    // -------------------------------------------------------------------------
    const embeddingText = buildCandidateEmbeddingText({
      fullName: parsedProfile.fullName,
      seniority: parsedProfile.seniority,
      experienceYears: parsedProfile.yearsOfExperience,
      skills: parsedProfile.skills,
      languages: parsedProfile.languages,
      location: parsedProfile.location,
      summary: parsedProfile.summary,
      workHistory: parsedProfile.workHistory,
    });

    const vector = await generateEmbedding(embeddingText);

    // -------------------------------------------------------------------------
    // STEP 5: PERSIST CANDIDATE & UPDATE EMAIL
    // Preserves original receivedAt date (e.g. 2024)
    // -------------------------------------------------------------------------
    const candidate = await prisma.candidate.upsert({
      where: { emailId: emailRecord.id },
      create: {
        emailId: emailRecord.id,
        fullName: parsedProfile.fullName,
        contactEmail: parsedProfile.contactEmail || details.senderEmail,
        phone: parsedProfile.phone,
        location: parsedProfile.location,
        seniority: parsedProfile.seniority,
        experienceYears: parsedProfile.yearsOfExperience,
        skills: parsedProfile.skills,
        languages: parsedProfile.languages as any,
        parsedData: parsedProfile as any,
        resumeFileUrl,
        resumeText: resumeText.slice(0, 10000),
        receivedAt: details.receivedAt, // PRESERVES HISTORICAL DATE
      },
      update: {
        fullName: parsedProfile.fullName,
        contactEmail: parsedProfile.contactEmail || details.senderEmail,
        phone: parsedProfile.phone,
        location: parsedProfile.location,
        seniority: parsedProfile.seniority,
        experienceYears: parsedProfile.yearsOfExperience,
        skills: parsedProfile.skills,
        languages: parsedProfile.languages as any,
        parsedData: parsedProfile as any,
        resumeFileUrl: resumeFileUrl || undefined,
        resumeText: resumeText.slice(0, 10000),
      },
    });

    // Save pgvector embedding using raw SQL
    try {
      if (vector && vector.length === 1536) {
        const vectorSql = formatVectorForPg(vector);
        await prisma.$executeRawUnsafe(
          `UPDATE candidates SET embedding = $1::vector WHERE id = $2`,
          vectorSql,
          candidate.id
        );
      }
    } catch (vectorErr: any) {
      console.warn(
        `[EmailProcessor] pgvector column not yet activated in DB, saved candidate without vector: ${vectorErr.message}`
      );
    }

    // Mark email as PROCESSED
    await prisma.email.update({
      where: { id: emailRecord.id },
      data: {
        status: EmailStatus.PROCESSED,
      },
    });

    return {
      messageId,
      status: EmailStatus.PROCESSED,
      isResume: true,
      candidateId: candidate.id,
    };
  } catch (err: any) {
    console.error(`[EmailProcessor] Pipeline error on message ${messageId}:`, err);

    await prisma.email.update({
      where: { id: emailRecord.id },
      data: {
        status: EmailStatus.ERROR,
        errorMessage: err.message || "Unknown error during email processing",
      },
    });

    return {
      messageId,
      status: EmailStatus.ERROR,
      isResume: false,
      error: err.message,
    };
  }
}
