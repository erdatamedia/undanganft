import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { resolveEvent } from "@/lib/event";
import {
  addAttendee,
  readAttendees,
  type AttendeePayload,
} from "@/lib/storage";

export async function GET(req: Request) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const selectedEvent = await resolveEvent(url.searchParams.get("eventId"));
  const attendees = await readAttendees(selectedEvent.id);
  return NextResponse.json({ event: selectedEvent, attendees });
}

export async function POST(req: Request) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = (await req.json()) as Partial<AttendeePayload>;
  const selectedEvent = await resolveEvent(payload.eventId);
  if (!payload.name || !payload.program || !payload.email) {
    return NextResponse.json(
      { message: "Nama, program studi, dan email wajib diisi." },
      { status: 400 },
    );
  }

  const attendee = await addAttendee({
    name: payload.name,
    program: payload.program,
    phone: payload.phone ?? "-",
    email: payload.email,
    npm: payload.npm ?? "-",
    seat: payload.seat ?? "-",
    eventId: selectedEvent.id,
  }, selectedEvent.id);

  return NextResponse.json(attendee, { status: 201 });
}
