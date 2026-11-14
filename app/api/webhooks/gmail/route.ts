import { NextRequest, NextResponse } from "next/server";
import { parsePubSubNotification, fetchNewMessagesFromHistory } from "@/lib/gmail/push";
import { getAuthenticatedGmailClient } from "@/lib/gmail/client";
import { processSingleEmail } from "@/lib/workers/emailProcessor";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Webhook handler for Google Cloud Pub/Sub real-time push notifications.
 * Triggered whenever a new message arrives in the connected Gmail mailbox.
 */
export async function POST(req: NextRequest) {
  try {
    // Optional webhook verification token
    const token = req.nextUrl.searchParams.get("token");
    if (process.env.WEBHOOK_SECRET && token && token !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized webhook caller" }, { status: 401 });
    }

    const body = await req.json();
    const payload = parsePubSubNotification(body);

    if (!payload) {
      // Return 200 to acknowledge invalid format so Pub/Sub doesn't retry infinitely
      return NextResponse.json({ received: false, reason: "Malformed or empty Pub/Sub message" }, { status: 200 });
    }

    console.log(`[GmailWebhook] Real-time push received for ${payload.emailAddress}, historyId: ${payload.historyId}`);

    // Retrieve last saved historyId from SyncState
    const syncState = await prisma.syncState.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    const startHistoryId = syncState?.lastHistoryId || payload.historyId;

    // Get authenticated Gmail client
    const gmail = await getAuthenticatedGmailClient(payload.emailAddress);

    // Query changes since startHistoryId
    const { messageIds, latestHistoryId } = await fetchNewMessagesFromHistory(gmail, startHistoryId);

    // Update lastHistoryId
    if (syncState && latestHistoryId) {
      await prisma.syncState.update({
        where: { id: syncState.id },
        data: {
          lastHistoryId: String(latestHistoryId),
          updatedAt: new Date(),
        },
      });
    }

    console.log(`[GmailWebhook] Found ${messageIds.length} new messages to process in real time`);

    // Process new messages asynchronously so webhook can acknowledge immediately
    (async () => {
      for (const msgId of messageIds) {
        try {
          console.log(`[GmailWebhook] Processing new incoming message: ${msgId}`);
          await processSingleEmail(gmail, msgId);
        } catch (procErr: any) {
          console.error(`[GmailWebhook] Error processing real-time message ${msgId}:`, procErr);
        }
      }
    })();

    return NextResponse.json({
      success: true,
      messagesDispatched: messageIds.length,
      historyId: latestHistoryId || payload.historyId,
    });
  } catch (err: any) {
    console.error("[GmailWebhook] Error in webhook handling:", err);
    // Returning 200 prevents Pub/Sub retry floods on application level exceptions
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 200 }
    );
  }
}
