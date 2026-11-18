import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "../env";

const COOKIE_NAME = "eliza_session";
const SESSION_EXPIRY_DAYS = 30;

function getSecret(): string {
  return (
    getEnv("SESSION_SECRET") ||
    getEnv("WEBHOOK_SECRET") ||
    getEnv("GOOGLE_CLIENT_SECRET") ||
    "eliza-rrhh-ats-secret-key-2026-dynamic-auth"
  );
}

export interface SessionPayload {
  email: string;
  accountId: string;
  createdAt: number;
  exp: number;
}

/**
 * Creates a cryptographically signed session token using HMAC-SHA256
 */
export function createSessionToken(email: string, accountId: string): string {
  const now = Date.now();
  const exp = now + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

  const payload: SessionPayload = {
    email: email.toLowerCase().trim(),
    accountId,
    createdAt: now,
    exp,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies and decodes a session token
 */
export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token || !token.includes(".")) return null;

  try {
    const [payloadB64, signature] = token.split(".");
    if (!payloadB64 || !signature) return null;

    const expectedSignature = crypto
      .createHmac("sha256", getSecret())
      .update(payloadB64)
      .digest("base64url");

    // Timing-safe comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload: SessionPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    );

    if (Date.now() > payload.exp) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Gets authenticated session from NextRequest (via cookie)
 */
export function getSessionFromRequest(req: NextRequest): SessionPayload | null {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  return verifySessionToken(cookie);
}

/**
 * Attaches the session cookie to a NextResponse
 */
export function setSessionCookie(res: NextResponse, email: string, accountId: string) {
  const token = createSessionToken(email, accountId);
  const isProd = getEnv("NODE_ENV") === "production";

  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60,
  });
}

/**
 * Clears the session cookie on logout
 */
export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: getEnv("NODE_ENV") === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
