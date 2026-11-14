import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../db";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
];

/**
 * Dynamically resolves the active application domain from HTTP headers,
 * ensuring zero manual configuration changes when deploying to Cloudflare,
 * custom domains, or local testing.
 */
export function getDynamicBaseUrl(headersList?: Headers | { get(name: string): string | null }): string {
  if (headersList) {
    const forwardedHost = headersList.get("x-forwarded-host");
    const host = forwardedHost || headersList.get("host");
    const proto =
      headersList.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");

    if (host) {
      return `${proto}://${host}`;
    }
  }

  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

/**
 * Returns a configured Google OAuth2 Client, dynamically adapting the redirect URI
 */
export function getOAuth2Client(baseUrl?: string): OAuth2Client {
  const redirectUri = baseUrl
    ? `${baseUrl.replace(/\/$/, "")}/api/auth/gmail/callback`
    : process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/gmail/callback";

  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri);
}

/**
 * Generates the authorization URL to redirect the user for consent.
 * Uses 'select_account consent' so the user can easily switch accounts!
 */
export function getGmailAuthUrl(baseUrl?: string): string {
  const oauth2Client = getOAuth2Client(baseUrl);
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: GMAIL_SCOPES,
    prompt: "select_account consent", // Forces Google to display the account picker!
  });
}

/**
 * Exchanges authorization code for access and refresh tokens
 */
export async function getTokensFromCode(code: string, baseUrl?: string) {
  const oauth2Client = getOAuth2Client(baseUrl);
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Returns an authenticated Gmail API client for a given account.
 * Automatically refreshes tokens and persists them if expired.
 */
export async function getAuthenticatedGmailClient(userEmail?: string) {
  const oauth2Client = getOAuth2Client();

  if (process.env.GOOGLE_REFRESH_TOKEN) {
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });
    return google.gmail({ version: "v1", auth: oauth2Client });
  }

  let account = null;
  if (userEmail) {
    account = await prisma.account.findUnique({ where: { email: userEmail } });
  }
  if (!account) {
    account = await prisma.account.findFirst({
      orderBy: { updatedAt: "desc" },
    });
  }

  if (!account) {
    throw new Error(
      "No Gmail account linked. Please authenticate via /api/auth/gmail or set GOOGLE_REFRESH_TOKEN in .env"
    );
  }

  oauth2Client.setCredentials({
    access_token: account.accessToken || undefined,
    refresh_token: account.refreshToken,
    expiry_date: account.expiresAt ? account.expiresAt.getTime() : undefined,
  });

  oauth2Client.on("tokens", async (newTokens) => {
    try {
      await prisma.account.update({
        where: { id: account!.id },
        data: {
          accessToken: newTokens.access_token || undefined,
          refreshToken: newTokens.refresh_token || account!.refreshToken,
          expiresAt: newTokens.expiry_date ? new Date(newTokens.expiry_date) : undefined,
        },
      });
      console.log(`[GmailAuth] Refreshed access token for ${account!.email}`);
    } catch (err) {
      console.error("[GmailAuth] Failed to persist refreshed token:", err);
    }
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}
