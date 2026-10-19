"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap, Loader2 } from "lucide-react";

export default function MahasiswaLoginPage() {
  const router = useRouter();
  const [npm, setNpm] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/mahasiswa/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ npm, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? "Gagal masuk");
      return;
    }
    router.replace("/mahasiswa/dashboard");
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-white border border-slate-100 p-6 shadow-sm">
        <div className="text-center mb-6">
          <GraduationCap className="mx-auto text-[#1B4332] mb-2" size={36} />
          <h1 className="text-lg font-bold text-[#1A1A2E]">Login Mahasiswa</h1>
          <p className="text-sm text-slate-500 mt-1">Yudisium &amp; Wisuda Pelepasan FT UNISMA</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">NPM</span>
            <input
              type="text"
              required
              value={npm}
              onChange={(e) => setNpm(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-[#1A1A2E] focus:border-[#1B4332] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-[#1A1A2E] focus:border-[#1B4332] focus:outline-none"
            />
          </label>
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
            Masuk
          </button>
        </form>
        <p className="text-center text-xs text-slate-400 mt-4">
          Belum punya akun?{" "}
          <Link href="/mahasiswa/daftar" className="text-[#40916C] font-semibold">
            Daftar di sini
          </Link>
        </p>
      </div>
    </div>
  );
}
