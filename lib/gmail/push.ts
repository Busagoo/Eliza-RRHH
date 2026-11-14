import { gmail_v1 } from "googleapis";

export interface PubSubNotificationPayload {
  emailAddress: string;
  historyId: string;
}

/**
 * Registers Gmail push notifications to a Google Cloud Pub/Sub topic
 */
export async function setupGmailWatch(gmail: gmail_v1.Gmail, topicName: string) {
  const res = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName,
      labelIds: ["INBOX"],
    },
  });

  return {
    historyId: res.data.historyId,
    expiration: res.data.expiration,
  };
}

/**
 * Parses and decodes the incoming Google Cloud Pub/Sub webhook payload
 */
export function parsePubSubNotification(body: any): PubSubNotificationPayload | null {
  if (!body?.message?.data) {
    return null;
  }

  try {
    const decodedString = Buffer.from(body.message.data, "base64").toString("utf-8");
    const parsed = JSON.parse(decodedString);

    return {
      emailAddress: parsed.emailAddress,
      historyId: String(parsed.historyId),
    };
  } catch (err) {
    console.error("[PubSub] Error decoding push notification payload:", err);
    return null;
  }
}

/**
 * Fetches new message IDs added since a given startHistoryId using users.history.list
 */
export async function fetchNewMessagesFromHistory(
  gmail: gmail_v1.Gmail,
  startHistoryId: string
): Promise<{ messageIds: string[]; latestHistoryId?: string }> {
  try {
    const res = await gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes: ["messageAdded"],
    });

    const messageIds = new Set<string>();
    const histories = res.data.history || [];

    for (const record of histories) {
      if (record.messagesAdded) {
        for (const added of record.messagesAdded) {
          if (added.message?.id) {
            messageIds.add(added.message.id);
          }
        }
      }
    }

    return {
      messageIds: Array.from(messageIds),
      latestHistoryId: res.data.historyId || startHistoryId,
    };
  } catch (error: any) {
    // If historyId is too old (HTTP 404), Gmail requires full sync
    if (error?.code === 404) {
      console.warn("[GmailHistory] HistoryId out of date, falling back to message listing");
    } else {
      console.error("[GmailHistory] Error fetching history list:", error);
    }
    return { messageIds: [] };
  }
}
