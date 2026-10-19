"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  Clock,
  GraduationCap,
  LogOut,
  Upload,
  XCircle,
} from "lucide-react";

type Submission = {
  id: string;
  yudisiumConfirmed: boolean;
  paymentProof: string | null;
  paymentStatus: "none" | "pending" | "approved" | "rejected";
  paymentRejectReason: string | null;
  wisudaConfirmed: boolean;
};

type EventData = {
  name: string;
  schedule: string;
  venue: string;
};

type Notification = {
  id: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
};

export default function MahasiswaDashboardPage() {
  const router = useRouter();
  const [mahasiswa, setMahasiswa] = useState<{ name: string; npm: string } | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [showNotif, setShowNotif] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchSubmission = useCallback(async () => {
    const res = await fetch("/api/mahasiswa/submission", { credentials: "include" });
    if (res.status === 401) {
      router.replace("/mahasiswa/login");
      return;
    }
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    const data = await res.json();
    setEvent(data.event);
    setSubmission(data.submission);
    setMahasiswa(data.mahasiswa);
  }, [router]);

  const fetchNotifications = useCallback(async () => {
    const res = await fetch("/api/mahasiswa/notifications", { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications ?? []);
    setUnread(data.unread ?? 0);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSubmission(), fetchNotifications()]).finally(() => setLoading(false));
  }, [fetchSubmission, fetchNotifications]);

  const handleLogout = async () => {
    await fetch("/api/mahasiswa/logout", { method: "POST", credentials: "include" });
    router.replace("/mahasiswa/login");
  };

  const handleConfirmYudisium = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/mahasiswa/submission/yudisium", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal konfirmasi");
      setSubmission(data.submission);
      showToast("Kehadiran yudisium dikonfirmasi.");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/mahasiswa/submission/payment-proof", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal mengunggah");
      setSubmission(data.submission);
      showToast("Bukti pembayaran terkirim. Menunggu review WD2.");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const toggleNotif = async () => {
    setShowNotif((v) => !v);
    if (!showNotif) {
      await Promise.all(
        notifications.filter((n) => !n.readAt).map((n) =>
          fetch(`/api/mahasiswa/notifications/${n.id}/read`, { method: "PATCH", credentials: "include" })
        )
      );
      setUnread(0);
      fetchNotifications();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-6 w-6 border-2 border-[#40916C] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex items-center justify-center min-h-screen px-5 text-center">
        <p className="text-sm text-slate-500">
          Tidak ada acara aktif yang membutuhkan konfirmasi Anda saat ini.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-5 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="text-[#1B4332]" size={22} />
          <div>
            <p className="text-sm font-bold text-[#1A1A2E]">{mahasiswa?.name}</p>
            <p className="text-xs text-slate-400">{mahasiswa?.npm}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              onClick={toggleNotif}
              className="p-2 rounded-xl hover:bg-white relative"
            >
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

      {event && (
        <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[2px] text-[#40916C] mb-2">Acara</p>
          <h2 className="text-base font-bold text-[#1A1A2E]">{event.name}</h2>
          <p className="text-sm text-slate-500 mt-1">{event.schedule}</p>
          <p className="text-sm text-slate-500">{event.venue}</p>
        </div>
      )}

      {/* Yudisium */}
      <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[2px] text-[#40916C] mb-3">
          Tahap 1 — Konfirmasi Yudisium
        </p>
        {submission?.yudisiumConfirmed ? (
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 size={18} />
            <span className="text-sm font-semibold">Kehadiran yudisium terkonfirmasi</span>
          </div>
        ) : (
          <button
            onClick={handleConfirmYudisium}
            disabled={busy}
            className="w-full rounded-xl bg-[#1B4332] text-white text-sm font-semibold py-3 hover:bg-[#40916C] disabled:opacity-60 transition-colors"
          >
            Konfirmasi Kehadiran Yudisium
          </button>
        )}
      </div>

      {/* Payment */}
      <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[2px] text-[#40916C] mb-3">
          Tahap 2 — Bukti Pembayaran Wisuda
        </p>

        {submission?.paymentStatus === "approved" ? (
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 size={18} />
            <span className="text-sm font-semibold">
              Disetujui — undangan wisuda {" "}
              {submission.wisudaConfirmed ? "sudah dikirim ke email Anda." : "sedang diproses."}
            </span>
          </div>
        ) : submission?.paymentStatus === "pending" ? (
          <div className="flex items-center gap-2 text-amber-600">
            <Clock size={18} />
            <span className="text-sm font-semibold">Menunggu review dari WD2…</span>
          </div>
        ) : (
          <div className="space-y-3">
            {submission?.paymentStatus === "rejected" && (
              <div className="flex items-start gap-2 text-rose-600 bg-rose-50 rounded-xl p-3">
                <XCircle size={16} className="shrink-0 mt-0.5" />
                <span className="text-xs">
                  Ditolak: {submission.paymentRejectReason}. Silakan unggah ulang bukti yang valid.
                </span>
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 text-sm font-semibold py-4 hover:border-[#40916C] hover:text-[#40916C] disabled:opacity-60 transition-colors"
            >
              <Upload size={16} /> Unggah Foto Bukti Pembayaran
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
            <p className="text-[11px] text-slate-400 text-center">Format foto, maksimal 2MB.</p>
          </div>
        )}
      </div>
    </div>
  );
}
