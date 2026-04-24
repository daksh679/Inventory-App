import { NextResponse } from "next/server";

import { createWardrobeItem, listWardrobeItems } from "@/lib/wardrobe-server";
import { getServerSession } from "@/lib/session";

export async function GET() {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await listWardrobeItems(session.user.id);
  return NextResponse.json({ items });
}

export async function POST(request) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const item = await createWardrobeItem(session.user.id, payload);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create item." },
      { status: 400 },
    );
  }
}
