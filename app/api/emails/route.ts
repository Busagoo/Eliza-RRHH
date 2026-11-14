import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EmailStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const statusParam = searchParams.get("status") || "ALL";
    const searchQuery = searchParams.get("search") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "30", 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.EmailWhereInput = {
      isDismissed: false, // Never return dismissed/deleted emails
    };

    if (statusParam !== "ALL") {
      where.status = statusParam as EmailStatus;
    }

    if (searchQuery.trim()) {
      where.OR = [
        { subject: { contains: searchQuery.trim(), mode: "insensitive" } },
        { sender: { contains: searchQuery.trim(), mode: "insensitive" } },
        { snippet: { contains: searchQuery.trim(), mode: "insensitive" } },
        { senderEmail: { contains: searchQuery.trim(), mode: "insensitive" } },
      ];
    }

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        skip,
        take: limit,
        include: {
          candidate: {
            select: {
              id: true,
              fullName: true,
              seniority: true,
              experienceYears: true,
              skills: true,
              resumeFileUrl: true,
            },
          },
        },
      }),
      prisma.email.count({ where }),
    ]);

    return NextResponse.json({
      emails,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch email feed", message: error.message },
      { status: 500 }
    );
  }
}

// Allows dismissing / deleting single or all discarded emails
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const emailId = body.emailId;
    const dismissAllDiscarded = body.dismissAllDiscarded;

    if (dismissAllDiscarded) {
      const res = await prisma.email.updateMany({
        where: { status: EmailStatus.DISCARDED },
        data: { isDismissed: true },
      });
      return NextResponse.json({ success: true, count: res.count });
    }

    if (emailId) {
      await prisma.email.update({
        where: { id: emailId },
        data: { isDismissed: true },
      });
      return NextResponse.json({ success: true, emailId });
    }

    return NextResponse.json({ error: "Missing emailId or dismissAllDiscarded" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to dismiss email", message: error.message },
      { status: 500 }
    );
  }
}
