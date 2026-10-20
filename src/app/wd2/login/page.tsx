"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";

export default function Wd2LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/wd2/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? "Gagal masuk");
      return;
    }
    router.replace("/wd2/review");
  };

  return (
    <div className="glass-bg flex items-center justify-center px-5">
      <div className="glass-card-strong glass-enter w-full max-w-sm p-7">
        <div className="mb-6">
          <div className="glass-card !rounded-2xl inline-flex p-3 mb-4">
            <ShieldCheck className="text-[#1B4332]" size={26} />
          </div>
          <h1 className="glass-title">Portal WD2</h1>
          <p className="text-sm text-slate-600 mt-2">Review bukti pembayaran wisuda.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            autoComplete="username"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
      </div>
    </div>
  );
}
