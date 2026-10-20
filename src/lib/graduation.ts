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
  await query(`alter table mahasiswa add column if not exists videotron_photo text`);

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

  await query(`alter table graduation_submissions add column if not exists yudisium_status text not null default 'pending'`);
  await query(`alter table graduation_submissions add column if not exists yudisium_absent_reason text`);
  await query(`update graduation_submissions set yudisium_status='hadir' where yudisium_confirmed=true and yudisium_status='pending'`);

  await query(`
    create table if not exists graduation_payments (
      id uuid primary key default uuid_generate_v4(),
      submission_id uuid not null references graduation_submissions(id) on delete cascade,
      kind text not null check (kind in ('fakultas','univ')),
      proof text,
      status text not null default 'none' check (status in ('none','pending','approved','rejected','desk')),
      source text not null default 'mahasiswa' check (source in ('mahasiswa','admin_desk')),
      uploaded_at timestamptz,
      reviewed_by_type text,
      reviewed_by uuid,
      reviewed_at timestamptz,
      reject_reason text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (submission_id, kind)
    )
  `);
  await query(`create index if not exists idx_grad_payments_status on graduation_payments(status)`);

  // One-off migration of the legacy single payment proof into kind='fakultas'
  await query(`
    insert into graduation_payments (submission_id, kind, proof, status, source, uploaded_at, reviewed_by_type, reviewed_by, reviewed_at, reject_reason)
    select id, 'fakultas', payment_proof, payment_status, 'mahasiswa', payment_proof_uploaded_at,
           case when payment_reviewed_by is not null then 'wd2' end, payment_reviewed_by, payment_reviewed_at, payment_reject_reason
    from graduation_submissions
    where payment_status <> 'none'
    on conflict (submission_id, kind) do nothing
  `);

  await query(`
    create table if not exists graduation_pickups (
      id uuid primary key default uuid_generate_v4(),
      submission_id uuid not null unique references graduation_submissions(id) on delete cascade,
      handed_by uuid,
      handed_at timestamptz not null default now(),
      undangan_given boolean not null default false,
      toga_given boolean not null default false,
      handover_photo text,
      note text,
      wd2_check_status text not null default 'pending' check (wd2_check_status in ('pending','valid','issue')),
      wd2_check_by uuid,
      wd2_check_by_type text,
      wd2_check_at timestamptz,
      wd2_check_note text
    )
  `);
  await query(`create index if not exists idx_grad_pickups_check on graduation_pickups(wd2_check_status)`);

  // Deleting an attendee must not be blocked by the submission link
  await query(`
    do $$ begin
      if exists (
        select 1 from pg_constraint
        where conname = 'graduation_submissions_attendee_id_fkey' and confdeltype <> 'n'
      ) then
        alter table graduation_submissions drop constraint graduation_submissions_attendee_id_fkey;
        alter table graduation_submissions add constraint graduation_submissions_attendee_id_fkey
          foreign key (attendee_id) references attendees(id) on delete set null;
      end if;
    end $$
  `);

  await query(`
    create table if not exists event_documents (
      id uuid primary key default uuid_generate_v4(),
      event_id uuid not null references events(id) on delete cascade,
      kind text not null check (kind in ('yudisium','wisuda')),
      filename text not null,
      mime text not null default 'application/pdf',
      size int not null,
      data bytea not null,
      updated_at timestamptz not null default now(),
      unique (event_id, kind)
    )
  `);
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

export type PaymentKind = "fakultas" | "univ";
export type PaymentStatus = "none" | "pending" | "approved" | "rejected" | "desk";
export type YudisiumStatus = "pending" | "hadir" | "tidak_hadir";
export type ReviewerType = "wd2" | "admin";

