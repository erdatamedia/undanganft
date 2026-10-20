"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarCheck,
  CheckCircle2,
  Clock,
  GraduationCap,
  Home,
  ListOrdered,
  LogOut,
  QrCode,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import { InstallPrompt } from "@/components/install-prompt";
import { Eyebrow, GlassCard, GlassSheet, StatusPill } from "@/components/glass";

type PaymentKind = "fakultas" | "univ";
type PaymentView = {
  id: string;
  status: "none" | "pending" | "approved" | "rejected" | "desk";
  rejectReason: string | null;
  source: "mahasiswa" | "admin_desk";
} | null;

type Submission = {
  id: string;
  yudisiumStatus: "pending" | "hadir" | "tidak_hadir";
  yudisiumAbsentReason: string | null;
};

type EventData = {
  name: string;
  schedule: string;
  venue: string;
  yudisiumSchedule?: string | null;
  yudisiumVenue?: string | null;
  yudisiumDresscode?: string | null;
  wisudaDresscode?: string | null;
  univSchedule?: string | null;
  univVenue?: string | null;
};

type Notification = {
  id: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
};

type RundownInfo = {
  order: number;
  timeStart: string | null;
  durationMinutes: number | null;
  title: string;
};

export default function MahasiswaDashboardPage() {
  const router = useRouter();
  const [mahasiswa, setMahasiswa] = useState<{ name: string; npm: string } | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [payments, setPayments] = useState<{ fakultas: PaymentView; univ: PaymentView }>({
    fakultas: null,
    univ: null,
  });
  const [pickup, setPickup] = useState<{ handedAt: string; undanganGiven: boolean; togaGiven: boolean } | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [sheet, setSheet] = useState<"notif" | "rundown" | "absent" | null>(null);
  const [rundown, setRundown] = useState<RundownInfo[]>([]);
  const [absentReason, setAbsentReason] = useState("");

  const fileRefs = useRef<Record<PaymentKind, HTMLInputElement | null>>({ fakultas: null, univ: null });

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
    setPayments(data.payments ?? { fakultas: null, univ: null });
    setPickup(data.pickup ?? null);
    setInviteToken(data.inviteToken ?? null);
  }, [router]);

  const fetchNotifications = useCallback(async () => {
    const res = await fetch("/api/mahasiswa/notifications", { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications ?? []);
    setUnread(data.unread ?? 0);
  }, []);

  const fetchRundown = useCallback(async () => {
    const res = await fetch("/api/mahasiswa/active-event-info");
    if (!res.ok) return;
    const data = await res.json();
    setRundown(data.rundown ?? []);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSubmission(), fetchNotifications(), fetchRundown()]).finally(() => setLoading(false));
  }, [fetchSubmission, fetchNotifications, fetchRundown]);

  const handleLogout = async () => {
    await fetch("/api/mahasiswa/logout", { method: "POST", credentials: "include" });
    router.replace("/mahasiswa/login");
  };

  const sendYudisium = async (attending: boolean, reason?: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/mahasiswa/submission/yudisium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ attending, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal menyimpan");
      setSubmission(data.submission);
      setSheet(null);
      setAbsentReason("");
      showToast(attending ? "Kehadiran yudisium dikonfirmasi." : "Ketidakhadiran dicatat.");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (kind: PaymentKind, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("kind", kind);
      formData.append("photo", file);
      const res = await fetch("/api/mahasiswa/submission/payment-proof", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal mengunggah");
      await fetchSubmission();
      showToast("Bukti pembayaran terkirim. Menunggu verifikasi.");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setBusy(false);
      const input = fileRefs.current[kind];
      if (input) input.value = "";
    }
  };

  const openNotifications = async () => {
    setSheet("notif");
    const unreadItems = notifications.filter((n) => !n.readAt);
    if (unreadItems.length) {
      await Promise.all(
        unreadItems.map((n) =>
          fetch(`/api/mahasiswa/notifications/${n.id}/read`, { method: "PATCH", credentials: "include" })
        )
      );
      setUnread(0);
      fetchNotifications();
    }
  };

  const renderPayment = (kind: PaymentKind) => {
    const p = payments[kind];
    const status = p?.status ?? "none";
    const uploadable = status === "none" || status === "rejected";
    return (
      <div className="space-y-3">
        {status === "pending" && (
          <StatusPill tone="wait">
            <Clock size={13} /> Menunggu verifikasi WD2
          </StatusPill>
        )}
        {status === "approved" && (
          <StatusPill tone="ok">
            <CheckCircle2 size={13} /> Disetujui
          </StatusPill>
        )}
        {status === "desk" && (
          <StatusPill tone="info">
            <ShieldCheck size={13} /> Diverifikasi admin di meja · validasi WD2 menyusul
          </StatusPill>
        )}
        {status === "rejected" && (
          <div className="glass-inset p-3 flex items-start gap-2 text-rose-700">
            <XCircle size={16} className="shrink-0 mt-0.5" />
            <span className="text-sm">
              Ditolak: {p?.rejectReason}. Silakan unggah ulang bukti yang valid.
            </span>
          </div>
        )}
        {uploadable && (
          <>
            <button
              onClick={() => fileRefs.current[kind]?.click()}
              disabled={busy}
              className="glass-btn glass-btn-soft w-full flex items-center justify-center gap-2 border-dashed"
            >
              <Upload size={16} /> Unggah Foto Bukti Bayar
            </button>
            <input
              ref={(el) => {
                fileRefs.current[kind] = el;
              }}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleUpload(kind, e)}
            />
            <p className="text-[11px] text-slate-500 text-center">Format foto, maksimal 2MB.</p>
          </>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="glass-bg flex items-center justify-center">
        <div className="animate-spin h-7 w-7 border-2 border-[#40916C] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="glass-bg flex items-center justify-center px-6 text-center">
        <GlassCard>
          <p className="text-sm text-slate-600">Tidak ada acara aktif yang membutuhkan konfirmasi Anda saat ini.</p>
        </GlassCard>
      </div>
    );
  }

  const invitationReady = payments.fakultas?.status === "approved" || payments.fakultas?.status === "desk";

  return (
    <div className="glass-bg">
      <div className="max-w-md mx-auto px-5 pt-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Halo,</p>
            <h1 className="glass-title">{mahasiswa?.name}</h1>
            <p className="text-xs text-slate-500 mt-1">{mahasiswa?.npm}</p>
          </div>
          <div className="glass-card !rounded-2xl p-2.5">
            <GraduationCap className="text-[#1B4332]" size={22} />
          </div>
        </div>

        <InstallPrompt />

        {toast && (
          <div
            className={`glass-card !rounded-2xl px-4 py-3 text-sm ${
              toast.type === "err" ? "text-rose-700" : "text-emerald-700"
            }`}
          >
            {toast.msg}
          </div>
        )}

        {event && (
          <GlassCard strong>
            <Eyebrow>Acara</Eyebrow>
            <h2 className="text-base font-bold text-[#11291f] leading-snug">{event.name}</h2>
          </GlassCard>
        )}

        {pickup && (
          <GlassCard>
            <Eyebrow>Pengambilan</Eyebrow>
            <div className="flex flex-wrap gap-2 items-center">
              <StatusPill tone="ok">
                <CheckCircle2 size={13} /> Sudah diambil di kantor
              </StatusPill>
              {pickup.undanganGiven && <StatusPill tone="muted">Undangan</StatusPill>}
              {pickup.togaGiven && <StatusPill tone="muted">Toga</StatusPill>}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {new Date(pickup.handedAt).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}
            </p>
          </GlassCard>
        )}

        {/* Yudisium */}
        <GlassCard>
          <Eyebrow>Undangan Yudisium</Eyebrow>
          <div className="space-y-1.5 text-sm text-[#11291f] mb-4">
            {event?.yudisiumSchedule && <p>🗓️ {event.yudisiumSchedule}</p>}
            {event?.yudisiumVenue && <p>📍 {event.yudisiumVenue}</p>}
            {event?.yudisiumDresscode && <p className="text-slate-600">👔 Dresscode: {event.yudisiumDresscode}</p>}
            {!event?.yudisiumSchedule && !event?.yudisiumVenue && (
              <p className="text-slate-500">Informasi jadwal yudisium akan diumumkan panitia.</p>
            )}
          </div>
          {submission?.yudisiumStatus === "hadir" && (
            <div className="flex items-center justify-between gap-2">
              <StatusPill tone="ok">
                <CheckCircle2 size={13} /> Hadir terkonfirmasi
              </StatusPill>
              <button onClick={() => setSheet("absent")} className="text-xs font-semibold text-slate-500 underline">
                Ubah
              </button>
            </div>
          )}
          {submission?.yudisiumStatus === "tidak_hadir" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <StatusPill tone="bad">
                  <XCircle size={13} /> Tidak hadir
                </StatusPill>
                <button onClick={() => sendYudisium(true)} className="text-xs font-semibold text-slate-500 underline">
                  Ubah jadi hadir
                </button>
              </div>
              {submission.yudisiumAbsentReason && (
                <p className="glass-inset p-3 text-sm text-slate-600">Catatan: {submission.yudisiumAbsentReason}</p>
              )}
            </div>
          )}
          {submission?.yudisiumStatus === "pending" && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => sendYudisium(true)}
                disabled={busy}
                className="glass-btn glass-btn-primary"
              >
                Hadir
              </button>
              <button onClick={() => setSheet("absent")} disabled={busy} className="glass-btn glass-btn-danger">
                Tidak Hadir
              </button>
            </div>
          )}
        </GlassCard>

        {/* Wisuda Pelepasan Fakultas */}
        <GlassCard>
          <Eyebrow>Wisuda Pelepasan Fakultas</Eyebrow>
          <div className="space-y-1.5 text-sm text-[#11291f] mb-4">
            {event?.schedule && <p>🗓️ {event.schedule}</p>}
            {event?.venue && <p>📍 {event.venue}</p>}
            {event?.wisudaDresscode && <p className="text-slate-600">👔 Dresscode: {event.wisudaDresscode}</p>}
          </div>
          {renderPayment("fakultas")}
          {invitationReady && inviteToken && (
            <a
              href={`/invite/${encodeURIComponent(inviteToken)}`}
              className="glass-btn glass-btn-primary w-full mt-3 flex items-center justify-center gap-2"
            >
              <QrCode size={16} /> Lihat Undangan &amp; QR Kehadiran
            </a>
          )}
        </GlassCard>

        {/* Wisuda Univ */}
        <GlassCard>
          <Eyebrow>Wisuda Universitas</Eyebrow>
          <div className="space-y-1.5 text-sm text-[#11291f] mb-4">
            {event?.univSchedule && <p>🗓️ {event.univSchedule}</p>}
            {event?.univVenue && <p>📍 {event.univVenue}</p>}
            {!event?.univSchedule && !event?.univVenue && (
              <p className="text-slate-500">Informasi wisuda universitas akan diumumkan panitia.</p>
            )}
          </div>
          {renderPayment("univ")}
        </GlassCard>
      </div>

      {/* Floating iOS-style bar */}
      <nav className="glass-bar">
        <button className="is-active" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <Home size={20} />
          Beranda
        </button>
        <button onClick={() => setSheet("rundown")}>
          <ListOrdered size={20} />
          Rundown
        </button>
        <button onClick={openNotifications}>
          <Bell size={20} />
          {unread > 0 && (
            <span className="absolute top-1 right-[28%] min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">
              {unread}
            </span>
          )}
          Notifikasi
        </button>
        <button onClick={handleLogout}>
          <LogOut size={20} />
          Keluar
        </button>
      </nav>

      <GlassSheet open={sheet === "rundown"} onClose={() => setSheet(null)}>
        <h3 className="text-lg font-bold text-[#11291f] mb-4 flex items-center gap-2">
          <CalendarCheck size={18} /> Susunan Acara
        </h3>
        {rundown.length === 0 ? (
          <p className="text-sm text-slate-500">Rundown belum tersedia.</p>
        ) : (
          <div className="space-y-3">
            {rundown.map((item) => (
              <div key={item.order} className="glass-inset p-3 flex gap-3 text-sm">
                <span className="shrink-0 w-14 font-bold text-[#1B4332]">{item.timeStart ?? "-"}</span>
                <div>
                  <p className="text-[#11291f]">{item.title}</p>
                  {item.durationMinutes != null && (
                    <p className="text-xs text-slate-500">{item.durationMinutes} menit</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassSheet>

      <GlassSheet open={sheet === "notif"} onClose={() => setSheet(null)}>
        <h3 className="text-lg font-bold text-[#11291f] mb-4">Notifikasi</h3>
        {notifications.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada notifikasi.</p>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div key={n.id} className="glass-inset p-3">
                <p className="text-sm font-semibold text-[#11291f]">{n.title}</p>
                {n.body && <p className="text-xs text-slate-600 mt-0.5">{n.body}</p>}
              </div>
            ))}
          </div>
        )}
      </GlassSheet>

      <GlassSheet open={sheet === "absent"} onClose={() => setSheet(null)}>
        <h3 className="text-lg font-bold text-[#11291f] mb-1">Tidak Hadir Yudisium</h3>
        <p className="text-sm text-slate-500 mb-4">Catatan alasan bersifat opsional.</p>
        <textarea
          value={absentReason}
          onChange={(e) => setAbsentReason(e.target.value)}
          placeholder="Contoh: sedang sakit / ada keperluan keluarga"
          className="glass-input mb-4"
        />
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setSheet(null)} className="glass-btn glass-btn-soft">
            Batal
          </button>
          <button
            onClick={() => sendYudisium(false, absentReason)}
            disabled={busy}
            className="glass-btn glass-btn-danger"
          >
            Simpan
          </button>
        </div>
      </GlassSheet>
    </div>
  );
}
