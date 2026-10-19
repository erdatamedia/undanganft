import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getUserFromSession } from "@/lib/auth";
import { importEligible } from "@/lib/graduation";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ message: "File Excel wajib diunggah." }, { status: 400 });
  }

  let rows: { npm: string; name: string; program?: string }[] = [];
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    rows = raw
      .map((row) => {
        const normalized = Object.fromEntries(
          Object.entries(row).map(([k, v]) => [
            k.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
            v,
          ])
        ) as Record<string, string>;

        const npm = String(
          normalized.npm || normalized.nomor_pokok_mahasiswa || normalized.nomor_induk || ""
        ).trim();
        const name = String(normalized.nama || normalized.name || normalized.nama_lengkap || "").trim();
        const program = String(normalized.program || normalized.prodi || normalized.program_studi || "").trim();

        return { npm, name, program: program || undefined };
      })
      .filter((row) => row.npm && row.name);
  } catch (error) {
    return NextResponse.json(
      { message: `File Excel tidak valid: ${(error as Error).message}` },
      { status: 400 }
    );
  }

  if (!rows.length) {
    return NextResponse.json(
      { message: "Tidak ditemukan baris dengan kolom NPM dan Nama yang valid." },
      { status: 400 }
    );
  }

  const result = await importEligible(id, rows);
  return NextResponse.json(result);
}
