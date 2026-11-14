import { NextRequest, NextResponse } from "next/server";
import { getGmailAuthUrl, getDynamicBaseUrl } from "@/lib/gmail/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const baseUrl = getDynamicBaseUrl(req.headers);
    const url = getGmailAuthUrl(baseUrl);
    return NextResponse.redirect(url);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to generate Google OAuth URL", message: error.message },
      { status: 500 }
    );
  }
}
