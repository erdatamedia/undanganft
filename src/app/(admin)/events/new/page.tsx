"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, ArrowLeft, Loader2 } from "lucide-react";

export default function NewEventPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    date: "",
    time: "",
    timeEnd: "",
    venue: "",
    gate: "",
    status: "ACTIVE",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          date: form.date.trim(),
          time: form.time.trim(),
          timeEnd: form.timeEnd.trim() || undefined,
          venue: form.venue.trim(),
          gate: form.gate.trim(),
          status: form.status,
        }),
      });

      if (res.status === 401) {
        window.location.href = "/auth/login";
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal membuat acara.");

      router.push(`/events/${data.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          href="/events"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#1B4332] transition-colors mb-4"
        >
          <ArrowLeft size={15} />
          Kembali ke daftar acara
        </Link>
        <div className="flex items-center gap-2 text-[#40916C]">
          <CalendarDays size={16} />
          <span className="text-sm font-semibold uppercase tracking-widest">Acara Baru</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-[#1A1A2E]">Buat Acara</h1>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
        <Field label="Nama Acara *">
          <input
            required
            placeholder="cth. Seminar Nasional Teknik 2026"
            value={form.name}
            onChange={set("name")}
            className={inputCls}
          />
        </Field>

        <Field label="Deskripsi">
          <textarea
            rows={3}
            placeholder="Deskripsi singkat acara (opsional)"
            value={form.description}
            onChange={set("description")}
            className={inputCls + " resize-none"}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Tanggal *">
            <input
              required
              placeholder="cth. Sabtu, 15 Agustus 2026"
              value={form.date}
              onChange={set("date")}
              className={inputCls}
            />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={set("status")} className={inputCls}>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Aktif</option>
              <option value="COMPLETED">Selesai</option>
              <option value="CANCELLED">Dibatalkan</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Waktu Mulai *">
            <input
              required
              placeholder="cth. 08.00 WIB"
              value={form.time}
              onChange={set("time")}
              className={inputCls}
            />
          </Field>
          <Field label="Waktu Selesai">
            <input
              placeholder="cth. 12.00 WIB"
              value={form.timeEnd}
              onChange={set("timeEnd")}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Lokasi / Venue *">
          <input
            required
            placeholder="cth. Aula Rektorat Lantai 3 UNISMA"
            value={form.venue}
            onChange={set("venue")}
            className={inputCls}
          />
        </Field>

        <Field label="Info Registrasi">
          <input
            placeholder="cth. Registrasi dibuka 30 menit sebelum acara"
            value={form.gate}
            onChange={set("gate")}
            className={inputCls}
          />
        </Field>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#40916C] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            Simpan Acara
          </button>
          <Link
            href="/events"
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-300 transition-colors"
          >
            Batal
          </Link>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-[#1A1A2E] placeholder:text-slate-400 focus:border-[#1B4332] focus:outline-none focus:ring-2 focus:ring-[#1B4332]/10";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}
