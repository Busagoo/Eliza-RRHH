import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EmailStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [syncState, account, totalCandidates, emailCounts] = await Promise.all([
      prisma.syncState.findFirst({
        orderBy: { createdAt: "desc" },
      }),
      prisma.account.findFirst({
        select: { id: true, email: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.candidate.count(),
      prisma.email.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
    ]);

    let totalEmails = 0;
    let totalProcessed = 0;
    let totalDiscarded = 0;
    let totalProcessing = 0;

    for (const group of emailCounts) {
      totalEmails += group._count.id;
      if (group.status === EmailStatus.PROCESSED) totalProcessed = group._count.id;
      if (group.status === EmailStatus.DISCARDED) totalDiscarded = group._count.id;
      if (group.status === EmailStatus.PROCESSING) totalProcessing = group._count.id;
    }

    return NextResponse.json({
      connected: Boolean(account),
      account,
      syncState: syncState || {
        status: "IDLE",
        totalScanned: 0,
        totalResumesFound: 0,
        totalDiscarded: 0,
        totalErrors: 0,
      },
      metrics: {
        totalCandidates,
        totalEmails,
        totalProcessed,
        totalDiscarded,
        totalProcessing,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch sync status", message: error.message },
      { status: 500 }
    );
  }
}
