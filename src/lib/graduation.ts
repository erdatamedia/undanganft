import { pool, query } from "@/lib/db";
import { ensureEventSchema } from "@/lib/event";

let schemaReadyPromise: Promise<void> | null = null;

async function ensureGraduationSchemaInternal() {
  await ensureEventSchema();

  await query(`
    create table if not exists mahasiswa_eligible (
      id uuid primary key default uuid_generate_v4(),
      event_id uuid not null references events(id) on delete cascade,
      npm text not null,
      name text not null,
      program text,
      created_at timestamptz not null default now(),
      unique (event_id, npm)
    )
  `);
  await query(`create index if not exists idx_mahasiswa_eligible_event on mahasiswa_eligible(event_id)`);

  await query(`
    create table if not exists mahasiswa (
      id uuid primary key default uuid_generate_v4(),
      npm text unique not null,
      name text not null,
      email text,
      password_hash text not null,
      created_at timestamptz not null default now()
    )
  `);
  await query(`alter table mahasiswa add column if not exists email text`);

  await query(`
    create table if not exists wd2_accounts (
      id uuid primary key default uuid_generate_v4(),
      email text unique not null,
      password_hash text not null,
      created_at timestamptz not null default now()
    )
  `);

  await query(`
    create table if not exists graduation_submissions (
      id uuid primary key default uuid_generate_v4(),
      event_id uuid not null references events(id) on delete cascade,
      mahasiswa_id uuid not null references mahasiswa(id) on delete cascade,
      yudisium_confirmed boolean not null default false,
      yudisium_confirmed_at timestamptz,
      payment_proof text,
      payment_proof_uploaded_at timestamptz,
      payment_status text not null default 'none',
      payment_reviewed_by uuid references wd2_accounts(id),
      payment_reviewed_at timestamptz,
      payment_reject_reason text,
      wisuda_confirmed boolean not null default false,
      attendee_id text references attendees(id),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (event_id, mahasiswa_id)
    )
  `);
  await query(`
    do $$ begin
      if not exists (
        select 1 from pg_constraint
        where conrelid = 'graduation_submissions'::regclass and conname = 'graduation_submissions_status_check'
      ) then
        alter table graduation_submissions add constraint graduation_submissions_status_check
          check (payment_status in ('none','pending','approved','rejected'));
      end if;
    end $$
  `);
  await query(`create index if not exists idx_grad_submissions_event on graduation_submissions(event_id)`);
  await query(`create index if not exists idx_grad_submissions_status on graduation_submissions(event_id, payment_status)`);

  await query(`
    create table if not exists graduation_notifications (
      id uuid primary key default uuid_generate_v4(),
      recipient_type text not null,
      recipient_id uuid not null,
      type text not null,
      title text not null,
      body text,
      link text,
      read_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);
  await query(`
    do $$ begin
      if not exists (
        select 1 from pg_constraint
        where conrelid = 'graduation_notifications'::regclass and conname = 'graduation_notifications_recipient_check'
      ) then
        alter table graduation_notifications add constraint graduation_notifications_recipient_check
          check (recipient_type in ('wd2','mahasiswa'));
      end if;
    end $$
  `);
  await query(`create index if not exists idx_grad_notif_recipient on graduation_notifications(recipient_type, recipient_id, read_at)`);
}

export async function ensureGraduationSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureGraduationSchemaInternal().catch((err) => {
      schemaReadyPromise = null;
      throw err;
    });
  }
  await schemaReadyPromise;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type MahasiswaEligibleRecord = {
  id: string;
  eventId: string;
  npm: string;
  name: string;
  program: string | null;
  createdAt: string;
};

export type MahasiswaRecord = {
  id: string;
  npm: string;
  name: string;
  email: string | null;
  createdAt: string;
};

export type Wd2AccountRecord = {
  id: string;
  email: string;
  createdAt: string;
};

export type PaymentStatus = "none" | "pending" | "approved" | "rejected";

export type GraduationSubmissionRecord = {
  id: string;
  eventId: string;
  mahasiswaId: string;
  yudisiumConfirmed: boolean;
  yudisiumConfirmedAt: string | null;
  paymentProof: string | null;
  paymentProofUploadedAt: string | null;
  paymentStatus: PaymentStatus;
  paymentReviewedBy: string | null;
  paymentReviewedAt: string | null;
  paymentRejectReason: string | null;
  wisudaConfirmed: boolean;
  attendeeId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GraduationNotificationRecord = {
  id: string;
  recipientType: "wd2" | "mahasiswa";
  recipientId: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

type MahasiswaEligibleRow = {
  id: string;
  event_id: string;
  npm: string;
  name: string;
  program: string | null;
  created_at: string;
};

type MahasiswaRow = {
  id: string;
  npm: string;
  name: string;
  email: string | null;
  password_hash: string;
  created_at: string;
};

type Wd2AccountRow = {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
};

type GraduationSubmissionRow = {
  id: string;
  event_id: string;
  mahasiswa_id: string;
  yudisium_confirmed: boolean;
  yudisium_confirmed_at: string | null;
  payment_proof: string | null;
  payment_proof_uploaded_at: string | null;
  payment_status: PaymentStatus;
  payment_reviewed_by: string | null;
  payment_reviewed_at: string | null;
  payment_reject_reason: string | null;
  wisuda_confirmed: boolean;
  attendee_id: string | null;
  created_at: string;
  updated_at: string;
};

type GraduationNotificationRow = {
  id: string;
  recipient_type: "wd2" | "mahasiswa";
  recipient_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const mapEligible = (row: MahasiswaEligibleRow): MahasiswaEligibleRecord => ({
  id: row.id,
  eventId: row.event_id,
  npm: row.npm,
  name: row.name,
  program: row.program,
  createdAt: row.created_at,
});

const mapMahasiswa = (row: MahasiswaRow): MahasiswaRecord => ({
  id: row.id,
  npm: row.npm,
  name: row.name,
  email: row.email,
  createdAt: row.created_at,
});

const mapWd2 = (row: Wd2AccountRow): Wd2AccountRecord => ({
  id: row.id,
  email: row.email,
  createdAt: row.created_at,
});

const mapSubmission = (row: GraduationSubmissionRow): GraduationSubmissionRecord => ({
  id: row.id,
  eventId: row.event_id,
  mahasiswaId: row.mahasiswa_id,
  yudisiumConfirmed: row.yudisium_confirmed,
  yudisiumConfirmedAt: row.yudisium_confirmed_at,
  paymentProof: row.payment_proof,
  paymentProofUploadedAt: row.payment_proof_uploaded_at,
  paymentStatus: row.payment_status,
  paymentReviewedBy: row.payment_reviewed_by,
  paymentReviewedAt: row.payment_reviewed_at,
  paymentRejectReason: row.payment_reject_reason,
  wisudaConfirmed: row.wisuda_confirmed,
  attendeeId: row.attendee_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapNotification = (row: GraduationNotificationRow): GraduationNotificationRecord => ({
  id: row.id,
  recipientType: row.recipient_type,
  recipientId: row.recipient_id,
  type: row.type,
  title: row.title,
  body: row.body,
  link: row.link,
  readAt: row.read_at,
  createdAt: row.created_at,
});

// ─── Eligible list ──────────────────────────────────────────────────────────

export function normalizeNpm(raw: string) {
  return (raw || "").trim().toUpperCase();
}

export function normalizeName(raw: string) {
  return (raw || "").trim().replace(/\s+/g, " ").toUpperCase();
}

export async function listEligible(eventId: string): Promise<MahasiswaEligibleRecord[]> {
  await ensureGraduationSchema();
  const rows = await query<MahasiswaEligibleRow>(
    "select * from mahasiswa_eligible where event_id=$1 order by name asc",
    [eventId]
  );
  return rows.map(mapEligible);
}

export async function findEligible(
  eventId: string,
  npm: string
): Promise<MahasiswaEligibleRecord | null> {
  await ensureGraduationSchema();
  const rows = await query<MahasiswaEligibleRow>(
    "select * from mahasiswa_eligible where event_id=$1 and npm=$2 limit 1",
    [eventId, normalizeNpm(npm)]
  );
  return rows[0] ? mapEligible(rows[0]) : null;
}

/** Finds the most recent ACTIVE event this NPM is eligible for. */
export async function findActiveEligibleEvent(
  npm: string
): Promise<MahasiswaEligibleRecord | null> {
  await ensureGraduationSchema();
  const rows = await query<MahasiswaEligibleRow>(
    `select me.* from mahasiswa_eligible me
     join events e on e.id = me.event_id
     where me.npm=$1 and e.status='ACTIVE'
     order by e.created_at desc
     limit 1`,
    [normalizeNpm(npm)]
  );
  return rows[0] ? mapEligible(rows[0]) : null;
}

/** Most recently created ACTIVE event — no eligible-list check. */
export async function findActiveEvent(): Promise<{ eventId: string } | null> {
  await ensureGraduationSchema();
  const rows = await query<{ id: string }>(
    "select id from events where status='ACTIVE' order by created_at desc limit 1"
  );
  return rows[0] ? { eventId: rows[0].id } : null;
}

export async function importEligible(
  eventId: string,
  rows: { npm: string; name: string; program?: string | null }[]
): Promise<{ imported: number }> {
  await ensureGraduationSchema();
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const row of rows) {
      await client.query(
        `insert into mahasiswa_eligible (event_id, npm, name, program)
         values ($1, $2, $3, $4)
         on conflict (event_id, npm) do update set name=excluded.name, program=excluded.program`,
        [eventId, normalizeNpm(row.npm), row.name.trim(), row.program?.trim() || null]
      );
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
  return { imported: rows.length };
}

// ─── Mahasiswa accounts ─────────────────────────────────────────────────────

export async function findMahasiswaByNpm(npm: string): Promise<MahasiswaRow | null> {
  await ensureGraduationSchema();
  const rows = await query<MahasiswaRow>(
    "select * from mahasiswa where npm=$1 limit 1",
    [normalizeNpm(npm)]
  );
  return rows[0] ?? null;
}

export async function getMahasiswaById(id: string): Promise<MahasiswaRecord | null> {
  await ensureGraduationSchema();
  const rows = await query<MahasiswaRow>("select * from mahasiswa where id=$1 limit 1", [id]);
  return rows[0] ? mapMahasiswa(rows[0]) : null;
}

export async function createMahasiswa(payload: {
  npm: string;
  name: string;
  email: string;
  passwordHash: string;
}): Promise<MahasiswaRecord> {
  await ensureGraduationSchema();
  const rows = await query<MahasiswaRow>(
    `insert into mahasiswa (npm, name, email, password_hash)
     values ($1, $2, $3, $4)
     returning *`,
    [normalizeNpm(payload.npm), payload.name.trim(), payload.email.trim(), payload.passwordHash]
  );
  return mapMahasiswa(rows[0]);
}

export async function setMahasiswaPasswordHash(id: string, passwordHash: string): Promise<void> {
  await ensureGraduationSchema();
  await query("update mahasiswa set password_hash=$1 where id=$2", [passwordHash, id]);
}

// ─── WD2 accounts ───────────────────────────────────────────────────────────

export async function listWd2Accounts(): Promise<Wd2AccountRecord[]> {
  await ensureGraduationSchema();
  const rows = await query<Wd2AccountRow>("select * from wd2_accounts order by created_at asc");
  return rows.map(mapWd2);
}

export async function findWd2ByEmail(email: string): Promise<Wd2AccountRow | null> {
  await ensureGraduationSchema();
  const rows = await query<Wd2AccountRow>(
    "select * from wd2_accounts where email=$1 limit 1",
    [email.trim().toLowerCase()]
  );
  return rows[0] ?? null;
}

export async function getWd2ById(id: string): Promise<Wd2AccountRecord | null> {
  await ensureGraduationSchema();
  const rows = await query<Wd2AccountRow>("select * from wd2_accounts where id=$1 limit 1", [id]);
  return rows[0] ? mapWd2(rows[0]) : null;
}

export async function createWd2Account(payload: {
  email: string;
  passwordHash: string;
}): Promise<Wd2AccountRecord> {
  await ensureGraduationSchema();
  const rows = await query<Wd2AccountRow>(
    `insert into wd2_accounts (email, password_hash) values ($1, $2) returning *`,
    [payload.email.trim().toLowerCase(), payload.passwordHash]
  );
  return mapWd2(rows[0]);
}

export async function deleteWd2Account(id: string): Promise<void> {
  await ensureGraduationSchema();
  await query("delete from wd2_accounts where id=$1", [id]);
}

// ─── Submissions ────────────────────────────────────────────────────────────

export async function getOrCreateSubmission(
  eventId: string,
  mahasiswaId: string
): Promise<GraduationSubmissionRecord> {
  await ensureGraduationSchema();
  const existing = await query<GraduationSubmissionRow>(
    "select * from graduation_submissions where event_id=$1 and mahasiswa_id=$2 limit 1",
    [eventId, mahasiswaId]
  );
  if (existing[0]) return mapSubmission(existing[0]);

  const rows = await query<GraduationSubmissionRow>(
    `insert into graduation_submissions (event_id, mahasiswa_id)
     values ($1, $2)
     on conflict (event_id, mahasiswa_id) do update set updated_at=graduation_submissions.updated_at
     returning *`,
    [eventId, mahasiswaId]
  );
  return mapSubmission(rows[0]);
}

export async function getSubmissionById(id: string): Promise<GraduationSubmissionRecord | null> {
  await ensureGraduationSchema();
  const rows = await query<GraduationSubmissionRow>(
    "select * from graduation_submissions where id=$1 limit 1",
    [id]
  );
  return rows[0] ? mapSubmission(rows[0]) : null;
}

export async function listSubmissions(
  eventId: string,
  status?: PaymentStatus
): Promise<GraduationSubmissionRecord[]> {
  await ensureGraduationSchema();
  const rows = status
    ? await query<GraduationSubmissionRow>(
        "select * from graduation_submissions where event_id=$1 and payment_status=$2 order by payment_proof_uploaded_at asc nulls last, created_at asc",
        [eventId, status]
      )
    : await query<GraduationSubmissionRow>(
        "select * from graduation_submissions where event_id=$1 order by created_at asc",
        [eventId]
      );
  return rows.map(mapSubmission);
}

export type SubmissionWithMahasiswa = GraduationSubmissionRecord & {
  mahasiswaNpm: string;
  mahasiswaName: string;
  mahasiswaEmail: string | null;
};

export async function listSubmissionsByStatusWithMahasiswa(
  status: PaymentStatus
): Promise<SubmissionWithMahasiswa[]> {
  await ensureGraduationSchema();
  const rows = await query<GraduationSubmissionRow & { npm: string; name: string; email: string | null }>(
    `select gs.*, m.npm, m.name, m.email
     from graduation_submissions gs
     join mahasiswa m on m.id = gs.mahasiswa_id
     where gs.payment_status=$1
     order by gs.payment_proof_uploaded_at asc nulls last, gs.created_at asc`,
    [status]
  );
  return rows.map((row) => ({
    ...mapSubmission(row),
    mahasiswaNpm: row.npm,
    mahasiswaName: row.name,
    mahasiswaEmail: row.email,
  }));
}

export async function listSubmissionsByStatus(
  status: PaymentStatus
): Promise<GraduationSubmissionRecord[]> {
  await ensureGraduationSchema();
  const rows = await query<GraduationSubmissionRow>(
    "select * from graduation_submissions where payment_status=$1 order by payment_proof_uploaded_at asc nulls last, created_at asc",
    [status]
  );
  return rows.map(mapSubmission);
}

export async function confirmYudisium(submissionId: string): Promise<GraduationSubmissionRecord | null> {
  await ensureGraduationSchema();
  const rows = await query<GraduationSubmissionRow>(
    `update graduation_submissions
     set yudisium_confirmed=true, yudisium_confirmed_at=now(), updated_at=now()
     where id=$1
     returning *`,
    [submissionId]
  );
  return rows[0] ? mapSubmission(rows[0]) : null;
}

export async function uploadPaymentProof(
  submissionId: string,
  dataUri: string
): Promise<GraduationSubmissionRecord | null> {
  await ensureGraduationSchema();
  const rows = await query<GraduationSubmissionRow>(
    `update graduation_submissions
     set payment_proof=$1, payment_proof_uploaded_at=now(), payment_status='pending',
         payment_reject_reason=null, updated_at=now()
     where id=$2
     returning *`,
    [dataUri, submissionId]
  );
  return rows[0] ? mapSubmission(rows[0]) : null;
}

export async function markSubmissionApproved(
  submissionId: string,
  wd2Id: string,
  attendeeId: string
): Promise<GraduationSubmissionRecord | null> {
  await ensureGraduationSchema();
  const rows = await query<GraduationSubmissionRow>(
    `update graduation_submissions
     set payment_status='approved', payment_reviewed_by=$1, payment_reviewed_at=now(),
         wisuda_confirmed=true, attendee_id=$2, updated_at=now()
     where id=$3
     returning *`,
    [wd2Id, attendeeId, submissionId]
  );
  return rows[0] ? mapSubmission(rows[0]) : null;
}

export async function rejectSubmission(
  submissionId: string,
  wd2Id: string,
  reason: string
): Promise<GraduationSubmissionRecord | null> {
  await ensureGraduationSchema();
  const rows = await query<GraduationSubmissionRow>(
    `update graduation_submissions
     set payment_status='rejected', payment_reviewed_by=$1, payment_reviewed_at=now(),
         payment_reject_reason=$2, updated_at=now()
     where id=$3
     returning *`,
    [wd2Id, reason, submissionId]
  );
  return rows[0] ? mapSubmission(rows[0]) : null;
}

// ─── Notifications ──────────────────────────────────────────────────────────

export async function createNotification(payload: {
  recipientType: "wd2" | "mahasiswa";
  recipientId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
}): Promise<GraduationNotificationRecord> {
  await ensureGraduationSchema();
  const rows = await query<GraduationNotificationRow>(
    `insert into graduation_notifications (recipient_type, recipient_id, type, title, body, link)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [
      payload.recipientType,
      payload.recipientId,
      payload.type,
      payload.title,
      payload.body ?? null,
      payload.link ?? null,
    ]
  );
  return mapNotification(rows[0]);
}

