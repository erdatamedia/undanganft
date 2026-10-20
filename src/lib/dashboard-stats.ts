import { query } from "@/lib/db";
import { ensureGraduationSchema } from "@/lib/graduation";

export type DayPoint = { day: string; label: string; registered: number; pickedUp: number };

export type AdminDashboardData = {
  attendeeStatus: { draft: number; sent: number; confirmed: number; absent: number };
  mahasiswaTotal: number;
  pickedUp: number;
  paymentsPending: number;
  pickupsPendingCheck: number;
  pickupsIssues: number;
  paymentsByStatus: { approved: number; desk: number; pending: number; rejected: number };
  yudisium: { hadir: number; tidakHadir: number; belum: number };
  days: DayPoint[];
};

const n = (v: string | undefined) => parseInt(v ?? "0", 10) || 0;

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  await ensureGraduationSchema();

  const [attendees, totals, payments, yudisium, regs, picks] = await Promise.all([
    query<{ status: string; c: string }>("select status, count(*) as c from attendees group by status"),
    query<{ mahasiswa: string; picked: string; pending_check: string; issues: string }>(
      `select
        (select count(*) from mahasiswa) as mahasiswa,
        (select count(*) from graduation_pickups) as picked,
        (select count(*) from graduation_pickups where wd2_check_status='pending') as pending_check,
        (select count(*) from graduation_pickups where wd2_check_status='issue') as issues`
    ),
    query<{ status: string; c: string }>("select status, count(*) as c from graduation_payments group by status"),
    query<{ status: string; c: string }>("select yudisium_status as status, count(*) as c from graduation_submissions group by yudisium_status"),
    query<{ d: string; c: string }>(
      `select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as d, count(*) as c
       from mahasiswa where created_at >= now() - interval '13 days' group by 1`
    ),
    query<{ d: string; c: string }>(
      `select to_char(date_trunc('day', handed_at), 'YYYY-MM-DD') as d, count(*) as c
       from graduation_pickups where handed_at >= now() - interval '13 days' group by 1`
    ),
  ]);

  const attendeeStatus = { draft: 0, sent: 0, confirmed: 0, absent: 0 };
  for (const row of attendees) {
    if (row.status in attendeeStatus) attendeeStatus[row.status as keyof typeof attendeeStatus] = n(row.c);
  }

  const paymentsByStatus = { approved: 0, desk: 0, pending: 0, rejected: 0 };
  for (const row of payments) {
    if (row.status in paymentsByStatus) paymentsByStatus[row.status as keyof typeof paymentsByStatus] = n(row.c);
  }

  const yud = { hadir: 0, tidakHadir: 0, belum: 0 };
  for (const row of yudisium) {
    if (row.status === "hadir") yud.hadir = n(row.c);
    else if (row.status === "tidak_hadir") yud.tidakHadir = n(row.c);
    else yud.belum += n(row.c);
  }

  const regMap = new Map(regs.map((r) => [r.d, n(r.c)]));
  const pickMap = new Map(picks.map((r) => [r.d, n(r.c)]));
  const days: DayPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    days.push({
      day: key,
      label: date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
      registered: regMap.get(key) ?? 0,
      pickedUp: pickMap.get(key) ?? 0,
    });
  }

  const t = totals[0];
  return {
    attendeeStatus,
    mahasiswaTotal: n(t?.mahasiswa),
    pickedUp: n(t?.picked),
    paymentsPending: paymentsByStatus.pending,
    pickupsPendingCheck: n(t?.pending_check),
    pickupsIssues: n(t?.issues),
    paymentsByStatus,
    yudisium: yud,
    days,
  };
}
