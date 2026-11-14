import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const seniority = searchParams.get("seniority");
    const minExp = searchParams.get("minExp");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "30", 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.CandidateWhereInput = {};

    if (seniority && seniority !== "ALL") {
      where.seniority = seniority;
    }

    if (minExp) {
      where.experienceYears = { gte: parseInt(minExp, 10) };
    }

    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        skip,
        take: limit,
        include: {
          email: {
            select: {
              subject: true,
              sender: true,
              receivedAt: true,
            },
          },
        },
      }),
      prisma.candidate.count({ where }),
    ]);

    return NextResponse.json({
      candidates,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch candidates", message: error.message },
      { status: 500 }
    );
  }
}
