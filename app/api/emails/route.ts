import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EmailStatus, Prisma } from "@prisma/client";
import { getSessionFromRequest } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session?.email) {
      return NextResponse.json({ emails: [], total: 0, page: 1, totalPages: 0 });
    }

    const searchParams = req.nextUrl.searchParams;
    const statusParam = searchParams.get("status") || "ALL";
    const searchQuery = searchParams.get("search") || "";
    const showDismissed = searchParams.get("showDismissed") === "true";
    const onlyDismissed = searchParams.get("onlyDismissed") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "60", 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.EmailWhereInput = {
      accountEmail: session.email,
    };

    if (onlyDismissed || statusParam === "DISMISSED") {
      where.isDismissed = true;
    } else if (!showDismissed) {
      where.isDismissed = false;
    }

    if (statusParam !== "ALL" && statusParam !== "DISMISSED") {
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

// Allows toggling dismissed state or restoring emails
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { emailId, emailIds, isDismissed, restoreAll } = body;

    if (restoreAll) {
      const res = await prisma.email.updateMany({
        where: { isDismissed: true },
        data: { isDismissed: false },
      });
      return NextResponse.json({ success: true, count: res.count });
    }

    if (Array.isArray(emailIds) && emailIds.length > 0) {
      const res = await prisma.email.updateMany({
        where: { id: { in: emailIds } },
        data: { isDismissed: Boolean(isDismissed) },
      });
      return NextResponse.json({ success: true, count: res.count, emailIds });
    }

    if (!emailId) {
      return NextResponse.json({ error: "Missing emailId or emailIds" }, { status: 400 });
    }

    const updated = await prisma.email.update({
      where: { id: emailId },
      data: { isDismissed: Boolean(isDismissed) },
    });

    return NextResponse.json({ success: true, email: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update email dismiss state", message: error.message },
      { status: 500 }
    );
  }
}

// Allows dismissing single or all discarded emails
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
