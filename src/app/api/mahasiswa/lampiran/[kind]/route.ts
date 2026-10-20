import { NextRequest, NextResponse } from "next/server";
import { findActiveEvent, getEventDocument } from "@/lib/graduation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public: invitation attachment of the currently active event. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ kind: string }> }
) {
  const { kind } = await params;
  if (kind !== "yudisium" && kind !== "wisuda") {
    return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });
  }
  const active = await findActiveEvent();
  if (!active) {
    return NextResponse.json({ message: "Tidak ada acara aktif" }, { status: 404 });
  }
  const doc = await getEventDocument(active.eventId, kind);
  if (!doc) {
    return NextResponse.json({ message: "Lampiran belum tersedia" }, { status: 404 });
  }

  const download = new URL(req.url).searchParams.get("download") === "1";
  const safeName = doc.filename.replace(/[^\w.\- ]+/g, "_");
  return new NextResponse(new Uint8Array(doc.data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
