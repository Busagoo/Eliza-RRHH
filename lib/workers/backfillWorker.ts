import { gmail_v1 } from "googleapis";
import { prisma } from "../db";
import { getAuthenticatedGmailClient } from "../gmail/client";
import { listGmailMessages } from "../gmail/service";
import { processSingleEmail } from "./emailProcessor";
import { SyncStatus, EmailStatus } from "@prisma/client";
import { getEnv } from "../env";

// In-memory lock to prevent duplicate worker executions per node process
const activeWorkers = new Set<string>();

export interface BackfillOptions {
  accountId?: string;
  queryFilter?: string;
  reset?: boolean;
  batchSize?: number;
  delayMs?: number;
}

/**
 * Executes or resumes the historical Gmail backfill worker.
 * Runs paginated scans, saves progress in SyncState, and handles rate limits.
 */
export async function runHistoricalBackfill(options: BackfillOptions = {}) {
  const account = await prisma.account.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  const accountId = options.accountId || account?.id;
  const workerKey = accountId || "default";

  if (activeWorkers.has(workerKey)) {
    console.log(`[BackfillWorker] Worker already running for ${workerKey}`);
    return { status: "already_running" };
  }

  activeWorkers.add(workerKey);

  // Run asynchronously without blocking HTTP request
  (async () => {
    try {
      await executeBackfillLoop(accountId, options);
    } catch (err: any) {
      console.error("[BackfillWorker] Unhandled worker failure:", err);
    } finally {
      activeWorkers.delete(workerKey);
    }
  })();

  return { status: "started" };
}

/**
 * Core loop iterating through Gmail history with nextPageToken
 */
