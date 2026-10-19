import { pool, query } from "@/lib/db";
import { ensureEventSchema } from "@/lib/event";

export type RundownItemRecord = {
  id: string;
  eventId: string;
  order: number;
  timeStart: string | null;
  timeEnd: string | null;
  durationMinutes: number | null;
  title: string;
  description: string | null;
  pic: string | null;
  technicalNotes: string | null;
  audioNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RundownItemPayload = {
  order?: number;
  timeStart?: string | null;
  timeEnd?: string | null;
  durationMinutes?: number | null;
  title: string;
  description?: string | null;
  pic?: string | null;
  technicalNotes?: string | null;
  audioNotes?: string | null;
};

export type RundownAttachmentRecord = {
  id: string;
  eventId: string;
  label: string;
  content: string;
  order: number;
  createdAt: string;
};

export type RundownAttachmentPayload = {
  label: string;
  content: string;
  order?: number;
};

type RundownItemRow = {
  id: string;
  event_id: string;
  item_order: number;
  time_start: string | null;
  time_end: string | null;
  duration_minutes: number | null;
  title: string;
  description: string | null;
  pic: string | null;
  technical_notes: string | null;
  audio_notes: string | null;
  created_at: string;
  updated_at: string;
};

type RundownAttachmentRow = {
  id: string;
  event_id: string;
  label: string;
  content: string;
  item_order: number;
  created_at: string;
};

const mapItem = (row: RundownItemRow): RundownItemRecord => ({
  id: row.id,
  eventId: row.event_id,
  order: row.item_order,
  timeStart: row.time_start,
  timeEnd: row.time_end,
  durationMinutes: row.duration_minutes,
  title: row.title,
  description: row.description,
  pic: row.pic,
  technicalNotes: row.technical_notes,
  audioNotes: row.audio_notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapAttachment = (row: RundownAttachmentRow): RundownAttachmentRecord => ({
  id: row.id,
  eventId: row.event_id,
  label: row.label,
  content: row.content,
  order: row.item_order,
  createdAt: row.created_at,
});

/** Parses "17.00" / "17:00" style strings into minutes since midnight. Returns null if unparseable. */
function parseTimeToMinutes(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d{1,2})[.:](\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function computeDurationMinutes(
  timeStart: string | null | undefined,
  timeEnd: string | null | undefined
): number | null {
  const start = parseTimeToMinutes(timeStart);
  const end = parseTimeToMinutes(timeEnd);
  if (start === null || end === null) return null;
  const diff = end - start;
  return diff >= 0 ? diff : diff + 24 * 60;
}

export async function listRundownItems(eventId: string): Promise<RundownItemRecord[]> {
  await ensureEventSchema();
  const rows = await query<RundownItemRow>(
    "select * from rundown_items where event_id=$1 order by item_order asc, created_at asc",
    [eventId]
  );
  return rows.map(mapItem);
}

export async function getRundownItem(
  eventId: string,
  itemId: string
): Promise<RundownItemRecord | null> {
  await ensureEventSchema();
  const rows = await query<RundownItemRow>(
    "select * from rundown_items where event_id=$1 and id=$2 limit 1",
    [eventId, itemId]
  );
  return rows[0] ? mapItem(rows[0]) : null;
}

export async function createRundownItem(
  eventId: string,
  payload: RundownItemPayload
): Promise<RundownItemRecord> {
  await ensureEventSchema();

  let order = payload.order;
  if (order === undefined) {
    const rows = await query<{ next_order: number }>(
      "select coalesce(max(item_order), 0) + 1 as next_order from rundown_items where event_id=$1",
      [eventId]
    );
    order = rows[0]?.next_order ?? 1;
  }

  const durationMinutes =
    payload.durationMinutes !== undefined
      ? payload.durationMinutes
      : computeDurationMinutes(payload.timeStart, payload.timeEnd);

  const rows = await query<RundownItemRow>(
    `insert into rundown_items
       (event_id, item_order, time_start, time_end, duration_minutes, title, description, pic, technical_notes, audio_notes)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning *`,
    [
      eventId,
      order,
      payload.timeStart ?? null,
      payload.timeEnd ?? null,
      durationMinutes,
      payload.title,
      payload.description ?? null,
      payload.pic ?? null,
      payload.technicalNotes ?? null,
      payload.audioNotes ?? null,
    ]
  );
  return mapItem(rows[0]);
}

export async function updateRundownItem(
  eventId: string,
  itemId: string,
  payload: Partial<RundownItemPayload>
): Promise<RundownItemRecord | null> {
  await ensureEventSchema();
  const current = await getRundownItem(eventId, itemId);
  if (!current) return null;

  const timeStart = payload.timeStart !== undefined ? payload.timeStart : current.timeStart;
  const timeEnd = payload.timeEnd !== undefined ? payload.timeEnd : current.timeEnd;
  const durationMinutes =
    payload.durationMinutes !== undefined
      ? payload.durationMinutes
      : payload.timeStart !== undefined || payload.timeEnd !== undefined
        ? computeDurationMinutes(timeStart, timeEnd)
        : current.durationMinutes;

  const rows = await query<RundownItemRow>(
    `update rundown_items
     set item_order=$1, time_start=$2, time_end=$3, duration_minutes=$4, title=$5,
         description=$6, pic=$7, technical_notes=$8, audio_notes=$9, updated_at=now()
     where event_id=$10 and id=$11
     returning *`,
    [
      payload.order ?? current.order,
      timeStart,
      timeEnd,
      durationMinutes,
      payload.title ?? current.title,
      payload.description !== undefined ? payload.description : current.description,
      payload.pic !== undefined ? payload.pic : current.pic,
      payload.technicalNotes !== undefined ? payload.technicalNotes : current.technicalNotes,
      payload.audioNotes !== undefined ? payload.audioNotes : current.audioNotes,
      eventId,
      itemId,
    ]
  );
  return rows[0] ? mapItem(rows[0]) : null;
}

export async function deleteRundownItem(eventId: string, itemId: string): Promise<void> {
  await ensureEventSchema();
  await query("delete from rundown_items where event_id=$1 and id=$2", [eventId, itemId]);
}

export async function reorderRundownItems(
  eventId: string,
  items: { id: string; order: number }[]
): Promise<void> {
  await ensureEventSchema();
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const item of items) {
      await client.query(
        "update rundown_items set item_order=$1, updated_at=now() where event_id=$2 and id=$3",
        [item.order, eventId, item.id]
      );
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function replaceRundownFromImport(
  eventId: string,
  items: RundownItemPayload[],
  attachments: RundownAttachmentPayload[]
): Promise<{ imported: number; attachments: number }> {
  await ensureEventSchema();
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from rundown_items where event_id=$1", [eventId]);
    await client.query("delete from rundown_attachments where event_id=$1", [eventId]);

    for (const item of items) {
      const durationMinutes =
        item.durationMinutes !== undefined
          ? item.durationMinutes
          : computeDurationMinutes(item.timeStart, item.timeEnd);
      await client.query(
        `insert into rundown_items
           (event_id, item_order, time_start, time_end, duration_minutes, title, description, pic, technical_notes, audio_notes)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          eventId,
          item.order ?? 0,
          item.timeStart ?? null,
          item.timeEnd ?? null,
          durationMinutes,
          item.title,
          item.description ?? null,
          item.pic ?? null,
          item.technicalNotes ?? null,
          item.audioNotes ?? null,
        ]
      );
    }

    for (let i = 0; i < attachments.length; i += 1) {
      const attachment = attachments[i];
      await client.query(
        `insert into rundown_attachments (event_id, label, content, item_order)
         values ($1, $2, $3, $4)`,
        [eventId, attachment.label, attachment.content, attachment.order ?? i]
      );
    }

    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  return { imported: items.length, attachments: attachments.length };
}

export async function listRundownAttachments(
  eventId: string
): Promise<RundownAttachmentRecord[]> {
  await ensureEventSchema();
  const rows = await query<RundownAttachmentRow>(
    "select * from rundown_attachments where event_id=$1 order by item_order asc, created_at asc",
    [eventId]
  );
  return rows.map(mapAttachment);
}

export async function getRundownAttachment(
  eventId: string,
  attachmentId: string
): Promise<RundownAttachmentRecord | null> {
  await ensureEventSchema();
  const rows = await query<RundownAttachmentRow>(
    "select * from rundown_attachments where event_id=$1 and id=$2 limit 1",
    [eventId, attachmentId]
  );
  return rows[0] ? mapAttachment(rows[0]) : null;
}

export async function createRundownAttachment(
  eventId: string,
  payload: RundownAttachmentPayload
): Promise<RundownAttachmentRecord> {
  await ensureEventSchema();
  const rows = await query<RundownAttachmentRow>(
    `insert into rundown_attachments (event_id, label, content, item_order)
     values ($1, $2, $3, $4)
     returning *`,
    [eventId, payload.label, payload.content, payload.order ?? 0]
  );
  return mapAttachment(rows[0]);
}

export async function updateRundownAttachment(
  eventId: string,
  attachmentId: string,
  payload: Partial<RundownAttachmentPayload>
): Promise<RundownAttachmentRecord | null> {
  await ensureEventSchema();
  const current = await getRundownAttachment(eventId, attachmentId);
  if (!current) return null;

  const rows = await query<RundownAttachmentRow>(
    `update rundown_attachments
     set label=$1, content=$2, item_order=$3
     where event_id=$4 and id=$5
     returning *`,
    [
      payload.label ?? current.label,
      payload.content ?? current.content,
      payload.order ?? current.order,
      eventId,
      attachmentId,
    ]
  );
  return rows[0] ? mapAttachment(rows[0]) : null;
}

export async function deleteRundownAttachment(
  eventId: string,
  attachmentId: string
): Promise<void> {
  await ensureEventSchema();
  await query("delete from rundown_attachments where event_id=$1 and id=$2", [
    eventId,
    attachmentId,
  ]);
}
