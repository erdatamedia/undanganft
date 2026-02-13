import { query } from "@/lib/db";

const DEFAULT_LINK_PREFIX = process.env.APP_BASE_URL
  ? `${process.env.APP_BASE_URL.replace(/\/$/, "")}/invite`
  : "https://undangan.ftunisma.online/invite";

type EventRow = {
  id: string;
  name: string;
  date: string;
  time: string;
  venue: string;
  gate: string;
  link_prefix: string;
  created_at: string;
  updated_at: string;
};

export type EventRecord = {
  id: string;
  name: string;
  date: string;
  time: string;
  schedule: string;
  venue: string;
  gate: string;
  linkPrefix: string;
  createdAt: string;
  updatedAt: string;
};

export type EventPayload = Pick<
  EventRecord,
  "name" | "date" | "time" | "venue" | "gate"
> & {
  linkPrefix?: string;
};

const defaultEventPayload: EventPayload = {
  name: "Pelepasan Calon Wisudawan/wati Fakultas Teknik Universitas Islam Malang Periode 78 Tahun 2026",
  date: "Jumat, 13 Februari 2026",
  time: "17.45 WIB",
  venue: "Gedung Pascasarjana Lantai 7 Universitas Islam Malang",
  gate: "Registrasi dibuka pukul 17.00 WIB",
  linkPrefix: DEFAULT_LINK_PREFIX,
};

let schemaReadyPromise: Promise<void> | null = null;

async function ensureEventSchemaInternal() {
  await query(`
    create table if not exists events (
      id uuid primary key default uuid_generate_v4(),
      name text not null,
      date text not null,
      time text not null,
      venue text not null,
      gate text not null,
      link_prefix text not null default 'https://undangan.ftunisma.online/invite',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await query(`
    create or replace function set_events_updated_at()
    returns trigger as $$
    begin
      new.updated_at = now();
      return new;
    end;
    $$ language plpgsql
  `);

  await query(`drop trigger if exists trg_events_updated on events`);
  await query(`
    create trigger trg_events_updated
    before update on events
    for each row execute procedure set_events_updated_at()
  `);

  await query(`alter table attendees add column if not exists event_id uuid`);
  await query(`alter table attendees add column if not exists photo_data text`);

  await query(`
    do $$
    declare
      default_event_id uuid;
    begin
      select id into default_event_id
      from events
      order by created_at asc
      limit 1;

      if default_event_id is null then
        insert into events (name, date, time, venue, gate, link_prefix)
        values (
          'Pelepasan Calon Wisudawan/wati Fakultas Teknik Universitas Islam Malang Periode 78 Tahun 2026',
          'Jumat, 13 Februari 2026',
          '17.45 WIB',
          'Gedung Pascasarjana Lantai 7 Universitas Islam Malang',
          'Registrasi dibuka pukul 17.00 WIB',
          'https://undangan.ftunisma.online/invite'
        )
        returning id into default_event_id;
      end if;

      update attendees
      set event_id = default_event_id
      where event_id is null;
    end $$;
  `);

  await query(`
    do $$
    begin
      if not exists (
        select 1
        from pg_constraint
        where conname = 'attendees_event_id_fkey'
      ) then
        alter table attendees
          add constraint attendees_event_id_fkey
          foreign key (event_id) references events(id) on delete cascade;
      end if;
    end $$;
  `);

  await query(`alter table attendees alter column event_id set not null`);
}

export async function ensureEventSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureEventSchemaInternal().catch((err) => {
      schemaReadyPromise = null;
      throw err;
    });
  }
  await schemaReadyPromise;
}

const mapEvent = (row: EventRow): EventRecord => ({
  id: row.id,
  name: row.name,
  date: row.date,
  time: row.time,
  schedule: `${row.date} • ${row.time}`,
  venue: row.venue,
  gate: row.gate,
  linkPrefix: row.link_prefix || DEFAULT_LINK_PREFIX,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function buildInviteLink(id: string, linkPrefix = DEFAULT_LINK_PREFIX) {
  return `${linkPrefix}/${encodeURIComponent(id)}`;
}

export async function readEvents(): Promise<EventRecord[]> {
  await ensureEventSchema();
  const rows = await query<EventRow>(
    "select * from events order by created_at desc, name asc"
  );
  return rows.map(mapEvent);
}

export async function getEvent(id: string): Promise<EventRecord | null> {
  await ensureEventSchema();
  const rows = await query<EventRow>(
    "select * from events where id=$1 limit 1",
    [id]
  );
  return rows[0] ? mapEvent(rows[0]) : null;
}

export async function createEvent(payload: EventPayload): Promise<EventRecord> {
  await ensureEventSchema();
  const rows = await query<EventRow>(
    `insert into events (name, date, time, venue, gate, link_prefix)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [
      payload.name,
      payload.date,
      payload.time,
      payload.venue,
      payload.gate,
      payload.linkPrefix || DEFAULT_LINK_PREFIX,
    ]
  );
  return mapEvent(rows[0]);
}

export async function updateEvent(
  id: string,
  payload: Partial<EventPayload>
): Promise<EventRecord | null> {
  await ensureEventSchema();
  const current = await getEvent(id);
  if (!current) return null;

  const rows = await query<EventRow>(
    `update events
     set name=$1, date=$2, time=$3, venue=$4, gate=$5, link_prefix=$6, updated_at=now()
     where id=$7
     returning *`,
    [
      payload.name ?? current.name,
      payload.date ?? current.date,
      payload.time ?? current.time,
      payload.venue ?? current.venue,
      payload.gate ?? current.gate,
      payload.linkPrefix ?? current.linkPrefix,
      id,
    ]
  );
  return rows[0] ? mapEvent(rows[0]) : null;
}

export async function deleteEvent(id: string) {
  await ensureEventSchema();
  await query("delete from events where id=$1", [id]);
}

async function ensureDefaultEvent(): Promise<EventRecord> {
  const existing = await readEvents();
  if (existing.length > 0) return existing[0];
  return createEvent(defaultEventPayload);
}

export async function resolveEvent(eventId?: string | null) {
  if (eventId) {
    const found = await getEvent(eventId);
    if (found) return found;
  }
  return ensureDefaultEvent();
}
