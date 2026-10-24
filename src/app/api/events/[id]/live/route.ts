import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { getEvent } from "@/lib/event";
import { readAttendees } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Data ringan untuk layar scanner: jumlah hadir realtime, per prodi, dan check-in terbaru. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return NextResponse.json({ message: "Acara tidak ditemukan" }, { status: 404 });

  const dual = Boolean(event.dualAgenda);
  const agenda = new URL(req.url).searchParams.get("agenda") === "pelepasan" && dual ? "pelepasan" : "yudisium";
  const attendees = await readAttendees(id);

  const hadirAt = (a: (typeof attendees)[number], which: "yudisium" | "pelepasan") =>
    which === "pelepasan" ? a.pelepasanConfirmedAt ?? null : a.status === "confirmed" ? a.confirmedAt ?? null : null;

  const perProgram = new Map<string, { program: string; total: number; hadir: number }>();
  for (const a of attendees) {
    const key = a.program || "Belum ditentukan";
    const cur = perProgram.get(key) ?? { program: key, total: 0, hadir: 0 };
    cur.total++;
    if (hadirAt(a, agenda)) cur.hadir++;
    perProgram.set(key, cur);
  }

  const recent = attendees
    .flatMap((a) => {
      const entries: { id: string; name: string; program: string; npm: string; at: string; agenda: "yudisium" | "pelepasan" }[] = [];
      const y = hadirAt(a, "yudisium");
      const p = dual ? hadirAt(a, "pelepasan") : null;
      if (y) entries.push({ id: a.id, name: a.name, program: a.program, npm: a.npm, at: y, agenda: "yudisium" });
      if (p) entries.push({ id: a.id, name: a.name, program: a.program, npm: a.npm, at: p, agenda: "pelepasan" });
      return entries;
    })
    .filter((e) => (dual ? e.agenda === agenda : true))
    .sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime())
    .slice(0, 12);

  return NextResponse.json({
    eventName: event.name,
    dualAgenda: dual,
    agenda,
    total: attendees.length,
    hadir: attendees.filter((a) => hadirAt(a, agenda)).length,
    hadirYudisium: attendees.filter((a) => hadirAt(a, "yudisium")).length,
    hadirPelepasan: dual ? attendees.filter((a) => hadirAt(a, "pelepasan")).length : 0,
    perProgram: [...perProgram.values()].sort((a, b) => a.program.localeCompare(b.program)),
    recent,
    now: new Date().toISOString(),
  });
}
