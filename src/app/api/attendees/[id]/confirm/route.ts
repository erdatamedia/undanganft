import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { updateAttendee } from "@/lib/storage";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { agenda?: string };
  const now = new Date().toISOString();

  // Acara dua agenda: "pelepasan" dicatat terpisah; default (yudisium) memakai status/confirmedAt.
  const updated = await updateAttendee(id, (current) =>
    body.agenda === "pelepasan"
      ? { ...current, pelepasanConfirmedAt: now }
      : { ...current, status: "confirmed", confirmedAt: now }
  );

  if (!updated) {
    return NextResponse.json({ message: "QR tidak valid" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
