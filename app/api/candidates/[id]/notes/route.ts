import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// GET /api/candidates/[id]/notes
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const candidateId = params.id;
    const notes = await prisma.candidateNote.findMany({
      where: { candidateId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ notes });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch candidate notes", message: error.message },
      { status: 500 }
    );
  }
}

// POST /api/candidates/[id]/notes
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const candidateId = params.id;
    const session = getSessionFromRequest(req);
    const authorEmail = session?.email || "reclutador@eliza.com";

    const body = await req.json();
    const { content } = body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const note = await prisma.candidateNote.create({
      data: {
        candidateId,
        authorEmail,
        content: content.trim(),
      },
    });

    return NextResponse.json({ success: true, note });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to create note", message: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/candidates/[id]/notes?noteId=...
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const noteId = searchParams.get("noteId");

    if (!noteId) {
      return NextResponse.json({ error: "Missing noteId" }, { status: 400 });
    }

    await prisma.candidateNote.delete({
      where: { id: noteId },
    });

    return NextResponse.json({ success: true, message: "Nota eliminada" });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to delete note", message: error.message },
      { status: 500 }
    );
  }
}
