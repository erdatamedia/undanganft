import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { deleteEvent, getEvent, updateEvent, type EventPayload } from "@/lib/event";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const event = await getEvent(id);
  if (!event) {
    return NextResponse.json({ message: "Acara tidak ditemukan" }, { status: 404 });
  }
  return NextResponse.json(event);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const payload = (await req.json()) as Partial<EventPayload>;
  const updated = await updateEvent(id, payload);

  if (!updated) {
    return NextResponse.json(
      { message: "Acara tidak ditemukan" },
      { status: 404 }
    );
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getEvent(id);
  if (!existing) {
    return NextResponse.json(
      { message: "Acara tidak ditemukan" },
      { status: 404 }
    );
  }

  await deleteEvent(id);
  return NextResponse.json({ status: "deleted", id });
}
