import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import {
  createNotification,
  getMahasiswaById,
  getOrCreateSubmission,
  getPayments,
  notifyAllWd2,
  searchDeskStudents,
  upsertDeskPayment,
  upsertPickup,
} from "@/lib/graduation";
import { ensureAttendeeForSubmission } from "@/lib/graduation-flow";

export const runtime = "nodejs";

const MAX_DATA_URI = 3_000_000;

function validPhoto(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("data:image/") &&
    value.length <= MAX_DATA_URI
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ students: [] });
  }
  const students = await searchDeskStudents(id, q);
  return NextResponse.json({ students });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { id: eventId } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    mahasiswaId?: string;
    fakultas?: string;
    univ?: string;
    handover?: string;
    undanganGiven?: boolean;
    togaGiven?: boolean;
    skipUniv?: boolean;
    skipFakultas?: boolean;
    note?: string;
  };

  if (!body.mahasiswaId) {
    return NextResponse.json({ message: "Mahasiswa belum dipilih." }, { status: 400 });
  }
  if (!validPhoto(body.handover)) {
    return NextResponse.json({ message: "Foto serah-terima wajib (maks ~2MB)." }, { status: 400 });
  }
  if (!body.undanganGiven && !body.togaGiven) {
    return NextResponse.json({ message: "Pilih minimal satu: undangan atau toga diserahkan." }, { status: 400 });
  }

  const mahasiswa = await getMahasiswaById(body.mahasiswaId);
  if (!mahasiswa) {
    return NextResponse.json({ message: "Mahasiswa tidak ditemukan." }, { status: 404 });
  }

  const submission = await getOrCreateSubmission(eventId, mahasiswa.id);

  // Bukti yang sudah diunggah mahasiswa sendiri boleh dilewati di meja (tetap diverifikasi WD2).
  const existing = await getPayments(submission.id);
  const hasOwnProof = (kind: "fakultas" | "univ") =>
    Boolean(existing[kind]?.proof) && existing[kind]?.status !== "rejected";

  if (body.skipFakultas) {
    if (!hasOwnProof("fakultas") && !body.note?.trim()) {
      return NextResponse.json({ message: "Catatan wajib diisi bila bukti fakultas dilewati (mahasiswa belum mengunggah)." }, { status: 400 });
    }
  } else if (!validPhoto(body.fakultas)) {
    return NextResponse.json({ message: "Foto bukti bayar fakultas wajib (maks ~2MB)." }, { status: 400 });
  }
  if (body.skipUniv) {
    if (!hasOwnProof("univ") && !body.note?.trim()) {
      return NextResponse.json({ message: "Catatan wajib diisi bila bukti univ dilewati (mahasiswa belum mengunggah)." }, { status: 400 });
    }
  } else if (!validPhoto(body.univ)) {
    return NextResponse.json({ message: "Foto bukti bayar univ wajib (maks ~2MB)." }, { status: 400 });
  }

  if (!body.skipFakultas && body.fakultas) {
    await upsertDeskPayment(submission.id, "fakultas", body.fakultas, user.id);
  }
  if (!body.skipUniv && body.univ) {
    await upsertDeskPayment(submission.id, "univ", body.univ, user.id);
  }
  const attendee = await ensureAttendeeForSubmission(submission);
  const pickup = await upsertPickup({
    submissionId: submission.id,
    adminId: user.id,
    undanganGiven: Boolean(body.undanganGiven),
    togaGiven: Boolean(body.togaGiven),
    handoverPhoto: body.handover,
    note: body.note,
  });

  await notifyAllWd2({
    type: "pickup_logged",
    title: `Serah-terima di meja: ${mahasiswa.name}`,
    body: `NPM ${mahasiswa.npm} sudah menerima undangan/toga dari admin. Mohon verifikasi susulan.`,
    link: "/wd2/review",
  });
  await createNotification({
    recipientType: "mahasiswa",
    recipientId: mahasiswa.id,
    type: "pickup_done",
    title: "Pengambilan undangan/toga tercatat",
    body: "Admin sudah mencatat pengambilan Anda. Undangan tersedia di dashboard.",
    link: "/mahasiswa/dashboard",
  });

  return NextResponse.json({ pickup, inviteToken: attendee?.token ?? null });
}
