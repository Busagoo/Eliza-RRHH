import { NextRequest, NextResponse } from "next/server";
import { processBackfillBatch, pauseBackfillWorker } from "@/lib/workers/backfillWorker";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "batch";

    if (action === "pause") {
      await pauseBackfillWorker(body.syncStateId);
      return NextResponse.json({ success: true, message: "Sincronización pausada" });
    }

    const validActions = ["start", "resume", "batch", "reset", "ingest", "process", "process_single"];
    if (validActions.includes(action)) {
      const result = await processBackfillBatch({
        accountId: session?.accountId,
        queryFilter: body.queryFilter,
        reset: action === "reset",
        action: action === "start" || action === "resume" ? "batch" : action,
        batchSize: body.batchSize || 15,
        targetEmailId: body.targetEmailId,
      });

      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    return NextResponse.json({ error: "Acción inválida. Usa start, pause, resume, batch, ingest, process o reset" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error en el control de sincronización", message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  const syncState = await prisma.syncState.findFirst({
    where: session?.accountId ? { accountId: session.accountId } : undefined,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ syncState });
}
