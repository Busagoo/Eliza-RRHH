import { prisma } from "../db";
import { getAuthenticatedGmailClient } from "../gmail/client";
import { fastIngestEmailBatch } from "./fastIngestWorker";
import { processPendingCandidateBatch } from "./candidateBatchProcessor";
import { SyncStatus, EmailStatus } from "@prisma/client";
import { getEnv } from "../env";

export interface BackfillOptions {
  accountId?: string;
  queryFilter?: string;
  reset?: boolean;
  batchSize?: number;
  action?: "batch" | "ingest" | "process" | "process_single";
  targetEmailId?: string;
}

export interface BackfillBatchResult {
  status: SyncStatus;
  processedCount: number;
  resumesFound: number;
  discarded: number;
  errors: number;
  pendingRemaining?: number;
  nextPageToken: string | null;
  hasMore: boolean;
  syncState?: any;
  message?: string;
}

/**
 * Executes Two-Phase Email Ingest & Candidate Processing:
 * Phase 1: Rapid Gmail email & attachment ingestion without AI (takes ~1-2s).
 * Phase 2: Controlled Candidate AI analysis with OCR and multi-domain parsing (takes ~3-4s).
 * Safely runs within Vercel's serverless limits without dropping connections or hitting rate limits.
 */
export async function processBackfillBatch(options: BackfillOptions = {}): Promise<BackfillBatchResult> {
  const account = options.accountId
    ? await prisma.account.findUnique({ where: { id: options.accountId } })
    : await prisma.account.findFirst({
        orderBy: { updatedAt: "desc" },
      });

  const accountId = options.accountId || account?.id;
  if (!account) {
    return {
      status: SyncStatus.IDLE,
      processedCount: 0,
      resumesFound: 0,
      discarded: 0,
      errors: 0,
      nextPageToken: null,
      hasMore: false,
      message: "No hay cuenta de Gmail conectada",
    };
  }

  const envQuery = getEnv("BACKFILL_QUERY");
  const defaultQuery = envQuery !== undefined && envQuery !== "" ? envQuery : "in:inbox";
  const queryFilter = options.queryFilter || defaultQuery;
  const action = options.action || "batch";

  // Find or create active SyncState
  let syncState = await prisma.syncState.findFirst({
    where: accountId ? { accountId } : undefined,
    orderBy: { createdAt: "desc" },
  });

  if (!syncState || options.reset) {
    syncState = await prisma.syncState.create({
      data: {
        accountId,
        status: SyncStatus.RUNNING,
        queryFilter,
        nextPageToken: null,
        startedAt: new Date(),
        totalScanned: 0,
        totalResumesFound: 0,
        totalDiscarded: 0,
        totalErrors: 0,
      },
    });
  } else if (syncState.status === SyncStatus.PAUSED && !options.reset) {
    return {
      status: SyncStatus.PAUSED,
      processedCount: 0,
      resumesFound: 0,
      discarded: 0,
      errors: 0,
      nextPageToken: syncState.nextPageToken,
      hasMore: Boolean(syncState.nextPageToken),
      syncState,
      message: "Sincronización en pausa",
    };
  } else if (syncState.status !== SyncStatus.RUNNING) {
    syncState = await prisma.syncState.update({
      where: { id: syncState.id },
      data: {
        status: SyncStatus.RUNNING,
        lastError: null,
      },
    });
  }

  const gmail = await getAuthenticatedGmailClient();
  const currentToken = options.reset ? undefined : (syncState.nextPageToken || undefined);

  let ingestedInBatch = 0;
  let discardedInBatch = 0;
  let candidatesCreatedInBatch = 0;
  let errorsInBatch = 0;
  let nextToken = currentToken || null;
  let hasMorePages = Boolean(currentToken);

  // ---------------------------------------------------------------------------
  // PHASE 1: Fast Email Ingestion (No AI, zero timeout risk)
  // ---------------------------------------------------------------------------
  if (action === "batch" || action === "ingest") {
    try {
      const ingestResult = await fastIngestEmailBatch(gmail, {
        accountId,
        accountEmail: account.email,
        queryFilter,
        pageToken: currentToken,
        batchSize: options.batchSize || 15,
      });

      ingestedInBatch = ingestResult.ingestedCount;
      discardedInBatch = ingestResult.discardedCount;
      nextToken = ingestResult.nextPageToken;
      hasMorePages = ingestResult.hasMore;
    } catch (ingestErr: any) {
      console.error("[Backfill] Fast ingest failed:", ingestErr.message);
      errorsInBatch++;
    }
  }

  // ---------------------------------------------------------------------------
  // PHASE 2: Candidate AI Processing (OCR for PNG/JPG + Multi-domain LLM)
  // ---------------------------------------------------------------------------
  let pendingRemaining = 0;
  if (action === "batch" || action === "process" || action === "process_single") {
    try {
      const procResult = await processPendingCandidateBatch(gmail, {
        accountEmail: account.email,
        batchSize: 3, // Safe bounded batch for LLM & Vercel
        targetEmailId: options.targetEmailId,
      });

      candidatesCreatedInBatch = procResult.candidatesFound;
      errorsInBatch += procResult.errors;
      pendingRemaining = procResult.pendingRemaining;
    } catch (procErr: any) {
      console.error("[Backfill] Candidate processor failed:", procErr.message);
      errorsInBatch++;
    }
  }

  let finalStatus = syncState.status;
  if (action === "ingest" || action === "batch") {
    finalStatus = hasMorePages ? SyncStatus.RUNNING : SyncStatus.COMPLETED;
  } else if (action === "process" || action === "process_single") {
    if (!hasMorePages && pendingRemaining === 0) {
      finalStatus = SyncStatus.COMPLETED;
    }
  }

  // Single atomic database update for progress
  const updatedState = await prisma.syncState.update({
    where: { id: syncState.id },
    data: {
      totalScanned: { increment: ingestedInBatch },
      totalResumesFound: { increment: candidatesCreatedInBatch },
      totalDiscarded: { increment: discardedInBatch },
      totalErrors: { increment: errorsInBatch },
      nextPageToken: nextToken,
      status: finalStatus,
      completedAt: finalStatus === SyncStatus.COMPLETED ? new Date() : null,
      updatedAt: new Date(),
    },
  });

  const hasMoreWork =
    action === "ingest" ? hasMorePages : action === "process" ? pendingRemaining > 0 : hasMorePages || pendingRemaining > 0;

  return {
    status: finalStatus,
    processedCount: ingestedInBatch + candidatesCreatedInBatch,
    resumesFound: candidatesCreatedInBatch,
    discarded: discardedInBatch,
    errors: errorsInBatch,
    pendingRemaining,
    nextPageToken: nextToken,
    hasMore: hasMoreWork,
    syncState: updatedState,
  };
}

/**
 * Compatibility wrapper for historical backfill
 */
export async function runHistoricalBackfill(options: BackfillOptions = {}) {
  try {
    const result = await processBackfillBatch(options);
    return {
      status: result.status === SyncStatus.RUNNING ? "started" : "completed",
      result,
    };
  } catch (err: any) {
    console.error("[BackfillWorker] Run error:", err);
    return { status: "error", error: err.message };
  }
}

/**
 * Pauses an ongoing backfill worker
 */
export async function pauseBackfillWorker(syncStateId?: string) {
  if (syncStateId) {
    return prisma.syncState.update({
      where: { id: syncStateId },
      data: { status: SyncStatus.PAUSED },
    });
  }

  return prisma.syncState.updateMany({
    where: { status: SyncStatus.RUNNING },
    data: { status: SyncStatus.PAUSED },
  });
}
