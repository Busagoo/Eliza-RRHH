import { gmail_v1 } from "googleapis";
import { prisma } from "../db";
import { getAuthenticatedGmailClient } from "../gmail/client";
import { listGmailMessages } from "../gmail/service";
import { processSingleEmail } from "./emailProcessor";
import { SyncStatus, EmailStatus } from "@prisma/client";
import { getEnv } from "../env";

export interface BackfillOptions {
  accountId?: string;
  queryFilter?: string;
  reset?: boolean;
  batchSize?: number;
}

export interface BackfillBatchResult {
  status: SyncStatus;
  processedCount: number;
  resumesFound: number;
  discarded: number;
  errors: number;
  nextPageToken: string | null;
  hasMore: boolean;
  syncState?: any;
  message?: string;
}

/**
 * Executes a single bounded batch of Gmail message backfill.
 * Ideal for Serverless (Vercel) execution: takes ~3-5 seconds, avoids timeouts,
 * and maintains atomic progress in PostgreSQL.
 */
export async function processBackfillBatch(options: BackfillOptions = {}): Promise<BackfillBatchResult> {
  const account = await prisma.account.findFirst({
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
  const batchSize = Math.min(20, Math.max(1, options.batchSize || Number(getEnv("BACKFILL_BATCH_SIZE")) || 8));

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

  console.log(`[BackfillBatch] Processing batch (token: ${currentToken ? currentToken.slice(0, 10) + "..." : "START"}, size: ${batchSize})`);

  let listResponse: any;
  try {
    listResponse = await listGmailMessages(gmail, {
      q: queryFilter,
      pageToken: currentToken,
      maxResults: batchSize,
    });
  } catch (apiErr: any) {
    console.error("[BackfillBatch] Gmail listMessages failed:", apiErr.message);
    const updated = await prisma.syncState.update({
      where: { id: syncState.id },
      data: {
        status: SyncStatus.ERROR,
        lastError: apiErr.message,
      },
    });
    return {
      status: SyncStatus.ERROR,
      processedCount: 0,
      resumesFound: 0,
      discarded: 0,
      errors: 1,
      nextPageToken: currentToken || null,
      hasMore: false,
      syncState: updated,
      message: apiErr.message,
    };
  }

  const messages = listResponse.messages || [];
  const nextToken = listResponse.nextPageToken || null;

  if (messages.length === 0) {
    console.log("[BackfillBatch] No more messages found. Marking COMPLETED.");
    const completedState = await prisma.syncState.update({
      where: { id: syncState.id },
      data: {
        status: SyncStatus.COMPLETED,
        nextPageToken: null,
        completedAt: new Date(),
      },
    });

    return {
      status: SyncStatus.COMPLETED,
      processedCount: 0,
      resumesFound: 0,
      discarded: 0,
      errors: 0,
      nextPageToken: null,
      hasMore: false,
      syncState: completedState,
    };
  }

  let resumesInBatch = 0;
  let discardedInBatch = 0;
  let errorsInBatch = 0;
  let processedInBatch = 0;

  // Process emails sequentially to guarantee connection safety and stability
  for (const msgRef of messages) {
    if (!msgRef.id) continue;
    try {
      const res = await processSingleEmail(gmail, msgRef.id);
      processedInBatch++;
      if (res.status === EmailStatus.PROCESSED) {
        resumesInBatch++;
      } else if (res.status === EmailStatus.DISCARDED) {
        discardedInBatch++;
      } else {
        errorsInBatch++;
      }
    } catch (procErr: any) {
      processedInBatch++;
      errorsInBatch++;
      console.error(`[BackfillBatch] Error processing email ${msgRef.id}:`, procErr.message);
    }
  }

  const finalStatus = nextToken ? SyncStatus.RUNNING : SyncStatus.COMPLETED;

  // Single atomic database update for the entire batch
  const updatedState = await prisma.syncState.update({
    where: { id: syncState.id },
    data: {
      totalScanned: { increment: processedInBatch },
      totalResumesFound: { increment: resumesInBatch },
      totalDiscarded: { increment: discardedInBatch },
      totalErrors: { increment: errorsInBatch },
      nextPageToken: nextToken,
      status: finalStatus,
      completedAt: nextToken ? null : new Date(),
      updatedAt: new Date(),
    },
  });

  return {
    status: finalStatus,
    processedCount: processedInBatch,
    resumesFound: resumesInBatch,
    discarded: discardedInBatch,
    errors: errorsInBatch,
    nextPageToken: nextToken,
    hasMore: Boolean(nextToken),
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
