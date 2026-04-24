import { NextResponse } from "next/server";

import { deleteWardrobeItem } from "@/lib/wardrobe-server";
import { getServerSession } from "@/lib/session";

export async function DELETE(_request, { params }) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = await params;
  const deleted = await deleteWardrobeItem(session.user.id, resolvedParams.id);

  if (!deleted) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
