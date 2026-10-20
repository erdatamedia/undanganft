import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getUserFromSession } from "@/lib/auth";
import { importEligible } from "@/lib/graduation";

export const runtime = "nodejs";

type Row = { npm: string; name: string; program?: string };

const norm = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const titleCase = (text: string) =>
  text
    .toLowerCase()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/** "DAFTAR HADIR MAHASISWA TEKNIK SIPIL" -> "Teknik Sipil"; falls back to the sheet name. */
function programFromSheet(sheet: XLSX.WorkSheet, sheetName: string): string {
  const title = String(sheet["A1"]?.v ?? "");
  const match = title.match(/MAHASISWA\s+(.+)$/i);
  return titleCase((match?.[1] ?? sheetName).trim());
}

function parseSheet(sheet: XLSX.WorkSheet, sheetName: string): Row[] {
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });

  let headerIndex = -1;
  let cols = { npm: -1, name: -1, program: -1 };
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const keys = grid[i].map(norm);
    const npm = keys.findIndex((k) => ["npm", "nomor_pokok_mahasiswa", "nomor_induk"].includes(k));
    const name = keys.findIndex((k) => ["nama", "name", "nama_lengkap"].includes(k));
    if (npm !== -1 && name !== -1) {
      headerIndex = i;
      cols = { npm, name, program: keys.findIndex((k) => ["program", "prodi", "program_studi"].includes(k)) };
      break;
    }
  }
  if (headerIndex === -1) return [];

  const sheetProgram = programFromSheet(sheet, sheetName);
  const rows: Row[] = [];
  for (const line of grid.slice(headerIndex + 1)) {
    const npm = String(line[cols.npm] ?? "").trim();
    const name = String(line[cols.name] ?? "").trim().replace(/\s+/g, " ");
    if (!npm || !name) continue;
    const program = cols.program !== -1 ? String(line[cols.program] ?? "").trim() : "";
    rows.push({ npm, name, program: program || sheetProgram });
  }
  return rows;
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
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ message: "File Excel wajib diunggah." }, { status: 400 });
  }

  const rows: Row[] = [];
  const perSheet: Record<string, number> = {};
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    for (const sheetName of wb.SheetNames) {
      const parsed = parseSheet(wb.Sheets[sheetName], sheetName);
      perSheet[sheetName] = parsed.length;
      rows.push(...parsed);
    }
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
  return NextResponse.json({ ...result, perSheet });
}
