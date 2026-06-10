import { query } from "@/lib/db";

const DEFAULT_LINK_PREFIX = process.env.APP_BASE_URL
  ? `${process.env.APP_BASE_URL.replace(/\/$/, "")}/invite`
  : "https://undangan.ftunisma.online/invite";

export type EventStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";

type EventRow = {
  id: string;
  name: string;
  description: string | null;
  date: string;
  time: string;
  time_end: string | null;
  venue: string;
  gate: string;
  banner_url: string | null;
  status: EventStatus;
  link_prefix: string;
  created_at: string;
  updated_at: string;
};

export type EventRecord = {
  id: string;
  name: string;
  description?: string | null;
  date: string;
  time: string;
  timeEnd?: string | null;
  schedule: string;
  venue: string;
  gate: string;
  bannerUrl?: string | null;
  status: EventStatus;
  linkPrefix: string;
  createdAt: string;
  updatedAt: string;
};

export type EventPayload = {
  name: string;
  description?: string;
  date: string;
  time: string;
  timeEnd?: string;
  venue: string;
  gate: string;
  bannerUrl?: string;
  status?: EventStatus;
  linkPrefix?: string;
};

const defaultEventPayload: EventPayload = {
  name: "Pelepasan Calon Wisudawan/wati Fakultas Teknik Universitas Islam Malang Periode 78 Tahun 2026",
  date: "Jumat, 13 Februari 2026",
  time: "17.45 WIB",
  venue: "Gedung Pascasarjana Lantai 7 Universitas Islam Malang",
  gate: "Registrasi dibuka pukul 17.00 WIB",
  status: "ACTIVE",
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

  // Add new columns if they don't exist
  await query(`alter table events add column if not exists description text`);
  await query(`alter table events add column if not exists time_end text`);
  await query(`alter table events add column if not exists banner_url text`);
  await query(`alter table events add column if not exists status text not null default 'ACTIVE'`);
  await query(`
    do $$ begin
      if not exists (
        select 1 from pg_constraint
        where conrelid = 'events'::regclass and conname = 'events_status_check'
      ) then
        alter table events add constraint events_status_check
          check (status in ('DRAFT','ACTIVE','COMPLETED','CANCELLED'));
      end if;
    end $$
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
  await query(`alter table attendees add column if not exists token text`);
  await query(`alter table attendees add column if not exists sent_at timestamptz`);

  // Generate tokens for existing attendees that don't have one
  await query(`update attendees set token = gen_random_uuid()::text where token is null`);

  await query(`
    do $$ begin
      alter table attendees alter column token set not null;
    exception when others then null;
    end $$
  `);

  await query(`
    do $$ begin
      if not exists (
        select 1 from pg_constraint
        where conrelid = 'attendees'::regclass and conname = 'attendees_token_key'
      ) then
        alter table attendees add constraint attendees_token_key unique (token);
      end if;
    exception when others then null;
    end $$
  `);

  // Update status check to include 'absent'
  await query(`
    do $$ begin
      alter table attendees drop constraint if exists attendees_status_check;
      alter table attendees add constraint attendees_status_check
        check (status in ('draft','sent','confirmed','absent'));
    exception when others then null;
    end $$
  `);

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
        insert into events (name, date, time, venue, gate, link_prefix, status)
        values (
          'Pelepasan Calon Wisudawan/wati Fakultas Teknik Universitas Islam Malang Periode 78 Tahun 2026',
          'Jumat, 13 Februari 2026',
          '17.45 WIB',
          'Gedung Pascasarjana Lantai 7 Universitas Islam Malang',
          'Registrasi dibuka pukul 17.00 WIB',
          'https://undangan.ftunisma.online/invite',
          'ACTIVE'
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
  await query(`create index if not exists idx_attendees_event_id on attendees(event_id)`);
  await query(`create index if not exists idx_attendees_token on attendees(token)`);
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
  description: row.description,
  date: row.date,
  time: row.time,
  timeEnd: row.time_end,
  schedule: row.time_end
    ? `${row.date} • ${row.time} – ${row.time_end}`
    : `${row.date} • ${row.time}`,
  venue: row.venue,
  gate: row.gate,
  bannerUrl: row.banner_url,
  status: row.status ?? "ACTIVE",
  linkPrefix: row.link_prefix || DEFAULT_LINK_PREFIX,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function buildInviteLink(token: string, linkPrefix = DEFAULT_LINK_PREFIX) {
  return `${linkPrefix}/${encodeURIComponent(token)}`;
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
    `insert into events (name, description, date, time, time_end, venue, gate, banner_url, status, link_prefix)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning *`,
    [
      payload.name,
      payload.description ?? null,
      payload.date,
      payload.time,
      payload.timeEnd ?? null,
      payload.venue,
      payload.gate,
      payload.bannerUrl ?? null,
      payload.status ?? "ACTIVE",
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
     set name=$1, description=$2, date=$3, time=$4, time_end=$5,
         venue=$6, gate=$7, banner_url=$8, status=$9, link_prefix=$10, updated_at=now()
     where id=$11
     returning *`,
    [
      payload.name ?? current.name,
      payload.description !== undefined ? payload.description : current.description,
      payload.date ?? current.date,
      payload.time ?? current.time,
      payload.timeEnd !== undefined ? payload.timeEnd : current.timeEnd,
      payload.venue ?? current.venue,
      payload.gate ?? current.gate,
      payload.bannerUrl !== undefined ? payload.bannerUrl : current.bannerUrl,
      payload.status ?? current.status,
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

export async function getEventStats(eventId: string) {
  await ensureEventSchema();
  const rows = await query<{
    total: string;
    sent: string;
    confirmed: string;
    absent: string;
  }>(
    `select
      count(*) as total,
      count(*) filter (where status != 'draft') as sent,
      count(*) filter (where status = 'confirmed') as confirmed,
      count(*) filter (where status = 'absent') as absent
     from attendees where event_id=$1`,
    [eventId]
  );
  const r = rows[0] ?? { total: "0", sent: "0", confirmed: "0", absent: "0" };
  return {
    total: parseInt(r.total),
    sent: parseInt(r.sent),
    confirmed: parseInt(r.confirmed),
    absent: parseInt(r.absent),
  };
}

export async function getDashboardStats() {
  await ensureEventSchema();
  const rows = await query<{
    total_events: string;
    active_events: string;
    total_attendees: string;
    total_confirmed: string;
  }>(
    `select
      (select count(*) from events) as total_events,
      (select count(*) from events where status = 'ACTIVE') as active_events,
      (select count(*) from attendees) as total_attendees,
      (select count(*) from attendees where status = 'confirmed') as total_confirmed`
  );
  const r = rows[0] ?? { total_events: "0", active_events: "0", total_attendees: "0", total_confirmed: "0" };
  return {
    totalEvents: parseInt(r.total_events),
    activeEvents: parseInt(r.active_events),
    totalAttendees: parseInt(r.total_attendees),
    totalConfirmed: parseInt(r.total_confirmed),
  };
}
