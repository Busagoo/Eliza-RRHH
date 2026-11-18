import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EmailStatus } from "@prisma/client";
import { getSessionFromRequest } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);

    // If this specific device does not have an active session cookie, treat as unauthenticated
    if (!session?.email) {
      return NextResponse.json({
        connected: false,
        account: null,
        syncState: {
          status: "IDLE",
          totalScanned: 0,
          totalResumesFound: 0,
          totalDiscarded: 0,
          totalErrors: 0,
        },
        metrics: {
          totalCandidates: 0,
          totalEmails: 0,
          totalProcessed: 0,
          totalDiscarded: 0,
          totalProcessing: 0,
        },
      });
    }

    const [syncState, account, totalCandidates, emailCounts] = await Promise.all([
      prisma.syncState.findFirst({
        orderBy: { createdAt: "desc" },
      }),
      prisma.account.findUnique({
        where: { email: session.email },
        select: { id: true, email: true, updatedAt: true },
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
      account: account || null,
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
