import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { getVideotronOwnerByNpm } from "@/lib/graduation";
import { safeFileName } from "@/lib/zip";

export async function GET(req: Request, { params }: { params: Promise<{ id: string; npm: string }> }) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { npm } = await params;
  const owner = await getVideotronOwnerByNpm(decodeURIComponent(npm));
  const match = owner?.photo?.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!owner || !match) return NextResponse.json({ message: "Belum ada foto" }, { status: 404 });
  const ext = match[1].split("/")[1].replace("jpeg", "jpg");
  const download = new URL(req.url).searchParams.get("download") === "1";
  // Nama berkas = nama akun mahasiswa (header dua versi agar nama berspasi/beraksen aman).
  const fileName = `${safeFileName(owner.name)}.${ext}`;
  const ascii = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return new NextResponse(new Uint8Array(Buffer.from(match[2], "base64")), {
    headers: {
      "Content-Type": match[1],
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
