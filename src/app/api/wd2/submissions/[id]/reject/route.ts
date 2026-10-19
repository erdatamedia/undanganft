import { NextRequest, NextResponse } from "next/server";
import { getWd2FromSession } from "@/lib/wd2-auth";
import { createNotification, getSubmissionById, rejectSubmission } from "@/lib/graduation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const wd2 = await getWd2FromSession();
  if (!wd2) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const reason = body.reason?.trim();
  if (!reason) {
    return NextResponse.json({ message: "Alasan penolakan wajib diisi." }, { status: 400 });
  }

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

  const updated = await rejectSubmission(submission.id, wd2.id, reason);

  await createNotification({
    recipientType: "mahasiswa",
    recipientId: submission.mahasiswaId,
    type: "payment_rejected",
    title: "Bukti pembayaran ditolak",
    body: `Alasan: ${reason}. Silakan unggah ulang bukti pembayaran yang valid.`,
    link: "/mahasiswa/dashboard",
  });

  return NextResponse.json({ submission: updated });
}
