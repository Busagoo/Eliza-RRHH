import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// GET /api/candidates/[id]/tags
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const candidateId = params.id;
    const tags = await prisma.candidateTagAssignment.findMany({
      where: { candidateId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ tags });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch candidate tags", message: error.message },
      { status: 500 }
    );
  }
}

// POST /api/candidates/[id]/tags - Toggle or add tag
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const candidateId = params.id;
    const session = getSessionFromRequest(req);
    const accountEmail = session?.email || "default";

    const body = await req.json();
    const { tagName, tagColor } = body;

    if (!tagName || typeof tagName !== "string" || !tagName.trim()) {
      return NextResponse.json({ error: "tagName is required" }, { status: 400 });
    }

    const cleanTagName = tagName.trim();

    // Check if tag already exists for this candidate
    const existing = await prisma.candidateTagAssignment.findFirst({
      where: {
        candidateId,
        tagName: cleanTagName,
        accountEmail,
      },
    });

    if (existing) {
      // Toggle off: remove tag
      await prisma.candidateTagAssignment.delete({
        where: { id: existing.id },
      });
      return NextResponse.json({ success: true, action: "removed", tag: existing });
    } else {
      // Add tag
      const tag = await prisma.candidateTagAssignment.create({
        data: {
          candidateId,
          tagName: cleanTagName,
          tagColor: tagColor || "#10b981",
          accountEmail,
        },
      });
      return NextResponse.json({ success: true, action: "added", tag });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update tag", message: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/candidates/[id]/tags?tagName=...
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const candidateId = params.id;
    const { searchParams } = new URL(req.url);
    const tagName = searchParams.get("tagName");

    if (!tagName) {
      return NextResponse.json({ error: "Missing tagName" }, { status: 400 });
    }

    await prisma.candidateTagAssignment.deleteMany({
      where: {
        candidateId,
        tagName,
      },
    });

    return NextResponse.json({ success: true, message: "Etiqueta removida" });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to delete tag", message: error.message },
      { status: 500 }
    );
  }
}
