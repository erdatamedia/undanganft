"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  Archive,
  CheckSquare,
  ClipboardCheck,
  Inbox,
  Loader2,
  LogOut,
  Search,
  Square,
  XCircle,
} from "lucide-react";
import { Eyebrow, GlassCard, GlassSheet, StatusPill } from "@/components/glass";

type Kind = "fakultas" | "univ";
type Payment = {
  id: string;
  kind: Kind;
  proof: string | null;
  status: "none" | "pending" | "approved" | "rejected" | "desk";
  rejectReason: string | null;
} | null;

type QueueItem = {
  submissionId: string;
  mahasiswaNpm: string;
  mahasiswaName: string;
  mahasiswaEmail: string | null;
  payments: { fakultas: Payment; univ: Payment };
};

type PickupItem = {
  id: string;
  mahasiswaNpm: string;
  mahasiswaName: string;
  handedAt: string;
  undanganGiven: boolean;
  togaGiven: boolean;
  handoverPhoto: string | null;
  note: string | null;
  wd2CheckStatus: "pending" | "valid" | "issue";
  wd2CheckNote: string | null;
  payments: { fakultas: Payment; univ: Payment };
};

type MonitorPay = { id: string; status: string; rejectReason: string | null; image: string } | null;
type MonitorItem = {
  submissionId: string;
  npm: string;
  name: string;
  program: string | null;
  yudisiumStatus: string | null;
  fakultas: MonitorPay;
  univ: MonitorPay;
  pickup: {
    handedAt: string;
    undanganGiven: boolean;
    togaGiven: boolean;
    note: string | null;
    checkStatus: "pending" | "valid" | "issue";
    checkNote: string | null;
    image: string | null;
  } | null;
};

type Notification = { id: string; title: string; body: string | null; readAt: string | null };

type Preview =
  | { type: "payment"; payment: NonNullable<Payment>; who: string }
  | { type: "photo"; src: string; title: string }
  | null;

const kindLabel: Record<Kind, string> = {
  fakultas: "Wisuda Pelepasan Fakultas",
  univ: "Wisuda Univ",
};

