"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Loader2,
  ListOrdered,
  Pencil,
  Plus,
  QrCode,
  Send,
  Trash2,
  Users,
  Upload,
  UserPlus,
  FileText,
  Settings,
  UserX,
} from "lucide-react";
import type { AttendeeRecord, InviteStatus } from "@/lib/storage";
import type { EventRecord as EventData } from "@/lib/event";
import type { RundownAttachmentRecord, RundownItemRecord } from "@/lib/rundown";

type Tab = "peserta" | "undangan" | "scan" | "laporan" | "rundown";

const statusTheme: Record<InviteStatus, { label: string; badge: string; dot: string }> = {
  draft: { label: "Belum dikirim", badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  sent: { label: "Terkirim", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  confirmed: { label: "Hadir", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  absent: { label: "Tidak hadir", badge: "bg-rose-100 text-rose-600", dot: "bg-rose-500" },
};

const statusOrder: InviteStatus[] = ["draft", "sent", "confirmed", "absent"];

export default function EventDetailPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("peserta");
  const [currentEvent, setCurrentEvent] = useState<EventData | null>(null);
  const [attendees, setAttendees] = useState<AttendeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleUnauthorized = useCallback(() => {
    window.location.href = `/auth/login?redirect=/events/${eventId}`;
  }, [eventId]);

  // Load event
  useEffect(() => {
    fetch(`/api/events/${eventId}`, { credentials: "include" })
      .then(async (res) => {
        if (res.status === 401) { handleUnauthorized(); return; }
        if (!res.ok) { router.push("/events"); return; }
        setCurrentEvent(await res.json());
      })
      .catch(() => router.push("/events"));
  }, [eventId, handleUnauthorized, router]);

  // Load attendees
  const fetchAttendees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendees?eventId=${eventId}`, { credentials: "include" });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) throw new Error("Gagal memuat peserta");
      const data = await res.json();
      setAttendees(data.attendees ?? []);
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setLoading(false);
    }
  }, [eventId, handleUnauthorized]);

  useEffect(() => { void fetchAttendees(); }, [fetchAttendees]);

  const stats = useMemo(() => {
    const total = attendees.length;
    const confirmed = attendees.filter((a) => a.status === "confirmed").length;
    const sent = attendees.filter((a) => a.status !== "draft").length;
    return { total, confirmed, sent, rate: total ? Math.round((confirmed / total) * 100) : 0 };
  }, [attendees]);

  if (!currentEvent && loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#40916C]" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/events" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#1B4332] transition-colors mb-4">
          <ArrowLeft size={15} /> Semua Acara
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#40916C]">Detail Acara</p>
            <h1 className="mt-1 text-xl font-bold text-[#1A1A2E] leading-tight max-w-2xl">
              {currentEvent?.name ?? "Memuat…"}
            </h1>
            {currentEvent && (
              <p className="text-sm text-slate-500 mt-1">{currentEvent.schedule} • {currentEvent.venue}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/events/${eventId}/pengambilan`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:border-slate-300 transition-colors"
            >
              <Camera size={15} /> Meja Pengambilan
            </Link>
            <Link
              href={`/events/${eventId}/yudisium`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:border-slate-300 transition-colors"
            >
              <GraduationCap size={15} /> Yudisium & Wisuda
            </Link>
            <Link
              href={`/events/${eventId}/scan`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#40916C] transition-colors"
            >
              <QrCode size={15} /> Scan QR
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="Total Peserta" value={stats.total} icon={<Users size={16} className="text-[#40916C]" />} />
        <MiniStat label="Terkirim" value={stats.sent} icon={<Send size={16} className="text-amber-500" />} />
        <MiniStat label="Konfirmasi Hadir" value={stats.confirmed} icon={<CheckCircle2 size={16} className="text-emerald-600" />} />
        <MiniStat label="Response Rate" value={`${stats.rate}%`} icon={<FileText size={16} className="text-slate-400" />} />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0">
          {(["peserta", "undangan", "scan", "laporan", "rundown"] as Tab[]).map((t) => (
            <TabButton key={t} active={tab === t} onClick={() => setTab(t)}>
              {t === "peserta" && <><Users size={14} /> Peserta</>}
              {t === "undangan" && <><Send size={14} /> Kirim Undangan</>}
              {t === "scan" && <><QrCode size={14} /> Scan & Kehadiran</>}
              {t === "laporan" && <><FileText size={14} /> Laporan</>}
              {t === "rundown" && <><ListOrdered size={14} /> Rundown</>}
            </TabButton>
          ))}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          toast.type === "err"
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Tab content */}
      {tab === "peserta" && (
        <PesertaTab
          eventId={eventId}
          currentEvent={currentEvent}
          onEventUpdated={setCurrentEvent}
          attendees={attendees}
          loading={loading}
          onRefresh={fetchAttendees}
          onAttendeeChange={setAttendees}
          onUnauthorized={handleUnauthorized}
          showToast={showToast}
        />
      )}

      {tab === "undangan" && (
        <UndanganTab
          eventId={eventId}
          attendees={attendees}
          onAttendeeChange={setAttendees}
          onUnauthorized={handleUnauthorized}
          showToast={showToast}
        />
      )}

      {tab === "scan" && (
        <div className="rounded-2xl bg-white border border-slate-100 p-8 text-center">
          <QrCode size={40} className="mx-auto text-[#40916C] mb-4" />
          <h3 className="text-base font-semibold text-[#1A1A2E]">Mode Pemindai QR</h3>
          <p className="text-sm text-slate-500 mt-1 mb-5">Buka halaman scan di perangkat mobile panitia untuk memindai QR tamu.</p>
          <Link
            href={`/events/${eventId}/scan`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#40916C] transition-colors"
          >
            <QrCode size={16} /> Buka Mode Scan
          </Link>
        </div>
      )}

      {tab === "laporan" && (
        <LaporanTab
          eventId={eventId}
          attendees={attendees}
          onUnauthorized={handleUnauthorized}
          showToast={showToast}
        />
      )}

      {tab === "rundown" && (
        <RundownTab
          eventId={eventId}
          onUnauthorized={handleUnauthorized}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ─── Peserta Tab ─────────────────────────────────────────────────────────────

function PesertaTab({
  eventId,
  currentEvent,
  onEventUpdated,
  attendees,
  loading,
  onRefresh,
  onAttendeeChange,
  onUnauthorized,
  showToast,
}: {
  eventId: string;
  currentEvent: EventData | null;
  onEventUpdated: (e: EventData) => void;
  attendees: AttendeeRecord[];
  loading: boolean;
  onRefresh: () => void;
  onAttendeeChange: React.Dispatch<React.SetStateAction<AttendeeRecord[]>>;
  onUnauthorized: () => void;
  showToast: (msg: string, type?: "ok" | "err") => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InviteStatus>("all");
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(1);

  const [addForm, setAddForm] = useState({ name: "", program: "", email: "", npm: "", seat: "" });
  const [addBusy, setAddBusy] = useState(false);

  const [actionId, setActionId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [emailId, setEmailId] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [defaultProgram, setDefaultProgram] = useState("Belum ditentukan");
  const [defaultSeat, setDefaultSeat] = useState("-");

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return [...attendees]
      .sort((a, b) => {
        if (a.status === b.status) return a.name.localeCompare(b.name);
        return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
      })
      .filter((a) => {
        const matchSearch = term
          ? [a.name, a.program, a.email, a.npm, a.id].some((v) => v.toLowerCase().includes(term))
          : true;
        const matchStatus = statusFilter === "all" ? true : a.status === statusFilter;
        return matchSearch && matchStatus;
      });
  }, [attendees, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!addForm.name || !addForm.email) return;
    setAddBusy(true);
    try {
      const res = await fetch("/api/attendees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...addForm, eventId, program: addForm.program || "Belum ditentukan" }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal menambah peserta");
      onAttendeeChange((prev) => [...prev, data]);
      setAddForm({ name: "", program: "", email: "", npm: "", seat: "" });
      showToast("Peserta berhasil ditambahkan.");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setAddBusy(false);
    }
  };

  const handleDelete = async (attendee: AttendeeRecord) => {
    if (!confirm(`Hapus peserta ${attendee.name}? Tindakan ini tidak bisa dibatalkan.`)) return;
    setDeleteId(attendee.id);
    try {
      const res = await fetch(`/api/attendees/${attendee.id}`, { method: "DELETE", credentials: "include" });
      if (res.status === 401) { onUnauthorized(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal menghapus");
      onAttendeeChange((prev) => prev.filter((a) => a.id !== attendee.id));
      showToast("Peserta dihapus.");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setDeleteId(null);
    }
  };

  const handleToggleConfirm = async (attendee: AttendeeRecord) => {
    setActionId(attendee.id);
    const nextStatus: InviteStatus = attendee.status === "confirmed" ? "sent" : "confirmed";
    try {
      const res = await fetch(`/api/attendees/${attendee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: nextStatus,
          confirmedAt: nextStatus === "confirmed" ? new Date().toISOString() : null,
        }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal memperbarui status");
      onAttendeeChange((prev) => prev.map((a) => (a.id === data.id ? data : a)));
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setActionId(null);
    }
  };

  const handleMarkAbsent = async (attendee: AttendeeRecord) => {
    setActionId(attendee.id);
    const nextStatus: InviteStatus = attendee.status === "absent" ? "sent" : "absent";
    try {
      const res = await fetch(`/api/attendees/${attendee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal memperbarui status");
      onAttendeeChange((prev) => prev.map((a) => (a.id === data.id ? data : a)));
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setActionId(null);
    }
  };

  const handleSendEmail = async (attendee: AttendeeRecord) => {
    setEmailId(attendee.id);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ attendeeId: attendee.id }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal mengirim email");
      if (data.attendee) onAttendeeChange((prev) => prev.map((a) => (a.id === data.attendee.id ? data.attendee : a)));
      showToast(data.message ?? "Undangan terkirim.");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setEmailId(null);
    }
  };

  const handleImport = async (e: FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { showToast("Pilih file CSV terlebih dahulu.", "err"); return; }
    setImportBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("defaultProgram", defaultProgram);
      form.append("defaultSeat", defaultSeat);
      form.append("eventId", eventId);
      const res = await fetch("/api/attendees/import", { method: "POST", body: form, credentials: "include" });
      if (res.status === 401) { onUnauthorized(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal mengimpor CSV");
      await onRefresh();
      showToast(`Berhasil menambah ${data.inserted} peserta.`);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      {/* Left: attendee table */}
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <input
            type="search"
            placeholder="Cari nama, prodi, email, NPM…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPageIndex(1); }}
            className="w-56 rounded-xl border border-slate-200 px-3 py-2 text-sm text-[#1A1A2E] placeholder:text-slate-400 focus:border-[#1B4332] focus:outline-none"
          />
          <div className="flex gap-2 items-center">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as "all" | InviteStatus); setPageIndex(1); }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-[#1A1A2E] focus:border-[#1B4332] focus:outline-none"
            >
              <option value="all">Semua status</option>
              <option value="draft">Belum dikirim</option>
              <option value="sent">Terkirim</option>
              <option value="confirmed">Hadir</option>
              <option value="absent">Tidak hadir</option>
            </select>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPageIndex(1); }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-[#1A1A2E] focus:border-[#1B4332] focus:outline-none"
            >
              {[10, 25, 50, 100].map((s) => (
                <option key={s} value={s}>{s}/hal</option>
              ))}
            </select>
            <button
              type="button"
              onClick={onRefresh}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:border-slate-300 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Peserta</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">NPM</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Kursi</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paged.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#1A1A2E]">{a.name}</p>
                    <p className="text-xs text-slate-400">{a.program}</p>
                    <p className="text-xs text-slate-400">{a.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusTheme[a.status].badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${statusTheme[a.status].dot}`} />
                      {statusTheme[a.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 hidden md:table-cell">{a.npm}</td>
                  <td className="px-4 py-3 text-sm text-slate-500 hidden lg:table-cell">{a.seat}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <ActionBtn
                        onClick={() => handleSendEmail(a)}
                        loading={emailId === a.id}
                        title="Kirim Email"
                        variant="outline"
                        icon={<Send size={13} />}
                      />
                      <ActionBtn
                        onClick={() => handleToggleConfirm(a)}
                        loading={actionId === a.id}
                        title={a.status === "confirmed" ? "Batalkan" : "Konfirmasi"}
                        variant={a.status === "confirmed" ? "active" : "primary"}
                        icon={<CheckCircle2 size={13} />}
                      />
                      <ActionBtn
                        onClick={() => handleMarkAbsent(a)}
                        loading={actionId === a.id}
                        title={a.status === "absent" ? "Batalkan" : "Absen"}
                        variant="warning"
                        icon={<UserX size={13} />}
                      />
                      <ActionBtn
                        onClick={() => handleDelete(a)}
                        loading={deleteId === a.id}
                        title="Hapus"
                        variant="danger"
                        icon={<Trash2 size={13} />}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {!paged.length && !loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                    {search || statusFilter !== "all"
                      ? "Tidak ada peserta yang cocok dengan filter."
                      : "Belum ada peserta. Tambahkan melalui form di samping."}
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <Loader2 className="animate-spin mx-auto text-[#40916C]" size={20} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {filtered.length === 0
              ? "0 peserta"
              : `${(pageIndex - 1) * pageSize + 1}–${Math.min(pageIndex * pageSize, filtered.length)} dari ${filtered.length} peserta`}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
              disabled={pageIndex === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            <span className="px-3">
              {pageIndex} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPageIndex((p) => Math.min(totalPages, p + 1))}
              disabled={pageIndex >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Right: forms */}
      <div className="space-y-4">
        {/* Add manually */}
        <details open className="rounded-2xl bg-white border border-slate-100 overflow-hidden">
          <summary className="cursor-pointer flex items-center gap-2 px-5 py-3.5 bg-slate-50 text-sm font-semibold text-slate-700 list-none">
            <UserPlus size={15} className="text-[#40916C]" />
            Tambah Peserta Manual
          </summary>
          <form onSubmit={handleAdd} className="p-5 space-y-3">
            <InputField label="Nama lengkap *" name="name" placeholder="cth. Salsabila Rahma"
              value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} required />
            <InputField label="Program studi" name="program" placeholder="cth. Teknik Informatika"
              value={addForm.program} onChange={(e) => setAddForm((f) => ({ ...f, program: e.target.value }))} />
            <InputField label="Email *" name="email" type="email" placeholder="nama@email.com"
              value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} required />
            <InputField label="NPM" name="npm" placeholder="cth. 21801052064"
              value={addForm.npm} onChange={(e) => setAddForm((f) => ({ ...f, npm: e.target.value }))} />
            <InputField label="Nomor kursi" name="seat" placeholder="cth. A25"
              value={addForm.seat} onChange={(e) => setAddForm((f) => ({ ...f, seat: e.target.value }))} />
            <button
              type="submit"
              disabled={addBusy}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#40916C] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {addBusy && <Loader2 size={14} className="animate-spin" />}
              Tambahkan
            </button>
          </form>
        </details>

        {/* Import CSV */}
        <details className="rounded-2xl bg-white border border-dashed border-slate-300 overflow-hidden">
          <summary className="cursor-pointer flex items-center gap-2 px-5 py-3.5 bg-slate-50 text-sm font-semibold text-slate-700 list-none">
            <Upload size={15} className="text-[#40916C]" />
            Impor dari CSV
          </summary>
          <form onSubmit={handleImport} className="p-5 space-y-3">
            <p className="text-xs text-slate-500">
              Format: <code className="font-mono bg-slate-100 px-1 rounded">name</code>,{" "}
              <code className="font-mono bg-slate-100 px-1 rounded">email</code> (wajib).
              Opsional: <code className="font-mono bg-slate-100 px-1 rounded">program</code>,{" "}
              <code className="font-mono bg-slate-100 px-1 rounded">npm</code>,{" "}
              <code className="font-mono bg-slate-100 px-1 rounded">seat</code>.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              required
              className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#1B4332] file:px-3 file:py-1.5 file:text-xs file:text-white file:cursor-pointer"
            />
            <div className="grid grid-cols-2 gap-2">
              <InputField label="Program default" name="defaultProgram"
                value={defaultProgram} onChange={(e) => setDefaultProgram(e.target.value)} />
              <InputField label="Kursi default" name="defaultSeat"
                value={defaultSeat} onChange={(e) => setDefaultSeat(e.target.value)} />
            </div>
            <button
              type="submit"
              disabled={importBusy}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {importBusy && <Loader2 size={14} className="animate-spin" />}
              Impor CSV
            </button>
          </form>
        </details>

        {/* Event settings link */}
        <div className="rounded-2xl bg-white border border-slate-100 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Pengaturan Acara</p>
          <EventSettingsInline event={currentEvent} onUpdated={onEventUpdated} onUnauthorized={onUnauthorized} showToast={showToast} />
        </div>
      </div>
    </div>
  );
}

// ─── Undangan Tab ─────────────────────────────────────────────────────────────

function UndanganTab({
  eventId,
  attendees,
  onAttendeeChange,
  onUnauthorized,
  showToast,
}: {
  eventId: string;
  attendees: AttendeeRecord[];
  onAttendeeChange: React.Dispatch<React.SetStateAction<AttendeeRecord[]>>;
  onUnauthorized: () => void;
  showToast: (msg: string, type?: "ok" | "err") => void;
}) {
  const [bulkBusy, setBulkBusy] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const APP_URL =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://undangan.ftunisma.online";

  const stats = {
    total: attendees.length,
    withEmail: attendees.filter((a) => a.email?.trim()).length,
    sent: attendees.filter((a) => a.status !== "draft").length,
    notSent: attendees.filter((a) => a.status === "draft").length,
  };

  const handleSendOne = async (attendee: AttendeeRecord) => {
    setSendingId(attendee.id);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ attendeeId: attendee.id }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal mengirim");
      if (data.attendee) onAttendeeChange((prev) => prev.map((a) => a.id === data.attendee.id ? data.attendee : a));
      showToast(`Undangan terkirim ke ${attendee.name}.`);
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setSendingId(null);
    }
  };

  const handleBulkSend = async (mode: "all" | "unsent") => {
    const targets = mode === "unsent"
      ? attendees.filter((a) => a.status === "draft" && a.email?.trim())
      : attendees.filter((a) => a.email?.trim());

    if (!targets.length) {
      showToast("Tidak ada peserta yang bisa dikirim.", "err");
      return;
    }

    if (!confirm(`Kirim undangan ke ${targets.length} peserta?`)) return;

    setBulkBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/send-invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          attendeeIds: mode === "all" ? "all" : targets.map((a) => a.id),
        }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal kirim bulk");
      // Refresh attendees by re-fetching
      const refreshRes = await fetch(`/api/attendees?eventId=${eventId}`, { credentials: "include" });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        onAttendeeChange(refreshData.attendees ?? []);
      }
      showToast(data.message ?? "Undangan berhasil dikirim.", data.failed > 0 ? "err" : "ok");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="Total Peserta" value={stats.total} icon={<Users size={16} className="text-slate-400" />} />
        <MiniStat label="Punya Email" value={stats.withEmail} icon={<Send size={16} className="text-[#40916C]" />} />
        <MiniStat label="Belum Dikirim" value={stats.notSent} icon={<Send size={16} className="text-amber-500" />} />
        <MiniStat label="Sudah Dikirim" value={stats.sent} icon={<CheckCircle2 size={16} className="text-emerald-600" />} />
      </div>

      {/* Bulk send actions */}
      <div className="rounded-2xl bg-white border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-[#1A1A2E] mb-1">Kirim Massal</h3>
        <p className="text-xs text-slate-500 mb-4">
          Email HTML dengan QR code terembed akan dikirim ke setiap peserta.
          Memerlukan konfigurasi SMTP di environment variable.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handleBulkSend("unsent")}
            disabled={bulkBusy || stats.notSent === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#40916C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkBusy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Kirim ke yang belum ({stats.notSent})
          </button>
          <button
            type="button"
            onClick={() => handleBulkSend("all")}
            disabled={bulkBusy || stats.withEmail === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkBusy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Kirim ulang semua ({stats.withEmail})
          </button>
        </div>
      </div>

      {/* Per-attendee list */}
      <div className="rounded-2xl bg-white border border-slate-100 overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Status Pengiriman Per Peserta</p>
        </div>
        <table className="min-w-full divide-y divide-slate-50 text-sm">
          <thead className="bg-slate-50/50 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-5 py-3 text-left">Peserta</th>
              <th className="px-5 py-3 text-left hidden sm:table-cell">Email</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left hidden md:table-cell">Link Undangan</th>
              <th className="px-5 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {attendees.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50/40">
                <td className="px-5 py-3">
                  <p className="font-semibold text-[#1A1A2E]">{a.name}</p>
                  <p className="text-xs text-slate-400">{a.program}</p>
                </td>
                <td className="px-5 py-3 text-sm text-slate-500 hidden sm:table-cell">
                  {a.email || <span className="text-rose-400 text-xs">Tidak ada email</span>}
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusTheme[a.status].badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusTheme[a.status].dot}`} />
                    {statusTheme[a.status].label}
                  </span>
                  {a.sentAt && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(a.sentAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </td>
                <td className="px-5 py-3 hidden md:table-cell">
                  <a
                    href={`${APP_URL}/invite/${a.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#40916C] hover:underline truncate max-w-[200px] block"
                  >
                    /invite/{a.token.slice(0, 8)}…
                  </a>
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSendOne(a)}
                    disabled={sendingId === a.id || !a.email?.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:border-[#40916C] hover:text-[#1B4332] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {sendingId === a.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    Kirim
                  </button>
                </td>
              </tr>
            ))}
            {!attendees.length && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">
                  Belum ada peserta.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Event settings inline ───────────────────────────────────────────────────

function EventSettingsInline({
  event,
  onUpdated,
  onUnauthorized,
  showToast,
}: {
  event: EventData | null;
  onUpdated: (e: EventData) => void;
  onUnauthorized: () => void;
  showToast: (msg: string, type?: "ok" | "err") => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Partial<EventData>>({});

  useEffect(() => {
    if (event) setForm({
      name: event.name, description: event.description ?? "", date: event.date, time: event.time,
      timeEnd: event.timeEnd ?? "", venue: event.venue, gate: event.gate, status: event.status,
      yudisiumSchedule: event.yudisiumSchedule ?? "", yudisiumVenue: event.yudisiumVenue ?? "",
      yudisiumDresscode: event.yudisiumDresscode ?? "", wisudaDresscode: event.wisudaDresscode ?? "",
      univSchedule: event.univSchedule ?? "", univVenue: event.univVenue ?? "",
    });
  }, [event]);

  const handleSave = async () => {
    if (!event) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name, description: form.description, date: form.date, time: form.time,
          timeEnd: form.timeEnd, venue: form.venue, gate: form.gate, status: form.status,
          yudisiumSchedule: form.yudisiumSchedule, yudisiumVenue: form.yudisiumVenue,
          yudisiumDresscode: form.yudisiumDresscode, wisudaDresscode: form.wisudaDresscode,
          univSchedule: form.univSchedule, univVenue: form.univVenue,
        }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal menyimpan");
      onUpdated(data);
      setOpen(false);
      showToast("Acara diperbarui.");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  if (!event) return <p className="text-xs text-slate-400">Memuat…</p>;

  if (!open) {
    return (
      <div className="space-y-2 text-xs text-slate-600">
        <EventRow label="Status" value={event.status} />
        <EventRow label="Tanggal" value={event.date} />
        <EventRow label="Waktu" value={`${event.time}${event.timeEnd ? ` – ${event.timeEnd}` : ""}`} />
        <EventRow label="Lokasi" value={event.venue} />
        {event.yudisiumSchedule && <EventRow label="Jadwal Yudisium" value={event.yudisiumSchedule} />}
        {event.yudisiumVenue && <EventRow label="Lokasi Yudisium" value={event.yudisiumVenue} />}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#40916C] font-semibold hover:underline"
        >
          <Settings size={13} /> Edit Acara
        </button>
      </div>
    );
  }

  const sf = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-3">
      <InputField label="Nama" name="name" value={form.name ?? ""} onChange={sf("name")} />
      <InputField label="Tanggal" name="date" value={form.date ?? ""} onChange={sf("date")} />
      <InputField label="Waktu mulai" name="time" value={form.time ?? ""} onChange={sf("time")} />
      <InputField label="Waktu selesai" name="timeEnd" value={form.timeEnd ?? ""} onChange={sf("timeEnd")} />
      <InputField label="Lokasi" name="venue" value={form.venue ?? ""} onChange={sf("venue")} />
      <InputField label="Info registrasi" name="gate" value={form.gate ?? ""} onChange={sf("gate")} />
      <div className="pt-2 border-t border-slate-100 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-[#40916C]">Yudisium &amp; Wisuda</p>
        <InputField label="Jadwal Yudisium" name="yudisiumSchedule" value={form.yudisiumSchedule ?? ""} onChange={sf("yudisiumSchedule")} placeholder="cth. Jumat, 07.30 WIB" />
        <InputField label="Lokasi Yudisium" name="yudisiumVenue" value={form.yudisiumVenue ?? ""} onChange={sf("yudisiumVenue")} placeholder="cth. Gedung B Lantai 7" />
        <InputField label="Dresscode Yudisium" name="yudisiumDresscode" value={form.yudisiumDresscode ?? ""} onChange={sf("yudisiumDresscode")} placeholder="cth. Hitam putih, almamater" />
        <InputField label="Dresscode Wisuda Pelepasan" name="wisudaDresscode" value={form.wisudaDresscode ?? ""} onChange={sf("wisudaDresscode")} placeholder="cth. Batik dan kebaya" />
        <InputField label="Jadwal Wisuda Univ" name="univSchedule" value={form.univSchedule ?? ""} onChange={sf("univSchedule")} placeholder="cth. Minggu, 25 Oktober 2026" />
        <InputField label="Lokasi Wisuda Univ" name="univVenue" value={form.univVenue ?? ""} onChange={sf("univVenue")} placeholder="cth. Gedung Bundar UNISMA" />
      </div>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-semibold text-slate-600">Status</span>
        <select value={form.status ?? "ACTIVE"} onChange={sf("status")}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-[#1B4332] focus:outline-none">
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Aktif</option>
          <option value="COMPLETED">Selesai</option>
          <option value="CANCELLED">Dibatalkan</option>
        </select>
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={handleSave} disabled={busy}
          className="flex-1 py-2 rounded-lg bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#40916C] transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1">
          {busy && <Loader2 size={12} className="animate-spin" />}
          Simpan
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-slate-300 transition-colors">
          Batal
        </button>
      </div>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
        active
          ? "border-[#1B4332] text-[#1B4332]"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white border border-slate-100 px-4 py-3 flex items-center gap-3">
      {icon}
      <div>
        <p className="text-xl font-bold text-[#1A1A2E]">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function EventRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-[#1A1A2E] text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

function PlaceholderTab({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl bg-white border border-dashed border-slate-200 p-12 text-center">
      <div className="flex justify-center mb-4">{icon}</div>
      <h3 className="text-base font-semibold text-[#1A1A2E]">{title}</h3>
      <p className="text-sm text-slate-400 mt-1">{desc}</p>
    </div>
  );
}

function InputField({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-semibold text-slate-600">{label}</span>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#1A1A2E] placeholder:text-slate-400 focus:border-[#1B4332] focus:outline-none"
      />
    </label>
  );
}

type ActionVariant = "primary" | "outline" | "danger" | "warning" | "active";

function ActionBtn({
  onClick,
  loading,
  title,
  variant,
  icon,
}: {
  onClick: () => void;
  loading: boolean;
  title: string;
  variant: ActionVariant;
  icon: React.ReactNode;
}) {
  const cls: Record<ActionVariant, string> = {
    primary: "bg-[#1B4332] text-white hover:bg-[#40916C]",
    active: "bg-blue-600 text-white hover:bg-blue-700",
    outline: "border border-slate-200 text-slate-600 hover:border-slate-300",
    danger: "border border-rose-200 text-rose-600 hover:border-rose-300",
    warning: "border border-amber-200 text-amber-700 hover:border-amber-300",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title={title}
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${cls[variant]}`}
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : icon}
      <span className="hidden sm:inline">{title}</span>
    </button>
  );
}

// ─── Laporan Tab ──────────────────────────────────────────────────────────────

function LaporanTab({
  eventId,
  attendees,
  onUnauthorized,
  showToast,
}: {
  eventId: string;
  attendees: AttendeeRecord[];
  onUnauthorized: () => void;
  showToast: (msg: string, type?: "ok" | "err") => void;
}) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [xlsBusy, setXlsBusy] = useState(false);

  const total = attendees.length;
  const confirmed = attendees.filter((a) => a.status === "confirmed").length;
  const absent = attendees.filter((a) => a.status === "absent").length;
  const sent = attendees.filter((a) => a.status !== "draft").length;
  const rate = total ? Math.round((confirmed / total) * 100) : 0;

  const programs = new Map<string, { total: number; confirmed: number }>();
  for (const a of attendees) {
    const key = a.program || "Lainnya";
    const cur = programs.get(key) ?? { total: 0, confirmed: 0 };
    cur.total++;
    if (a.status === "confirmed") cur.confirmed++;
    programs.set(key, cur);
  }
  const programList = Array.from(programs.entries())
    .sort((a, b) => b[1].confirmed - a[1].confirmed);

  const timeline = [...attendees]
    .filter((a) => a.status === "confirmed" && a.confirmedAt)
    .sort((a, b) => new Date(a.confirmedAt!).getTime() - new Date(b.confirmedAt!).getTime())
    .slice(0, 20);

  const handleExport = async (format: "pdf" | "excel") => {
    const setBusy = format === "pdf" ? setPdfBusy : setXlsBusy;
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/export?format=${format}`, {
        credentials: "include",
      });
      if (res.status === 401) { onUnauthorized(); return; }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? `Gagal ekspor ${format}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `rekap-kehadiran-${date}.${format === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast(`Berhasil mengunduh rekap ${format.toUpperCase()}.`);
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MiniStat label="Total Peserta" value={total} icon={<Users size={16} className="text-slate-400" />} />
        <MiniStat label="Terkirim" value={sent} icon={<Send size={16} className="text-amber-500" />} />
        <MiniStat label="Konfirmasi Hadir" value={confirmed} icon={<CheckCircle2 size={16} className="text-emerald-600" />} />
        <MiniStat label="Tidak Hadir" value={absent} icon={<UserX size={16} className="text-rose-500" />} />
        <MiniStat label="Response Rate" value={`${rate}%`} icon={<FileText size={16} className="text-[#40916C]" />} />
      </div>

      {/* Export buttons */}
      <div className="rounded-2xl bg-white border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-[#1A1A2E] mb-1">Ekspor Laporan</h3>
        <p className="text-xs text-slate-500 mb-4">
          PDF berisi laporan resmi dengan kop institusi. Excel berisi data mentah lengkap dua sheet: detail peserta &amp; ringkasan per prodi.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            disabled={pdfBusy || !total}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#40916C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pdfBusy ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
            Unduh PDF
          </button>
          <button
            type="button"
            onClick={() => handleExport("excel")}
            disabled={xlsBusy || !total}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {xlsBusy ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
            Unduh Excel (.xlsx)
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Per-program breakdown */}
        <div className="rounded-2xl bg-white border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-[#1A1A2E] mb-4">Rekap per Program Studi</h3>
          {programList.length === 0 ? (
            <p className="text-sm text-slate-400">Belum ada data.</p>
          ) : (
            <div className="space-y-3">
              {programList.map(([prog, stat]) => {
                const pct = stat.total ? Math.round((stat.confirmed / stat.total) * 100) : 0;
                return (
                  <div key={prog}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-[#1A1A2E] truncate max-w-[60%]">{prog}</span>
                      <span className="text-xs text-slate-500">
                        {stat.confirmed}/{stat.total} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#40916C] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Timeline kedatangan */}
        <div className="rounded-2xl bg-white border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-[#1A1A2E] mb-4">
            Timeline Kedatangan
            {confirmed > 20 && (
              <span className="text-xs text-slate-400 font-normal ml-2">(20 pertama)</span>
            )}
          </h3>
          {timeline.length === 0 ? (
            <p className="text-sm text-slate-400">Belum ada peserta yang dikonfirmasi hadir.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {timeline.map((a) => (
                <div key={a.id} className="flex items-center gap-3 text-sm">
                  <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#40916C]" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#1A1A2E] truncate">{a.name}</p>
                    <p className="text-xs text-slate-400">{a.program}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                    {new Date(a.confirmedAt!).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Rundown Tab ──────────────────────────────────────────────────────────────

const emptyRundownForm = {
  timeStart: "",
  timeEnd: "",
  title: "",
  description: "",
  pic: "",
  technicalNotes: "",
  audioNotes: "",
};

function RundownTab({
  eventId,
  onUnauthorized,
  showToast,
}: {
  eventId: string;
  onUnauthorized: () => void;
  showToast: (msg: string, type?: "ok" | "err") => void;
}) {
  const [items, setItems] = useState<RundownItemRecord[]>([]);
  const [attachments, setAttachments] = useState<RundownAttachmentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [addForm, setAddForm] = useState(emptyRundownForm);
  const [addBusy, setAddBusy] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyRundownForm);
  const [editBusy, setEditBusy] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  const [attachForm, setAttachForm] = useState({ label: "", content: "" });
  const [attachBusy, setAttachBusy] = useState(false);
  const [editingAttachmentId, setEditingAttachmentId] = useState<string | null>(null);
  const [editAttachForm, setEditAttachForm] = useState({ label: "", content: "" });

  const fetchItems = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/rundown`, { credentials: "include" });
    if (res.status === 401) { onUnauthorized(); return; }
    if (!res.ok) throw new Error("Gagal memuat rundown");
    const data = await res.json();
    setItems(data.items ?? []);
  }, [eventId, onUnauthorized]);

  const fetchAttachments = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/rundown/attachments`, { credentials: "include" });
    if (res.status === 401) { onUnauthorized(); return; }
    if (!res.ok) throw new Error("Gagal memuat naskah");
    const data = await res.json();
    setAttachments(data.attachments ?? []);
  }, [eventId, onUnauthorized]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchItems(), fetchAttachments()])
      .catch((err) => showToast((err as Error).message, "err"))
      .finally(() => setLoading(false));
  }, [fetchItems, fetchAttachments, showToast]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!addForm.title.trim()) return;
    setAddBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/rundown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          timeStart: addForm.timeStart || undefined,
          timeEnd: addForm.timeEnd || undefined,
          title: addForm.title,
        }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal menambah item rundown");
      setItems((prev) => [...prev, data].sort((a, b) => a.order - b.order));
      setAddForm(emptyRundownForm);
      showToast("Item rundown ditambahkan.");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setAddBusy(false);
    }
  };

  const openEdit = (item: RundownItemRecord) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(item.id);
    setEditForm({
      timeStart: item.timeStart ?? "",
      timeEnd: item.timeEnd ?? "",
      title: item.title,
      description: item.description ?? "",
      pic: item.pic ?? "",
      technicalNotes: item.technicalNotes ?? "",
      audioNotes: item.audioNotes ?? "",
    });
  };

  const handleSaveEdit = async (itemId: string) => {
    setEditBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/rundown/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editForm),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal menyimpan perubahan");
      setItems((prev) => prev.map((it) => (it.id === data.id ? data : it)).sort((a, b) => a.order - b.order));
      setExpandedId(null);
      showToast("Perubahan disimpan.");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setEditBusy(false);
    }
  };

  const handleDelete = async (item: RundownItemRecord) => {
    if (!confirm(`Hapus item "${item.title}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    setActionId(item.id);
    try {
      const res = await fetch(`/api/events/${eventId}/rundown/${item.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.status === 401) { onUnauthorized(); return; }
      if (!res.ok) throw new Error("Gagal menghapus item");
      setItems((prev) => prev.filter((it) => it.id !== item.id));
      showToast("Item rundown dihapus.");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setActionId(null);
    }
  };

  const handleMove = async (item: RundownItemRecord, direction: "up" | "down") => {
    const sorted = [...items].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((it) => it.id === item.id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || swapIndex < 0 || swapIndex >= sorted.length) return;

    const neighbor = sorted[swapIndex];
    setActionId(item.id);
    try {
      const res = await fetch(`/api/events/${eventId}/rundown/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          items: [
            { id: item.id, order: neighbor.order },
            { id: neighbor.id, order: item.order },
          ],
        }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      if (!res.ok) throw new Error("Gagal mengubah urutan");
      setItems((prev) =>
        prev.map((it) => {
          if (it.id === item.id) return { ...it, order: neighbor.order };
          if (it.id === neighbor.id) return { ...it, order: item.order };
          return it;
        })
      );
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setActionId(null);
    }
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/events/${eventId}/rundown/import`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (res.status === 401) { onUnauthorized(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal mengimpor file");
      await Promise.all([fetchItems(), fetchAttachments()]);
      showToast(`Berhasil mengimpor ${data.imported} item rundown + ${data.attachments} naskah lampiran.`);
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setImportBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleAddAttachment = async (e: FormEvent) => {
    e.preventDefault();
    if (!attachForm.label.trim()) return;
    setAttachBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/rundown/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(attachForm),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal menambah naskah");
      setAttachments((prev) => [...prev, data]);
      setAttachForm({ label: "", content: "" });
      showToast("Naskah ditambahkan.");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setAttachBusy(false);
    }
  };

  const openEditAttachment = (attachment: RundownAttachmentRecord) => {
    if (editingAttachmentId === attachment.id) {
      setEditingAttachmentId(null);
      return;
    }
    setEditingAttachmentId(attachment.id);
    setEditAttachForm({ label: attachment.label, content: attachment.content });
  };

  const handleSaveAttachment = async (attachmentId: string) => {
    setAttachBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/rundown/attachments/${attachmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editAttachForm),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal menyimpan naskah");
      setAttachments((prev) => prev.map((a) => (a.id === data.id ? data : a)));
      setEditingAttachmentId(null);
      showToast("Naskah disimpan.");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setAttachBusy(false);
    }
  };

  const handleDeleteAttachment = async (attachment: RundownAttachmentRecord) => {
    if (!confirm(`Hapus naskah "${attachment.label}"?`)) return;
    setAttachBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/rundown/attachments/${attachment.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.status === 401) { onUnauthorized(); return; }
      if (!res.ok) throw new Error("Gagal menghapus naskah");
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
      showToast("Naskah dihapus.");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setAttachBusy(false);
    }
  };

  const sortedItems = useMemo(() => [...items].sort((a, b) => a.order - b.order), [items]);

  return (
    <div className="space-y-6">
      {/* Rundown items */}
      <div className="rounded-2xl bg-white border border-slate-100 p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-bold text-[#1A1A2E] flex items-center gap-2">
            <ListOrdered size={16} className="text-[#40916C]" /> Rundown Acara
          </h3>
          <div className="flex items-center gap-2">
            <a
              href={`/api/events/${eventId}/rundown/export?format=excel`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-slate-300"
            >
              Export Excel
            </a>
            <a
              href={`/api/events/${eventId}/rundown/export?format=pdf`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-slate-300"
            >
              Export PDF
            </a>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={importBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#40916C] disabled:opacity-50"
            >
              {importBusy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Import Excel
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="animate-spin text-[#40916C]" size={24} />
          </div>
        ) : sortedItems.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Belum ada item rundown. Tambahkan secara manual atau impor dari Excel.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {sortedItems.map((item, index) => (
              <div key={item.id}>
                <div className="flex items-center gap-3 py-2.5">
                  <span className="w-5 shrink-0 text-xs font-semibold text-slate-400 text-right">{item.order}</span>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(item)}>
                    <p className="text-sm font-medium text-[#1A1A2E] truncate">{item.title}</p>
                    <p className="text-xs text-slate-400">
                      {item.timeStart && item.timeEnd
                        ? `${item.timeStart} – ${item.timeEnd}`
                        : item.timeStart || item.timeEnd || "-"}
                      {item.durationMinutes != null ? ` • ${item.durationMinutes}'` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMove(item, "up")}
                      disabled={index === 0 || actionId === item.id}
                      title="Pindah ke atas"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#1B4332] hover:bg-slate-50 disabled:opacity-30"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(item, "down")}
                      disabled={index === sortedItems.length - 1 || actionId === item.id}
                      title="Pindah ke bawah"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#1B4332] hover:bg-slate-50 disabled:opacity-30"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <ActionBtn onClick={() => openEdit(item)} loading={false} title="Edit" variant="outline" icon={<Pencil size={12} />} />
                    <ActionBtn onClick={() => handleDelete(item)} loading={actionId === item.id} title="Hapus" variant="danger" icon={<Trash2 size={12} />} />
                  </div>
                </div>

                {expandedId === item.id && (
                  <div className="pb-4 pl-8 pr-2 space-y-3 bg-slate-50/60 rounded-xl">
                    <div className="grid grid-cols-2 gap-3 pt-3">
                      <InputField
                        label="Waktu Mulai"
                        name="timeStart"
                        value={editForm.timeStart}
                        placeholder="17.00"
                        onChange={(e) => setEditForm((f) => ({ ...f, timeStart: e.target.value }))}
                      />
                      <InputField
                        label="Waktu Selesai"
                        name="timeEnd"
                        value={editForm.timeEnd}
                        placeholder="18.50"
                        onChange={(e) => setEditForm((f) => ({ ...f, timeEnd: e.target.value }))}
                      />
                    </div>
                    <InputField
                      label="Judul Rangkaian Acara"
                      name="title"
                      value={editForm.title}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                      required
                    />
                    <TextAreaField
                      label="Deskripsi"
                      value={editForm.description}
                      onChange={(v) => setEditForm((f) => ({ ...f, description: v }))}
                    />
                    <TextAreaField
                      label="PIC / Koordinator"
                      value={editForm.pic}
                      onChange={(v) => setEditForm((f) => ({ ...f, pic: v }))}
                    />
                    <TextAreaField
                      label="Catatan Teknis"
                      value={editForm.technicalNotes}
                      onChange={(v) => setEditForm((f) => ({ ...f, technicalNotes: v }))}
                    />
                    <InputField
                      label="Musik / Audio"
                      name="audioNotes"
                      value={editForm.audioNotes}
                      onChange={(e) => setEditForm((f) => ({ ...f, audioNotes: e.target.value }))}
                    />
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(item.id)}
                        disabled={editBusy}
                        className="px-4 py-1.5 rounded-lg bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#40916C] disabled:opacity-50"
                      >
                        {editBusy ? "Menyimpan…" : "Simpan"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedId(null)}
                        className="px-4 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-slate-300"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add form */}
        <form onSubmit={handleAdd} className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-[100px_100px_1fr_auto] gap-2 items-end">
          <InputField
            label="Mulai"
            name="timeStart"
            value={addForm.timeStart}
            placeholder="17.00"
            onChange={(e) => setAddForm((f) => ({ ...f, timeStart: e.target.value }))}
          />
          <InputField
            label="Selesai"
            name="timeEnd"
            value={addForm.timeEnd}
            placeholder="18.50"
            onChange={(e) => setAddForm((f) => ({ ...f, timeEnd: e.target.value }))}
          />
          <InputField
            label="Rangkaian Acara"
            name="title"
            value={addForm.title}
            placeholder="Nama segmen acara"
            onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          <button
            type="submit"
            disabled={addBusy || !addForm.title.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#40916C] disabled:opacity-50 h-[34px]"
          >
            {addBusy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Tambah
          </button>
        </form>
      </div>

      {/* Attachments / naskah */}
      <div className="rounded-2xl bg-white border border-slate-100 p-5">
        <h3 className="text-sm font-bold text-[#1A1A2E] flex items-center gap-2 mb-4">
          <FileText size={16} className="text-[#40916C]" /> Naskah / Lampiran
        </h3>

        {attachments.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Belum ada naskah atau lampiran.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="rounded-xl border border-slate-100">
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <FileText size={14} className="text-slate-400 shrink-0" />
                  <span className="flex-1 text-sm font-medium text-[#1A1A2E] truncate">{attachment.label}</span>
                  <ActionBtn onClick={() => openEditAttachment(attachment)} loading={false} title="Edit" variant="outline" icon={<Pencil size={12} />} />
                  <ActionBtn onClick={() => handleDeleteAttachment(attachment)} loading={attachBusy} title="Hapus" variant="danger" icon={<Trash2 size={12} />} />
                </div>
                {editingAttachmentId === attachment.id && (
                  <div className="px-3 pb-3 space-y-2">
                    <InputField
                      label="Label"
                      name="label"
                      value={editAttachForm.label}
                      onChange={(e) => setEditAttachForm((f) => ({ ...f, label: e.target.value }))}
                      required
                    />
                    <TextAreaField
                      label="Isi Naskah"
                      value={editAttachForm.content}
                      onChange={(v) => setEditAttachForm((f) => ({ ...f, content: v }))}
                      rows={6}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveAttachment(attachment.id)}
                        disabled={attachBusy}
                        className="px-4 py-1.5 rounded-lg bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#40916C] disabled:opacity-50"
                      >
                        Simpan
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingAttachmentId(null)}
                        className="px-4 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-slate-300"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddAttachment} className="pt-3 border-t border-slate-100 space-y-2">
          <InputField
            label="Label Naskah"
            name="label"
            value={attachForm.label}
            placeholder="Naskah Serah Terima"
            onChange={(e) => setAttachForm((f) => ({ ...f, label: e.target.value }))}
            required
          />
          <TextAreaField
            label="Isi Naskah"
            value={attachForm.content}
            onChange={(v) => setAttachForm((f) => ({ ...f, content: v }))}
            rows={4}
          />
          <button
            type="submit"
            disabled={attachBusy || !attachForm.label.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#40916C] disabled:opacity-50"
          >
            {attachBusy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Tambah Naskah
          </button>
        </form>
      </div>
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-semibold text-slate-600">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#1A1A2E] placeholder:text-slate-400 focus:border-[#1B4332] focus:outline-none resize-y"
      />
    </label>
  );
}
