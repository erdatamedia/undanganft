import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ensureEventSchema, type EventStatus } from "@/lib/event";
import { listRundownItems } from "@/lib/rundown";

export async function GET() {
  await ensureEventSchema();

  const rows = await query<{ id: string }>(
    "select id from events where status='ACTIVE' order by created_at desc limit 1"
  );
  const eventId = rows[0]?.id;
  if (!eventId) {
    return NextResponse.json({ event: null, rundown: [] });
  }

  const eventRows = await query<{
    name: string;
    date: string;
    time: string;
    time_end: string | null;
    venue: string;
    status: EventStatus;
    yudisium_schedule: string | null;
    yudisium_venue: string | null;
    yudisium_dresscode: string | null;
    wisuda_dresscode: string | null;
  }>(
    `select name, date, time, time_end, venue, status,
            yudisium_schedule, yudisium_venue, yudisium_dresscode, wisuda_dresscode
     from events where id=$1 limit 1`,
    [eventId]
  );
  const row = eventRows[0];
  if (!row) {
    return NextResponse.json({ event: null, rundown: [] });
  }

  const rundownItems = await listRundownItems(eventId);
  const publicRundown = rundownItems.map((item) => ({
    order: item.order,
    timeStart: item.timeStart,
    timeEnd: item.timeEnd,
    durationMinutes: item.durationMinutes,
    title: item.title,
  }));

  return NextResponse.json({
    event: {
      name: row.name,
      schedule: row.time_end ? `${row.date} • ${row.time} – ${row.time_end}` : `${row.date} • ${row.time}`,
      venue: row.venue,
      yudisiumSchedule: row.yudisium_schedule,
      yudisiumVenue: row.yudisium_venue,
      yudisiumDresscode: row.yudisium_dresscode,
      wisudaDresscode: row.wisuda_dresscode,
    },
    rundown: publicRundown,
  });
}
