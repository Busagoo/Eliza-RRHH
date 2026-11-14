import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pauseBackfillWorker } from "@/lib/workers/backfillWorker";
import { getDynamicBaseUrl } from "@/lib/gmail/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Pause any running sync tasks
    await pauseBackfillWorker();

    // 2. Remove linked accounts to allow clean switching
    await prisma.account.deleteMany({});

    return NextResponse.json({
      success: true,
      message: "Cuenta desvinculada exitosamente. Listo para conectar una nueva cuenta.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to disconnect account", message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const baseUrl = getDynamicBaseUrl(req.headers);
  try {
    await pauseBackfillWorker();
    await prisma.account.deleteMany({});
    return NextResponse.redirect(`${baseUrl}/?auth_disconnected=true`);
  } catch {
    return NextResponse.redirect(`${baseUrl}/`);
  }
}
