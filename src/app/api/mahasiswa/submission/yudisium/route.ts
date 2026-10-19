import { NextResponse } from "next/server";
import { getMahasiswaFromSession } from "@/lib/mahasiswa-auth";
import { confirmYudisium, findActiveEligibleEvent, getOrCreateSubmission } from "@/lib/graduation";

export async function POST() {
  const mhs = await getMahasiswaFromSession();
  if (!mhs) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const eligible = await findActiveEligibleEvent(mhs.npm);
  if (!eligible) {
    return NextResponse.json({ message: "Tidak ada acara aktif." }, { status: 404 });
  }

  const submission = await getOrCreateSubmission(eligible.eventId, mhs.id);
  const updated = await confirmYudisium(submission.id);

  return NextResponse.json({ submission: updated });
}
