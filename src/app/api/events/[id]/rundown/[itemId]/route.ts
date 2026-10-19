import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { deleteRundownItem, updateRundownItem, type RundownItemPayload } from "@/lib/rundown";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id, itemId } = await params;
  const payload = (await req.json()) as Partial<RundownItemPayload>;
  const updated = await updateRundownItem(id, itemId, payload);

  if (!updated) {
    return NextResponse.json(
      { message: "Item rundown tidak ditemukan" },
      { status: 404 }
    );
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id, itemId } = await params;
  await deleteRundownItem(id, itemId);
  return NextResponse.json({ status: "deleted", id: itemId });
}
