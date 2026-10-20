import { NextRequest, NextResponse } from "next/server";
import { getReviewerFromSession } from "@/lib/wd2-auth";
import {
  createNotification,
  getPaymentById,
  getSubmissionById,
  rejectPayment,
} from "@/lib/graduation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const reviewer = await getReviewerFromSession();
  if (!reviewer) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const reason = body.reason?.trim();
  if (!reason) {
    return NextResponse.json({ message: "Alasan penolakan wajib diisi." }, { status: 400 });
  }

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

  await rejectPayment(payment.id, { type: reviewer.type, id: reviewer.id }, reason);

  await createNotification({
    recipientType: "mahasiswa",
    recipientId: submission.mahasiswaId,
    type: "payment_rejected",
    title:
      payment.kind === "fakultas"
        ? "Bukti bayar Wisuda Pelepasan Fakultas ditolak"
        : "Bukti bayar Wisuda Univ ditolak",
    body: `Alasan: ${reason}. Silakan unggah ulang bukti pembayaran yang valid.`,
    link: "/mahasiswa/dashboard",
  });

  return NextResponse.json({ status: "rejected" });
}
