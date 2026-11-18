import { gmail_v1 } from "googleapis";
import { prisma } from "../db";
import { processSingleEmail } from "./emailProcessor";
import { EmailStatus } from "@prisma/client";

export interface CandidateBatchResult {
  processedCount: number;
  candidatesFound: number;
  errors: number;
  pendingRemaining: number;
}

/**
 * PHASE 2: Candidate Processor Worker
 * Takes pending emails from the database, extracts attachments (PDF, DOCX, or PNG/JPG via OCR),
 * calls the AI model to parse the candidate profile, and generates embeddings.
 * Operates in small batches with rate-limit pacing to avoid timeouts and token errors.
 */
export async function processPendingCandidateBatch(
  gmail: gmail_v1.Gmail,
  options: {
    accountEmail?: string;
    batchSize?: number;
    targetEmailId?: string;
  } = {}
): Promise<CandidateBatchResult> {
  const batchSize = Math.min(5, Math.max(1, options.batchSize || 3));

  let pendingEmails: any[] = [];

  if (options.targetEmailId) {
    // Single email prioritized analysis
    const target = await prisma.email.findUnique({
      where: { id: options.targetEmailId },
      include: { candidate: true },
    });
    if (target && (!target.candidate || target.status === EmailStatus.PENDING || target.status === EmailStatus.ERROR)) {
      pendingEmails = [target];
    }
  } else {
    // Batch analysis of pending emails
    pendingEmails = await prisma.email.findMany({
      where: {
        status: { in: [EmailStatus.PENDING, EmailStatus.PROCESSING] },
        accountEmail: options.accountEmail || undefined,
        isDismissed: false,
      },
      orderBy: { receivedAt: "desc" },
      take: batchSize,
    });
  }

  if (pendingEmails.length === 0) {
    const remaining = await prisma.email.count({
      where: {
        status: { in: [EmailStatus.PENDING, EmailStatus.PROCESSING] },
        accountEmail: options.accountEmail || undefined,
        isDismissed: false,
      },
    });
    return {
      processedCount: 0,
      candidatesFound: 0,
      errors: 0,
      pendingRemaining: remaining,
    };
  }

  let candidatesFound = 0;
  let errors = 0;
  let processedCount = 0;

  for (const email of pendingEmails) {
    try {
      console.log(`[CandidateProcessor] Processing pending email ${email.gmailMessageId} (${email.subject})...`);
      const res = await processSingleEmail(gmail, email.gmailMessageId, undefined, email.accountEmail || undefined);
      processedCount++;

      if (res.status === EmailStatus.PROCESSED) {
        candidatesFound++;
      } else if (res.status === EmailStatus.ERROR) {
        errors++;
      }

      // Small pacing delay to prevent Groq API rate limits
      await new Promise((r) => setTimeout(r, 400));
    } catch (err: any) {
      processedCount++;
      errors++;
      console.error(`[CandidateProcessor] Error processing email ${email.id}:`, err.message);

      await prisma.email.update({
        where: { id: email.id },
        data: {
          status: EmailStatus.ERROR,
          errorMessage: err.message || "Error during candidate extraction",
        },
      });
    }
  }

  const pendingRemaining = await prisma.email.count({
    where: {
      status: { in: [EmailStatus.PENDING, EmailStatus.PROCESSING] },
      accountEmail: options.accountEmail || undefined,
      isDismissed: false,
    },
  });

  return {
    processedCount,
    candidatesFound,
    errors,
    pendingRemaining,
  };
}
