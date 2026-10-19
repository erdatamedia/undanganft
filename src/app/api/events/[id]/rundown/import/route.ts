import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getUserFromSession } from "@/lib/auth";
import {
  replaceRundownFromImport,
  type RundownAttachmentPayload,
  type RundownItemPayload,
} from "@/lib/rundown";

export const runtime = "nodejs";

function parseWaktu(raw: unknown): { timeStart: string | null; timeEnd: string | null } {
  const text = String(raw ?? "").trim();
  if (!text) return { timeStart: null, timeEnd: null };
  const [start, end] = text.split(/[–-]/).map((s) => s.trim());
  return { timeStart: start || null, timeEnd: end || null };
}

function parseRundownExcel(buffer: Buffer): {
  items: RundownItemPayload[];
  attachments: RundownAttachmentPayload[];
} {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const items: RundownItemPayload[] = [];
  const attachments: RundownAttachmentPayload[] = [];

  const mainSheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(mainSheet, { header: 1 });

  for (const row of rows) {
    const [no, waktu, durasi, acara, pic, catatanTeknis, audio] = row as unknown[];
    if (no === undefined || no === null || Number.isNaN(Number(no))) continue;

    const { timeStart, timeEnd } = parseWaktu(waktu);
    const acaraText = String(acara ?? "").trim();
    const title = acaraText.split(".")[0].trim() || acaraText || `Acara ${no}`;

    items.push({
      order: Number(no),
      timeStart,
      timeEnd,
      durationMinutes: durasi !== undefined && durasi !== "" ? Number(durasi) || null : undefined,
      title,
      description: acaraText || null,
      pic: pic ? String(pic).trim() : null,
      technicalNotes: catatanTeknis ? String(catatanTeknis).trim() : null,
      audioNotes: audio ? String(audio).trim() : null,
    });
  }

  for (let i = 1; i < wb.SheetNames.length; i += 1) {
    const sheetName = wb.SheetNames[i];
    const sheet = wb.Sheets[sheetName];
    const content = XLSX.utils.sheet_to_csv(sheet);
    if (content.trim()) {
      attachments.push({ label: sheetName, content, order: i - 1 });
    }
  }

  return { items, attachments };
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

  let parsed: ReturnType<typeof parseRundownExcel>;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = parseRundownExcel(buffer);
  } catch (error) {
    return NextResponse.json(
      { message: `File Excel tidak valid: ${(error as Error).message}` },
      { status: 400 }
    );
  }

  if (!parsed.items.length) {
    return NextResponse.json(
      { message: "Tidak ditemukan baris rundown yang valid pada sheet pertama." },
      { status: 400 }
    );
  }

  const result = await replaceRundownFromImport(id, parsed.items, parsed.attachments);
  return NextResponse.json(result);
}
