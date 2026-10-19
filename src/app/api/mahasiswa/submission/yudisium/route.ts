import { NextResponse } from "next/server";
import { getMahasiswaFromSession } from "@/lib/mahasiswa-auth";
import { confirmYudisium, findActiveEvent, getOrCreateSubmission } from "@/lib/graduation";

export async function POST() {
  const mhs = await getMahasiswaFromSession();
  if (!mhs) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const active = await findActiveEvent();
  if (!active) {
    return NextResponse.json({ message: "Tidak ada acara aktif." }, { status: 404 });
  }

  const submission = await getOrCreateSubmission(active.eventId, mhs.id);
  const updated = await confirmYudisium(submission.id);

  return NextResponse.json({ submission: updated });
}
