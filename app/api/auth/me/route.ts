import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session?.email) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const account = await prisma.account.findUnique({
      where: { email: session.email },
      select: { id: true, email: true, updatedAt: true },
    });

    if (!account) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: account.id,
        email: account.email,
        updatedAt: account.updatedAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { authenticated: false, error: error.message },
      { status: 500 }
    );
  }
}
