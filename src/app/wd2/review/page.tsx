"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCircle2, Loader2, LogOut, ShieldCheck, XCircle } from "lucide-react";

type Submission = {
  id: string;
  mahasiswaNpm: string;
  mahasiswaName: string;
  mahasiswaEmail: string | null;
  paymentProof: string | null;
  paymentProofUploadedAt: string | null;
};

type Notification = {
  id: string;
  title: string;
  body: string | null;
  readAt: string | null;
};

export default function Wd2ReviewPage() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [showNotif, setShowNotif] = useState(false);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchSubmissions = useCallback(async () => {
    const res = await fetch("/api/wd2/submissions?status=pending", { credentials: "include" });
    if (res.status === 401) {
      router.replace("/wd2/login");
      return;
    }
    const data = await res.json();
    setSubmissions(data.submissions ?? []);
  }, [router]);

  const fetchNotifications = useCallback(async () => {
    const res = await fetch("/api/wd2/notifications", { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications ?? []);
    setUnread(data.unread ?? 0);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSubmissions(), fetchNotifications()]).finally(() => setLoading(false));
  }, [fetchSubmissions, fetchNotifications]);

  const handleLogout = async () => {
    await fetch("/api/wd2/logout", { method: "POST", credentials: "include" });
    router.replace("/wd2/login");
  };

  const handleApprove = async (id: string) => {
    setActionId(id);
    try {
      const res = await fetch(`/api/wd2/submissions/${id}/approve`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal menyetujui");
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      showToast(`Disetujui. ${data.emailNote ?? ""}`);
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) return;
    setActionId(id);
    try {
      const res = await fetch(`/api/wd2/submissions/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal menolak");
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      setRejectingId(null);
      setRejectReason("");
      showToast("Submission ditolak.");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setActionId(null);
    }
  };

  const toggleNotif = async () => {
    setShowNotif((v) => !v);
    if (!showNotif) {
      await Promise.all(
        notifications.filter((n) => !n.readAt).map((n) =>
          fetch(`/api/wd2/notifications/${n.id}/read`, { method: "PATCH", credentials: "include" })
        )
      );
      setUnread(0);
      fetchNotifications();
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-5 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-[#1B4332]" size={22} />
          <h1 className="text-base font-bold text-[#1A1A2E]">Review Pembayaran Wisuda</h1>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button onClick={toggleNotif} className="p-2 rounded-xl hover:bg-white relative">
              <Bell size={18} className="text-slate-500" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">
                  {unread}
                </span>
              )}
            </button>
            {showNotif && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-slate-100 shadow-lg z-10 max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Belum ada notifikasi.</p>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="px-4 py-3 border-b border-slate-50 last:border-0">
                      <p className="text-xs font-semibold text-[#1A1A2E]">{n.title}</p>
                      {n.body && <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <button onClick={handleLogout} className="p-2 rounded-xl hover:bg-white text-slate-500">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {toast && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          toast.type === "err" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-100 px-5 py-3">
        <p className="text-sm text-slate-500">
          <span className="font-bold text-[#1A1A2E]">{submissions.length}</span> submission menunggu review
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-[#40916C]" size={24} />
        </div>
      ) : submissions.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">Tidak ada submission yang menunggu review.</p>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <div key={s.id} className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
              <div className="flex gap-4">
                {s.paymentProof && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.paymentProof}
                    alt="Bukti pembayaran"
                    className="w-24 h-24 object-cover rounded-xl border border-slate-100 shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#1A1A2E]">{s.mahasiswaName}</p>
                  <p className="text-xs text-slate-400">{s.mahasiswaNpm} • {s.mahasiswaEmail}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => handleApprove(s.id)}
                      disabled={actionId === s.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#40916C] disabled:opacity-50"
                    >
                      <CheckCircle2 size={13} /> Setujui
                    </button>
                    <button
                      onClick={() => setRejectingId(rejectingId === s.id ? null : s.id)}
                      disabled={actionId === s.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 text-xs font-semibold hover:border-rose-300 disabled:opacity-50"
                    >
                      <XCircle size={13} /> Tolak
                    </button>
                  </div>
                </div>
              </div>
              {rejectingId === s.id && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Alasan penolakan..."
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#1B4332] focus:outline-none"
                  />
                  <button
                    onClick={() => handleReject(s.id)}
                    disabled={!rejectReason.trim() || actionId === s.id}
                    className="px-4 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50"
                  >
                    Kirim Penolakan
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
