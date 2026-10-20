import { NextRequest, NextResponse } from "next/server";
import { getReviewerFromSession } from "@/lib/wd2-auth";
import {
  approvePayment,
  createNotification,
  getPaymentById,
  getSubmissionById,
} from "@/lib/graduation";
import { ensureAttendeeForSubmission } from "@/lib/graduation-flow";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const reviewer = await getReviewerFromSession();
  if (!reviewer) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const payment = await getPaymentById(id);
  if (!payment) {
    return NextResponse.json({ message: "Bukti pembayaran tidak ditemukan" }, { status: 404 });
  }
  if (payment.status !== "pending") {
    return NextResponse.json({ message: "Bukti ini tidak sedang menunggu review." }, { status: 400 });
  }

  const submission = await getSubmissionById(payment.submissionId);
  if (!submission) {
    return NextResponse.json({ message: "Data pengajuan tidak ditemukan" }, { status: 404 });
  }

  await approvePayment(payment.id, { type: reviewer.type, id: reviewer.id });

  if (payment.kind === "fakultas") {
    await ensureAttendeeForSubmission(submission);
  }

  await createNotification({
    recipientType: "mahasiswa",
    recipientId: submission.mahasiswaId,
    type: "payment_approved",
    title:
      payment.kind === "fakultas"
        ? "Bukti bayar Wisuda Pelepasan Fakultas disetujui"
        : "Bukti bayar Wisuda Univ disetujui",
    body:
      payment.kind === "fakultas"
        ? "Undangan wisuda pelepasan Anda sudah tersedia di dashboard."
        : "Pembayaran wisuda universitas Anda telah diverifikasi.",
    link: "/mahasiswa/dashboard",
  });

  return NextResponse.json({ status: "approved" });
}