export default function Wd2ReviewPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"queue" | "pickups" | "monitor">("queue");
  const [reviewerType, setReviewerType] = useState<"wd2" | "admin">("wd2");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [pickups, setPickups] = useState<PickupItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [monitor, setMonitor] = useState<MonitorItem[]>([]);
  const [monitorTotal, setMonitorTotal] = useState(0);
  const [monitorQuery, setMonitorQuery] = useState("");
  const [monitorFilter, setMonitorFilter] = useState<"all" | "picked" | "unpicked" | "issue" | "rejected">("all");
  const [monitorBusy, setMonitorBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [sheet, setSheet] = useState<"notif" | null>(null);
  const [preview, setPreview] = useState<Preview>(null);

  const [rejectTarget, setRejectTarget] = useState<{ type: "payment" | "pickup"; id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchQueue = useCallback(async () => {
    const res = await fetch("/api/wd2/submissions", { credentials: "include" });
    if (res.status === 401) {
      router.replace("/wd2/login");
      return;
    }
    const data = await res.json();
    setQueue(data.queue ?? []);
    if (data.reviewer?.type) setReviewerType(data.reviewer.type);
  }, [router]);

  const fetchPickups = useCallback(async () => {
    const res = await fetch("/api/wd2/pickups?status=pending", { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setPickups(data.pickups ?? []);
  }, []);

  const fetchNotifications = useCallback(async () => {
    const res = await fetch("/api/wd2/notifications", { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications ?? []);
    setUnread(data.unread ?? 0);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchQueue(), fetchPickups(), fetchNotifications()]).finally(() => setLoading(false));
  }, [fetchQueue, fetchPickups, fetchNotifications]);

  const loadMonitor = useCallback(
    async (append: boolean, offset = 0) => {
      setMonitorBusy(true);
      const params = new URLSearchParams({ filter: monitorFilter, q: monitorQuery, limit: "30", offset: String(offset) });
      const res = await fetch(`/api/wd2/monitor?${params}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setMonitor((prev) => (append ? [...prev, ...data.rows] : data.rows));
        setMonitorTotal(data.total);
      }
      setMonitorBusy(false);
    },
    [monitorFilter, monitorQuery]
  );

  useEffect(() => {
    if (tab !== "monitor") return;
    const t = setTimeout(() => void loadMonitor(false), 300);
    return () => clearTimeout(t);
  }, [tab, loadMonitor]);

  const handleLogout = async () => {
    if (reviewerType === "admin") {
      router.push("/dashboard");
      return;
    }
    await fetch("/api/wd2/logout", { method: "POST", credentials: "include" });
    router.replace("/wd2/login");
  };

  const approvePaymentById = async (id: string): Promise<boolean> => {
    const res = await fetch(`/api/wd2/payments/${id}/approve`, { method: "POST", credentials: "include" });
    return res.ok;
  };

  const handleApprove = async (id: string) => {
    setBusyId(id);
    try {
      if (!(await approvePaymentById(id))) throw new Error("Gagal menyetujui");
      await fetchQueue();
      setPreview(null);
      showToast("Disetujui.");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setBusyId(null);
    }
  };

  const handleBulkApprove = async () => {
    const items = queue.filter((q) => selected.has(q.submissionId));
    const paymentIds = items.flatMap((q) =>
      [q.payments.fakultas, q.payments.univ].filter((p): p is NonNullable<Payment> => p?.status === "pending").map((p) => p.id)
    );
    if (!paymentIds.length) return;
    setBulkBusy(true);
    let ok = 0;
    let fail = 0;
    for (const id of paymentIds) {
      if (await approvePaymentById(id)) ok++;
      else fail++;
    }
    await fetchQueue();
    setSelected(new Set());
    setBulkBusy(false);
    showToast(fail ? `${ok} bukti disetujui, ${fail} gagal.` : `${ok} bukti disetujui.`, fail ? "err" : "ok");
  };

  const submitReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setBusyId(rejectTarget.id);
    try {
      const url =
        rejectTarget.type === "payment"
          ? `/api/wd2/payments/${rejectTarget.id}/reject`
          : `/api/wd2/pickups/${rejectTarget.id}/check`;
      const body =
        rejectTarget.type === "payment"
          ? { reason: rejectReason }
          : { outcome: "issue", note: rejectReason };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal menyimpan");
      await Promise.all([fetchQueue(), fetchPickups()]);
      setRejectTarget(null);
      setRejectReason("");
      setPreview(null);
      showToast(rejectTarget.type === "payment" ? "Bukti ditolak." : "Ditandai bermasalah.");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setBusyId(null);
    }
  };

  const markPickupValid = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/wd2/pickups/${id}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ outcome: "valid" }),
      });
      if (!res.ok) throw new Error("Gagal memvalidasi");
      await fetchPickups();
      showToast("Ditandai valid.");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setBusyId(null);
    }
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openNotifications = async () => {
    setSheet("notif");
    const unreadItems = notifications.filter((n) => !n.readAt);
    if (unreadItems.length) {
      await Promise.all(
        unreadItems.map((n) =>
          fetch(`/api/wd2/notifications/${n.id}/read`, { method: "PATCH", credentials: "include" })
        )
      );
      setUnread(0);
      fetchNotifications();
    }
  };

  const proofThumb = (src: string | null, title: string, onClick?: () => void) =>
    src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={title}
        loading="lazy"
        onClick={onClick ?? (() => setPreview({ type: "photo", src, title }))}
        className="w-20 h-20 object-cover rounded-2xl border border-white/80 shadow-sm cursor-zoom-in shrink-0"
      />
    ) : (
      <div className="w-20 h-20 rounded-2xl glass-inset flex items-center justify-center text-[10px] text-slate-400 shrink-0">
        Tidak ada
      </div>
    );

  const allSelected = queue.length > 0 && selected.size === queue.length;
  const previewPayment = preview?.type === "payment" ? preview : null;

  const payTone = (st: string): "ok" | "wait" | "bad" | "info" | "muted" =>
    st === "approved" ? "ok" : st === "pending" ? "wait" : st === "rejected" ? "bad" : st === "desk" ? "info" : "muted";
  const payLabel = (st: string) =>
    ({ approved: "Disetujui", pending: "Menunggu", rejected: "Ditolak", desk: "Diverifikasi di meja" } as Record<string, string>)[st] ?? st;

  const monitorView = (
    <>
      <div className="glass-card !rounded-2xl px-4 py-3 space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={monitorQuery}
            onChange={(e) => setMonitorQuery(e.target.value)}
            placeholder="Cari nama atau NPM…"
            className="glass-input !pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            ["all", "Semua"],
            ["picked", "Sudah ambil"],
            ["unpicked", "Belum ambil"],
            ["issue", "Bermasalah"],
            ["rejected", "Bukti ditolak"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMonitorFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                monitorFilter === key
                  ? "bg-[#1B4332] text-white border-[#1B4332]"
                  : "bg-white/60 text-slate-600 border-white/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          {monitorBusy && monitor.length === 0 ? "Memuat…" : `${monitorTotal} mahasiswa`} · hanya lihat
        </p>
      </div>

      {monitor.map((m) => (
        <GlassCard key={m.submissionId}>
          <div className="mb-3">
            <p className="font-bold text-[#11291f]">{m.name}</p>
            <p className="text-xs text-slate-500">
              {m.npm}
              {m.program ? ` • ${m.program}` : ""}
              {m.yudisiumStatus && m.yudisiumStatus !== "pending"
                ? ` • Yudisium: ${m.yudisiumStatus === "hadir" ? "hadir" : "tidak hadir"}`
                : ""}
            </p>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {([
              ["Fakultas", m.fakultas],
              ["Univ", m.univ],
            ] as const).map(([label, p]) => (
              <div key={label} className="text-center shrink-0">
                {proofThumb(p?.image ?? null, `Bukti ${label.toLowerCase()} — ${m.name}`)}
                <p className="text-[10px] text-slate-500 mt-1">{label}</p>
                {p && (
                  <div className="mt-1">
                    <StatusPill tone={payTone(p.status)}>{payLabel(p.status)}</StatusPill>
                  </div>
                )}
              </div>
            ))}
            <div className="text-center shrink-0">
              {proofThumb(m.pickup?.image ?? null, `Serah-terima — ${m.name}`)}
              <p className="text-[10px] text-slate-500 mt-1">Serah-terima</p>
              {m.pickup ? (
                <div className="mt-1">
                  <StatusPill tone={m.pickup.checkStatus === "valid" ? "ok" : m.pickup.checkStatus === "issue" ? "bad" : "wait"}>
                    {m.pickup.checkStatus === "valid" ? "Valid" : m.pickup.checkStatus === "issue" ? "Bermasalah" : "Menunggu"}
                  </StatusPill>
                </div>
              ) : (
                <div className="mt-1">
                  <StatusPill tone="muted">Belum ambil</StatusPill>
                </div>
              )}
            </div>
          </div>
          {m.pickup && (
            <p className="text-xs text-slate-500 mt-2">
              Diserahkan {new Date(m.pickup.handedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
              {m.pickup.undanganGiven ? " • Undangan" : ""}
              {m.pickup.togaGiven ? " • Toga" : ""}
            </p>
          )}
          {m.pickup?.note && <p className="glass-inset p-3 text-xs text-slate-600 mt-2">Catatan admin: {m.pickup.note}</p>}
          {m.pickup?.checkNote && <p className="glass-inset p-3 text-xs text-rose-700 mt-2">Catatan verifikasi: {m.pickup.checkNote}</p>}
          {(m.fakultas?.rejectReason || m.univ?.rejectReason) && (
            <p className="glass-inset p-3 text-xs text-rose-700 mt-2">
              Ditolak: {[m.fakultas?.rejectReason, m.univ?.rejectReason].filter(Boolean).join(" / ")}
            </p>
          )}
        </GlassCard>
      ))}

      {!monitorBusy && monitor.length === 0 && (
        <GlassCard>
          <div className="text-center py-6 text-slate-500 text-sm">
            <Archive className="mx-auto mb-2 text-slate-400" /> Tidak ada data yang cocok.
          </div>
        </GlassCard>
      )}

      {monitor.length < monitorTotal && (
        <button
          onClick={() => void loadMonitor(true, monitor.length)}
          disabled={monitorBusy}
          className="glass-btn w-full flex items-center justify-center gap-2"
        >
          {monitorBusy && <Loader2 size={14} className="animate-spin" />}
          Muat lagi ({monitorTotal - monitor.length} tersisa)
        </button>
      )}
    </>
  );

  return (
    <div className="glass-bg">
      <div className="max-w-2xl mx-auto px-5 pt-6 space-y-4">
        <div>
          <p className="text-sm text-slate-500">{reviewerType === "admin" ? "Admin (akses penuh)" : "Reviewer"}</p>
          <h1 className="glass-title">{tab === "queue" ? "Review Bukti Bayar" : tab === "pickups" ? "Verifikasi Susulan" : "Arsip & Monitoring"}</h1>
        </div>

        {toast && (
          <div className={`glass-card !rounded-2xl px-4 py-3 text-sm ${toast.type === "err" ? "text-rose-700" : "text-emerald-700"}`}>
            {toast.msg}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-[#40916C]" size={26} />
          </div>
        ) : tab === "monitor" ? (
          monitorView
        ) : tab === "queue" ? (
          <>
            <div className="glass-card !rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
              <button
                onClick={() => setSelected(allSelected ? new Set() : new Set(queue.map((q) => q.submissionId)))}
                disabled={!queue.length}
                className="flex items-center gap-2 text-sm text-slate-700 disabled:opacity-40"
              >
                {allSelected ? <CheckSquare size={18} className="text-[#1B4332]" /> : <Square size={18} />}
                <span>
                  <b>{queue.length}</b> mahasiswa menunggu
                </span>
              </button>
              {selected.size > 0 && (
                <button
                  onClick={handleBulkApprove}
                  disabled={bulkBusy}
                  className="glass-btn glass-btn-primary !min-h-10 px-4 text-sm flex items-center gap-1.5"
                >
                  {bulkBusy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Setujui ({selected.size})
                </button>
              )}
            </div>

            {queue.length === 0 && (
              <GlassCard>
                <div className="text-center py-6 text-slate-500 text-sm">
                  <Inbox className="mx-auto mb-2 text-slate-400" /> Tidak ada bukti yang menunggu review.
                </div>
              </GlassCard>
            )}

            {queue.map((q) => (
              <GlassCard key={q.submissionId}>
                <div className="flex items-start gap-3 mb-4">
                  <button onClick={() => toggleSelect(q.submissionId)} className="mt-0.5" aria-label="Pilih">
                    {selected.has(q.submissionId) ? (
                      <CheckSquare size={20} className="text-[#1B4332]" />
                    ) : (
                      <Square size={20} className="text-slate-400" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <p className="font-bold text-[#11291f]">{q.mahasiswaName}</p>
                    <p className="text-xs text-slate-500">
                      {q.mahasiswaNpm} {q.mahasiswaEmail ? `• ${q.mahasiswaEmail}` : ""}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {(["fakultas", "univ"] as Kind[]).map((kind) => {
                    const p = q.payments[kind];
                    return (
                      <div key={kind} className="glass-inset p-3 flex gap-3 items-center">
                        {proofThumb(p?.proof ?? null, kindLabel[kind], p ? () => setPreview({ type: "payment", payment: p, who: q.mahasiswaName }) : undefined)}
                        <div className="flex-1 min-w-0">
                          <Eyebrow>{kindLabel[kind]}</Eyebrow>
                          {!p || p.status === "none" ? (
                            <StatusPill tone="muted">Belum diunggah</StatusPill>
                          ) : p.status === "pending" ? (
                            <div className="flex gap-2 mt-1">
                              <button
                                onClick={() => handleApprove(p.id)}
                                disabled={busyId === p.id}
                                className="glass-btn glass-btn-primary !min-h-10 px-4 text-sm"
                              >
                                Setujui
                              </button>
                              <button
                                onClick={() => setRejectTarget({ type: "payment", id: p.id })}
                                className="glass-btn glass-btn-danger !min-h-10 px-4 text-sm"
                              >
                                Tolak
                              </button>
                            </div>
                          ) : p.status === "approved" ? (
                            <StatusPill tone="ok">Disetujui</StatusPill>
                          ) : p.status === "desk" ? (
                            <StatusPill tone="info">Diverifikasi admin</StatusPill>
                          ) : (
                            <StatusPill tone="bad">Ditolak</StatusPill>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            ))}
          </>
        ) : (
          <>
            {pickups.length === 0 && (
              <GlassCard>
                <div className="text-center py-6 text-slate-500 text-sm">
                  <ClipboardCheck className="mx-auto mb-2 text-slate-400" /> Tidak ada serah-terima yang perlu diverifikasi.
                </div>
              </GlassCard>
            )}
            {pickups.map((pk) => (
              <GlassCard key={pk.id}>
                <div className="mb-3">
                  <p className="font-bold text-[#11291f]">{pk.mahasiswaName}</p>
                  <p className="text-xs text-slate-500">
                    {pk.mahasiswaNpm} • {new Date(pk.handedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                  <div className="flex gap-2 mt-2">
                    {pk.undanganGiven && <StatusPill tone="muted">Undangan</StatusPill>}
                    {pk.togaGiven && <StatusPill tone="muted">Toga</StatusPill>}
                  </div>
                </div>
                <div className="flex gap-3 mb-3 overflow-x-auto pb-1">
                  <div className="text-center">
                    {proofThumb(pk.payments.fakultas?.proof ?? null, "Bukti fakultas")}
                    <p className="text-[10px] text-slate-500 mt-1">Fakultas</p>
                  </div>
                  <div className="text-center">
                    {proofThumb(pk.payments.univ?.proof ?? null, "Bukti univ")}
                    <p className="text-[10px] text-slate-500 mt-1">Univ</p>
                  </div>
                  <div className="text-center">
                    {proofThumb(pk.handoverPhoto, "Foto serah-terima")}
                    <p className="text-[10px] text-slate-500 mt-1">Serah-terima</p>
                  </div>
                </div>
                {pk.note && <p className="glass-inset p-3 text-sm text-slate-600 mb-3">Catatan admin: {pk.note}</p>}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => markPickupValid(pk.id)}
                    disabled={busyId === pk.id}
                    className="glass-btn glass-btn-primary"
                  >
                    Valid
                  </button>
                  <button
                    onClick={() => setRejectTarget({ type: "pickup", id: pk.id })}
                    className="glass-btn glass-btn-danger"
                  >
                    Bermasalah
                  </button>
                </div>
              </GlassCard>
            ))}
          </>
        )}
      </div>

      <nav className="glass-bar">
        <button className={tab === "queue" ? "is-active" : ""} onClick={() => setTab("queue")}>
          <Inbox size={20} />
          Menunggu{queue.length ? ` (${queue.length})` : ""}
        </button>
        <button className={tab === "pickups" ? "is-active" : ""} onClick={() => setTab("pickups")}>
          <ClipboardCheck size={20} />
          Susulan{pickups.length ? ` (${pickups.length})` : ""}
        </button>
        <button className={tab === "monitor" ? "is-active" : ""} onClick={() => setTab("monitor")}>
          <Archive size={20} />
          Arsip
        </button>
        {reviewerType === "wd2" && (
          <button onClick={openNotifications}>
            <Bell size={20} />
            {unread > 0 && (
              <span className="absolute top-1 right-[28%] min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">
                {unread}
              </span>
            )}
            Notifikasi
          </button>
        )}
        <button onClick={handleLogout}>
          <LogOut size={20} />
          {reviewerType === "admin" ? "Admin" : "Keluar"}
        </button>
      </nav>

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

      {/* Image preview — approve/reject stay reachable for payment proofs */}
      <GlassSheet open={preview !== null} onClose={() => setPreview(null)}>
        {preview?.type === "photo" && (
          <>
            <h3 className="text-base font-bold text-[#11291f] mb-3">{preview.title}</h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.src} alt={preview.title} className="w-full max-h-[65dvh] object-contain rounded-2xl" />
          </>
        )}
        {previewPayment && (
          <>
            <h3 className="text-base font-bold text-[#11291f]">{previewPayment.who}</h3>
            <p className="text-xs text-slate-500 mb-3">{kindLabel[previewPayment.payment.kind]}</p>
            {previewPayment.payment.proof && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewPayment.payment.proof}
                alt="Bukti pembayaran"
                className="w-full max-h-[55dvh] object-contain rounded-2xl mb-4"
              />
            )}
            {previewPayment.payment.status === "pending" && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleApprove(previewPayment.payment.id)}
                  disabled={busyId === previewPayment.payment.id}
                  className="glass-btn glass-btn-primary"
                >
                  Setujui
                </button>
                <button
                  onClick={() => {
                    setRejectTarget({ type: "payment", id: previewPayment.payment.id });
                    setPreview(null);
                  }}
                  className="glass-btn glass-btn-danger"
                >
                  Tolak
                </button>
              </div>
            )}
          </>
        )}
      </GlassSheet>

      <GlassSheet open={rejectTarget !== null} onClose={() => setRejectTarget(null)}>
        <h3 className="text-lg font-bold text-[#11291f] mb-1">
          {rejectTarget?.type === "pickup" ? "Tandai Bermasalah" : "Tolak Bukti"}
        </h3>
        <p className="text-sm text-slate-500 mb-4">Alasan wajib diisi dan akan terlihat oleh {rejectTarget?.type === "pickup" ? "admin" : "mahasiswa"}.</p>
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Tulis alasan..."
          className="glass-input mb-4"
        />
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setRejectTarget(null)} className="glass-btn glass-btn-soft">
            Batal
          </button>
          <button
            onClick={submitReject}
            disabled={!rejectReason.trim() || busyId === rejectTarget?.id}
            className="glass-btn glass-btn-danger flex items-center justify-center gap-1"
          >
            <XCircle size={15} /> Kirim
          </button>
        </div>
      </GlassSheet>
    </div>
  );
}
