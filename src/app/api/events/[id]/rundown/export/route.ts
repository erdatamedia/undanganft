import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";
import * as XLSX from "xlsx";
import { getUserFromSession } from "@/lib/auth";
import { getEvent } from "@/lib/event";
import {
  listRundownAttachments,
  listRundownItems,
  type RundownAttachmentRecord,
  type RundownItemRecord,
} from "@/lib/rundown";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// ─── Shared text helpers ────────────────────────────────────────────────────

/** Strips characters outside WinAnsi/Latin-1, which crash pdf-lib's StandardFonts. */
function safeText(value: string | null | undefined): string {
  const replaced = (value ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[•·]/g, "-")
    .replace(/…/g, "...")
    .replace(/[✓✔]/g, "OK");
  return replaced.replace(/[^\x00-\xFF]/g, "").trim();
}

function wrapTextToLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}

function drawColumnLines(
  page: PDFPage,
  lines: string[],
  x: number,
  startY: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
  lineH: number
) {
  let cy = startY;
  for (const line of lines) {
    if (line) page.drawText(line, { x, y: cy, size, font, color });
    cy -= lineH;
  }
  return cy;
}

// ─── Excel ────────────────────────────────────────────────────────────────────

function buildExcel(
  items: RundownItemRecord[],
  attachments: RundownAttachmentRecord[],
  eventName: string
): Buffer {
  const rows = items.map((item) => ({
    No: item.order,
    Waktu:
      item.timeStart && item.timeEnd
        ? `${item.timeStart}–${item.timeEnd}`
        : item.timeStart || item.timeEnd || "",
    "Durasi (menit)": item.durationMinutes ?? "",
    "Rangkaian Acara": item.description || item.title,
    "PIC / Koordinator": item.pic ?? "",
    "Catatan Teknis": item.technicalNotes ?? "",
    "Musik / Audio": item.audioNotes ?? "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 4 },
    { wch: 16 },
    { wch: 10 },
    { wch: 45 },
    { wch: 28 },
    { wch: 30 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Rundown");

  for (const attachment of attachments) {
    const aoa = attachment.content.split(/\r?\n/).map((line) => [line]);
    const ws2 = XLSX.utils.aoa_to_sheet(aoa.length ? aoa : [[""]]);
    ws2["!cols"] = [{ wch: 80 }];
    const sheetName = attachment.label.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Naskah";
    XLSX.utils.book_append_sheet(wb, ws2, sheetName);
  }

  if (!items.length) {
    const ws3 = XLSX.utils.aoa_to_sheet([[eventName]]);
    XLSX.utils.book_append_sheet(wb, ws3, "Info");
  }

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

async function buildPdf(
  items: RundownItemRecord[],
  attachments: RundownAttachmentRecord[],
  event: NonNullable<Awaited<ReturnType<typeof getEvent>>>
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const margin = 44;
  const contentW = PAGE_W - margin * 2;

  const green = rgb(0.107, 0.263, 0.196); // #1B4332
  const accent = rgb(0.251, 0.569, 0.424); // #40916C
  const dark = rgb(0.102, 0.102, 0.18); // #1A1A2E
  const muted = rgb(0.42, 0.44, 0.5);
  const lightGray = rgb(0.9, 0.91, 0.93);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H;

  // ── Header bar ──
  page.drawRectangle({ x: 0, y: PAGE_H - 72, width: PAGE_W, height: 72, color: green });
  page.drawText("FAKULTAS TEKNIK", { x: margin, y: PAGE_H - 26, size: 8, font: fontBold, color: rgb(0.455, 0.776, 0.616) });
  page.drawText("Universitas Islam Malang", { x: margin, y: PAGE_H - 41, size: 13, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("Rundown Acara", { x: margin, y: PAGE_H - 57, size: 9, font, color: rgb(0.8, 0.85, 0.82) });
  y = PAGE_H - 72 - 20;

  const eventName = safeText(event.name);
  const eventNameSize = eventName.length > 70 ? 11 : 13;
  const eventNameLines = wrapTextToLines(eventName, fontBold, eventNameSize, contentW);
  y = drawColumnLines(page, eventNameLines, margin, y, eventNameSize, fontBold, dark, eventNameSize + 3);
  y -= 3;

  page.drawText(`${safeText(event.date)} ${safeText(event.time)}`, { x: margin, y, size: 9, font, color: muted });
  y -= 9 + 4;
  page.drawText(safeText(event.venue), { x: margin, y, size: 9, font, color: muted, maxWidth: contentW });
  y -= 9 + 4;
  page.drawText(`Dicetak: ${new Date().toLocaleString("id-ID")}`, { x: margin, y, size: 8, font, color: lightGray });
  y -= 8 + 14;

  page.drawLine({ start: { x: margin, y }, end: { x: PAGE_W - margin, y }, thickness: 0.5, color: lightGray });
  y -= 14;

  // ── Table ──
  const cols = [
    { key: "no", label: "No", w: 18 },
    { key: "waktu", label: "Waktu", w: 62 },
    { key: "durasi", label: "Durasi", w: 30 },
    { key: "acara", label: "Rangkaian Acara", w: 130 },
    { key: "pic", label: "PIC", w: 85 },
    { key: "teknis", label: "Catatan Teknis", w: 90 },
    { key: "audio", label: "Musik / Audio", w: contentW - (18 + 62 + 30 + 130 + 85 + 90) },
  ];
  const colX: Record<string, number> = {};
  {
    let cx = margin;
    for (const col of cols) {
      colX[col.key] = cx;
      cx += col.w;
    }
  }

  const headerSize = 7.5;
  const bodySize = 7.5;
  const lineH = 9;

  const drawTableHeader = (p: PDFPage) => {
    for (const col of cols) {
      p.drawText(col.label, { x: colX[col.key], y, size: headerSize, font: fontBold, color: dark });
    }
    y -= 3;
    p.drawLine({ start: { x: margin, y }, end: { x: PAGE_W - margin, y }, thickness: 0.5, color: accent });
    y -= lineH;
  };

  page.drawText("SUSUNAN ACARA", { x: margin, y, size: 8, font: fontBold, color: accent });
  y -= 8 + 8;
  drawTableHeader(page);

  const ensureSpace = (needed: number, continuationLabel: string) => {
    if (y - needed < margin + 20) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      page.drawRectangle({ x: 0, y: PAGE_H - 28, width: PAGE_W, height: 28, color: green });
      page.drawText(continuationLabel, { x: margin, y: PAGE_H - 19, size: 8, font, color: rgb(0.85, 0.9, 0.87) });
      y = PAGE_H - 28 - 16;
      drawTableHeader(page);
    }
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const waktuText = item.timeStart && item.timeEnd
      ? `${item.timeStart}-${item.timeEnd}`
      : item.timeStart || item.timeEnd || "-";
    const durasiText = item.durationMinutes != null ? `${item.durationMinutes}'` : "-";
    const titleText = safeText(item.title);
    const rawDesc = safeText(item.description ?? "");
    const descText = rawDesc && rawDesc !== titleText ? rawDesc : "";
    const picText = safeText(item.pic) || "-";
    const teknisText = safeText(item.technicalNotes) || "-";
    const audioText = safeText(item.audioNotes) || "-";

    const titleLines = wrapTextToLines(titleText, fontBold, bodySize, cols[3].w - 4);
    const descLines = descText ? wrapTextToLines(descText, font, bodySize, cols[3].w - 4) : [];
    const picLines = wrapTextToLines(picText, font, bodySize, cols[4].w - 4);
    const teknisLines = wrapTextToLines(teknisText, font, bodySize, cols[5].w - 4);
    const audioLines = wrapTextToLines(audioText, font, bodySize, cols[6].w - 4);

    const maxLines = Math.max(
      titleLines.length + descLines.length,
      picLines.length,
      teknisLines.length,
      audioLines.length,
      1
    );
    const rowH = maxLines * lineH + 4;

    ensureSpace(rowH, `${eventName} — Susunan Acara (lanjutan)`);

    const isEven = i % 2 === 0;
    if (isEven) {
      page.drawRectangle({ x: margin - 2, y: y - rowH + lineH - 2, width: contentW + 4, height: rowH, color: rgb(0.975, 0.985, 0.978) });
    }

    page.drawText(String(item.order), { x: colX.no, y, size: bodySize, font, color: dark });
    page.drawText(waktuText, { x: colX.waktu, y, size: bodySize, font, color: dark });
    page.drawText(durasiText, { x: colX.durasi, y, size: bodySize, font, color: dark });

    const acaraY = drawColumnLines(page, titleLines, colX.acara, y, bodySize, fontBold, dark, lineH);
    drawColumnLines(page, descLines, colX.acara, acaraY, bodySize, font, muted, lineH);
    drawColumnLines(page, picLines, colX.pic, y, bodySize, font, dark, lineH);
    drawColumnLines(page, teknisLines, colX.teknis, y, bodySize, font, dark, lineH);
    drawColumnLines(page, audioLines, colX.audio, y, bodySize, font, dark, lineH);

    y -= rowH;
  }

  // ── Attachments appendix ──
  for (const attachment of attachments) {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - margin;
    page.drawText(`LAMPIRAN: ${safeText(attachment.label).toUpperCase()}`, {
      x: margin, y, size: 11, font: fontBold, color: green,
    });
    y -= 11 + 10;
    page.drawLine({ start: { x: margin, y }, end: { x: PAGE_W - margin, y }, thickness: 0.5, color: lightGray });
    y -= 14;

    const contentLines = wrapTextToLines(safeText(attachment.content), font, 9, contentW);
    for (const line of contentLines) {
      if (y < margin + 20) {
        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - margin;
        page.drawText(`${safeText(attachment.label)} (lanjutan)`, { x: margin, y, size: 9, font: fontBold, color: muted });
        y -= 9 + 10;
      }
      if (line) page.drawText(line, { x: margin, y, size: 9, font, color: dark });
      y -= 12;
    }
  }

  return pdfDoc.save();
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return NextResponse.json({ message: "Acara tidak ditemukan" }, { status: 404 });

  const [items, attachments] = await Promise.all([
    listRundownItems(id),
    listRundownAttachments(id),
  ]);

  const format = new URL(req.url).searchParams.get("format") ?? "pdf";
  const date = new Date().toISOString().slice(0, 10);
  const safeName = event.name.replace(/[^a-z0-9]/gi, "-").slice(0, 40).toLowerCase();

  if (format === "excel" || format === "xlsx") {
    const buf = buildExcel(items, attachments, event.name);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="rundown-${safeName}-${date}.xlsx"`,
      },
    });
  }

  const pdfBytes = await buildPdf(items, attachments, event);
  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rundown-${safeName}-${date}.pdf"`,
    },
  });
}
