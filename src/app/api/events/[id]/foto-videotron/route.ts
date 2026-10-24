import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { listVideotron, listVideotronFiles } from "@/lib/graduation";
import { createZip, safeFileName } from "@/lib/zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const sp = new URL(req.url).searchParams;
  if (sp.get("format") !== "zip") {
    return NextResponse.json({ rows: await listVideotron(id) });
  }

  // Unduh semua: satu berkas ZIP, nama berkas = nama akun mahasiswa (opsional dikelompokkan per prodi).
  const files = await listVideotronFiles(id);
  if (!files.length) return NextResponse.json({ message: "Belum ada foto yang diunggah." }, { status: 404 });
  const flat = sp.get("flat") === "1";

  const used = new Set<string>();
  const entries = files.flatMap((f) => {
    const m = f.photo.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (!m) return [];
    const ext = EXT[m[1]] ?? "jpg";
    const folder = flat ? "" : `${safeFileName(f.program || "Belum ditentukan")}/`;
    let base = `${folder}${safeFileName(f.name)}`;
    if (used.has(`${base}.${ext}`.toLowerCase())) base = `${base} - ${f.npm}`; // nama kembar: tambahkan NPM
    const name = `${base}.${ext}`;
    used.add(name.toLowerCase());
    return [{ name, data: Buffer.from(m[2], "base64") }];
  });

  const zip = createZip(entries);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="foto-videotron-${date}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
