import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// GET /api/folders - List all folders with candidate count
export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    const email = session?.email || "default";

    const folders = await prisma.jobFolder.findMany({
      where: {
        accountEmail: email,
      },
      include: {
        _count: {
          select: { candidates: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const formatted = folders.map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      color: f.color || "#6366f1",
      candidateCount: f._count.candidates,
      createdAt: f.createdAt,
    }));

    return NextResponse.json({ folders: formatted });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch folders", message: error.message },
      { status: 500 }
    );
  }
}

// POST /api/folders - Create a new search folder
export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    const email = session?.email || "default";

    const body = await req.json();
    const { name, description, color } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 }
      );
    }

    const folder = await prisma.jobFolder.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        color: color || "#6366f1",
        accountEmail: email,
      },
    });

    return NextResponse.json({ success: true, folder });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to create folder", message: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/folders?id=... - Delete a folder
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing folder id" }, { status: 400 });
    }

    await prisma.jobFolder.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Carpeta eliminada" });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to delete folder", message: error.message },
      { status: 500 }
    );
  }
}
