"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, Loader2, Copy, CheckCircle2 } from "lucide-react";

export default function DaftarMahasiswaPage() {
  const [form, setForm] = useState({ name: "", npm: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-white border border-slate-100 p-6 shadow-sm">
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
