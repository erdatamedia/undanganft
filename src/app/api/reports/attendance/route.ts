import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { readAttendees, type AttendeeRecord } from "@/lib/storage";
import { resolveEvent } from "@/lib/event";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProgramSummary = {
  program: string;
  total: number;
  confirmed: number;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID");
}

function buildProgramSummary(attendees: AttendeeRecord[]): ProgramSummary[] {
  const map = new Map<string, ProgramSummary>();
  attendees.forEach((item) => {
    const key = item.program || "Lainnya";
    const current = map.get(key) ?? {
      program: key,
      total: 0,
      confirmed: 0,
    };
    current.total += 1;
    if (item.status === "confirmed") current.confirmed += 1;
    map.set(key, current);
  });
  return Array.from(map.values()).sort((a, b) =>
    a.program.localeCompare(b.program)
  );
}

export async function GET(req: Request) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const event = await resolveEvent(url.searchParams.get("eventId"));
  const attendees = await readAttendees(event.id);
  const summaries = buildProgramSummary(attendees);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([595.28, 841.89]); // A4
  const margin = 40;
  let y = page.getHeight() - margin;

  const drawText = (
    text: string,
    x: number,
    size = 10,
    isBold = false,
    color = rgb(0.22, 0.25, 0.32)
  ) => {
    const usedFont = isBold ? fontBold : font;
    page.drawText(text, { x, y, size, font: usedFont, color });
  };

  const lineGap = 6;
  const moveDown = (size = 10) => {
    y -= size + lineGap;
  };

  const drawHeading = (text: string, size = 12) => {
    drawText(text, margin, size, true, rgb(0.07, 0.09, 0.15));
    moveDown(size);
  };

  const drawBody = (text: string, size = 10, bold = false) => {
    drawText(text, margin, size, bold);
    moveDown(size);
  };

  drawText("Rekap Kehadiran", margin, 16, true, rgb(0.07, 0.09, 0.15));
  moveDown(16);
  drawText(event.name, margin, 11, true, rgb(0.22, 0.25, 0.32));
  moveDown(11);
  drawText(`${event.schedule} • ${event.venue}`, margin, 10);
  moveDown(10);
  drawText(
    `Dicetak: ${new Date().toLocaleString("id-ID")}`,
    margin,
    9,
    false,
    rgb(0.42, 0.45, 0.5)
  );
  moveDown(9);
  y -= 8;

  const total = attendees.length;
  const confirmed = attendees.filter((item) => item.status === "confirmed").length;
  const sent = attendees.filter((item) => item.status !== "draft").length;
  const responseRate = total ? Math.round((confirmed / total) * 100) : 0;

  drawHeading("Ringkasan", 12);
  drawBody(`Total peserta: ${total}`);
  drawBody(`Sudah dikirim: ${sent}`);
  drawBody(`Konfirmasi hadir: ${confirmed}`);
  drawBody(`Response rate: ${responseRate}%`);
  y -= 6;

  drawHeading("Rekap Program Studi", 12);
  summaries.forEach((row) => {
    drawBody(
      `${row.program} • Total: ${row.total} • Hadir: ${row.confirmed}`,
      9
    );
  });
  y -= 6;

  drawHeading("Daftar Kehadiran", 12);

  const cols = [
    { label: "No", width: 26 },
    { label: "Nama", width: 170 },
    { label: "Prodi", width: 120 },
    { label: "NPM", width: 70 },
    { label: "Status", width: 60 },
    { label: "Waktu Scan", width: 95 },
  ];
  const tableLeft = margin;
  const tableRight = page.getWidth() - margin;
  const rowHeight = 14;

  const drawRow = (cells: string[], isHeader = false) => {
    let x = tableLeft;
    const size = isHeader ? 9 : 8;
    const color = isHeader ? rgb(0.07, 0.09, 0.15) : rgb(0.22, 0.25, 0.32);
    const usedFont = isHeader ? fontBold : font;
    cells.forEach((cell, idx) => {
      page.drawText(cell, { x, y, size, font: usedFont, color });
      x += cols[idx].width;
    });
    y -= rowHeight;
  };

  const drawTableHeader = () => {
    drawRow(cols.map((c) => c.label), true);
    page.drawLine({
      start: { x: tableLeft, y: y + 4 },
      end: { x: tableRight, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.8, 0.82, 0.86),
    });
    y -= 4;
  };

  const ensureSpace = () => {
    if (y < margin + 60) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = page.getHeight() - margin;
      drawTableHeader();
    }
  };

  drawTableHeader();

  attendees.forEach((item, index) => {
    ensureSpace();
    drawRow([
      String(index + 1),
      item.name,
      item.program,
      item.npm || "-",
      item.status === "confirmed" ? "Hadir" : "Belum",
      formatDate(item.confirmedAt ?? item.updatedAt),
    ]);
  });

  const pdfBytes = await pdfDoc.save();
  const filename = `rekap-kehadiran-${new Date().toISOString().slice(0, 10)}.pdf`;

  const bytes = Uint8Array.from(pdfBytes);
  const body = new Blob([bytes.buffer], { type: "application/pdf" });
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
