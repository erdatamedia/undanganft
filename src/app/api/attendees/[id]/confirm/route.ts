import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { getAttendee, updateAttendee } from "@/lib/storage";

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
  const pelepasan = body.agenda === "pelepasan";

  const existing = await getAttendee(id);
  if (!existing) {
    return NextResponse.json({ message: "QR tidak valid" }, { status: 404 });
  }

  // Scan ulang tidak menimpa waktu hadir pertama; beri tahu operator bahwa sudah tercatat.
  const already = pelepasan ? Boolean(existing.pelepasanConfirmedAt) : existing.status === "confirmed" && Boolean(existing.confirmedAt);
  if (already) {
    return NextResponse.json({ ...existing, alreadyConfirmed: true });
  }

  const now = new Date().toISOString();
  // Acara dua agenda: "pelepasan" dicatat terpisah; default (yudisium) memakai status/confirmedAt.
  const updated = await updateAttendee(id, (current) =>
    pelepasan
      ? { ...current, pelepasanConfirmedAt: now }
      : { ...current, status: "confirmed", confirmedAt: now }
  );

  if (!updated) {
    return NextResponse.json({ message: "QR tidak valid" }, { status: 404 });
  }

  return NextResponse.json({ ...updated, alreadyConfirmed: false });
}
