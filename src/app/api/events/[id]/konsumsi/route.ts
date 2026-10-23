import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as XLSX from "xlsx";
import { getUserFromSession } from "@/lib/auth";
import { getEvent } from "@/lib/event";
import { listBelumLengkap, listKonsumsi, type BelumLengkapRow, type KonsumsiRow } from "@/lib/graduation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const TZ = "Asia/Jakarta";
const fmtDateTime = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString("id-ID", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "")
    : "-";
const fmtDay = (v: string) =>
  new Date(v).toLocaleDateString("id-ID", { timeZone: TZ, weekday: "short", day: "2-digit", month: "short", year: "numeric" });
const dayKey = (v: string) => new Date(v).toLocaleDateString("en-CA", { timeZone: TZ });
const payState = (status: string, reason: string | null, includeDesk: boolean) => {
  if (status === "none") return "Belum upload bukti";
  if (status === "pending") return "Menunggu verifikasi WD2";
  if (status === "rejected") return `Ditolak${reason ? `: ${reason}` : ""}`;
  if (status === "desk") return includeDesk ? "Diverifikasi meja" : "Diverifikasi meja (menunggu WD2)";
  return "Disetujui";
};
const missing = (r: BelumLengkapRow, includeDesk: boolean) => ({
  fak: payState(r.fakultasStatus, r.fakultasReason, includeDesk),
  univ: payState(r.univStatus, r.univReason, includeDesk),
  fakOk: r.fakultasStatus === "approved" || (includeDesk && r.fakultasStatus === "desk"),
  univOk: r.univStatus === "approved" || (includeDesk && r.univStatus === "desk"),
});
const byLabel = (b: string | null, status: string) =>
  status === "desk" ? "Verifikasi meja" : b === "admin" ? "Admin" : b === "wd2" ? "WD2" : "-";

