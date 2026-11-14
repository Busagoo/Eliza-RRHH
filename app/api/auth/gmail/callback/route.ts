import { NextRequest, NextResponse } from "next/server";
import { getTokensFromCode, getOAuth2Client, getDynamicBaseUrl } from "@/lib/gmail/client";
import { setupGmailWatch } from "@/lib/gmail/push";
import { runHistoricalBackfill } from "@/lib/workers/backfillWorker";
import { prisma } from "@/lib/db";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const baseUrl = getDynamicBaseUrl(req.headers);

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/?auth_error=${encodeURIComponent(error || "Missing auth code")}`);
  }

  try {
    const tokens = await getTokensFromCode(code, baseUrl);

    // Retrieve user email using the tokens
    const oauth2Client = getOAuth2Client(baseUrl);
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const userEmail = userInfo.data.email || process.env.GOOGLE_USER_EMAIL || "linked_user@gmail.com";

    // Upsert Account record
    const account = await prisma.account.upsert({
      where: { email: userEmail },
      create: {
        email: userEmail,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || "",
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        tokenType: tokens.token_type || "Bearer",
        scope: tokens.scope || undefined,
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        scope: tokens.scope || undefined,
      },
    });

    // Optionally register Gmail Pub/Sub watch if configured
    if (process.env.GOOGLE_PUBSUB_TOPIC_NAME) {
      try {
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        await setupGmailWatch(gmail, process.env.GOOGLE_PUBSUB_TOPIC_NAME);
        console.log("[GmailCallback] Successfully registered Gmail push watch with Pub/Sub topic");
      } catch (watchErr: any) {
        console.warn("[GmailCallback] Pub/Sub watch registration skipped/failed:", watchErr.message);
      }
    }

    // Automatically trigger historical backfill in the background for this account!
    runHistoricalBackfill({ accountId: account.id }).catch((err) =>
      console.error("[GmailCallback] Failed to launch backfill worker:", err)
    );

    return NextResponse.redirect(`${baseUrl}/?auth_success=true&email=${encodeURIComponent(userEmail)}`);
  } catch (err: any) {
    console.error("[GmailCallback] OAuth exchange error:", err);
    return NextResponse.redirect(`${baseUrl}/?auth_error=${encodeURIComponent(err.message)}`);
  }
}