export type GraduationSubmissionRecord = {
  id: string;
  eventId: string;
  mahasiswaId: string;
  yudisiumConfirmed: boolean;
  yudisiumConfirmedAt: string | null;
  yudisiumStatus: YudisiumStatus;
  yudisiumAbsentReason: string | null;
  wisudaConfirmed: boolean;
  attendeeId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentRecord = {
  id: string;
  submissionId: string;
  kind: PaymentKind;
  proof: string | null;
  status: PaymentStatus;
  source: "mahasiswa" | "admin_desk";
  uploadedAt: string | null;
  reviewedByType: ReviewerType | null;
  reviewedAt: string | null;
  rejectReason: string | null;
};

export type PickupRecord = {
  id: string;
  submissionId: string;
  handedAt: string;
  undanganGiven: boolean;
  togaGiven: boolean;
  handoverPhoto: string | null;
  note: string | null;
  wd2CheckStatus: "pending" | "valid" | "issue";
  wd2CheckAt: string | null;
  wd2CheckNote: string | null;
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
  yudisium_status: YudisiumStatus;
  yudisium_absent_reason: string | null;
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
  yudisiumStatus: row.yudisium_status,
  yudisiumAbsentReason: row.yudisium_absent_reason,
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
      // Peserta acara: ikut masuk daftar attendees (draft) bila NPM belum ada.
      const npm = normalizeNpm(row.npm);
      const name = row.name.trim();
      await client.query(
        `insert into attendees (id, token, event_id, name, program, phone, email, npm, seat, status, whatsapp_sent)
         select upper(regexp_replace($1::uuid::text || '-' || $2::text || '-' || $3::text, '\\s+', ' ', 'g')), gen_random_uuid()::text,
                $1::uuid, $2::text, $4::text, '-', '', $3::text, '-', 'draft', false
         where not exists (select 1 from attendees where event_id=$1::uuid and npm=$3::text)
         on conflict (id) do nothing`,
        [eventId, name, npm, row.program?.trim() || "Belum ditentukan"]
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

export async function setYudisiumStatus(
  submissionId: string,
  attending: boolean,
  reason?: string | null
): Promise<GraduationSubmissionRecord | null> {
  await ensureGraduationSchema();
  const rows = await query<GraduationSubmissionRow>(
    `update graduation_submissions
     set yudisium_status=$2, yudisium_confirmed=$3,
         yudisium_confirmed_at=now(), yudisium_absent_reason=$4, updated_at=now()
     where id=$1
     returning *`,
    [submissionId, attending ? "hadir" : "tidak_hadir", attending, attending ? null : reason?.trim() || null]
  );
  return rows[0] ? mapSubmission(rows[0]) : null;
}

export async function setSubmissionAttendee(
  submissionId: string,
  attendeeId: string
): Promise<void> {
  await ensureGraduationSchema();
  await query(
    `update graduation_submissions set attendee_id=$2, wisuda_confirmed=true, updated_at=now() where id=$1`,
    [submissionId, attendeeId]
  );
}

// ─── Payments (2 bukti: fakultas & univ) ────────────────────────────────────

type PaymentRow = {
  id: string;
  submission_id: string;
  kind: PaymentKind;
  proof: string | null;
  status: PaymentStatus;
  source: "mahasiswa" | "admin_desk";
  uploaded_at: string | null;
  reviewed_by_type: ReviewerType | null;
  reviewed_at: string | null;
  reject_reason: string | null;
};

const mapPayment = (row: PaymentRow): PaymentRecord => ({
  id: row.id,
  submissionId: row.submission_id,
  kind: row.kind,
  proof: row.proof,
  status: row.status,
  source: row.source,
  uploadedAt: row.uploaded_at,
  reviewedByType: row.reviewed_by_type,
  reviewedAt: row.reviewed_at,
  rejectReason: row.reject_reason,
});

export type PaymentsByKind = { fakultas: PaymentRecord | null; univ: PaymentRecord | null };

export async function getPayments(submissionId: string): Promise<PaymentsByKind> {
  await ensureGraduationSchema();
  const rows = await query<PaymentRow>(
    "select * from graduation_payments where submission_id=$1",
    [submissionId]
  );
  const result: PaymentsByKind = { fakultas: null, univ: null };
  for (const row of rows) result[row.kind] = mapPayment(row);
  return result;
}

export async function getPaymentById(id: string): Promise<PaymentRecord | null> {
  await ensureGraduationSchema();
  const rows = await query<PaymentRow>("select * from graduation_payments where id=$1 limit 1", [id]);
  return rows[0] ? mapPayment(rows[0]) : null;
}

/** Student upload (or re-upload after rejection): always goes back to 'pending'. */
export async function uploadPaymentProof(
  submissionId: string,
  kind: PaymentKind,
  dataUri: string
): Promise<PaymentRecord> {
  await ensureGraduationSchema();
  const rows = await query<PaymentRow>(
    `insert into graduation_payments (submission_id, kind, proof, status, source, uploaded_at)
     values ($1, $2, $3, 'pending', 'mahasiswa', now())
     on conflict (submission_id, kind) do update
       set proof=excluded.proof, status='pending', source='mahasiswa', uploaded_at=now(),
           reviewed_by_type=null, reviewed_by=null, reviewed_at=null, reject_reason=null, updated_at=now()
     returning *`,
    [submissionId, kind, dataUri]
  );
  return mapPayment(rows[0]);
}

/** Admin desk: proof photographed at the counter, handed over without waiting for WD2. */
export async function upsertDeskPayment(
  submissionId: string,
  kind: PaymentKind,
  dataUri: string,
  adminId: string
): Promise<PaymentRecord> {
  await ensureGraduationSchema();
  const rows = await query<PaymentRow>(
    `insert into graduation_payments (submission_id, kind, proof, status, source, uploaded_at, reviewed_by_type, reviewed_by, reviewed_at)
     values ($1, $2, $3, 'desk', 'admin_desk', now(), 'admin', $4, now())
     on conflict (submission_id, kind) do update
       set proof=excluded.proof, status='desk', source='admin_desk', uploaded_at=now(),
           reviewed_by_type='admin', reviewed_by=excluded.reviewed_by, reviewed_at=now(), reject_reason=null, updated_at=now()
     returning *`,
    [submissionId, kind, dataUri, adminId]
  );
  return mapPayment(rows[0]);
}

export async function approvePayment(
  paymentId: string,
  reviewer: { type: ReviewerType; id: string }
): Promise<PaymentRecord | null> {
  await ensureGraduationSchema();
  const rows = await query<PaymentRow>(
    `update graduation_payments
     set status='approved', reviewed_by_type=$2, reviewed_by=$3, reviewed_at=now(), reject_reason=null, updated_at=now()
     where id=$1
     returning *`,
    [paymentId, reviewer.type, reviewer.id]
  );
  return rows[0] ? mapPayment(rows[0]) : null;
}

export async function rejectPayment(
  paymentId: string,
  reviewer: { type: ReviewerType; id: string },
  reason: string
): Promise<PaymentRecord | null> {
  await ensureGraduationSchema();
  const rows = await query<PaymentRow>(
    `update graduation_payments
     set status='rejected', reviewed_by_type=$2, reviewed_by=$3, reviewed_at=now(), reject_reason=$4, updated_at=now()
     where id=$1
     returning *`,
    [paymentId, reviewer.type, reviewer.id, reason]
  );
  return rows[0] ? mapPayment(rows[0]) : null;
}

export type ReviewQueueItem = {
  submissionId: string;
  mahasiswaId: string;
  mahasiswaNpm: string;
  mahasiswaName: string;
  mahasiswaEmail: string | null;
  payments: PaymentsByKind;
};

/** Students having at least one payment proof waiting for a decision. */
export async function listReviewQueue(): Promise<ReviewQueueItem[]> {
  await ensureGraduationSchema();
  const subs = await query<{
    id: string;
    mahasiswa_id: string;
    npm: string;
    name: string;
    email: string | null;
  }>(
    `select gs.id, gs.mahasiswa_id, m.npm, m.name, m.email
     from graduation_submissions gs
     join mahasiswa m on m.id = gs.mahasiswa_id
     where exists (select 1 from graduation_payments gp where gp.submission_id = gs.id and gp.status='pending')
     order by (select min(uploaded_at) from graduation_payments gp where gp.submission_id = gs.id and gp.status='pending') asc`
  );
  const items: ReviewQueueItem[] = [];
  for (const sub of subs) {
    items.push({
      submissionId: sub.id,
      mahasiswaId: sub.mahasiswa_id,
      mahasiswaNpm: sub.npm,
      mahasiswaName: sub.name,
      mahasiswaEmail: sub.email,
      payments: await getPayments(sub.id),
    });
  }
  return items;
}

// ─── Pickups (meja pengambilan) ─────────────────────────────────────────────

type PickupRow = {
  id: string;
  submission_id: string;
  handed_at: string;
  undangan_given: boolean;
  toga_given: boolean;
  handover_photo: string | null;
  note: string | null;
  wd2_check_status: "pending" | "valid" | "issue";
  wd2_check_at: string | null;
  wd2_check_note: string | null;
};

const mapPickup = (row: PickupRow): PickupRecord => ({
  id: row.id,
  submissionId: row.submission_id,
  handedAt: row.handed_at,
  undanganGiven: row.undangan_given,
  togaGiven: row.toga_given,
  handoverPhoto: row.handover_photo,
  note: row.note,
  wd2CheckStatus: row.wd2_check_status,
  wd2CheckAt: row.wd2_check_at,
  wd2CheckNote: row.wd2_check_note,
});

export async function getPickupBySubmission(submissionId: string): Promise<PickupRecord | null> {
  await ensureGraduationSchema();
  const rows = await query<PickupRow>(
    "select * from graduation_pickups where submission_id=$1 limit 1",
    [submissionId]
  );
  return rows[0] ? mapPickup(rows[0]) : null;
}

export async function getPickupById(id: string): Promise<PickupRecord | null> {
  await ensureGraduationSchema();
  const rows = await query<PickupRow>("select * from graduation_pickups where id=$1 limit 1", [id]);
  return rows[0] ? mapPickup(rows[0]) : null;
}

export async function upsertPickup(payload: {
  submissionId: string;
  adminId: string;
  undanganGiven: boolean;
  togaGiven: boolean;
  handoverPhoto: string | null;
  note?: string | null;
}): Promise<PickupRecord> {
  await ensureGraduationSchema();
  const rows = await query<PickupRow>(
    `insert into graduation_pickups (submission_id, handed_by, undangan_given, toga_given, handover_photo, note)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (submission_id) do update
       set handed_by=excluded.handed_by, handed_at=now(), undangan_given=excluded.undangan_given,
           toga_given=excluded.toga_given, handover_photo=excluded.handover_photo, note=excluded.note,
           wd2_check_status='pending', wd2_check_by=null, wd2_check_by_type=null, wd2_check_at=null, wd2_check_note=null
     returning *`,
    [
      payload.submissionId,
      payload.adminId,
      payload.undanganGiven,
      payload.togaGiven,
      payload.handoverPhoto,
      payload.note?.trim() || null,
    ]
  );
  return mapPickup(rows[0]);
}

export type PickupQueueItem = PickupRecord & {
  mahasiswaNpm: string;
  mahasiswaName: string;
  payments: PaymentsByKind;
};

export async function listPickups(
  status?: "pending" | "valid" | "issue"
): Promise<PickupQueueItem[]> {
  await ensureGraduationSchema();
  const rows = await query<PickupRow & { npm: string; name: string }>(
    `select gp.*, m.npm, m.name
     from graduation_pickups gp
     join graduation_submissions gs on gs.id = gp.submission_id
     join mahasiswa m on m.id = gs.mahasiswa_id
     ${status ? "where gp.wd2_check_status = $1" : ""}
     order by gp.handed_at desc`,
    status ? [status] : []
  );
  const items: PickupQueueItem[] = [];
  for (const row of rows) {
    items.push({
      ...mapPickup(row),
      mahasiswaNpm: row.npm,
      mahasiswaName: row.name,
      payments: await getPayments(row.submission_id),
    });
  }
  return items;
}

export async function checkPickup(
  pickupId: string,
  reviewer: { type: ReviewerType; id: string },
  outcome: "valid" | "issue",
  note?: string | null
): Promise<PickupRecord | null> {
  await ensureGraduationSchema();
  const rows = await query<PickupRow>(
    `update graduation_pickups
     set wd2_check_status=$2, wd2_check_by_type=$3, wd2_check_by=$4, wd2_check_at=now(), wd2_check_note=$5
     where id=$1
     returning *`,
    [pickupId, outcome, reviewer.type, reviewer.id, note?.trim() || null]
  );
  const pickup = rows[0] ? mapPickup(rows[0]) : null;
  if (pickup && outcome === "valid") {
    await query(
      `update graduation_payments
       set status='approved', reviewed_by_type=$2, reviewed_by=$3, reviewed_at=now(), updated_at=now()
       where submission_id=$1 and status='desk'`,
      [pickup.submissionId, reviewer.type, reviewer.id]
    );
  }
  return pickup;
}

// ─── Desk lookup & rekap ────────────────────────────────────────────────────

export type DeskStudent = {
  mahasiswaId: string | null;
  program: string | null;
  npm: string;
  name: string;
  email: string | null;
  submissionId: string | null;
  yudisiumStatus: YudisiumStatus | null;
  fakultasStatus: PaymentStatus | null;
  univStatus: PaymentStatus | null;
  pickedUp: boolean;
  handedAt: string | null;
  undanganGiven: boolean;
  togaGiven: boolean;
  checkStatus: "pending" | "valid" | "issue" | null;
  checkNote: string | null;
};

type DeskRow = {
  mahasiswa_id: string | null;
  program: string | null;
  npm: string;
  name: string;
  email: string | null;
  submission_id: string | null;
  yudisium_status: YudisiumStatus | null;
  fakultas_status: PaymentStatus | null;
  univ_status: PaymentStatus | null;
  handed_at: string | null;
  undangan_given: boolean | null;
  toga_given: boolean | null;
  check_status: "pending" | "valid" | "issue" | null;
  check_note: string | null;
};

const DESK_SELECT = `
  select m.id as mahasiswa_id, el.program as program, m.npm, m.name, m.email,
         gs.id as submission_id, gs.yudisium_status,
         (select status from graduation_payments where submission_id = gs.id and kind='fakultas') as fakultas_status,
         (select status from graduation_payments where submission_id = gs.id and kind='univ') as univ_status,
         gp.handed_at, gp.undangan_given, gp.toga_given,
         gp.wd2_check_status as check_status, gp.wd2_check_note as check_note
  from mahasiswa m
  left join graduation_submissions gs on gs.mahasiswa_id = m.id and gs.event_id = $1
  left join graduation_pickups gp on gp.submission_id = gs.id
  left join mahasiswa_eligible el on el.event_id = $1 and el.npm = m.npm
`;

const mapDesk = (row: DeskRow): DeskStudent => ({
  mahasiswaId: row.mahasiswa_id,
  program: row.program,
  npm: row.npm,
  name: row.name,
  email: row.email,
  submissionId: row.submission_id,
  yudisiumStatus: row.yudisium_status,
  fakultasStatus: row.fakultas_status,
  univStatus: row.univ_status,
  pickedUp: Boolean(row.handed_at),
  handedAt: row.handed_at,
  undanganGiven: Boolean(row.undangan_given),
  togaGiven: Boolean(row.toga_given),
  checkStatus: row.check_status,
  checkNote: row.check_note,
});

export async function searchDeskStudents(eventId: string, q: string): Promise<DeskStudent[]> {
  await ensureGraduationSchema();
  const term = `%${q.trim()}%`;
  const rows = await query<DeskRow>(
    `select * from (
       ${DESK_SELECT} where m.npm ilike $2 or m.name ilike $2
       union all
       select null::uuid, e.program, e.npm, e.name, null, null, null, null, null, null, null, null, null, null
       from mahasiswa_eligible e
       where e.event_id = $1 and (e.npm ilike $2 or e.name ilike $2)
         and not exists (select 1 from mahasiswa m2 where m2.npm = e.npm)
     ) t order by name asc limit 20`,
    [eventId, term]
  );
  return rows.map(mapDesk);
}

/** Everyone who has a submission (registered) or a pickup for this event. */
export async function listDeskRekap(eventId: string): Promise<DeskStudent[]> {
  await ensureGraduationSchema();
  const rows = await query<DeskRow>(
    `${DESK_SELECT} where gs.id is not null order by gp.handed_at desc nulls last, m.name asc`,
    [eventId]
  );
  return rows.map(mapDesk);
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

// ─── Lampiran undangan (PDF) ────────────────────────────────────────────────

export type DocKind = "yudisium" | "wisuda";
export type EventDocumentMeta = { kind: DocKind; filename: string; size: number; updatedAt: string };

export async function listEventDocuments(eventId: string): Promise<EventDocumentMeta[]> {
  await ensureGraduationSchema();
  const rows = await query<{ kind: DocKind; filename: string; size: number; updated_at: string }>(
    "select kind, filename, size, updated_at from event_documents where event_id=$1",
    [eventId]
  );
  return rows.map((r) => ({ kind: r.kind, filename: r.filename, size: r.size, updatedAt: r.updated_at }));
}

export async function saveEventDocument(
  eventId: string,
  kind: DocKind,
  filename: string,
  data: Buffer
): Promise<void> {
  await ensureGraduationSchema();
  await query(
    `insert into event_documents (event_id, kind, filename, size, data)
     values ($1, $2, $3, $4, $5)
     on conflict (event_id, kind) do update
       set filename=excluded.filename, size=excluded.size, data=excluded.data, updated_at=now()`,
    [eventId, kind, filename, data.length, data]
  );
}

export async function deleteEventDocument(eventId: string, kind: DocKind): Promise<void> {
  await ensureGraduationSchema();
  await query("delete from event_documents where event_id=$1 and kind=$2", [eventId, kind]);
}

export async function getEventDocument(
  eventId: string,
  kind: DocKind
): Promise<{ filename: string; data: Buffer } | null> {
  await ensureGraduationSchema();
  const rows = await query<{ filename: string; data: Buffer }>(
    "select filename, data from event_documents where event_id=$1 and kind=$2 limit 1",
    [eventId, kind]
  );
  return rows[0] ?? null;
}

// ─── Foto semi formal (videotron) ───────────────────────────────────────────

export async function setVideotronPhoto(mahasiswaId: string, dataUri: string | null): Promise<void> {
  await ensureGraduationSchema();
  await query("update mahasiswa set videotron_photo=$2 where id=$1", [mahasiswaId, dataUri]);
}

export async function getVideotronPhotoById(mahasiswaId: string): Promise<string | null> {
  await ensureGraduationSchema();
  const rows = await query<{ videotron_photo: string | null }>(
    "select videotron_photo from mahasiswa where id=$1",
    [mahasiswaId]
  );
  return rows[0]?.videotron_photo ?? null;
}

export async function getVideotronPhotoByNpm(npm: string): Promise<string | null> {
  await ensureGraduationSchema();
  const rows = await query<{ videotron_photo: string | null }>(
    "select videotron_photo from mahasiswa where npm=$1",
    [normalizeNpm(npm)]
  );
  return rows[0]?.videotron_photo ?? null;
}

export type VideotronRow = { npm: string; name: string; program: string | null; hasPhoto: boolean };

/** Everyone known for the event (imported or registered) with whether a photo was uploaded. */
export async function listVideotron(eventId: string): Promise<VideotronRow[]> {
  await ensureGraduationSchema();
  const rows = await query<{ npm: string; name: string; program: string | null; has_photo: boolean }>(
    `select x.npm, x.name, x.program, (m.videotron_photo is not null) as has_photo
       from (
         select npm, name, program from mahasiswa_eligible where event_id=$1
         union
         select m2.npm, m2.name, null::text as program
           from graduation_submissions gs join mahasiswa m2 on m2.id=gs.mahasiswa_id
          where gs.event_id=$1
            and not exists (select 1 from mahasiswa_eligible e where e.event_id=$1 and e.npm=m2.npm)
       ) x
       left join mahasiswa m on m.npm = x.npm
      order by coalesce(x.program,'~'), x.name`,
    [eventId]
  );
  return rows.map((r) => ({ npm: r.npm, name: r.name, program: r.program, hasPhoto: r.has_photo }));
}

// ─── Pendaftar per acara ────────────────────────────────────────────────────

export type RegistrantRow = {
  mahasiswaId: string;
  npm: string;
  name: string;
  program: string | null;
  yudisiumStatus: string | null;
  fakultasStatus: string | null;
  univStatus: string | null;
  hasAttendee: boolean;
};

export async function listRegistrants(eventId: string): Promise<RegistrantRow[]> {
  await ensureGraduationSchema();
  const rows = await query<{
    mahasiswa_id: string; npm: string; name: string; program: string | null;
    yudisium_status: string | null; fakultas: string | null; univ: string | null; has_attendee: boolean;
  }>(
    `select gs.mahasiswa_id, m.npm, m.name, el.program, gs.yudisium_status,
            (select status from graduation_payments where submission_id=gs.id and kind='fakultas') as fakultas,
            (select status from graduation_payments where submission_id=gs.id and kind='univ') as univ,
            (gs.attendee_id is not null) as has_attendee
       from graduation_submissions gs
       join mahasiswa m on m.id=gs.mahasiswa_id
       left join mahasiswa_eligible el on el.event_id=gs.event_id and el.npm=m.npm
      where gs.event_id=$1
      order by gs.created_at desc`,
    [eventId]
  );
  return rows.map((r) => ({
    mahasiswaId: r.mahasiswa_id, npm: r.npm, name: r.name, program: r.program,
    yudisiumStatus: r.yudisium_status, fakultasStatus: r.fakultas, univStatus: r.univ,
    hasAttendee: r.has_attendee,
  }));
}

/** Daftar mahasiswa yang belum punya pengajuan di acara ini (pendaftar lama / acara lain). */
export async function listMahasiswaWithoutSubmission(eventId: string): Promise<string[]> {
  await ensureGraduationSchema();
  const rows = await query<{ id: string }>(
    `select m.id from mahasiswa m
      where not exists (select 1 from graduation_submissions gs where gs.event_id=$1 and gs.mahasiswa_id=m.id)`,
    [eventId]
  );
  return rows.map((r) => r.id);
}
