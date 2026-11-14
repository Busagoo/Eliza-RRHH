import { NextRequest, NextResponse } from "next/server";
import { runHistoricalBackfill, pauseBackfillWorker } from "@/lib/workers/backfillWorker";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "start";

    if (action === "pause") {
      await pauseBackfillWorker(body.syncStateId);
      return NextResponse.json({ success: true, message: "Backfill worker paused" });
    }

    if (action === "start" || action === "resume" || action === "reset") {
      const result = await runHistoricalBackfill({
        queryFilter: body.queryFilter,
        reset: action === "reset",
        batchSize: body.batchSize,
      });

      return NextResponse.json({
        success: true,
        status: result.status,
        message: result.status === "started" ? "Backfill worker started in background" : "Worker already active",
      });
    }

    return NextResponse.json({ error: "Invalid action. Use start, pause, resume, or reset" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Backfill control failed", message: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  const syncState = await prisma.syncState.findFirst({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ syncState });
}
