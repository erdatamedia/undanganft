"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, Utensils } from "lucide-react";

/** Laporan untuk sie konsumsi: mahasiswa dengan dua pembayaran (fakultas & univ) terverifikasi. */
export function KonsumsiCard({ eventId }: { eventId: string }) {
  const [includeDesk, setIncludeDesk] = useState(false);
  const [counts, setCounts] = useState<{ count: number; countWithDesk: number; belumLengkap: number } | null>(null);
  const [busy, setBusy] = useState<"pdf" | "excel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/konsumsi?desk=${includeDesk ? 1 : 0}`, { credentials: "include" });
    if (res.ok) setCounts(await res.json());
  }, [eventId, includeDesk]);

  useEffect(() => {
    void load();
  }, [load]);

  const download = async (format: "pdf" | "excel") => {
    setBusy(format);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/konsumsi?format=${format}&desk=${includeDesk ? 1 : 0}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Gagal mengunduh laporan konsumsi.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `konsumsi-${new Date().toISOString().slice(0, 10)}.${format === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const total = counts?.count ?? 0;

  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-5">
      <h3 className="text-sm font-semibold text-[#1A1A2E] mb-1 flex items-center gap-2">
        <Utensils size={15} className="text-amber-600" /> Laporan Konsumsi
      </h3>
      <p className="text-xs text-slate-500 mb-4">
        Mahasiswa yang bukti bayar <b>fakultas dan univ</b>-nya sudah disetujui, lengkap dengan waktu persetujuan,
        prodi, dan status yudisium, sebagai acuan jumlah porsi. Peserta yang belum lengkap disorot di bagian akhir PDF dan sheet &quot;Belum Lengkap&quot; untuk ditindaklanjuti kaprodi.
      </p>
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div>
          <p className="text-2xl font-bold text-[#1A1A2E]">{counts ? total : "…"}</p>
          <p className="text-xs text-slate-500">porsi (peserta)</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-rose-600">{counts ? counts.belumLengkap : "…"}</p>
          <p className="text-xs text-slate-500">belum lengkap (tindak lanjut kaprodi)</p>
        </div>
        <label className="flex items-start gap-2 text-xs text-slate-600 max-w-xs">
          <input type="checkbox" className="mt-0.5" checked={includeDesk} onChange={(e) => setIncludeDesk(e.target.checked)} />
          <span>
            Sertakan yang diverifikasi admin di meja (menunggu validasi WD2)
            {counts && counts.countWithDesk !== counts.count && !includeDesk && (
              <span className="block text-amber-700">+{counts.countWithDesk - counts.count} orang bila disertakan</span>
            )}
          </span>
        </label>
      </div>
      {error && <p className="mb-3 text-xs text-rose-600">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => download("pdf")}
          disabled={busy !== null || !total}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#40916C] transition-colors disabled:opacity-50"
        >
          {busy === "pdf" ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
          PDF Konsumsi
        </button>
        <button
          type="button"
          onClick={() => download("excel")}
          disabled={busy !== null || !total}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-300 transition-colors disabled:opacity-50"
        >
          {busy === "excel" ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
          Excel Konsumsi
        </button>
      </div>
    </div>
  );
}
