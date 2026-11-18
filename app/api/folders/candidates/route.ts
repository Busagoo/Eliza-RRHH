import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/folders/candidates - Add candidate to folder
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { folderId, candidateId } = body;

    if (!folderId || !candidateId) {
      return NextResponse.json(
        { error: "folderId and candidateId are required" },
        { status: 400 }
      );
    }

    const assignment = await prisma.candidateFolder.upsert({
      where: {
        folderId_candidateId: {
          folderId,
          candidateId,
        },
      },
      create: {
        folderId,
        candidateId,
      },
      update: {},
    });

    return NextResponse.json({ success: true, assignment });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to add candidate to folder", message: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/folders/candidates?folderId=...&candidateId=... - Remove candidate from folder
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get("folderId");
    const candidateId = searchParams.get("candidateId");

    if (!folderId || !candidateId) {
      return NextResponse.json(
        { error: "folderId and candidateId are required" },
        { status: 400 }
      );
    }

    await prisma.candidateFolder.deleteMany({
      where: {
        folderId,
        candidateId,
      },
    });

    return NextResponse.json({ success: true, message: "Candidato removido de la carpeta" });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to remove candidate from folder", message: error.message },
      { status: 500 }
    );
  }
}
