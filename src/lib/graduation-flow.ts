import {
  findActiveEvent,
  findEligible,
  findUnlinkedAttendeeByName,
  listMahasiswaWithoutSubmission,
  getOrCreateSubmission,
  getMahasiswaById,
  setSubmissionAttendee,
  type GraduationSubmissionRecord,
} from "@/lib/graduation";
import { addAttendee, findAttendeeByNpm, getAttendee, type AttendeeRecord } from "@/lib/storage";

/** Creates the attendee (QR/invite) for a submission once, reusing it afterwards. */
export async function ensureAttendeeForSubmission(
  submission: GraduationSubmissionRecord
): Promise<AttendeeRecord | null> {
  if (submission.attendeeId) {
    const existing = await getAttendee(submission.attendeeId);
    if (existing) return existing;
  }

  const mahasiswa = await getMahasiswaById(submission.mahasiswaId);
  if (!mahasiswa) return null;

  const imported = await findAttendeeByNpm(submission.eventId, mahasiswa.npm);
  if (imported) {
    await setSubmissionAttendee(submission.id, imported.id);
    return imported;
  }

  // NPM salah ketik / beda format: pakai peserta hasil impor bila namanya cocok persis dan hanya satu.
  const byName = await findUnlinkedAttendeeByName(submission.eventId, mahasiswa.name);
  if (byName) {
    const matched = await getAttendee(byName);
    if (matched) {
      await setSubmissionAttendee(submission.id, matched.id);
      return matched;
    }
  }

  const eligible = await findEligible(submission.eventId, mahasiswa.npm);
  const attendee = await addAttendee(
    {
      name: mahasiswa.name,
      program: eligible?.program || "Belum ditentukan",
      phone: "-",
      email: mahasiswa.email || "",
      npm: mahasiswa.npm,
      seat: "-",
    },
    submission.eventId,
    `${submission.eventId}-${mahasiswa.name}-${mahasiswa.npm}`
  );
  await setSubmissionAttendee(submission.id, attendee.id);
  return attendee;
}

/** Registers the mahasiswa into the event: submission + attendee (draft), reusing imported rows. */
export async function enrollMahasiswaInEvent(eventId: string, mahasiswaId: string) {
  const submission = await getOrCreateSubmission(eventId, mahasiswaId);
  await ensureAttendeeForSubmission(submission);
  return submission;
}

/** Pendaftar yang belum tertaut otomatis masuk, tapi hanya untuk acara aktif pendaftaran. */
export async function syncRegistrantsToEvent(eventId: string): Promise<number> {
  const active = await findActiveEvent();
  if (!active || active.eventId !== eventId) return 0;
  const ids = await listMahasiswaWithoutSubmission(eventId);
  for (const id of ids) await enrollMahasiswaInEvent(eventId, id);
  return ids.length;
}
