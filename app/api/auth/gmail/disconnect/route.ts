import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { getDynamicBaseUrl } from "@/lib/gmail/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const res = NextResponse.json({
      success: true,
      message: "Sesión cerrada correctamente en este dispositivo.",
    });
    clearSessionCookie(res);
    return res;
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to disconnect account", message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const baseUrl = getDynamicBaseUrl(req.headers);
  const res = NextResponse.redirect(`${baseUrl}/?auth_disconnected=true`);
  clearSessionCookie(res);
  return res;
}
