"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, Loader2, Copy, CheckCircle2 } from "lucide-react";

type EventInfo = {
  name: string;
  schedule: string;
  venue: string;
  yudisiumSchedule: string | null;
  yudisiumVenue: string | null;
  yudisiumDresscode: string | null;
  wisudaDresscode: string | null;
};

type RundownInfo = {
  order: number;
  timeStart: string | null;
  timeEnd: string | null;
  durationMinutes: number | null;
  title: string;
};

export default function DaftarMahasiswaPage() {
  const [form, setForm] = useState({ name: "", npm: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [rundown, setRundown] = useState<RundownInfo[]>([]);

  useEffect(() => {
    fetch("/api/mahasiswa/active-event-info")
      .then((res) => res.json())
      .then((data) => {
        setEventInfo(data.event);
        setRundown(data.rundown ?? []);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mahasiswa/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Pendaftaran gagal");
      setPassword(data.password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (password) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm rounded-3xl bg-white border border-slate-100 p-6 shadow-sm text-center">
          <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={40} />
          <h1 className="text-lg font-bold text-[#1A1A2E]">Pendaftaran Berhasil</h1>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Simpan password berikut baik-baik. Password ini <strong>hanya ditampilkan sekali</strong>.
          </p>
          <div className="flex items-center gap-2 bg-[#F8FAF9] border border-dashed border-slate-300 rounded-xl px-4 py-3">
            <span className="flex-1 font-mono text-lg font-bold text-[#1B4332] tracking-wider">
              {password}
            </span>
            <button
              onClick={handleCopy}
              className="shrink-0 p-2 rounded-lg hover:bg-white text-slate-500"
              title="Salin"
            >
              {copied ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Copy size={18} />}
            </button>
          </div>
          <p className="text-xs text-amber-600 mt-3">
            Lupa password nanti? Hubungi panitia untuk direset — pendaftaran ulang dengan NPM yang sama tidak diperbolehkan.
          </p>
          <Link
            href="/mahasiswa/login"
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#1B4332] text-white text-sm font-semibold py-3 hover:bg-[#40916C] transition-colors"
          >
            Masuk Sekarang
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] px-5 py-10">
      <div className="w-full max-w-sm mx-auto space-y-4">
        {eventInfo && (
          <div className="rounded-3xl bg-white border border-slate-100 p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[2px] text-[#40916C] mb-1">Acara</p>
            <h2 className="text-base font-bold text-[#1A1A2E] mb-3">{eventInfo.name}</h2>

            {(eventInfo.yudisiumSchedule || eventInfo.yudisiumVenue || eventInfo.yudisiumDresscode) && (
              <div className="mb-3 pb-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-[#1B4332] mb-1">Yudisium</p>
                {eventInfo.yudisiumSchedule && <p className="text-sm text-slate-600">🗓️ {eventInfo.yudisiumSchedule}</p>}
                {eventInfo.yudisiumVenue && <p className="text-sm text-slate-600">📍 {eventInfo.yudisiumVenue}</p>}
                {eventInfo.yudisiumDresscode && <p className="text-xs text-slate-400">👔 {eventInfo.yudisiumDresscode}</p>}
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-[#1B4332] mb-1">Wisuda Pelepasan</p>
              <p className="text-sm text-slate-600">🗓️ {eventInfo.schedule}</p>
              <p className="text-sm text-slate-600">📍 {eventInfo.venue}</p>
              {eventInfo.wisudaDresscode && <p className="text-xs text-slate-400">👔 {eventInfo.wisudaDresscode}</p>}
            </div>

            {rundown.length > 0 && (
              <details className="mt-3 pt-3 border-t border-slate-100">
                <summary className="text-xs font-semibold text-[#40916C] cursor-pointer">Lihat Susunan Acara</summary>
                <div className="mt-2 space-y-1.5">
                  {rundown.map((item) => (
                    <div key={item.order} className="flex gap-2 text-xs">
                      <span className="shrink-0 font-semibold text-[#1B4332] w-12">{item.timeStart ?? "-"}</span>
                      <span className="text-slate-600">{item.title}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

      <div className="w-full rounded-3xl bg-white border border-slate-100 p-6 shadow-sm">
        <div className="text-center mb-6">
          <GraduationCap className="mx-auto text-[#1B4332] mb-2" size={36} />
          <h1 className="text-lg font-bold text-[#1A1A2E]">Pendaftaran Mahasiswa</h1>
          <p className="text-sm text-slate-500 mt-1">
            Konfirmasi kehadiran yudisium &amp; wisuda pelepasan Fakultas Teknik
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field
            label="Nama Lengkap"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder="Sesuai data akademik"
          />
          <Field
            label="NPM"
            value={form.npm}
            onChange={(v) => setForm((f) => ({ ...f, npm: v }))}
            placeholder="Nomor Pokok Mahasiswa"
          />
          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            placeholder="email@contoh.com"
          />
          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1B4332] text-white text-sm font-semibold py-3 hover:bg-[#40916C] disabled:opacity-60 transition-colors"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Daftar
          </button>
        </form>
        <p className="text-center text-xs text-slate-400 mt-4">
          Sudah punya akun?{" "}
          <Link href="/mahasiswa/login" className="text-[#40916C] font-semibold">
            Masuk di sini
          </Link>
        </p>
      </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-[#1A1A2E] placeholder:text-slate-400 focus:border-[#1B4332] focus:outline-none"
      />
    </label>
  );
}
