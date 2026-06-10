import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { readEvents } from "@/lib/event";

export const metadata = {
  title: "Acara — Sistem Undangan FT UNISMA",
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

export default async function EventsPage() {
  const events = await readEvents();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#40916C]">
            <CalendarDays size={16} />
            <span className="text-sm font-semibold uppercase tracking-widest">Acara</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#1A1A2E]">Semua Acara</h1>
        </div>
        <Link
          href="/events/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#40916C] transition-colors"
        >
          <Plus size={16} />
          Buat Acara Baru
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
          <CalendarDays size={40} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Belum ada acara.</p>
          <p className="text-sm text-slate-400 mt-1">Mulai dengan membuat acara pertama.</p>
          <Link
            href="/events/new"
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#40916C] transition-colors"
          >
            <Plus size={15} />
            Buat Acara Baru
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {events.map((event) => (
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
              {event.description && (
                <p className="mt-2 text-xs text-slate-500 line-clamp-2">{event.description}</p>
              )}
              <div className="mt-3 space-y-1 text-xs text-slate-400 border-t border-slate-50 pt-3">
                <div className="flex items-center gap-1.5">
                  <CalendarDays size={12} />
                  <span>{event.schedule}</span>
                </div>
                <p className="truncate pl-4">{event.venue}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
