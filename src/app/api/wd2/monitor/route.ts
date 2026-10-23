import { NextRequest, NextResponse } from "next/server";
import { getReviewerFromSession } from "@/lib/wd2-auth";
import { listMonitor, type MonitorFilter } from "@/lib/graduation";

export const dynamic = "force-dynamic";

const FILTERS: MonitorFilter[] = ["all", "picked", "unpicked", "issue", "rejected"];

/** Arsip hanya-baca: semua bukti bayar & serah-terima, untuk monitoring WD2/admin. */
export async function GET(req: NextRequest) {
  const reviewer = await getReviewerFromSession();
  if (!reviewer) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const f = sp.get("filter") as MonitorFilter;
  const { rows, total } = await listMonitor({
    q: sp.get("q") ?? "",
    filter: FILTERS.includes(f) ? f : "all",
    limit: Number(sp.get("limit")) || 30,
    offset: Number(sp.get("offset")) || 0,
  });

  const pay = (p: (typeof rows)[number]["fakultas"]) =>
    p ? { ...p, image: `/api/wd2/image/payment/${p.id}?v=${encodeURIComponent(p.uploadedAt ?? "")}` } : null;
  return NextResponse.json({
    total,
    rows: rows.map((r) => ({
      ...r,
      fakultas: pay(r.fakultas),
      univ: pay(r.univ),
      pickup: r.pickup
        ? {
            ...r.pickup,
            image: r.pickup.hasPhoto
              ? `/api/wd2/image/handover/${r.pickup.id}?v=${encodeURIComponent(r.pickup.handedAt)}`
              : null,
          }
        : null,
    })),
  });
}
