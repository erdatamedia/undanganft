import Link from "next/link";
import { CalendarDays, Users, CheckCircle2, LayoutDashboard, Plus } from "lucide-react";
import { readEvents } from "@/lib/event";
import { getDashboardStats } from "@/lib/event";

export const metadata = {
  title: "Dashboard — Sistem Undangan FT UNISMA",
};

const statusLabel: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Aktif",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

const statusColor: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-rose-100 text-rose-600",
};

export default async function DashboardPage() {
  const [events, stats] = await Promise.all([
    readEvents(),
    getDashboardStats(),
  ]);

  const activeEvents = events.filter((e) => e.status === "ACTIVE");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#40916C]">
            <LayoutDashboard size={16} />
            <span className="text-sm font-semibold uppercase tracking-widest">Dashboard</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#1A1A2E]">Selamat datang</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kelola undangan dan kehadiran peserta dari sini.</p>
        </div>
        <Link
          href="/events/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#40916C] transition-colors"
        >
          <Plus size={16} />
          Buat Acara Baru
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<CalendarDays size={20} className="text-[#40916C]" />}
          label="Total Acara"
          value={stats.totalEvents}
          sub={`${stats.activeEvents} aktif`}
        />
        <StatCard
          icon={<Users size={20} className="text-[#40916C]" />}
          label="Total Peserta"
          value={stats.totalAttendees}
          sub="seluruh acara"
        />
        <StatCard
          icon={<CheckCircle2 size={20} className="text-[#40916C]" />}
          label="Konfirmasi Hadir"
          value={stats.totalConfirmed}
          sub={
            stats.totalAttendees
              ? `${Math.round((stats.totalConfirmed / stats.totalAttendees) * 100)}% dari total`
              : "belum ada data"
          }
        />
        <StatCard
          icon={<CalendarDays size={20} className="text-slate-400" />}
          label="Acara Aktif"
          value={stats.activeEvents}
          sub="sedang berjalan"
        />
      </div>

      {/* Active events */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#1A1A2E]">Acara Aktif</h2>
          <Link href="/events" className="text-sm text-[#40916C] hover:underline font-medium">
            Lihat semua →
          </Link>
        </div>

        {activeEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <CalendarDays size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">Belum ada acara aktif.</p>
            <Link
              href="/events/new"
              className="mt-3 inline-block text-sm text-[#40916C] font-semibold hover:underline"
            >
              Buat acara pertama →
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeEvents.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="group block rounded-2xl bg-white border border-slate-100 p-5 hover:border-[#40916C] hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-[#1A1A2E] text-sm leading-snug group-hover:text-[#1B4332] line-clamp-2">
                    {event.name}
                  </h3>
                  <span
                    className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor[event.status]}`}
                  >
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

      {/* All events (if more) */}
      {events.length > activeEvents.length && (
        <div>
          <h2 className="text-base font-semibold text-[#1A1A2E] mb-4">Acara Lainnya</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {events
              .filter((e) => e.status !== "ACTIVE")
              .slice(0, 6)
              .map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="block rounded-2xl bg-white border border-slate-100 p-5 hover:border-slate-300 transition-colors opacity-80 hover:opacity-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-[#1A1A2E] text-sm leading-snug line-clamp-2">
                      {event.name}
                    </h3>
                    <span
                      className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor[event.status]}`}
                    >
                      {statusLabel[event.status]}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">{event.schedule}</p>
                </Link>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-5">
      <div className="flex items-center justify-between">
        {icon}
      </div>
      <p className="mt-3 text-3xl font-bold text-[#1A1A2E]">{value}</p>
      <p className="text-sm text-slate-600 font-medium mt-0.5">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}