async function executeBackfillLoop(accountId?: string, options: BackfillOptions = {}) {
  const gmail = await getAuthenticatedGmailClient();

  // Find or create active SyncState
  let syncState = await prisma.syncState.findFirst({
    where: accountId ? { accountId } : undefined,
    orderBy: { createdAt: "desc" },
  });

  const envQuery = getEnv("BACKFILL_QUERY");
  const defaultQuery = envQuery !== undefined && envQuery !== "" ? envQuery : "in:inbox";

  const queryFilter = options.queryFilter || syncState?.queryFilter || defaultQuery;
  const batchSize = options.batchSize || Number(getEnv("BACKFILL_BATCH_SIZE")) || 15;
  const delayMs = options.delayMs || Number(getEnv("BACKFILL_DELAY_MS")) || 600;

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
  } else {
    syncState = await prisma.syncState.update({
      where: { id: syncState.id },
      data: {
        status: SyncStatus.RUNNING,
        lastError: null,
        startedAt: syncState.startedAt || new Date(),
      },
    });
  }

  console.log(`[BackfillWorker] Starting sync with query: "${queryFilter}"`);

  // ALWAYS PRIORITIZE: Check and process the newest emails first (Page 1 without token)
  try {
    console.log("[BackfillWorker] Checking for newest incoming emails at top of inbox...");
    const topMessages = await listGmailMessages(gmail, {
      q: queryFilter,
      maxResults: 15,
    });

    if (topMessages.messages && topMessages.messages.length > 0) {
      for (const msgRef of topMessages.messages) {
        if (!msgRef.id) continue;
        try {
          await processSingleEmail(gmail, msgRef.id);
        } catch (topErr: any) {
          console.warn(`[BackfillWorker] Error processing top message ${msgRef.id}:`, topErr.message);
        }
      }
    }
  } catch (err: any) {
    console.warn("[BackfillWorker] Could not pre-fetch newest top messages:", err.message);
  }

  let currentToken = options.reset ? undefined : (syncState.nextPageToken || undefined);
  let hasMore = true;
  let retryCount = 0;
  const maxRetries = 5;

  while (hasMore) {
    // Check if worker was paused externally
    const refreshedState = await prisma.syncState.findUnique({
      where: { id: syncState.id },
      select: { status: true },
    });

    if (refreshedState?.status === SyncStatus.PAUSED) {
      console.log("[BackfillWorker] Sync paused by user/system signal");
      break;
    }

    try {
      console.log(`[BackfillWorker] Fetching page (token: ${currentToken ? currentToken.slice(0, 10) + "..." : "START"})`);

      const listResponse = await listGmailMessages(gmail, {
        q: queryFilter,
        pageToken: currentToken,
        maxResults: batchSize,
      });

      const messages = listResponse.messages;
      const nextToken = listResponse.nextPageToken || null;

      if (!messages || messages.length === 0) {
        console.log("[BackfillWorker] No further messages found in query.");
        hasMore = false;
        break;
      }

      // Process batch of messages concurrently in chunks of 5 to respect quotas
      const chunkSize = 5;
      for (let i = 0; i < messages.length; i += chunkSize) {
        const chunk = messages.slice(i, i + chunkSize);

        await Promise.allSettled(
          chunk.map(async (msgRef) => {
            if (!msgRef.id) return;

            try {
              const res = await processSingleEmail(gmail, msgRef.id);

              if (res.status === EmailStatus.PROCESSED) {
                await prisma.syncState.update({
                  where: { id: syncState!.id },
                  data: {
                    totalScanned: { increment: 1 },
                    totalResumesFound: { increment: 1 },
                  },
                });
              } else if (res.status === EmailStatus.DISCARDED) {
                await prisma.syncState.update({
                  where: { id: syncState!.id },
                  data: {
                    totalScanned: { increment: 1 },
                    totalDiscarded: { increment: 1 },
                  },
                });
              } else {
                await prisma.syncState.update({
                  where: { id: syncState!.id },
                  data: {
                    totalScanned: { increment: 1 },
                    totalErrors: { increment: 1 },
                  },
                });
              }
            } catch (procErr: any) {
              console.error(`[BackfillWorker] Error processing message ${msgRef.id}:`, procErr.message);
              await prisma.syncState.update({
                where: { id: syncState!.id },
                data: {
                  totalScanned: { increment: 1 },
                  totalErrors: { increment: 1 },
                  lastError: procErr.message,
                },
              });
            }
          })
        );

        // Inter-chunk throttle delay
        if (delayMs > 0) {
          await sleep(delayMs);
        }
      }

      // Persist pagination progress in SyncState
      currentToken = nextToken || undefined;
      await prisma.syncState.update({
        where: { id: syncState.id },
        data: {
          nextPageToken: nextToken,
          updatedAt: new Date(),
        },
      });

      retryCount = 0; // reset retry counter after successful batch

      if (!nextToken) {
        console.log("[BackfillWorker] Reached the end of Gmail history!");
        hasMore = false;
        break;
      }
    } catch (apiError: any) {
      console.error("[BackfillWorker] Gmail API error:", apiError?.message || apiError);

      // Handle Rate Limiting (429 or quotaExceeded) with exponential backoff
      const isRateLimit =
        apiError?.code === 429 ||
        apiError?.status === 429 ||
        apiError?.message?.includes("quotaExceeded") ||
        apiError?.message?.includes("Rate Limit Exceeded");

      if (isRateLimit && retryCount < maxRetries) {
        retryCount++;
        const backoffMs = Math.pow(2, retryCount) * 2000;
        console.warn(`[BackfillWorker] Rate limit hit. Backing off for ${backoffMs}ms (retry ${retryCount}/${maxRetries})...`);
        await sleep(backoffMs);
        continue;
      }

      // Record error and pause worker so it can be resumed exactly from currentToken
      await prisma.syncState.update({
        where: { id: syncState.id },
        data: {
          status: SyncStatus.ERROR,
          lastError: apiError.message || "Gmail API query failure",
        },
      });
      return;
    }
  }

  // Backfill complete
  if (!hasMore) {
    await prisma.syncState.update({
      where: { id: syncState.id },
      data: {
        status: SyncStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
    console.log("[BackfillWorker] Completed full historical backfill successfully!");
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
