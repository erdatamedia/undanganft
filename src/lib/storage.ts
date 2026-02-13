import { query } from "@/lib/db";
import { ensureEventSchema } from "@/lib/event";

// Normalisasi nomor telepon ke format internasional Indonesia (E.164 tanpa '+')
export function normalizePhone(raw: string): string {
  // hapus semua karakter non-digit
  const digitsOnly = (raw || "").replace(/\D+/g, "");
  if (!digitsOnly) return "";

  // kasus umum: 08xxxxxxx -> 628xxxxxxx
  if (digitsOnly.startsWith("0")) {
    return "62" + digitsOnly.slice(1);
  }
  // sudah 62xxxx -> biarkan
  if (digitsOnly.startsWith("62")) {
    return digitsOnly;
  }
  // 8xxxxxxxx -> 628xxxxxxxx
  if (digitsOnly.startsWith("8")) {
    return "62" + digitsOnly;
  }
  // jika ada leading 00 (kode internasional), ubah 00 -> (hapus) dan tambahkan sesuai Indonesia bila perlu
  if (digitsOnly.startsWith("00")) {
    const n = digitsOnly.slice(2);
    if (n.startsWith("62")) return n;
    if (n.startsWith("8")) return "62" + n; // 00 8xx -> 628xx
    return n;
  }
  // fallback: kembalikan digit yang sudah dibersihkan
  return digitsOnly;
}

export type InviteStatus = "draft" | "sent" | "confirmed";

export type AttendeeRecord = {
  id: string;
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
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

const mapRow = (row: AttendeeRow): AttendeeRecord => ({
  id: row.id,
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
  confirmedAt: row.confirmed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

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
    `insert into attendees (id, event_id, name, program, phone, email, npm, seat, status, whatsapp_sent)
     values ($1, $2, $3, $4, $5, $6, coalesce($7, '-'), coalesce($8, '-'), 'draft', false)
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
  const normalizedId = normalizeAttendeeId(id);
  const current = await getAttendee(normalizedId);
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
         confirmed_at=$10,
         updated_at=now()
     where id=$11
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
      nextState.confirmedAt,
      normalizedId,
    ]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getAttendee(id: string) {
  await ensureEventSchema();
  const rows = await query<AttendeeRow>(
    "select * from attendees where id=$1 limit 1",
    [normalizeAttendeeId(id)]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function clearAttendees(eventId: string) {
  await ensureEventSchema();
  await query("delete from attendees where event_id=$1", [eventId]);
}

export async function deleteAttendee(id: string) {
  await ensureEventSchema();
  await query("delete from attendees where id=$1", [normalizeAttendeeId(id)]);
}
