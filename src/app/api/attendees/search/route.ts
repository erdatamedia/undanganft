import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { resolveEvent } from "@/lib/event";
import { readAttendees } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Pencarian cepat peserta berdasarkan nama/NPM untuk layar scanner (peserta yang lama membuka QR). */
export async function GET(req: Request) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const terms = (url.searchParams.get("q") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length || terms.join("").length < 2) return NextResponse.json({ results: [] });

  const event = await resolveEvent(url.searchParams.get("eventId"));
  const attendees = await readAttendees(event.id);

  const scored = attendees
    .map((a) => {
      const name = a.name.toLowerCase();
      const hay = `${name} ${a.npm} ${(a.program ?? "").toLowerCase()}`;
      if (!terms.every((t) => hay.includes(t))) return null;
      // Nama yang diawali kata ketikan didahulukan, lalu urut abjad.
      const startsWith = name.startsWith(terms[0]) ? 0 : 1;
      return { a, startsWith };
    })
    .filter((x): x is { a: (typeof attendees)[number]; startsWith: number } => x !== null)
    .sort((x, y) => x.startsWith - y.startsWith || x.a.name.localeCompare(y.a.name))
    .slice(0, 8);

  return NextResponse.json({
    dualAgenda: Boolean(event.dualAgenda),
    results: scored.map(({ a }) => ({
      id: a.id,
      name: a.name,
      npm: a.npm,
      program: a.program,
      status: a.status,
      confirmedAt: a.confirmedAt ?? null,
      pelepasanConfirmedAt: a.pelepasanConfirmedAt ?? null,
    })),
  });
}
