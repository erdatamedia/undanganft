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
import { addAttendee } from "@/lib/storage";

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

  const attendee = await addAttendee(
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

  await markSubmissionApproved(submission.id, wd2.id, attendee.id);
  await createNotification({
    recipientType: "mahasiswa",
    recipientId: mahasiswa.id,
    type: "payment_approved",
    title: "Bukti pembayaran disetujui",
    body: "Pembayaran wisuda Anda telah disetujui. Undangan sudah tersedia di dashboard Anda.",
    link: "/mahasiswa/dashboard",
  });

  return NextResponse.json({ status: "approved", attendee });
}
