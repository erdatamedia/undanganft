import { NextResponse } from "next/server";
import { getAttendee, normalizeAttendeeId, updateAttendee } from "@/lib/storage";

const MAX_UPLOAD_SIZE = 2 * 1024 * 1024; // 2MB
export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const attendeeId = normalizeAttendeeId(id);
  const attendee = await getAttendee(attendeeId);

  if (!attendee) {
    return NextResponse.json(
      { message: "Data undangan tidak ditemukan" },
      { status: 404 }
    );
  }

  const form = await req.formData();
  const file = form.get("photo");

  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { message: "File foto wajib diunggah." },
      { status: 400 }
    );
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json(
      { message: "Ukuran foto maksimal 2MB." },
      { status: 400 }
    );
  }

  const mimeType = file.type || "application/octet-stream";
  if (!mimeType.startsWith("image/")) {
    return NextResponse.json(
      { message: "File harus berupa gambar." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const photoData = `data:${mimeType};base64,${base64}`;

  const updated = await updateAttendee(attendeeId, (current) => ({
    ...current,
    photoData,
  }));

  if (!updated) {
    return NextResponse.json(
      { message: "Gagal menyimpan foto." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: "ok",
    attendee: updated,
    photoData: updated.photoData ?? null,
  });
}
