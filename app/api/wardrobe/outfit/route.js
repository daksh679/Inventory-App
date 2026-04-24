import { NextResponse } from "next/server";

import { getOutfitSelection, saveOutfitSelection } from "@/lib/wardrobe-server";
import { getServerSession } from "@/lib/session";

export async function GET() {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const outfit = await getOutfitSelection(session.user.id);
  return NextResponse.json({ outfit });
}

export async function PUT(request) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const outfit = await saveOutfitSelection(session.user.id, payload);
    return NextResponse.json({ outfit });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save outfit." },
      { status: 400 },
    );
  }
}
