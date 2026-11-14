import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EmailStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [syncState, account, totalCandidates, totalEmails, totalProcessed, totalDiscarded, totalProcessing] =
      await Promise.all([
        prisma.syncState.findFirst({
          orderBy: { createdAt: "desc" },
        }),
        prisma.account.findFirst({
          select: { id: true, email: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
        }),
        prisma.candidate.count(),
        prisma.email.count(),
        prisma.email.count({ where: { status: EmailStatus.PROCESSED } }),
        prisma.email.count({ where: { status: EmailStatus.DISCARDED } }),
        prisma.email.count({ where: { status: EmailStatus.PROCESSING } }),
      ]);

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
