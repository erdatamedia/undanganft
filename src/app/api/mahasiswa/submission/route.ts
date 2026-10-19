import { NextResponse } from "next/server";
import { getMahasiswaFromSession } from "@/lib/mahasiswa-auth";
import { findActiveEvent, getOrCreateSubmission } from "@/lib/graduation";
import { getEvent } from "@/lib/event";
import { getAttendee } from "@/lib/storage";

export async function GET() {
  const mhs = await getMahasiswaFromSession();
  if (!mhs) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const active = await findActiveEvent();
  if (!active) {
    return NextResponse.json(
      { message: "Tidak ada acara aktif yang mengharuskan konfirmasi saat ini." },
      { status: 404 }
    );
  }

  const [event, submission] = await Promise.all([
    getEvent(active.eventId),
    getOrCreateSubmission(active.eventId, mhs.id),
  ]);

  const attendee = submission.attendeeId ? await getAttendee(submission.attendeeId) : null;

  return NextResponse.json({
    event,
    submission,
    mahasiswa: mhs,
    inviteToken: attendee?.token ?? null,
  });
}
