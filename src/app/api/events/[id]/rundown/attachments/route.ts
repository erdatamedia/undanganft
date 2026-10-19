import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import {
  createRundownAttachment,
  listRundownAttachments,
  type RundownAttachmentPayload,
} from "@/lib/rundown";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const attachments = await listRundownAttachments(id);
  return NextResponse.json({ attachments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const payload = (await req.json()) as RundownAttachmentPayload;
  if (!payload.label?.trim()) {
    return NextResponse.json({ message: "Label naskah wajib diisi." }, { status: 400 });
  }

  const attachment = await createRundownAttachment(id, payload);
  return NextResponse.json(attachment);
}
