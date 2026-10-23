import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { createEvent, readEvents, type EventPayload } from "@/lib/event";

export async function GET() {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const events = await readEvents();
  return NextResponse.json({ events });
}

export async function POST(req: Request) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = (await req.json()) as Partial<EventPayload>;
  if (!payload.name || !payload.date || !payload.time || !payload.venue) {
    return NextResponse.json(
      { message: "Nama acara, tanggal, waktu mulai, dan lokasi wajib diisi." },
      { status: 400 }
    );
  }

  const event = await createEvent({
    name: payload.name,
    description: payload.description,
    date: payload.date,
    time: payload.time,
    timeEnd: payload.timeEnd,
    venue: payload.venue,
    gate: payload.gate ?? "",
    bannerUrl: payload.bannerUrl,
    status: payload.status ?? "ACTIVE",
    linkPrefix: payload.linkPrefix,
    yudisiumSchedule: payload.yudisiumSchedule,
    yudisiumVenue: payload.yudisiumVenue,
    yudisiumDresscode: payload.yudisiumDresscode,
    wisudaDresscode: payload.wisudaDresscode,
    univSchedule: payload.univSchedule,
    univVenue: payload.univVenue,
    dualAgenda: payload.dualAgenda,
  });

  return NextResponse.json(event, { status: 201 });
}
