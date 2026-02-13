create extension if not exists "uuid-ossp";

create table if not exists admins (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

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
);

create table if not exists attendees (
  id text primary key,
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  program text not null,
  phone text not null,
  email text not null default '',
  npm text not null default '-',
  seat text not null default '-'
    check (char_length(seat) <= 10),
  photo_data text,
  status text not null default 'draft'
    check (status in ('draft','sent','confirmed')),
  whatsapp_sent boolean not null default false,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function set_events_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_events_updated on events;
create trigger trg_events_updated
  before update on events
  for each row execute procedure set_events_updated_at();

create or replace function set_attendees_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_attendees_updated on attendees;
create trigger trg_attendees_updated
  before update on attendees
  for each row execute procedure set_attendees_updated_at();

alter table attendees
  add column if not exists event_id uuid;

alter table attendees
  add column if not exists photo_data text;

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

alter table attendees
  alter column event_id set not null;

create index if not exists idx_attendees_event_id on attendees(event_id);
