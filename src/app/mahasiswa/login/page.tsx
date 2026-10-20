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
    <div className="glass-bg flex items-center justify-center px-5">
      <div className="glass-card-strong glass-enter w-full max-w-sm p-7">
        <div className="mb-6">
          <div className="glass-card !rounded-2xl inline-flex p-3 mb-4">
            <GraduationCap className="text-[#1B4332]" size={26} />
          </div>
          <h1 className="glass-title">Masuk</h1>
          <p className="text-sm text-slate-600 mt-2">Yudisium &amp; Wisuda Pelepasan FT UNISMA</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="username"
            required
            placeholder="NPM"
            value={npm}
            onChange={(e) => setNpm(e.target.value)}
            className="glass-input"
          />
          <input
            type="password"
            autoComplete="current-password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="glass-input"
          />
          {error && <p className="glass-inset px-4 py-3 text-sm text-rose-700">{error}</p>}
          <button type="submit" disabled={loading} className="glass-btn glass-btn-primary w-full flex items-center justify-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            Masuk
          </button>
        </form>
        <p className="text-center text-sm text-slate-600 mt-5">
          Belum punya akun?{" "}
          <Link href="/mahasiswa/daftar" className="font-semibold text-[#1B4332]">
            Daftar
          </Link>
        </p>
      </div>
    </div>
  );
}
