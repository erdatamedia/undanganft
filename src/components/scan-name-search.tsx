"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Search, UserCheck } from "lucide-react";

type Result = {
  id: string;
  name: string;
  npm: string;
  program: string;
  status: string;
  confirmedAt: string | null;
  pelepasanConfirmedAt: string | null;
};

/**
 * Cari peserta dengan mengetik nama lalu konfirmasi hadir langsung dari layar scanner.
 * Atribut data-name-search membuat handler keyboard/fokus scanner hardware tidak mengambil alih ketikan.
 */
export function ScanNameSearch({
  eventId,
  agenda,
  busy,
  onConfirm,
}: {
  eventId?: string;
  agenda: "yudisium" | "pelepasan";
  busy: boolean;
  onConfirm: (attendeeId: string) => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [dual, setDual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ q });
      if (eventId) params.set("eventId", eventId);
      const res = await fetch(`/api/attendees/search?${params}`, { credentials: "include" }).catch(() => null);
      if (!cancelled && res?.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
        setDual(Boolean(data.dualAgenda));
        setSearched(true);
      }
      if (!cancelled) setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, eventId]);

  const active = query.trim().length >= 2;
  const shown = active ? results : [];

  const hadirAt = (r: Result) => (dual && agenda === "pelepasan" ? r.pelepasanConfirmedAt : r.status === "confirmed" ? r.confirmedAt ?? "ok" : null);
  const fmt = (v: string) =>
    v === "ok" ? "" : new Date(v).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  return (
    <div data-name-search className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#40916C]">Cari Nama</p>
      <p className="mt-1 text-sm text-slate-500">
        QR belum siap? Ketik nama atau NPM, lalu konfirmasi kehadirannya di sini
        {dual ? ` (agenda: ${agenda === "pelepasan" ? "Pelepasan" : "Yudisium"})` : ""}.
      </p>
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ketik nama peserta…"
          autoComplete="off"
          className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-10 text-base text-[#1A1A2E] placeholder:text-slate-400 focus:border-[#1B4332] focus:outline-none"
        />
        {loading && <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>

      {shown.length > 0 && (
        <ul className="mt-3 space-y-2">
          {shown.map((r) => {
            const done = hadirAt(r);
            return (
              <li
                key={r.id}
                className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-slate-100 bg-[#F8FAF9] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="break-words text-base font-semibold leading-tight text-[#1A1A2E]">{r.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {r.npm} • {r.program}
                  </p>
                </div>
                {done ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Sudah hadir {fmt(done)}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      await onConfirm(r.id);
                      setQuery("");
                      setResults([]);
                    }}
                    className="inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl bg-[#1B4332] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#40916C] disabled:opacity-50"
                  >
                    <UserCheck className="h-4 w-4" /> Konfirmasi
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {active && searched && !loading && shown.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">Tidak ada peserta dengan nama itu.</p>
      )}
    </div>
  );
}
