"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, GraduationCap, Loader2 } from "lucide-react";
import { Eyebrow, GlassCard } from "@/components/glass";

type EventInfo = {
  name: string;
  schedule: string;
  venue: string;
  yudisiumSchedule: string | null;
  yudisiumVenue: string | null;
  yudisiumDresscode: string | null;
  wisudaDresscode: string | null;
  univSchedule: string | null;
  univVenue: string | null;
};

type RundownInfo = {
  order: number;
  timeStart: string | null;
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
      <div className="glass-bg flex items-center justify-center px-5">
        <div className="glass-card-strong glass-enter w-full max-w-sm p-7 text-center">
          <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={44} />
          <h1 className="text-2xl font-extrabold text-[#11291f]">Pendaftaran Berhasil</h1>
          <p className="text-sm text-slate-600 mt-2 mb-5">
            Simpan password ini baik-baik. Password <strong>hanya ditampilkan sekali</strong>.
          </p>
          <div className="glass-inset flex items-center gap-2 px-4 py-3">
            <span className="flex-1 font-mono text-xl font-bold text-[#1B4332] tracking-wider">{password}</span>
            <button onClick={handleCopy} className="p-2 rounded-xl text-slate-500" aria-label="Salin password">
              {copied ? <CheckCircle2 size={20} className="text-emerald-500" /> : <Copy size={20} />}
            </button>
          </div>
          <p className="text-xs text-amber-700 mt-3">
            Lupa password? Hubungi panitia untuk direset — pendaftaran ulang dengan NPM yang sama tidak diperbolehkan.
          </p>
          <Link href="/mahasiswa/login" className="glass-btn glass-btn-primary mt-5 w-full flex items-center justify-center">
            Masuk Sekarang
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-bg">
      <div className="w-full max-w-md mx-auto px-5 pt-8 space-y-4">
        <div>
          <div className="glass-card !rounded-2xl inline-flex p-3 mb-4">
            <GraduationCap className="text-[#1B4332]" size={26} />
          </div>
          <h1 className="glass-title">Pendaftaran Mahasiswa</h1>
          <p className="text-sm text-slate-600 mt-2">Konfirmasi yudisium &amp; wisuda Fakultas Teknik</p>
        </div>

        {eventInfo && (
          <GlassCard strong>
            <Eyebrow>Acara</Eyebrow>
            <h2 className="text-base font-bold text-[#11291f] mb-4 leading-snug">{eventInfo.name}</h2>

            {(eventInfo.yudisiumSchedule || eventInfo.yudisiumVenue || eventInfo.yudisiumDresscode) && (
              <div className="glass-inset p-3 mb-3 space-y-1">
                <p className="text-xs font-bold text-[#1B4332]">Yudisium</p>
                {eventInfo.yudisiumSchedule && <p className="text-sm text-slate-700">🗓️ {eventInfo.yudisiumSchedule}</p>}
                {eventInfo.yudisiumVenue && <p className="text-sm text-slate-700">📍 {eventInfo.yudisiumVenue}</p>}
                {eventInfo.yudisiumDresscode && <p className="text-xs text-slate-500">👔 {eventInfo.yudisiumDresscode}</p>}
              </div>
            )}

            <div className="glass-inset p-3 mb-3 space-y-1">
              <p className="text-xs font-bold text-[#1B4332]">Wisuda Pelepasan Fakultas</p>
              <p className="text-sm text-slate-700">🗓️ {eventInfo.schedule}</p>
              <p className="text-sm text-slate-700">📍 {eventInfo.venue}</p>
              {eventInfo.wisudaDresscode && <p className="text-xs text-slate-500">👔 {eventInfo.wisudaDresscode}</p>}
            </div>

            {(eventInfo.univSchedule || eventInfo.univVenue) && (
              <div className="glass-inset p-3 space-y-1">
                <p className="text-xs font-bold text-[#1B4332]">Wisuda Universitas</p>
                {eventInfo.univSchedule && <p className="text-sm text-slate-700">🗓️ {eventInfo.univSchedule}</p>}
                {eventInfo.univVenue && <p className="text-sm text-slate-700">📍 {eventInfo.univVenue}</p>}
              </div>
            )}

            {rundown.length > 0 && (
              <details className="mt-4">
                <summary className="text-sm font-semibold text-[#1B4332] cursor-pointer">Lihat Susunan Acara</summary>
                <div className="mt-3 space-y-2">
                  {rundown.map((item) => (
                    <div key={item.order} className="flex gap-3 text-sm">
                      <span className="shrink-0 w-14 font-bold text-[#1B4332]">{item.timeStart ?? "-"}</span>
                      <span className="text-slate-700">{item.title}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </GlassCard>
        )}

        <GlassCard strong>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              required
              autoComplete="name"
              placeholder="Nama lengkap (sesuai data akademik)"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="glass-input"
            />
            <input
              required
              inputMode="numeric"
              placeholder="NPM"
              value={form.npm}
              onChange={(e) => setForm((f) => ({ ...f, npm: e.target.value }))}
              className="glass-input"
            />
            <input
              required
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="glass-input"
            />
            {error && <p className="glass-inset px-4 py-3 text-sm text-rose-700">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="glass-btn glass-btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Daftar
            </button>
          </form>
          <p className="text-center text-sm text-slate-600 mt-4">
            Sudah punya akun?{" "}
            <Link href="/mahasiswa/login" className="font-semibold text-[#1B4332]">
              Masuk
            </Link>
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
