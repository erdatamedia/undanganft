import {
  findEligible,
  getMahasiswaById,
  setSubmissionAttendee,
  type GraduationSubmissionRecord,
} from "@/lib/graduation";
import { addAttendee, getAttendee, type AttendeeRecord } from "@/lib/storage";

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
