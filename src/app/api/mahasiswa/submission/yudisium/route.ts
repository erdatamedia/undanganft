import { NextResponse } from "next/server";
import { getMahasiswaFromSession } from "@/lib/mahasiswa-auth";
import { findActiveEvent, getOrCreateSubmission, setYudisiumStatus } from "@/lib/graduation";

export async function POST(request: Request) {
  const mhs = await getMahasiswaFromSession();
  if (!mhs) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { attending?: boolean; reason?: string };
  if (typeof body.attending !== "boolean") {
    return NextResponse.json({ message: "Pilihan hadir/tidak hadir wajib diisi." }, { status: 400 });
  }

  const active = await findActiveEvent();
  if (!active) {
    return NextResponse.json({ message: "Tidak ada acara aktif." }, { status: 404 });
  }

  const submission = await getOrCreateSubmission(active.eventId, mhs.id);
  const updated = await setYudisiumStatus(submission.id, body.attending, body.reason);

  return NextResponse.json({ submission: updated });
}
