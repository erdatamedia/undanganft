import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import {
  deleteRundownAttachment,
  updateRundownAttachment,
  type RundownAttachmentPayload,
} from "@/lib/rundown";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id, attachmentId } = await params;
  const payload = (await req.json()) as Partial<RundownAttachmentPayload>;
  const updated = await updateRundownAttachment(id, attachmentId, payload);

  if (!updated) {
    return NextResponse.json({ message: "Naskah tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id, attachmentId } = await params;
  await deleteRundownAttachment(id, attachmentId);
  return NextResponse.json({ status: "deleted", id: attachmentId });
}
