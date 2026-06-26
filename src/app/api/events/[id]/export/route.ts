import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { getEvent } from "@/lib/event";
import { readAttendees } from "@/lib/storage";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// ─── Excel ────────────────────────────────────────────────────────────────────

function buildExcel(
  attendees: Awaited<ReturnType<typeof readAttendees>>,
  eventName: string
): Buffer {
  const statusLabel: Record<string, string> = {
    draft: "Belum Dikirim",
    sent: "Terkirim",
    confirmed: "Hadir",
    absent: "Tidak Hadir",
  };

  const rows = attendees.map((a, i) => ({
    No: i + 1,
    Nama: a.name,
    NPM: a.npm,
    "Program Studi": a.program,
    Email: a.email,
    "Nomor Kursi": a.seat,
    Status: statusLabel[a.status] ?? a.status,
    "Waktu Kirim Undangan": a.sentAt
      ? new Date(a.sentAt).toLocaleString("id-ID")
      : "-",
    "Waktu Konfirmasi Hadir": a.confirmedAt
      ? new Date(a.confirmedAt).toLocaleString("id-ID")
      : "-",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 4 },
    { wch: 30 },
    { wch: 16 },
    { wch: 24 },
    { wch: 28 },
    { wch: 12 },
    { wch: 14 },
    { wch: 22 },
    { wch: 22 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Kehadiran");

  // Summary sheet
  const programs = new Map<string, { total: number; confirmed: number }>();
  for (const a of attendees) {
    const key = a.program || "Lainnya";
    const cur = programs.get(key) ?? { total: 0, confirmed: 0 };
    cur.total++;
    if (a.status === "confirmed") cur.confirmed++;
    programs.set(key, cur);
  }

  const total = attendees.length;
  const confirmed = attendees.filter((a) => a.status === "confirmed").length;

  const summaryRows = [
    { Keterangan: "Nama Acara", Nilai: eventName },
    { Keterangan: "Total Peserta", Nilai: total },
    { Keterangan: "Konfirmasi Hadir", Nilai: confirmed },
    {
      Keterangan: "Response Rate",
      Nilai: total ? `${Math.round((confirmed / total) * 100)}%` : "0%",
    },
    { Keterangan: "", Nilai: "" },
    { Keterangan: "Program Studi", Nilai: "Total / Hadir" },
    ...Array.from(programs.entries()).map(([prog, stat]) => ({
      Keterangan: prog,
      Nilai: `${stat.confirmed} / ${stat.total}`,
    })),
  ];

  const ws2 = XLSX.utils.json_to_sheet(summaryRows);
  ws2["!cols"] = [{ wch: 24 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Ringkasan");

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

async function buildPdf(
  attendees: Awaited<ReturnType<typeof readAttendees>>,
  event: NonNullable<Awaited<ReturnType<typeof getEvent>>>
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const margin = 44;
  const contentW = PAGE_W - margin * 2;

  // Color palette
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
  page.drawText("Rekap Kehadiran Peserta", { x: margin, y: PAGE_H - 57, size: 9, font, color: rgb(0.8, 0.85, 0.82) });
  y = PAGE_H - 72 - 20;

  // ── Event info ──
  const maxEventNameW = contentW;
  const eventNameSize = event.name.length > 70 ? 11 : 13;
  page.drawText(event.name, { x: margin, y, size: eventNameSize, font: fontBold, color: dark, maxWidth: maxEventNameW });
  y -= eventNameSize + 6;

  const timeRange = event.timeEnd ? `${event.time} – ${event.timeEnd}` : event.time;
  page.drawText(`${event.date}  •  ${timeRange}`, { x: margin, y, size: 9, font, color: muted });
  y -= 9 + 4;
  page.drawText(event.venue, { x: margin, y, size: 9, font, color: muted, maxWidth: contentW });
  y -= 9 + 4;
  page.drawText(`Dicetak: ${new Date().toLocaleString("id-ID")}`, { x: margin, y, size: 8, font, color: lightGray });
  y -= 8 + 14;

  // ── Divider ──
  page.drawLine({ start: { x: margin, y }, end: { x: PAGE_W - margin, y }, thickness: 0.5, color: lightGray });
  y -= 14;

  // ── Stats ──
  const total = attendees.length;
  const confirmed = attendees.filter((a) => a.status === "confirmed").length;
  const absent = attendees.filter((a) => a.status === "absent").length;
  const rate = total ? Math.round((confirmed / total) * 100) : 0;

  const statBoxes = [
    { label: "Total Peserta", value: String(total) },
    { label: "Konfirmasi Hadir", value: String(confirmed) },
    { label: "Tidak Hadir", value: String(absent) },
    { label: "Response Rate", value: `${rate}%` },
  ];

  const boxW = (contentW - 9) / 4;
  const boxH = 38;
  statBoxes.forEach((stat, i) => {
    const bx = margin + i * (boxW + 3);
    page.drawRectangle({ x: bx, y: y - boxH, width: boxW, height: boxH, color: rgb(0.968, 0.98, 0.972), borderColor: lightGray, borderWidth: 0.5 });
    page.drawText(stat.value, { x: bx + 6, y: y - 18, size: 14, font: fontBold, color: green });
    page.drawText(stat.label, { x: bx + 6, y: y - 32, size: 7, font, color: muted });
  });
  y -= boxH + 16;

  // ── Program studi breakdown ──
  const programs = new Map<string, { total: number; confirmed: number }>();
  for (const a of attendees) {
    const key = a.program || "Lainnya";
    const cur = programs.get(key) ?? { total: 0, confirmed: 0 };
    cur.total++;
    if (a.status === "confirmed") cur.confirmed++;
    programs.set(key, cur);
  }

  page.drawText("REKAP PER PROGRAM STUDI", { x: margin, y, size: 8, font: fontBold, color: accent });
  y -= 8 + 6;

  const progEntries = Array.from(programs.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const progColW = (contentW - 6) / 3;
  let progX = margin;
  let progY = y;
  let progCount = 0;

  for (const [prog, stat] of progEntries) {
    if (progCount > 0 && progCount % 3 === 0) {
      progY -= 24;
      progX = margin;
    }
    const pct = stat.total ? Math.round((stat.confirmed / stat.total) * 100) : 0;
    page.drawText(`${prog}`, { x: progX, y: progY, size: 8, font: fontBold, color: dark, maxWidth: progColW - 4 });
    page.drawText(`${stat.confirmed}/${stat.total}  (${pct}%)`, { x: progX, y: progY - 10, size: 7.5, font, color: muted });
    progX += progColW + 3;
    progCount++;
  }
  y = progY - 24 - 8;

  // ── Divider ──
  page.drawLine({ start: { x: margin, y }, end: { x: PAGE_W - margin, y }, thickness: 0.5, color: lightGray });
  y -= 14;

  // ── Attendee table ──
  page.drawText("DAFTAR PESERTA", { x: margin, y, size: 8, font: fontBold, color: accent });
  y -= 8 + 8;

  const cols = [
    { label: "No", w: 22 },
    { label: "Nama", w: 148 },
    { label: "NPM", w: 72 },
    { label: "Program Studi", w: 110 },
    { label: "Kursi", w: 36 },
    { label: "Status", w: 50 },
    { label: "Waktu Hadir", w: 90 },
  ];

  const rowH = 13;

  const drawTableHeader = (p: typeof page) => {
    let cx = margin;
    for (const col of cols) {
      p.drawText(col.label, { x: cx, y, size: 7.5, font: fontBold, color: dark });
      cx += col.w;
    }
    y -= 3;
    p.drawLine({ start: { x: margin, y }, end: { x: PAGE_W - margin, y }, thickness: 0.5, color: accent });
    y -= rowH - 3;
  };

  drawTableHeader(page);

  const statusLabel: Record<string, string> = {
    draft: "Draft",
    sent: "Terkirim",
    confirmed: "Hadir",
    absent: "Absen",
  };

  for (let i = 0; i < attendees.length; i++) {
    if (y < margin + 20) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      // Continuation header
      page.drawRectangle({ x: 0, y: PAGE_H - 28, width: PAGE_W, height: 28, color: green });
      page.drawText(`${event.name} — Rekap Kehadiran (lanjutan)`, { x: margin, y: PAGE_H - 19, size: 8, font, color: rgb(0.85, 0.9, 0.87) });
      y = PAGE_H - 28 - 16;
      drawTableHeader(page);
    }

    const a = attendees[i];
    const isEven = i % 2 === 0;
    if (isEven) {
      page.drawRectangle({ x: margin - 2, y: y - 2, width: contentW + 4, height: rowH, color: rgb(0.975, 0.985, 0.978) });
    }

    const rowColor = a.status === "confirmed" ? accent : a.status === "absent" ? rgb(0.86, 0.15, 0.15) : dark;
    let cx = margin;
    const cells = [
      String(i + 1),
      a.name.length > 26 ? a.name.slice(0, 24) + "…" : a.name,
      a.npm,
      a.program.length > 20 ? a.program.slice(0, 18) + "…" : a.program,
      a.seat,
      statusLabel[a.status] ?? a.status,
      a.confirmedAt ? new Date(a.confirmedAt).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-",
    ];

    cells.forEach((cell, ci) => {
      const color = ci === 5 ? rowColor : dark;
      page.drawText(cell, { x: cx, y, size: 7.5, font: ci === 5 ? fontBold : font, color });
      cx += cols[ci].w;
    });
    y -= rowH;
  }

  // Footer on last page
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: PAGE_W - margin, y }, thickness: 0.5, color: lightGray });
  y -= 10;
  page.drawText(`Total: ${total} peserta  |  Hadir: ${confirmed}  |  Response Rate: ${rate}%`, {
    x: margin, y, size: 8, font: fontBold, color: muted,
  });

  return pdfDoc.save();
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return NextResponse.json({ message: "Acara tidak ditemukan" }, { status: 404 });

  const attendees = await readAttendees(id);
  const format = new URL(req.url).searchParams.get("format") ?? "pdf";
  const date = new Date().toISOString().slice(0, 10);
  const safeName = event.name.replace(/[^a-z0-9]/gi, "-").slice(0, 40).toLowerCase();

  if (format === "excel" || format === "xlsx") {
    const buf = buildExcel(attendees, event.name);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="rekap-${safeName}-${date}.xlsx"`,
      },
    });
  }

  // Default: PDF
  const pdfBytes = await buildPdf(attendees, event);
  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rekap-${safeName}-${date}.pdf"`,
    },
  });
}
