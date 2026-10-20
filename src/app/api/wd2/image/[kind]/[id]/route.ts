import { NextResponse } from "next/server";
import { getReviewerFromSession } from "@/lib/wd2-auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";

/** Foto bukti / serah-terima disajikan terpisah (bukan base64 di JSON) agar daftar review cepat. */
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const reviewer = await getReviewerFromSession();
  if (!reviewer) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { kind, id } = await params;

  let sql: string;
  if (kind === "payment") sql = "select proof as img from graduation_payments where id=$1";
  else if (kind === "handover") sql = "select handover_photo as img from graduation_pickups where id=$1";
  else return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });

  const rows = await query<{ img: string | null }>(sql, [id]).catch(() => []);
  const match = rows[0]?.img?.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!match) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });
  return new NextResponse(new Uint8Array(Buffer.from(match[2], "base64")), {
    headers: { "Content-Type": match[1], "Cache-Control": "private, max-age=300" },
  });
}
