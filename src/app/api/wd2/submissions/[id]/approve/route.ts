import { NextRequest, NextResponse } from "next/server";
import { getWd2FromSession } from "@/lib/wd2-auth";
import {
  createNotification,
  findEligible,
  getMahasiswaById,
  getSubmissionById,
  markSubmissionApproved,
} from "@/lib/graduation";
import { getEvent } from "@/lib/event";
import { addAttendee, updateAttendee } from "@/lib/storage";
import { isEmailConfigured, sendInvitationEmail } from "@/lib/email";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const wd2 = await getWd2FromSession();
  if (!wd2) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const submission = await getSubmissionById(id);
  if (!submission) {
    return NextResponse.json({ message: "Submission tidak ditemukan" }, { status: 404 });
  }
  if (submission.paymentStatus !== "pending") {
    return NextResponse.json(
      { message: "Submission ini tidak sedang menunggu review." },
      { status: 400 }
    );
  }

  const [mahasiswa, event] = await Promise.all([
    getMahasiswaById(submission.mahasiswaId),
    getEvent(submission.eventId),
  ]);
  if (!mahasiswa || !event) {
    return NextResponse.json({ message: "Data mahasiswa atau acara tidak ditemukan" }, { status: 404 });
  }

  const eligible = await findEligible(submission.eventId, mahasiswa.npm);

  let attendee = await addAttendee(
    {
      name: mahasiswa.name,
      program: eligible?.program || "Belum ditentukan",
      phone: "-",
      email: mahasiswa.email || "",
      npm: mahasiswa.npm,
      seat: "-",
    },
    submission.eventId
  );

  let emailNote = "Panitia akan mengirim undangan secara manual.";
  if (isEmailConfigured() && attendee.email) {
    try {
      await sendInvitationEmail(attendee, event);
      const updated = await updateAttendee(attendee.id, (current) => ({
        ...current,
        emailSent: true,
        sentAt: new Date().toISOString(),
        status: "sent",
      }));
      if (updated) attendee = updated;
      emailNote = "Undangan telah dikirim via email.";
    } catch {
      emailNote = "Undangan belum terkirim otomatis — panitia perlu mengirim manual.";
    }
  }

  await markSubmissionApproved(submission.id, wd2.id, attendee.id);
  await createNotification({
    recipientType: "mahasiswa",
    recipientId: mahasiswa.id,
    type: "payment_approved",
    title: "Bukti pembayaran disetujui",
    body: `Pembayaran wisuda Anda telah disetujui. ${emailNote}`,
    link: "/mahasiswa/dashboard",
  });

  return NextResponse.json({ status: "approved", attendee, emailNote });
}
