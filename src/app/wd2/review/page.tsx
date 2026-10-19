"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  CheckSquare,
  Loader2,
  LogOut,
  Square,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";

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

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

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

  const approveOne = async (id: string): Promise<{ ok: boolean; message?: string }> => {
    const res = await fetch(`/api/wd2/submissions/${id}/approve`, {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, message: data.message ?? "Gagal menyetujui" };
    return { ok: true };
  };

  const handleApprove = async (id: string) => {
    setActionId(id);
    try {
      const result = await approveOne(id);
      if (!result.ok) throw new Error(result.message);
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (previewId === id) setPreviewId(null);
      showToast("Disetujui.");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setActionId(null);
    }
  };

  const handleBulkApprove = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkBusy(true);
    let success = 0;
    let failed = 0;
    for (const id of ids) {
      const result = await approveOne(id);
      if (result.ok) success++;
      else failed++;
    }
    // Refetch rather than locally filter, since some approvals may have failed mid-loop
    await fetchSubmissions();
    setSelected(new Set());
    setBulkBusy(false);
    showToast(
      failed > 0
        ? `${success} disetujui, ${failed} gagal.`
        : `${success} submission disetujui.`,
      failed > 0 ? "err" : "ok"
    );
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
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setRejectingId(null);
      setRejectReason("");
      if (previewId === id) setPreviewId(null);
      showToast("Submission ditolak.");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setActionId(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) =>
      prev.size === submissions.length ? new Set() : new Set(submissions.map((s) => s.id))
    );
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

  const previewSubmission = submissions.find((s) => s.id === previewId) ?? null;
  const allSelected = submissions.length > 0 && selected.size === submissions.length;

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

      <div className="rounded-2xl bg-white border border-slate-100 px-5 py-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={toggleSelectAll}
          disabled={submissions.length === 0}
          className="flex items-center gap-2 text-sm text-slate-600 disabled:opacity-40"
        >
          {allSelected ? <CheckSquare size={16} className="text-[#1B4332]" /> : <Square size={16} />}
          <span>
            <span className="font-bold text-[#1A1A2E]">{submissions.length}</span> submission menunggu review
          </span>
        </button>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={handleBulkApprove}
            disabled={bulkBusy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#40916C] disabled:opacity-50"
          >
            {bulkBusy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            Setujui Terpilih ({selected.size})
          </button>
        )}
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
                <button
                  type="button"
                  onClick={() => toggleSelect(s.id)}
                  className="shrink-0 mt-1"
                  title="Pilih untuk approve massal"
                >
                  {selected.has(s.id) ? (
                    <CheckSquare size={18} className="text-[#1B4332]" />
                  ) : (
                    <Square size={18} className="text-slate-300" />
                  )}
                </button>
                {s.paymentProof && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.paymentProof}
                    alt="Bukti pembayaran"
                    onClick={() => setPreviewId(s.id)}
                    className="w-24 h-24 object-cover rounded-xl border border-slate-100 shrink-0 cursor-zoom-in hover:opacity-90 transition-opacity"
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

      {/* Image preview lightbox — keeps approve/reject reachable */}
      {previewSubmission && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-5"
          onClick={() => setPreviewId(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden max-w-lg w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div>
                <p className="text-sm font-bold text-[#1A1A2E]">{previewSubmission.mahasiswaName}</p>
                <p className="text-xs text-slate-400">
                  {previewSubmission.mahasiswaNpm} • {previewSubmission.mahasiswaEmail}
                </p>
              </div>
              <button onClick={() => setPreviewId(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-auto flex-1 bg-slate-50 flex items-center justify-center p-2">
              {previewSubmission.paymentProof && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewSubmission.paymentProof}
                  alt="Bukti pembayaran"
                  className="max-w-full max-h-[65vh] object-contain rounded-lg"
                />
              )}
            </div>
            <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100">
              <button
                onClick={() => handleApprove(previewSubmission.id)}
                disabled={actionId === previewSubmission.id}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#40916C] disabled:opacity-50"
              >
                {actionId === previewSubmission.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Setujui
              </button>
              <button
                onClick={() => {
                  setRejectingId(previewSubmission.id);
                  setPreviewId(null);
                }}
                disabled={actionId === previewSubmission.id}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-rose-200 text-rose-600 text-sm font-semibold hover:border-rose-300 disabled:opacity-50"
              >
                <XCircle size={14} /> Tolak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
