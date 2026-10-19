import { NextResponse } from "next/server";
import { getMahasiswaFromSession } from "@/lib/mahasiswa-auth";
import { findActiveEligibleEvent, getOrCreateSubmission } from "@/lib/graduation";
import { getEvent } from "@/lib/event";

export async function GET() {
  const mhs = await getMahasiswaFromSession();
  if (!mhs) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const eligible = await findActiveEligibleEvent(mhs.npm);
  if (!eligible) {
    return NextResponse.json(
      { message: "Tidak ada acara aktif yang mengharuskan konfirmasi saat ini." },
      { status: 404 }
    );
  }

  const [event, submission] = await Promise.all([
    getEvent(eligible.eventId),
    getOrCreateSubmission(eligible.eventId, mhs.id),
  ]);

  return NextResponse.json({ event, submission, mahasiswa: mhs });
}