export async function notifyAllWd2(payload: {
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
}): Promise<void> {
  await ensureGraduationSchema();
  const accounts = await listWd2Accounts();
  for (const account of accounts) {
    await createNotification({ ...payload, recipientType: "wd2", recipientId: account.id });
  }
}

export async function listNotifications(
  recipientType: "wd2" | "mahasiswa",
  recipientId: string
): Promise<GraduationNotificationRecord[]> {
  await ensureGraduationSchema();
  const rows = await query<GraduationNotificationRow>(
    `select * from graduation_notifications
     where recipient_type=$1 and recipient_id=$2
     order by created_at desc
     limit 50`,
    [recipientType, recipientId]
  );
  return rows.map(mapNotification);
}

export async function countUnreadNotifications(
  recipientType: "wd2" | "mahasiswa",
  recipientId: string
): Promise<number> {
  await ensureGraduationSchema();
  const rows = await query<{ count: string }>(
    `select count(*) from graduation_notifications
     where recipient_type=$1 and recipient_id=$2 and read_at is null`,
    [recipientType, recipientId]
  );
  return parseInt(rows[0]?.count ?? "0", 10);
}

export async function markNotificationRead(id: string): Promise<void> {
  await ensureGraduationSchema();
  await query("update graduation_notifications set read_at=now() where id=$1 and read_at is null", [id]);
}
