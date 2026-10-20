import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Inbox,
  Plus,
  Users,
} from "lucide-react";
import { getDashboardStats, readEvents } from "@/lib/event";
import { getAdminDashboardData } from "@/lib/dashboard-stats";
import { DayBars, Donut, ProgressRow } from "@/components/charts";

export const metadata = {
  title: "Dashboard — Sistem Undangan FT UNISMA",
};

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Aktif",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

const statusColor: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  COMPLETED: "bg-blue-50 text-blue-700",
  CANCELLED: "bg-rose-50 text-rose-600",
};

export default async function DashboardPage() {
  const [events, stats, data] = await Promise.all([
    readEvents(),
    getDashboardStats(),
    getAdminDashboardData(),
  ]);

  const activeEvents = events.filter((e) => e.status === "ACTIVE");
  const paymentTotal =
    data.paymentsByStatus.approved +
    data.paymentsByStatus.desk +
    data.paymentsByStatus.pending +
    data.paymentsByStatus.rejected;
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 19 ? "Selamat sore" : "Selamat malam";

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">{greeting},</p>
          <h1 className="text-3xl font-bold tracking-tight text-[#1A1A2E]">Ringkasan Hari Ini</h1>
          <p className="text-sm text-slate-500 mt-1">Pantau pendaftaran, verifikasi, dan pengambilan undangan &amp; toga.</p>
        </div>
        <div className="flex gap-2">
          {activeEvents[0] && (
            <Link
              href={`/events/${activeEvents[0].id}/pengambilan`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:border-slate-300 transition-colors"
            >
              <Camera size={15} /> Meja Pengambilan
            </Link>
          )}
          <Link
            href="/events/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#40916C] transition-colors"
          >
            <Plus size={15} /> Acara Baru
          </Link>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={<GraduationCap size={18} />} label="Mahasiswa Terdaftar" value={data.mahasiswaTotal} hint={`${data.yudisium.hadir} hadir yudisium`} />
        <Kpi icon={<Camera size={18} />} label="Sudah Ambil" value={data.pickedUp} hint={data.mahasiswaTotal ? `${Math.round((data.pickedUp / data.mahasiswaTotal) * 100)}% dari terdaftar` : "belum ada data"} />
        <Kpi icon={<Inbox size={18} />} label="Bukti Menunggu Review" value={data.paymentsPending} hint="perlu keputusan WD2/admin" href="/wd2/review" tone={data.paymentsPending ? "warn" : undefined} />
        <Kpi icon={<ClipboardCheck size={18} />} label="Verifikasi Susulan" value={data.pickupsPendingCheck} hint={data.pickupsIssues ? `${data.pickupsIssues} bermasalah` : "serah-terima menunggu WD2"} href="/wd2/review" tone={data.pickupsIssues ? "bad" : data.pickupsPendingCheck ? "warn" : undefined} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={<CalendarDays size={18} />} label="Acara Aktif" value={stats.activeEvents} hint={`${stats.totalEvents} total acara`} />
        <Kpi icon={<Users size={18} />} label="Total Peserta" value={stats.totalAttendees} hint="seluruh acara" />
        <Kpi icon={<CheckCircle2 size={18} />} label="Konfirmasi Hadir" value={stats.totalConfirmed} hint={stats.totalAttendees ? `${Math.round((stats.totalConfirmed / stats.totalAttendees) * 100)}% dari peserta` : "belum ada data"} />
        <Kpi icon={<GraduationCap size={18} />} label="Tidak Hadir Yudisium" value={data.yudisium.tidakHadir} hint={`${data.yudisium.belum} belum memilih`} />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-5 gap-4">
        <Panel title="Aktivitas 14 Hari" subtitle="Pendaftaran mahasiswa vs pengambilan di meja" className="lg:col-span-3">
          <DayBars days={data.days} />
        </Panel>
        <Panel title="Status Peserta" subtitle="Seluruh acara" className="lg:col-span-2">
          <Donut
            centerLabel="peserta"
            slices={[
              { label: "Hadir", value: data.attendeeStatus.confirmed, color: "#40916C" },
              { label: "Undangan terkirim", value: data.attendeeStatus.sent, color: "#F5B83D" },
              { label: "Belum dikirim", value: data.attendeeStatus.draft, color: "#CBD5E1" },
              { label: "Tidak hadir", value: data.attendeeStatus.absent, color: "#F43F5E" },
            ]}
          />
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Verifikasi Bukti Bayar" subtitle={`${paymentTotal} bukti masuk`}>
          <div className="space-y-4">
            <ProgressRow label="Disetujui" value={data.paymentsByStatus.approved} total={paymentTotal} color="#40916C" />
            <ProgressRow label="Diverifikasi admin (menunggu WD2)" value={data.paymentsByStatus.desk} total={paymentTotal} color="#38BDF8" />
            <ProgressRow label="Menunggu review" value={data.paymentsByStatus.pending} total={paymentTotal} color="#F5B83D" />
            <ProgressRow label="Ditolak" value={data.paymentsByStatus.rejected} total={paymentTotal} color="#F43F5E" />
          </div>
        </Panel>
        <Panel title="Progres Pengambilan" subtitle="Undangan & toga yang sudah diserahkan">
          <div className="space-y-4">
            <ProgressRow label="Sudah diambil" value={data.pickedUp} total={Math.max(data.mahasiswaTotal, data.pickedUp)} color="#1B4332" />
            <ProgressRow label="Sudah divalidasi WD2" value={Math.max(data.pickedUp - data.pickupsPendingCheck - data.pickupsIssues, 0)} total={Math.max(data.pickedUp, 1)} color="#40916C" />
            <ProgressRow label="Bermasalah" value={data.pickupsIssues} total={Math.max(data.pickedUp, 1)} color="#F43F5E" />
          </div>
        </Panel>
      </div>

      {/* Events */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#1A1A2E]">Acara</h2>
          <Link href="/events" className="text-sm text-[#40916C] hover:underline font-medium">
            Lihat semua →
          </Link>
        </div>
        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <CalendarDays size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">Belum ada acara.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {events.slice(0, 6).map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="group block rounded-2xl bg-white border border-slate-100 p-5 hover:border-[#40916C] hover:shadow-[0_8px_30px_rgba(27,67,50,0.08)] transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-[#1A1A2E] text-sm leading-snug line-clamp-2">{event.name}</h3>
                  <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor[event.status]}`}>
                    {statusLabel[event.status]}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-xs text-slate-500">
                  <p>{event.schedule}</p>
                  <p className="truncate">{event.venue}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  href,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  href?: string;
  tone?: "warn" | "bad";
}) {
  const accent = tone === "bad" ? "text-rose-500 bg-rose-50" : tone === "warn" ? "text-amber-600 bg-amber-50" : "text-[#40916C] bg-[#40916C]/10";
  const body = (
    <div className="rounded-2xl bg-white border border-slate-100 p-5 h-full transition-all hover:shadow-[0_8px_30px_rgba(27,67,50,0.07)]">
      <div className="flex items-center justify-between">
        <span className={`inline-flex p-2 rounded-xl ${accent}`}>{icon}</span>
        {href && <ArrowUpRight size={16} className="text-slate-300" />}
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-[#1A1A2E]">{value}</p>
      <p className="text-sm text-slate-600 font-medium mt-0.5">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5">{hint}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Panel({
  title,
  subtitle,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl bg-white border border-slate-100 p-6 ${className}`}>
      <h3 className="text-sm font-semibold text-[#1A1A2E]">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400 mb-5 mt-0.5">{subtitle}</p>}
      {children}
    </div>
  );
}
