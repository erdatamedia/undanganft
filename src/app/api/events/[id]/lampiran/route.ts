import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import {
  deleteEventDocument,
  listEventDocuments,
  saveEventDocument,
  type DocKind,
} from "@/lib/graduation";

export const runtime = "nodejs";

const MAX_PDF_SIZE = 10 * 1024 * 1024;

const asKind = (v: unknown): DocKind | null => (v === "yudisium" || v === "wisuda" ? v : null);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  return NextResponse.json({ documents: await listEventDocuments(id) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const form = await req.formData();
  const kind = asKind(form.get("kind"));
  const file = form.get("file");
  if (!kind) {
    return NextResponse.json({ message: "Jenis lampiran tidak valid." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "File PDF wajib diunggah." }, { status: 400 });
  }
  if (file.size > MAX_PDF_SIZE) {
    return NextResponse.json({ message: "Ukuran PDF maksimal 10MB." }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.subarray(0, 4).toString("latin1") !== "%PDF") {
    return NextResponse.json({ message: "File harus berformat PDF." }, { status: 400 });
  }

  await saveEventDocument(id, kind, file.name || `${kind}.pdf`, buffer);
  return NextResponse.json({ documents: await listEventDocuments(id) });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const kind = asKind(new URL(req.url).searchParams.get("kind"));
  if (!kind) {
    return NextResponse.json({ message: "Jenis lampiran tidak valid." }, { status: 400 });
  }
  await deleteEventDocument(id, kind);
  return NextResponse.json({ documents: await listEventDocuments(id) });
}
