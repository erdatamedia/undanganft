import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { createRundownItem, listRundownItems, type RundownItemPayload } from "@/lib/rundown";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const items = await listRundownItems(id);
  return NextResponse.json({ items });
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
  const payload = (await req.json()) as RundownItemPayload;
  if (!payload.title?.trim()) {
    return NextResponse.json(
      { message: "Judul rangkaian acara wajib diisi." },
      { status: 400 }
    );
  }

  const item = await createRundownItem(id, payload);
  return NextResponse.json(item);
}
