import { notFound } from "next/navigation";
import { getEvent, resolveEvent } from "@/lib/event";
import { getAttendee, normalizeAttendeeId } from "@/lib/storage";
import { listRundownItems } from "@/lib/rundown";
import { GlassCard } from "@/components/glass";
import { InviteQr } from "@/components/invite-qr";

export const dynamic = "force-dynamic";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://undangan.ftunisma.online";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(props: Props) {
  const { id } = await props.params;
  const attendee = await getAttendee(normalizeAttendeeId(id));
  const event = attendee
    ? (await getEvent(attendee.eventId)) ?? (await resolveEvent())
    : await resolveEvent();
  return {
    title: attendee
      ? `Undangan ${attendee.name} — ${event.name}`
      : `Undangan Tidak Ditemukan — ${event.name}`,
    description: attendee
      ? `Konfirmasi kehadiran ${attendee.name} pada ${event.name}, ${event.schedule}`
      : undefined,
  };
}

export default async function InvitePage(props: Props) {
  const { id } = await props.params;
  const attendee = await getAttendee(normalizeAttendeeId(id));
  if (!attendee) notFound();

  const event = (await getEvent(attendee.eventId)) ?? (await resolveEvent());
  const rundownItems = await listRundownItems(event.id);

  const inviteUrl = `${APP_URL}/invite/${encodeURIComponent(attendee.token)}`;
  const qrPayload = inviteUrl;

  const timeRange = event.timeEnd
    ? `${event.time} – ${event.timeEnd}`
    : event.time;

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue)}`;

  const calendarUrl = (() => {
    const title = encodeURIComponent(event.name);
    const location = encodeURIComponent(event.venue);
    const details = encodeURIComponent(
      `Undangan untuk ${attendee.name}\n${inviteUrl}`
    );
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&location=${location}&details=${details}`;
  })();

  return (
    <div className="glass-bg">
      <div className="mx-auto max-w-sm px-5 pt-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#40916C]">
          Fakultas Teknik
        </p>
        <h1 className="glass-title mt-1">Universitas Islam Malang</h1>
        <p className="mt-1 text-xs text-slate-500">Undangan Digital Resmi</p>
      </div>

      <div className="mx-auto max-w-sm px-5 py-5 space-y-4">
        {/* Personal greeting */}
        <GlassCard strong>
          <p className="text-xs text-slate-400 mb-2">Kepada Yth,</p>
          <h2 className="text-xl font-bold text-[#1A1A2E] leading-tight">
            {attendee.name}
          </h2>
          <p className="text-sm text-[#40916C] font-medium mt-1">
            {attendee.program}
            {attendee.npm !== "-" && (
              <span className="text-slate-400 font-normal"> · {attendee.npm}</span>
            )}
          </p>
          {attendee.seat !== "-" && (
            <div className="mt-3 inline-flex items-center gap-1.5 bg-[#1B4332]/10 text-[#1B4332] text-xs font-semibold px-3 py-1.5 rounded-full">
              🪑 Nomor Kursi: {attendee.seat}
            </div>
          )}
        </GlassCard>

        {/* Event details */}
        <GlassCard>
          <p className="text-xs font-bold uppercase tracking-[2px] text-[#40916C] mb-3">
            Detail Acara
          </p>
          <h3 className="text-base font-bold text-[#1A1A2E] leading-snug mb-3">
            {event.name}
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2.5">
              <span className="shrink-0 mt-0.5">📅</span>
              <span className="text-slate-700">{event.date}</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="shrink-0 mt-0.5">🕐</span>
              <span className="text-slate-700">{timeRange}</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="shrink-0 mt-0.5">📍</span>
              <span className="text-slate-700">{event.venue}</span>
            </div>
            {event.gate && (
              <div className="flex items-start gap-2.5">
                <span className="shrink-0 mt-0.5">ℹ️</span>
                <span className="text-slate-500 text-xs">{event.gate}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-xs font-semibold py-2.5 px-3 glass-btn !text-xs !py-2.5 !px-3"
            >
              🗺️ Lihat Lokasi
            </a>
            <a
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-xs font-semibold py-2.5 px-3 glass-btn !text-xs !py-2.5 !px-3"
            >
              📆 Simpan ke Kalender
            </a>
          </div>
        </GlassCard>

        {/* Susunan Acara */}
        {rundownItems.length > 0 && (
          <details className="group glass-card glass-enter p-5">
            <summary className="flex items-center justify-between cursor-pointer list-none">
              <span className="text-xs font-bold uppercase tracking-[2px] text-[#40916C]">
                Susunan Acara
              </span>
              <span className="text-slate-400 text-xs group-open:rotate-180 transition-transform">
                ▾
              </span>
            </summary>
            <div className="mt-4 space-y-3">
              {rundownItems.map((item) => (
                <div key={item.id} className="flex gap-3 text-sm">
                  <div className="shrink-0 w-16 text-xs font-semibold text-[#1B4332] pt-0.5">
                    {item.timeStart ?? "-"}
                  </div>
                  <div className="flex-1 min-w-0 border-l border-slate-100 pl-3">
                    <p className="text-[#1A1A2E] font-medium leading-snug">{item.title}</p>
                    {item.durationMinutes != null && (
                      <p className="text-xs text-slate-400 mt-0.5">{item.durationMinutes} menit</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* QR Code */}
        <GlassCard className="text-center">
          <p className="text-xs font-bold uppercase tracking-[2px] text-[#40916C] mb-1">
            QR Konfirmasi Kehadiran
          </p>
          <p className="text-xs text-slate-400 mb-5">
            Tunjukkan QR ini kepada petugas di meja registrasi
          </p>
          <div className="flex justify-center">
            <InviteQr value={qrPayload} size={240} />
          </div>
          <p className="mt-4 text-xs text-slate-400 leading-relaxed">
            Pemindaian QR akan otomatis mencatat kehadiran Anda.
            <br />
            Pastikan layar cukup terang saat ditunjukkan.
          </p>
        </GlassCard>

        {/* Instructions */}
        <div className="rounded-3xl bg-[#1B4332]/90 backdrop-blur-xl p-5 text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-[2px] text-[#74C69D] mb-3">
            Alur Kehadiran
          </p>
          <ol className="space-y-2 text-sm text-white/80">
            <li className="flex gap-2.5">
              <span className="shrink-0 font-bold text-[#74C69D]">1.</span>
              Tiba di {event.venue} sebelum pukul {event.time}.
            </li>
            <li className="flex gap-2.5">
              <span className="shrink-0 font-bold text-[#74C69D]">2.</span>
              Tunjukkan QR di atas kepada petugas registrasi.
            </li>
            <li className="flex gap-2.5">
              <span className="shrink-0 font-bold text-[#74C69D]">3.</span>
              Setelah QR discan, ikuti arahan panitia menuju tempat duduk.
            </li>
          </ol>
          <p className="mt-4 text-xs text-white/40 leading-relaxed">
            Simpan halaman ini atau tautan berikut untuk ditunjukkan saat registrasi:
            <br />
            <span className="text-white/60 break-all">{inviteUrl}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
