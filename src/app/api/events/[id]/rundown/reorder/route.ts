import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { reorderRundownItems } from "@/lib/rundown";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json()) as { items?: { id: string; order: number }[] };
  const items = body.items ?? [];
  if (!items.length) {
    return NextResponse.json({ message: "Tidak ada perubahan urutan." }, { status: 400 });
  }

  await reorderRundownItems(id, items);
  return NextResponse.json({ status: "reordered" });
}
