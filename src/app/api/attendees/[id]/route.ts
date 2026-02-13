import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { deleteAttendee, getAttendee, updateAttendee } from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const attendee = await getAttendee(id);
  if (!attendee) {
    return NextResponse.json(
      { message: "Data undangan tidak ditemukan" },
      { status: 404 }
    );
  }
  return NextResponse.json(attendee);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const changes = await request.json();

  const updated = await updateAttendee(id, (current) => ({
    ...current,
    ...changes,
  }));

  if (!updated) {
    return NextResponse.json(
      { message: "Data undangan tidak ditemukan" },
      { status: 404 }
    );
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const existing = await getAttendee(id);
  if (!existing) {
    return NextResponse.json(
      { message: "Data undangan tidak ditemukan" },
      { status: 404 }
    );
  }

  await deleteAttendee(id);
  return NextResponse.json({ status: "deleted", id });
}
