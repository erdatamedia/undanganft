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
  eventName: string,
  dual = false
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
    [dual ? "Waktu Hadir Yudisium" : "Waktu Konfirmasi Hadir"]: a.confirmedAt
      ? new Date(a.confirmedAt).toLocaleString("id-ID")
      : "-",
    ...(dual
      ? {
          "Hadir Pelepasan": a.pelepasanConfirmedAt ? "Hadir" : "Belum",
          "Waktu Hadir Pelepasan": a.pelepasanConfirmedAt
            ? new Date(a.pelepasanConfirmedAt).toLocaleString("id-ID")
            : "-",
        }
      : {}),
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
    ...(dual ? [{ wch: 16 }, { wch: 22 }] : []),
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
    { Keterangan: dual ? "Hadir Yudisium" : "Konfirmasi Hadir", Nilai: confirmed },
    ...(dual
      ? [{ Keterangan: "Hadir Pelepasan", Nilai: attendees.filter((a) => a.pelepasanConfirmedAt).length }]
      : []),
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
  const dual = Boolean(event.dualAgenda);
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const margin = 44;
  const contentW = PAGE_W - margin * 2;
  const right = PAGE_W - margin;

  const green = rgb(0.107, 0.263, 0.196);
  const accent = rgb(0.251, 0.569, 0.424);
  const sky = rgb(0.059, 0.38, 0.62);
  const dark = rgb(0.102, 0.102, 0.18);
  const muted = rgb(0.42, 0.44, 0.5);
  const lightGray = rgb(0.9, 0.91, 0.93);
  const panel = rgb(0.968, 0.98, 0.972);

  // Helvetica (WinAnsi) tidak bisa menggambar semua karakter; ganti yang tak didukung.
  const clean = (t: string) => (t ?? "").replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?");
  const width = (t: string, size: number, f = font) => f.widthOfTextAtSize(clean(t), size);
  const fit = (t: string, size: number, maxW: number, f = font) => {
    let out = clean(t);
    if (f.widthOfTextAtSize(out, size) <= maxW) return out;
    while (out.length > 1 && f.widthOfTextAtSize(out + "...", size) > maxW) out = out.slice(0, -1);
    return out.trimEnd() + "...";
  };
  const wrap = (t: string, size: number, maxW: number, f = font) => {
    const lines: string[] = [];
    let cur = "";
    for (const word of clean(t).split(/\s+/).filter(Boolean)) {
      const test = cur ? `${cur} ${word}` : word;
      if (cur && f.widthOfTextAtSize(test, size) > maxW) {
        lines.push(cur);
        cur = word;
      } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const text = (pg: typeof page, t: string, x: number, yy: number, size: number, f = font, color = dark) =>
    pg.drawText(clean(t), { x, y: yy, size, font: f, color });
  const textRight = (pg: typeof page, t: string, xr: number, yy: number, size: number, f = font, color = dark) =>
    pg.drawText(clean(t), { x: xr - width(t, size, f), y: yy, size, font: f, color });

  const fmtTime = (v?: string | null) =>
    v ? new Date(v).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", "") : "";

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);

  // ── Header ──
  page.drawRectangle({ x: 0, y: PAGE_H - 72, width: PAGE_W, height: 72, color: green });
  text(page, "FAKULTAS TEKNIK", margin, PAGE_H - 26, 8, fontBold, rgb(0.455, 0.776, 0.616));
  text(page, "Universitas Islam Malang", margin, PAGE_H - 41, 13, fontBold, rgb(1, 1, 1));
  text(page, "Rekap Kehadiran Peserta", margin, PAGE_H - 57, 9, font, rgb(0.8, 0.85, 0.82));
  let y = PAGE_H - 72 - 24;

  // ── Info acara (judul dibungkus agar tidak menimpa baris di bawahnya) ──
  for (const line of wrap(event.name, 13, contentW, fontBold)) {
    text(page, line, margin, y, 13, fontBold, dark);
    y -= 17;
  }
  const timeRange = event.timeEnd ? `${event.time} - ${event.timeEnd}` : event.time;
  y -= 2;
  text(page, `${event.date}  |  ${timeRange}`, margin, y, 9, font, muted);
  y -= 13;
  for (const line of wrap(event.venue ?? "", 9, contentW)) {
    text(page, line, margin, y, 9, font, muted);
    y -= 13;
  }
  text(page, `Dicetak: ${new Date().toLocaleString("id-ID")}`, margin, y, 8, font, muted);
  y -= 16;
  page.drawLine({ start: { x: margin, y }, end: { x: right, y }, thickness: 0.5, color: lightGray });
  y -= 18;

  // ── Ringkasan ──
  const total = attendees.length;
  const yudisiumHadir = attendees.filter((a) => a.status === "confirmed").length;
  const yudisiumAbsen = attendees.filter((a) => a.status === "absent").length;
  const pelepasanHadir = attendees.filter((a) => a.pelepasanConfirmedAt).length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  const summaryBlocks = dual
    ? [
        { title: "YUDISIUM", color: green, hadir: yudisiumHadir, extra: `Tidak hadir: ${yudisiumAbsen}` },
        { title: "PELEPASAN", color: sky, hadir: pelepasanHadir, extra: `Belum hadir: ${total - pelepasanHadir}` },
      ]
    : [{ title: "KEHADIRAN", color: green, hadir: yudisiumHadir, extra: `Tidak hadir: ${yudisiumAbsen}` }];

  const gap = 10;
  const blockW = (contentW - gap * (summaryBlocks.length)) / (summaryBlocks.length + 1);
  // kotak pertama: total peserta
  const boxH = 54;
  const drawBox = (idx: number, title: string, big: string, sub: string, color: ReturnType<typeof rgb>) => {
    const bx = margin + idx * (blockW + gap);
    page.drawRectangle({ x: bx, y: y - boxH, width: blockW, height: boxH, color: panel, borderColor: lightGray, borderWidth: 0.5 });
    page.drawRectangle({ x: bx, y: y - boxH, width: 3, height: boxH, color });
    text(page, title, bx + 10, y - 14, 7.5, fontBold, color);
    text(page, big, bx + 10, y - 33, 17, fontBold, dark);
    text(page, sub, bx + 10, y - 46, 7.5, font, muted);
  };
  drawBox(0, "TOTAL PESERTA", String(total), `${new Set(attendees.map((a) => a.program || "-")).size} program studi`, accent);
  summaryBlocks.forEach((b, i) =>
    drawBox(i + 1, b.title, `${b.hadir} hadir (${pct(b.hadir)}%)`, b.extra, b.color)
  );
  y -= boxH + 22;

  // ── Rekap per prodi ──
  const sorted = [...attendees].sort(
    (a, b) => (a.program || "~").localeCompare(b.program || "~") || a.name.localeCompare(b.name)
  );
  const byProgram = new Map<string, typeof attendees>();
  for (const a of sorted) {
    const key = a.program || "Belum ditentukan";
    byProgram.set(key, [...(byProgram.get(key) ?? []), a]);
  }

  text(page, "REKAP PER PROGRAM STUDI", margin, y, 8, fontBold, accent);
  y -= 14;
  const recapCols = dual
    ? [
        { label: "Program Studi", x: margin, align: "left" as const },
        { label: "Peserta", x: margin + 250, align: "right" as const },
        { label: "Yudisium", x: margin + 330, align: "right" as const },
        { label: "%", x: margin + 370, align: "right" as const },
        { label: "Pelepasan", x: margin + 440, align: "right" as const },
        { label: "%", x: right, align: "right" as const },
      ]
    : [
        { label: "Program Studi", x: margin, align: "left" as const },
        { label: "Peserta", x: margin + 300, align: "right" as const },
        { label: "Hadir", x: margin + 380, align: "right" as const },
        { label: "%", x: right, align: "right" as const },
      ];
  for (const c of recapCols) {
    if (c.align === "left") text(page, c.label, c.x, y, 7.5, fontBold, dark);
    else textRight(page, c.label, c.x, y, 7.5, fontBold, dark);
  }
  y -= 4;
  page.drawLine({ start: { x: margin, y }, end: { x: right, y }, thickness: 0.5, color: accent });
  y -= 12;
  const recapRow = (label: string, list: typeof attendees, bold = false) => {
    const f = bold ? fontBold : font;
    const yh = list.filter((a) => a.status === "confirmed").length;
    const ph = list.filter((a) => a.pelepasanConfirmedAt).length;
    const p = (n: number) => (list.length ? Math.round((n / list.length) * 100) : 0);
    const vals = dual
      ? [fit(label, 8, 240, f), String(list.length), String(yh), `${p(yh)}%`, String(ph), `${p(ph)}%`]
      : [fit(label, 8, 290, f), String(list.length), String(yh), `${p(yh)}%`];
    vals.forEach((v, i) => {
      if (i === 0) text(page, v, recapCols[0].x, y, 8, f, dark);
      else textRight(page, v, recapCols[i].x, y, 8, f, dark);
    });
    y -= 13;
  };
  for (const [prog, list] of byProgram) recapRow(prog, list);
  page.drawLine({ start: { x: margin, y: y + 9 }, end: { x: right, y: y + 9 }, thickness: 0.5, color: lightGray });
  recapRow("Total", attendees, true);
  y -= 8;

  // ── Daftar peserta per prodi ──
  const cols = dual
    ? [
        { label: "No", x: margin, w: 24 },
        { label: "Nama", x: margin + 26, w: 190 },
        { label: "NPM", x: margin + 222, w: 80 },
        { label: "Yudisium", x: margin + 312, w: 90 },
        { label: "Pelepasan", x: margin + 410, w: 90 },
      ]
    : [
        { label: "No", x: margin, w: 24 },
        { label: "Nama", x: margin + 26, w: 220 },
        { label: "NPM", x: margin + 252, w: 90 },
        { label: "Status", x: margin + 352, w: 60 },
        { label: "Waktu Hadir", x: margin + 420, w: 80 },
      ];
  const rowH = 14;
  const newPage = () => {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: PAGE_H - 28, width: PAGE_W, height: 28, color: green });
    text(page, fit(`${event.name} - Rekap Kehadiran (lanjutan)`, 8, contentW), margin, PAGE_H - 19, 8, font, rgb(0.85, 0.9, 0.87));
    y = PAGE_H - 28 - 22;
  };
  const header = () => {
    for (const c of cols) text(page, c.label, c.x, y, 7.5, fontBold, dark);
    y -= 4;
    page.drawLine({ start: { x: margin, y }, end: { x: right, y }, thickness: 0.5, color: accent });
    y -= 12;
  };

  if (y < 140) newPage();
  text(page, "DAFTAR PESERTA PER PROGRAM STUDI", margin, y, 8, fontBold, accent);
  y -= 16;
  header();

  const agendaCell = (done: boolean, at?: string | null, absent = false) =>
    done ? { t: `Hadir ${fmtTime(at)}`.trim(), color: accent, bold: true } : absent ? { t: "Tidak hadir", color: rgb(0.86, 0.15, 0.15), bold: true } : { t: "-", color: muted, bold: false };

  let no = 0;
  for (const [prog, list] of byProgram) {
    if (y < margin + 60) {
      newPage();
      header();
    }
    page.drawRectangle({ x: margin - 2, y: y - 4, width: contentW + 4, height: 14, color: panel });
    text(page, `${prog}  (${list.length} peserta)`, margin, y, 8, fontBold, green);
    y -= rowH + 2;

    list.forEach((a, idx) => {
      if (y < margin + 24) {
        newPage();
        header();
      }
      no++;
      if (idx % 2 === 1) {
        page.drawRectangle({ x: margin - 2, y: y - 3, width: contentW + 4, height: rowH, color: rgb(0.985, 0.99, 0.987) });
      }
      text(page, String(no), cols[0].x, y, 7.5, font, muted);
      text(page, fit(a.name ?? "", 7.5, cols[1].w), cols[1].x, y, 7.5, font, dark);
      text(page, fit(a.npm ?? "", 7.5, cols[2].w), cols[2].x, y, 7.5, font, dark);
      if (dual) {
        const yc = agendaCell(a.status === "confirmed", a.confirmedAt, a.status === "absent");
        const pc = agendaCell(Boolean(a.pelepasanConfirmedAt), a.pelepasanConfirmedAt);
        text(page, yc.t, cols[3].x, y, 7.5, yc.bold ? fontBold : font, yc.color);
        text(page, pc.t, cols[4].x, y, 7.5, pc.bold ? fontBold : font, pc.color);
      } else {
        const label = a.status === "confirmed" ? "Hadir" : a.status === "absent" ? "Absen" : a.status === "sent" ? "Terkirim" : "Draft";
        text(page, label, cols[3].x, y, 7.5, a.status === "confirmed" ? fontBold : font, a.status === "confirmed" ? accent : a.status === "absent" ? rgb(0.86, 0.15, 0.15) : dark);
        text(page, fmtTime(a.confirmedAt) || "-", cols[4].x, y, 7.5, font, dark);
      }
      y -= rowH;
    });
    y -= 4;
  }

  // ── Footer nomor halaman ──
  const pages = pdfDoc.getPages();
  pages.forEach((pg, i) => {
    const label = `Halaman ${i + 1} / ${pages.length}`;
    pg.drawText(label, { x: right - font.widthOfTextAtSize(label, 7.5), y: 22, size: 7.5, font, color: muted });
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
    const buf = buildExcel(attendees, event.name, Boolean(event.dualAgenda));
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
