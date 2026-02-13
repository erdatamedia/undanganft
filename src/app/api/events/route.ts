import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { createEvent, readEvents, resolveEvent, type EventPayload } from "@/lib/event";

export async function GET() {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let events = await readEvents();
  if (!events.length) {
    await resolveEvent();
    events = await readEvents();
  }
  return NextResponse.json({ events });
}

export async function POST(req: Request) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = (await req.json()) as Partial<EventPayload>;
  if (
    !payload.name ||
    !payload.date ||
    !payload.time ||
    !payload.venue ||
    !payload.gate
  ) {
    return NextResponse.json(
      { message: "Nama acara, tanggal, waktu, lokasi, dan registrasi wajib diisi." },
      { status: 400 }
    );
  }

  const event = await createEvent({
    name: payload.name,
    date: payload.date,
    time: payload.time,
    venue: payload.venue,
    gate: payload.gate,
    linkPrefix: payload.linkPrefix,
  });

  return NextResponse.json(event, { status: 201 });
}
