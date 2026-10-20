import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { getEvent } from "@/lib/event";
import { enrollMahasiswaInEvent } from "@/lib/graduation-flow";
import { findActiveEvent, listMahasiswaWithoutSubmission, listRegistrants } from "@/lib/graduation";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const active = await findActiveEvent();
  const activeEvent = active ? await getEvent(active.eventId) : null;
  return NextResponse.json({
    rows: await listRegistrants(id),
    registrationEvent: activeEvent ? { id: activeEvent.id, name: activeEvent.name } : null,
    isRegistrationEvent: active?.eventId === id,
    unlinked: (await listMahasiswaWithoutSubmission(id)).length,
  });
}

/** Menautkan semua akun mahasiswa yang belum punya pengajuan ke acara ini (peserta + pengajuan). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ids = await listMahasiswaWithoutSubmission(id);
  for (const mahasiswaId of ids) await enrollMahasiswaInEvent(id, mahasiswaId);
  return NextResponse.json({ linked: ids.length });
}
