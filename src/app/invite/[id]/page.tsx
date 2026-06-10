import { notFound } from "next/navigation";
import { getEvent, resolveEvent } from "@/lib/event";
import { getAttendee, normalizeAttendeeId } from "@/lib/storage";
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
    <div className="min-h-screen bg-[#F8FAF9]">
      {/* Header */}
      <div className="bg-[#1B4332] px-6 py-8 text-white">
        <div className="mx-auto max-w-sm">
          <p className="text-xs font-bold uppercase tracking-[3px] text-[#74C69D]">
            Fakultas Teknik
          </p>
          <h1 className="mt-1 text-xl font-bold leading-tight">
            Universitas Islam Malang
          </h1>
          <p className="mt-1 text-xs text-white/50">Undangan Digital Resmi</p>
        </div>
      </div>

      <div className="mx-auto max-w-sm px-5 py-6 space-y-4">
        {/* Personal greeting */}
        <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm">
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
        </div>

        {/* Event details */}
        <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm">
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
              className="flex-1 text-center text-xs font-semibold py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:border-slate-300 transition-colors"
            >
              🗺️ Lihat Lokasi
            </a>
            <a
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-xs font-semibold py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:border-slate-300 transition-colors"
            >
              📆 Simpan ke Kalender
            </a>
          </div>
        </div>

        {/* QR Code */}
        <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm text-center">
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
        </div>

        {/* Instructions */}
        <div className="rounded-2xl bg-[#1B4332] p-5 text-white">
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
