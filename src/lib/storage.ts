import { query } from "@/lib/db";
import { ensureEventSchema } from "@/lib/event";

export function normalizePhone(raw: string): string {
  const digitsOnly = (raw || "").replace(/\D+/g, "");
  if (!digitsOnly) return "";
  if (digitsOnly.startsWith("0")) return "62" + digitsOnly.slice(1);
  if (digitsOnly.startsWith("62")) return digitsOnly;
  if (digitsOnly.startsWith("8")) return "62" + digitsOnly;
  if (digitsOnly.startsWith("00")) {
    const n = digitsOnly.slice(2);
    if (n.startsWith("62")) return n;
    if (n.startsWith("8")) return "62" + n;
    return n;
  }
  return digitsOnly;
}

export type InviteStatus = "draft" | "sent" | "confirmed" | "absent";

export type AttendeeRecord = {
  id: string;
  token: string;
  eventId: string;
  name: string;
  program: string;
  phone: string;
  email: string;
  npm: string;
  seat: string;
  photoData?: string | null;
  status: InviteStatus;
  emailSent: boolean;
  sentAt?: string | null;
  confirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AttendeePayload = Pick<
  AttendeeRecord,
  "name" | "program" | "email" | "npm" | "seat"
> & {
  phone?: string;
  eventId?: string;
};

export type AttendeeRow = {
  id: string;
  token: string;
  event_id: string;
  name: string;
  program: string;
  phone: string;
  email: string;
  npm: string;
  seat: string;
  photo_data: string | null;
  status: InviteStatus;
  whatsapp_sent: boolean;
  sent_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

const mapRow = (row: AttendeeRow): AttendeeRecord => ({
  id: row.id,
  token: row.token,
  eventId: row.event_id,
  name: row.name,
  program: row.program,
  phone: row.phone,
  email: row.email,
  npm: row.npm,
  seat: row.seat,
  photoData: row.photo_data,
  status: row.status,
  emailSent: row.whatsapp_sent,
  sentAt: row.sent_at,
  confirmedAt: row.confirmed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

async function findAttendeeByIdentifier(raw: string): Promise<AttendeeRow | null> {
  const normalized = normalizeAttendeeId(raw);
  if (!normalized) return null;

  type MatchedRow = AttendeeRow & { match_rank: number };
  const matched = await query<MatchedRow>(
    `select *,
            case
              when upper(id) = $1 then 0
              when upper(token) = $1 then 1
              when upper(name) = $1 then 2
              when upper(split_part(name, ' ', 1)) = $1 then 3
              when upper(name) like $2 then 4
              when upper(id) like $3 then 5
              else 99
            end as match_rank
     from attendees
     where upper(id) = $1
        or upper(token) = $1
        or upper(name) = $1
        or upper(split_part(name, ' ', 1)) = $1
        or upper(name) like $2
        or upper(id) like $3
     order by match_rank asc, created_at desc
     limit 1`,
    [normalized, `${normalized}%`, `%-${normalized}%`]
  );

  return matched[0] ?? null;
}

export async function findAttendeeByToken(token: string): Promise<AttendeeRow | null> {
  await ensureEventSchema();
  const rows = await query<AttendeeRow>(
    "select * from attendees where token=$1 limit 1",
    [token]
  );
  return rows[0] ?? null;
}

export function normalizeAttendeeId(raw: string) {
  let value = raw || "";
  if (value.includes("%")) {
    try {
      value = decodeURIComponent(value);
    } catch {
      // keep original if decode fails
    }
  }
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export async function readAttendees(eventId: string): Promise<AttendeeRecord[]> {
  await ensureEventSchema();
  const rows = await query<AttendeeRow>(
    "select * from attendees where event_id=$1 order by created_at asc",
    [eventId]
  );
  return rows.map(mapRow);
}

export async function addAttendee(
  payload: AttendeePayload,
  eventId: string,
  providedId?: string
) {
  await ensureEventSchema();
  const nextId = normalizeAttendeeId(
    providedId || `${eventId}-${payload.name}`
  );
  const rows = await query<AttendeeRow>(
    `insert into attendees (id, token, event_id, name, program, phone, email, npm, seat, status, whatsapp_sent)
     values ($1, gen_random_uuid()::text, $2, $3, $4, $5, $6, coalesce($7, '-'), coalesce($8, '-'), 'draft', false)
     returning *`,
    [
      nextId,
      eventId,
      payload.name,
      payload.program,
      normalizePhone(payload.phone || "") || "-",
      payload.email,
      payload.npm,
      payload.seat,
    ]
  );
  return mapRow(rows[0]);
}

export async function updateAttendee(
  id: string,
  updater: (current: AttendeeRecord) => AttendeeRecord
) {
  await ensureEventSchema();
  const currentRow = await findAttendeeByIdentifier(id);
  const normalizedId = currentRow?.id;
  const current = currentRow ? mapRow(currentRow) : null;
  if (!current) return null;

  const nextState = updater(current);
  const rows = await query<AttendeeRow>(
    `update attendees
     set name=$1,
         program=$2,
         phone=$3,
         email=$4,
         npm=$5,
         seat=$6,
         photo_data=$7,
         status=$8,
         whatsapp_sent=$9,
         sent_at=$10,
         confirmed_at=$11,
         updated_at=now()
     where id=$12
     returning *`,
    [
      nextState.name,
      nextState.program,
      nextState.phone,
      nextState.email,
      nextState.npm,
      nextState.seat,
      nextState.photoData ?? null,
      nextState.status,
      nextState.emailSent,
      nextState.sentAt ?? null,
      nextState.confirmedAt ?? null,
      normalizedId,
    ]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getAttendee(id: string) {
  await ensureEventSchema();
  const row = await findAttendeeByIdentifier(id);
  return row ? mapRow(row) : null;
}

export async function clearAttendees(eventId: string) {
  await ensureEventSchema();
  await query("delete from attendees where event_id=$1", [eventId]);
}

export async function deleteAttendee(id: string) {
  await ensureEventSchema();
  const row = await findAttendeeByIdentifier(id);
  if (!row) return;
  await query("delete from attendees where id=$1", [row.id]);
}