function groupByProgram(rows: KonsumsiRow[]) {
  const map = new Map<string, KonsumsiRow[]>();
  for (const r of rows) {
    const key = r.program || "Belum ditentukan";
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  return map;
}

function perDay(rows: KonsumsiRow[]) {
  const map = new Map<string, { label: string; n: number }>();
  for (const r of rows) {
    if (!r.completeAt) continue;
    const k = dayKey(r.completeAt);
    const cur = map.get(k) ?? { label: fmtDay(r.completeAt), n: 0 };
    cur.n++;
    map.set(k, cur);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
}

function buildExcel(rows: KonsumsiRow[], belum: BelumLengkapRow[], eventName: string, info: string[], includeDesk: boolean): Buffer {
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(
    rows.map((r, i) => ({
      No: i + 1,
      Nama: r.name,
      NPM: r.npm,
      "Program Studi": r.program ?? "Belum ditentukan",
      "Bayar Fakultas (waktu)": fmtDateTime(r.fakultasAt),
      "Verifikasi Fakultas": byLabel(r.fakultasBy, r.fakultasStatus),
      "Bayar Univ (waktu)": fmtDateTime(r.univAt),
      "Verifikasi Univ": byLabel(r.univBy, r.univStatus),
      "Lengkap Sejak": fmtDateTime(r.completeAt),
      "Yudisium": r.yudisiumStatus === "hadir" ? "Hadir" : r.yudisiumStatus === "tidak_hadir" ? "Tidak hadir" : "Belum konfirmasi",
      "Ambil Toga": r.togaGiven ? "Sudah" : "Belum",
      "Ambil Undangan": r.undanganGiven ? "Sudah" : "Belum",
      Catatan: r.note ?? "",
    }))
  );
  sheet["!cols"] = [4, 30, 16, 20, 20, 16, 20, 16, 20, 16, 11, 14, 30].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, sheet, "Daftar Konsumsi");

  const belumSheet = XLSX.utils.json_to_sheet(
    belum.map((r, i) => {
      const m = missing(r, includeDesk);
      return {
        No: i + 1,
        "Program Studi": r.program ?? "Belum ditentukan",
        Nama: r.name,
        NPM: r.npm,
        Email: r.email ?? "",
        "Akun Dashboard": r.hasAccount ? "Sudah daftar" : "Belum daftar",
        "Bayar Fakultas": m.fak,
        "Bayar Univ": m.univ,
        Yudisium: r.yudisiumStatus === "hadir" ? "Hadir" : r.yudisiumStatus === "tidak_hadir" ? "Tidak hadir" : "Belum konfirmasi",
      };
    })
  );
  belumSheet["!cols"] = [4, 20, 30, 16, 28, 14, 30, 30, 16].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, belumSheet, "Belum Lengkap");

  const programs = groupByProgram(rows);
  const days = perDay(rows);
  const summary = [
    { Keterangan: "Nama Acara", Nilai: eventName },
    ...info.map((line) => ({ Keterangan: "Info Acara", Nilai: line })),
    { Keterangan: "Kriteria", Nilai: includeDesk ? "Fakultas & Univ disetujui atau diverifikasi di meja" : "Fakultas & Univ sama-sama disetujui" },
    { Keterangan: "Dicetak", Nilai: fmtDateTime(new Date().toISOString()) },
    { Keterangan: "TOTAL PORSI (peserta)", Nilai: rows.length },
    { Keterangan: "Belum lengkap (perlu tindak lanjut)", Nilai: belum.length },
    { Keterangan: "", Nilai: "" },
    { Keterangan: "Program Studi", Nilai: "Jumlah" },
    ...[...new Set([...programs.keys(), ...belum.map((b) => b.program || "Belum ditentukan")])].sort().map((p) => ({
      Keterangan: p,
      Nilai: `${programs.get(p)?.length ?? 0} lengkap / ${belum.filter((b) => (b.program || "Belum ditentukan") === p).length} belum`,
    })),
    { Keterangan: "", Nilai: "" },
    { Keterangan: "Pembayaran lengkap per hari", Nilai: "Jumlah" },
    ...days.map((d) => ({ Keterangan: d.label, Nilai: d.n })),
  ];
  const ws2 = XLSX.utils.json_to_sheet(summary);
  ws2["!cols"] = [{ wch: 34 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Ringkasan");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

async function buildPdf(
  rows: KonsumsiRow[],
  belum: BelumLengkapRow[],
  event: NonNullable<Awaited<ReturnType<typeof getEvent>>>,
  info: string[],
  includeDesk: boolean
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28;
  const H = 841.89;
  const margin = 44;
  const cw = W - margin * 2;
  const right = W - margin;
  const green = rgb(0.107, 0.263, 0.196);
  const accent = rgb(0.251, 0.569, 0.424);
  const dark = rgb(0.102, 0.102, 0.18);
  const muted = rgb(0.42, 0.44, 0.5);
  const line = rgb(0.9, 0.91, 0.93);
  const panel = rgb(0.968, 0.98, 0.972);
  const amber = rgb(0.7, 0.45, 0.05);
  const red = rgb(0.78, 0.13, 0.13);
  const redPanel = rgb(0.995, 0.955, 0.955);

  const clean = (t: string) => (t ?? "").replace(/[^\x20-\x7E -ÿ]/g, "?");
  const width = (t: string, s: number, f = font) => f.widthOfTextAtSize(clean(t), s);
  const fit = (t: string, s: number, maxW: number, f = font) => {
    let o = clean(t);
    if (f.widthOfTextAtSize(o, s) <= maxW) return o;
    while (o.length > 1 && f.widthOfTextAtSize(o + "...", s) > maxW) o = o.slice(0, -1);
    return o.trimEnd() + "...";
  };
  const wrap = (t: string, s: number, maxW: number, f = font) => {
    const out: string[] = [];
    let cur = "";
    for (const w of clean(t).split(/\s+/).filter(Boolean)) {
      const test = cur ? `${cur} ${w}` : w;
      if (cur && f.widthOfTextAtSize(test, s) > maxW) { out.push(cur); cur = w; } else cur = test;
    }
    if (cur) out.push(cur);
    return out;
  };

  let page = pdf.addPage([W, H]);
  const text = (t: string, x: number, y: number, size: number, f = font, color = dark) =>
    page.drawText(clean(t), { x, y, size, font: f, color });
  const textRight = (t: string, xr: number, y: number, size: number, f = font, color = dark) =>
    page.drawText(clean(t), { x: xr - width(t, size, f), y, size, font: f, color });

  page.drawRectangle({ x: 0, y: H - 72, width: W, height: 72, color: green });
  text("FAKULTAS TEKNIK", margin, H - 26, 8, bold, rgb(0.455, 0.776, 0.616));
  text("Universitas Islam Malang", margin, H - 41, 13, bold, rgb(1, 1, 1));
  text("Laporan Kebutuhan Konsumsi", margin, H - 57, 9, font, rgb(0.8, 0.85, 0.82));
  let y = H - 72 - 24;

  for (const l of wrap(event.name, 13, cw, bold)) { text(l, margin, y, 13, bold); y -= 17; }
  y -= 2;
  for (const l of info) {
    for (const part of wrap(l, 9, cw)) { text(part, margin, y, 9, font, muted); y -= 13; }
  }
  text(`Dicetak: ${fmtDateTime(new Date().toISOString())} WIB`, margin, y, 8, font, muted);
  y -= 16;
  page.drawLine({ start: { x: margin, y }, end: { x: right, y }, thickness: 0.5, color: line });
  y -= 18;

  // Ringkasan
  const programs = groupByProgram(rows);
  const days = perDay(rows);
  const boxH = 64;
  page.drawRectangle({ x: margin, y: y - boxH, width: cw, height: boxH, color: panel, borderColor: line, borderWidth: 0.5 });
  page.drawRectangle({ x: margin, y: y - boxH, width: 3, height: boxH, color: amber });
  text("TOTAL PORSI KONSUMSI", margin + 12, y - 15, 8, bold, amber);
  text(`${rows.length} peserta`, margin + 12, y - 40, 22, bold);
  const criteria = includeDesk
    ? "Fakultas & Univ disetujui / diverifikasi di meja"
    : "Fakultas & Univ sama-sama disetujui";
  textRight(criteria, right - 10, y - 15, 7.5, font, muted);
  textRight(
    `Hadir yudisium: ${rows.filter((r) => r.yudisiumStatus === "hadir").length}  |  Tidak hadir: ${rows.filter((r) => r.yudisiumStatus === "tidak_hadir").length}`,
    right - 10, y - 30, 7.5, font, muted
  );
  textRight(`Sudah ambil toga: ${rows.filter((r) => r.togaGiven).length}  |  undangan: ${rows.filter((r) => r.undanganGiven).length}`, right - 10, y - 43, 7.5, font, muted);
  textRight(`BELUM LENGKAP: ${belum.length} peserta (perlu tindak lanjut)`, right - 10, y - 54, 7.5, bold, red);
  y -= boxH + 20;

  text("REKAP PER PROGRAM STUDI", margin, y, 8, bold, accent);
  y -= 14;
  const belumByProgram = new Map<string, BelumLengkapRow[]>();
  for (const b of belum) {
    const key = b.program || "Belum ditentukan";
    belumByProgram.set(key, [...(belumByProgram.get(key) ?? []), b]);
  }
  const allPrograms = [...new Set([...programs.keys(), ...belumByProgram.keys()])].sort();
  text("Program Studi", margin, y, 7.5, bold);
  textRight("Lengkap", margin + 330, y, 7.5, bold);
  textRight("Belum", margin + 410, y, 7.5, bold, red);
  textRight("Total", right, y, 7.5, bold);
  y -= 4;
  page.drawLine({ start: { x: margin, y }, end: { x: right, y }, thickness: 0.5, color: accent });
  y -= 12;
  for (const p of allPrograms) {
    const done = programs.get(p)?.length ?? 0;
    const todo = belumByProgram.get(p)?.length ?? 0;
    text(fit(p, 8, 280), margin, y, 8);
    textRight(String(done), margin + 330, y, 8);
    textRight(String(todo), margin + 410, y, 8, todo ? bold : font, todo ? red : dark);
    textRight(String(done + todo), right, y, 8);
    y -= 13;
  }
  page.drawLine({ start: { x: margin, y: y + 9 }, end: { x: right, y: y + 9 }, thickness: 0.5, color: line });
  text("Total", margin, y, 8, bold);
  textRight(String(rows.length), margin + 330, y, 8, bold);
  textRight(String(belum.length), margin + 410, y, 8, bold, red);
  textRight(String(rows.length + belum.length), right, y, 8, bold);
  y -= 24;

  if (days.length) {
    text("PEMBAYARAN LENGKAP PER HARI", margin, y, 8, bold, accent);
    y -= 14;
    for (const d of days) {
      text(d.label, margin, y, 8);
      textRight(`${d.n} orang`, right, y, 8);
      y -= 13;
    }
    y -= 12;
  }

  // Daftar
  const cols = [
    { label: "No", x: margin, w: 22 },
    { label: "Nama", x: margin + 24, w: 160 },
    { label: "NPM", x: margin + 188, w: 66 },
    { label: "Fakultas", x: margin + 258, w: 78 },
    { label: "Univ", x: margin + 340, w: 78 },
    { label: "Lengkap sejak", x: margin + 422, w: 85 },
  ];
  const rowH = 14;
  const newPage = () => {
    page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 28, width: W, height: 28, color: green });
    text(fit(`${event.name} - Kebutuhan Konsumsi (lanjutan)`, 8, cw), margin, H - 19, 8, font, rgb(0.85, 0.9, 0.87));
    y = H - 28 - 22;
  };
  const header = () => {
    for (const c of cols) text(c.label, c.x, y, 7.5, bold);
    y -= 4;
    page.drawLine({ start: { x: margin, y }, end: { x: right, y }, thickness: 0.5, color: accent });
    y -= 12;
  };
  const short = (v: string | null) =>
    v ? new Date(v).toLocaleString("id-ID", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", "") : "-";

  if (y < 160) newPage();
  text("DAFTAR PESERTA YANG PEMBAYARANNYA LENGKAP", margin, y, 8, bold, accent);
  y -= 16;
  header();
  let no = 0;
  for (const [prog, list] of programs) {
    if (y < margin + 60) { newPage(); header(); }
    page.drawRectangle({ x: margin - 2, y: y - 4, width: cw + 4, height: 14, color: panel });
    text(`${prog}  (${list.length} peserta)`, margin, y, 8, bold, green);
    y -= rowH + 2;
    list.forEach((r, idx) => {
      if (y < margin + 24) { newPage(); header(); }
      no++;
      if (idx % 2 === 1) page.drawRectangle({ x: margin - 2, y: y - 3, width: cw + 4, height: rowH, color: rgb(0.985, 0.99, 0.987) });
      text(String(no), cols[0].x, y, 7.5, font, muted);
      text(fit(r.name, 7.5, cols[1].w), cols[1].x, y, 7.5);
      text(fit(r.npm, 7.5, cols[2].w), cols[2].x, y, 7.5);
      text(short(r.fakultasAt), cols[3].x, y, 7.5);
      text(short(r.univAt), cols[4].x, y, 7.5);
      text(short(r.completeAt), cols[5].x, y, 7.5, bold, amber);
      y -= rowH;
    });
    y -= 4;
  }

  // ── Belum lengkap: highlight untuk tindak lanjut kaprodi ──
  const bcols = [
    { label: "No", x: margin, w: 20 },
    { label: "Nama", x: margin + 22, w: 122 },
    { label: "NPM", x: margin + 148, w: 62 },
    { label: "Bayar Fakultas", x: margin + 214, w: 100 },
    { label: "Bayar Univ", x: margin + 318, w: 100 },
    { label: "Kontak", x: margin + 422, w: 85 },
  ];
  const bHeader = () => {
    for (const c of bcols) text(c.label, c.x, y, 7.5, bold);
    y -= 4;
    page.drawLine({ start: { x: margin, y }, end: { x: right, y }, thickness: 0.5, color: red });
    y -= 12;
  };
  newPage();
  page.drawRectangle({ x: margin - 2, y: y - 6, width: cw + 4, height: 22, color: redPanel, borderColor: red, borderWidth: 0.5 });
  text(`BELUM LENGKAP - PERLU TINDAK LANJUT (${belum.length} peserta)`, margin + 4, y + 2, 9, bold, red);
  y -= 22;
  for (const l of wrap("Daftar ini untuk kaprodi menghubungi mahasiswa yang bukti bayar fakultas dan/atau univ-nya belum disetujui. Kolom status menunjukkan bagian yang masih kurang.", 8, cw, font)) {
    text(l, margin, y, 8, font, muted);
    y -= 11;
  }
  y -= 6;
  if (belum.length === 0) {
    text("Semua peserta sudah lengkap.", margin, y, 9, bold, accent);
  } else {
    bHeader();
    let bn = 0;
    for (const [prog, list] of belumByProgram) {
      if (y < margin + 60) { newPage(); bHeader(); }
      page.drawRectangle({ x: margin - 2, y: y - 4, width: cw + 4, height: 14, color: redPanel });
      text(`${prog}  (${list.length} belum lengkap)`, margin, y, 8, bold, red);
      y -= rowH + 2;
      for (const b of list) {
        if (y < margin + 24) { newPage(); bHeader(); }
        bn++;
        const m = missing(b, includeDesk);
        text(String(bn), bcols[0].x, y, 7.5, font, muted);
        text(fit(b.name, 7.5, bcols[1].w), bcols[1].x, y, 7.5, bold);
        text(fit(b.npm, 7.5, bcols[2].w), bcols[2].x, y, 7.5);
        const tone = (ok: boolean, st: string) => (ok ? accent : st === "none" || st === "rejected" ? red : amber);
        text(fit(m.fak, 7, bcols[3].w), bcols[3].x, y, 7, m.fakOk ? font : bold, tone(m.fakOk, b.fakultasStatus));
        text(fit(m.univ, 7, bcols[4].w), bcols[4].x, y, 7, m.univOk ? font : bold, tone(m.univOk, b.univStatus));
        text(fit(b.hasAccount ? b.email ?? "-" : "Belum daftar dashboard", 7, bcols[5].w), bcols[5].x, y, 7, font, b.hasAccount ? dark : red);
        y -= rowH;
      }
      y -= 4;
    }
  }

  const pages = pdf.getPages();
  pages.forEach((pg, i) => {
    const label = `Halaman ${i + 1} / ${pages.length}`;
    pg.drawText(label, { x: right - font.widthOfTextAtSize(label, 7.5), y: 22, size: 7.5, font, color: muted });
  });
  return pdf.save();
}

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return NextResponse.json({ message: "Acara tidak ditemukan" }, { status: 404 });

  const sp = new URL(req.url).searchParams;
  const includeDesk = sp.get("desk") === "1";
  const [rows, belum] = await Promise.all([listKonsumsi(id, includeDesk), listBelumLengkap(id, includeDesk)]);
  const format = sp.get("format");

  const timeRange = event.timeEnd ? `${event.time} - ${event.timeEnd}` : event.time;
  const info = [`${event.date} | ${timeRange}`, event.venue ?? ""].filter(Boolean);
  const date = new Date().toISOString().slice(0, 10);

  if (format === "excel") {
    return new NextResponse(new Uint8Array(buildExcel(rows, belum, event.name, info, includeDesk)), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="konsumsi-${date}.xlsx"`,
      },
    });
  }
  if (format === "pdf") {
    return new NextResponse(new Uint8Array(await buildPdf(rows, belum, event, info, includeDesk)), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="konsumsi-${date}.pdf"`,
      },
    });
  }

  // Pratinjau jumlah untuk UI.
  const withDesk = includeDesk ? rows : await listKonsumsi(id, true);
  return NextResponse.json({ count: rows.length, countWithDesk: withDesk.length, belumLengkap: belum.length });
}
