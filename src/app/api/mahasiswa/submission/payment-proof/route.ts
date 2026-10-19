import { NextResponse } from "next/server";
import { getMahasiswaFromSession } from "@/lib/mahasiswa-auth";
import {
  findActiveEvent,
  getOrCreateSubmission,
  notifyAllWd2,
  uploadPaymentProof,
} from "@/lib/graduation";

export const runtime = "nodejs";

const MAX_UPLOAD_SIZE = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const mhs = await getMahasiswaFromSession();
  if (!mhs) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const active = await findActiveEvent();
  if (!active) {
    return NextResponse.json({ message: "Tidak ada acara aktif." }, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get("photo");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ message: "Foto bukti pembayaran wajib diunggah." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json({ message: "Ukuran foto maksimal 2MB." }, { status: 400 });
  }
  const mimeType = file.type || "image/jpeg";
  if (!mimeType.startsWith("image/")) {
    return NextResponse.json({ message: "File harus berupa foto." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const dataUri = `data:${mimeType};base64,${base64}`;

  const submission = await getOrCreateSubmission(active.eventId, mhs.id);
  const updated = await uploadPaymentProof(submission.id, dataUri);

  await notifyAllWd2({
    type: "payment_submitted",
    title: `Bukti pembayaran baru: ${mhs.name}`,
    body: `NPM ${mhs.npm} mengunggah bukti pembayaran wisuda dan menunggu review.`,
    link: "/wd2/review",
  });

  return NextResponse.json({ submission: updated });
}
