import { NextResponse } from "next/server";
import { getMahasiswaFromSession } from "@/lib/mahasiswa-auth";
import { findActiveEvent, getOrCreateSubmission, getPayments, getPickupBySubmission } from "@/lib/graduation";
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

  const [payments, pickup, attendee] = await Promise.all([
    getPayments(submission.id),
    getPickupBySubmission(submission.id),
    submission.attendeeId ? getAttendee(submission.attendeeId) : Promise.resolve(null),
  ]);

  return NextResponse.json({
    event,
    submission,
    mahasiswa: mhs,
    payments: {
      fakultas: payments.fakultas
        ? { id: payments.fakultas.id, status: payments.fakultas.status, rejectReason: payments.fakultas.rejectReason, source: payments.fakultas.source, hasProof: Boolean(payments.fakultas.proof), uploadedAt: payments.fakultas.uploadedAt }
        : null,
      univ: payments.univ
        ? { id: payments.univ.id, status: payments.univ.status, rejectReason: payments.univ.rejectReason, source: payments.univ.source, hasProof: Boolean(payments.univ.proof), uploadedAt: payments.univ.uploadedAt }
        : null,
    },
    pickup: pickup
      ? { handedAt: pickup.handedAt, undanganGiven: pickup.undanganGiven, togaGiven: pickup.togaGiven }
      : null,
    inviteToken: attendee?.token ?? null,
  });
}
