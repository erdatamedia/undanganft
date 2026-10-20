import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getUserFromSession } from "@/lib/auth";
import { listDeskRekap } from "@/lib/graduation";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const rows = await listDeskRekap(id);

  if (new URL(req.url).searchParams.get("format") === "excel") {
    const sheet = XLSX.utils.json_to_sheet(
      rows.map((r, i) => ({
        No: i + 1,
        NPM: r.npm,
        Nama: r.name,
        Yudisium: r.yudisiumStatus ?? "-",
        "Bukti Fakultas": r.fakultasStatus ?? "-",
        "Bukti Univ": r.univStatus ?? "-",
        "Sudah Ambil": r.pickedUp ? "Ya" : "Belum",
        Undangan: r.undanganGiven ? "Ya" : "-",
        Toga: r.togaGiven ? "Ya" : "-",
        "Waktu Ambil": r.handedAt ? new Date(r.handedAt).toLocaleString("id-ID") : "-",
        "Verifikasi WD2": r.checkStatus ?? "-",
        "Catatan WD2": r.checkNote ?? "",
      }))
    );
    sheet["!cols"] = [{ wch: 4 }, { wch: 14 }, { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 20 }, { wch: 14 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Rekap Pengambilan");
    const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="rekap-pengambilan-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  }

  return NextResponse.json({
    rows,
    totals: {
      registered: rows.length,
      pickedUp: rows.filter((r) => r.pickedUp).length,
      pendingCheck: rows.filter((r) => r.checkStatus === "pending").length,
      issues: rows.filter((r) => r.checkStatus === "issue").length,
    },
  });
}
