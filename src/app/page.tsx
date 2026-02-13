"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import {
  CalendarDays,
  CheckCircle2,
  LineChart,
  Loader2,
  LogOut,
  QrCode,
  Send,
  Smartphone,
  Trash2,
  Users,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { AttendeeRecord, InviteStatus } from "@/lib/storage";

type EventRecord = {
  id: string;
  name: string;
  date: string;
  time: string;
  schedule: string;
  venue: string;
  gate: string;
  linkPrefix: string;
  createdAt: string;
  updatedAt: string;
};

const buildInviteLink = (id: string, linkPrefix?: string) => {
  const base = (linkPrefix || "https://undangan.ftunisma.online/invite").replace(
    /\/$/,
    ""
  );
  return `${base}/${encodeURIComponent(id)}`;
};

const statusTheme: Record<
  InviteStatus,
  { label: string; badge: string; dot: string }
> = {
  draft: {
    label: "Belum dikirim",
    badge: "bg-slate-100 text-slate-700",
    dot: "bg-slate-500",
  },
  sent: {
    label: "Menunggu konfirmasi",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
  },
  confirmed: {
    label: "Sudah konfirmasi",
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
  },
};

const statusOrder: InviteStatus[] = ["draft", "sent", "confirmed"];

export default function Home() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState({
    name: "",
    date: "",
    time: "",
    venue: "",
    gate: "",
  });
  const [eventBusy, setEventBusy] = useState(false);
  const [attendees, setAttendees] = useState<AttendeeRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const FALLBACK_PROGRAM = "Belum ditentukan";
  const FALLBACK_SEAT = "-";

  const [formData, setFormData] = useState({
    name: "",
    program: "",
    email: "",
    npm: "",
    seat: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [formBusy, setFormBusy] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [emailActionId, setEmailActionId] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(5);
  const [pageIndex, setPageIndex] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | InviteStatus>("all");
  const redirectRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [defaultProgram, setDefaultProgram] = useState("Belum ditentukan");
  const [defaultSeat, setDefaultSeat] = useState("-");

  const handleUnauthorized = useCallback(() => {
    if (redirectRef.current) return;
    redirectRef.current = true;
    const target = encodeURIComponent(window.location.pathname);
    window.location.href = `/auth/login?redirect=${target}`;
  }, []);

  const handleSignOut = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/auth/login";
  }, []);

  const handleCreateEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !eventForm.name.trim() ||
      !eventForm.date.trim() ||
      !eventForm.time.trim() ||
      !eventForm.venue.trim() ||
      !eventForm.gate.trim()
    ) {
      setError("Lengkapi data acara terlebih dahulu.");
      return;
    }

    setEventBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(eventForm),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal membuat acara.");

      const created = data as EventRecord;
      setEvents((prev) => [created, ...prev]);
      setSelectedEventId(created.id);
      setEventForm({ name: "", date: "", time: "", venue: "", gate: "" });
      await fetchAttendees(created.id);
      setFeedback("Acara baru berhasil dibuat.");
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEventBusy(false);
    }
  };

  const handleChangeEvent = async (nextId: string) => {
    setSelectedEventId(nextId);
    setSelectedId(null);
    await fetchAttendees(nextId);
  };

  const fetchAttendees = useCallback(async (eventId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/attendees?eventId=${encodeURIComponent(eventId)}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) throw new Error("Gagal memuat data peserta");
      const data = (await res.json()) as { attendees: AttendeeRecord[] };
      setAttendees(data.attendees ?? []);
      setSelectedId((prev) => prev ?? data.attendees?.[0]?.id ?? null);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [handleUnauthorized]);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events", {
        cache: "no-store",
        credentials: "include",
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) throw new Error("Gagal memuat data acara");
      const data = (await res.json()) as { events: EventRecord[] };
      const nextEvents = data.events ?? [];
      setEvents(nextEvents);

      if (!nextEvents.length) return;

      const nextSelected =
        selectedEventId && nextEvents.some((ev) => ev.id === selectedEventId)
          ? selectedEventId
          : nextEvents[0].id;

      setSelectedEventId(nextSelected);
      await fetchAttendees(nextSelected);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [fetchAttendees, handleUnauthorized, selectedEventId]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const selectedEvent =
    events.find((item) => item.id === selectedEventId) ?? events[0] ?? null;

  const selectedAttendee =
    attendees.find((item) => item.id === selectedId) ?? attendees[0] ?? null;

  const stats = useMemo(() => {
    const total = attendees.length;
    const confirmed = attendees.filter(
      (item) => item.status === "confirmed"
    ).length;
    const sent = attendees.filter((item) => item.status !== "draft").length;
    const pendingScan = attendees.filter(
      (item) => item.status === "sent"
    ).length;

    return {
      total,
      confirmed,
      sent,
      pendingScan,
      responseRate: total ? Math.round((confirmed / total) * 100) : 0,
    };
  }, [attendees]);

  const filteredAttendees = useMemo(() => {
    const copy = [...attendees];
    const term = searchTerm.toLowerCase().trim();
    copy.sort((a, b) => {
      if (a.status === b.status) {
        return a.name.localeCompare(b.name);
      }
      return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
    });
    const filtered = copy.filter((item) => {
      const matchesSearch = term
        ? [item.name, item.program, item.email, item.npm, item.id].some(
            (value) => value.toLowerCase().includes(term)
          )
        : true;
      const matchesStatus =
        statusFilter === "all" ? true : item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    const totalPages = Math.min(
      5,
      Math.max(1, Math.ceil(filtered.length / pageSize))
    );
    if (pageIndex > totalPages) {
      setPageIndex(totalPages);
    }
    const start = (pageIndex - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [attendees, searchTerm, pageSize, pageIndex, statusFilter]);

  const handleFormChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAddAttendee = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEventId) return;
    if (!formData.name || !formData.email) return;

    setFormBusy(true);
    try {
      const res = await fetch("/api/attendees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...formData,
          eventId: selectedEventId,
          program: formData.program.trim() || FALLBACK_PROGRAM,
          email: formData.email.trim(),
          npm: formData.npm.trim() || "-",
          seat: formData.seat.trim() || FALLBACK_SEAT,
        }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal menambah peserta");

      setAttendees((prev) => [...prev, data]);
      setSelectedId(data.id);
      setFormData({ name: "", program: "", email: "", npm: "", seat: "" });
      setFeedback("Data peserta tersimpan.");
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setFormBusy(false);
    }
  };

  const syncUpdatedAttendee = (updated: AttendeeRecord) => {
    setAttendees((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  };

  const handleSendEmail = async (attendee: AttendeeRecord) => {
    setEmailActionId(attendee.id);
    setFeedback(null);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ attendeeId: attendee.id }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal mengirim pesan");

      if (data.attendee) {
        syncUpdatedAttendee(data.attendee as AttendeeRecord);
      }

      setFeedback(data.message ?? "Undangan berhasil dikirim via email.");
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEmailActionId(null);
    }
  };

  const handleDownloadReport = async () => {
    if (!selectedEventId) return;
    setReportBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/reports/attendance?eventId=${encodeURIComponent(selectedEventId)}`,
        {
        credentials: "include",
        }
      );
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) throw new Error("Gagal menyiapkan PDF.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rekap-kehadiran-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReportBusy(false);
    }
  };

  const toggleConfirmAttendance = async (attendee: AttendeeRecord) => {
    setActionId(attendee.id);
    setFeedback(null);
    try {
      const nextStatus = attendee.status === "confirmed" ? "sent" : "confirmed";
      const res = await fetch(`/api/attendees/${attendee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: nextStatus,
          confirmedAt:
            nextStatus === "confirmed" ? new Date().toISOString() : null,
        }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal memperbarui status");

      syncUpdatedAttendee(data as AttendeeRecord);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteAttendee = async (attendee: AttendeeRecord) => {
    const confirmed = window.confirm(
      `Hapus peserta ${attendee.name}? Tindakan ini tidak dapat dibatalkan.`
    );
    if (!confirmed) return;

    setDeleteId(attendee.id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/attendees/${attendee.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal menghapus peserta");

      setAttendees((prev) => prev.filter((item) => item.id !== attendee.id));
      setSelectedId((prev) => (prev === attendee.id ? null : prev));
      setFeedback("Peserta dihapus.");
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleteId(null);
    }
  };

  const handleImportCsv = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedEventId) return;
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Pilih file CSV terlebih dahulu.");
      return;
    }

    setImportBusy(true);
    setFeedback(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("defaultProgram", defaultProgram);
      form.append("defaultSeat", defaultSeat);
      form.append("eventId", selectedEventId);

      const res = await fetch("/api/attendees/import", {
        method: "POST",
        body: form,
        credentials: "include",
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal mengimpor CSV");

      await fetchAttendees(selectedEventId);
      setFeedback(`Berhasil menambah ${data.inserted} peserta.`);
      if (data.errors?.length) {
        setError(
          `Beberapa baris dilewati (${data.errors.length}). Contoh: ${data.errors[0].message}`
        );
      } else {
        setError(null);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 py-10 font-[family-name:var(--font-geist-sans)] text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 md:px-8">
        <header className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">
                Fakultas Teknik
              </p>
              <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">
                Sistem Pelepasan
              </h1>
              <p className="text-slate-600">
                Data peserta tersimpan di server melalui API route, siap
                digunakan panitia untuk distribusi email resmi dan validasi QR.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-300"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Keluar
              </button>
              <button
                type="button"
                onClick={() => selectedEventId && fetchAttendees(selectedEventId)}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-300"
              >
                Refresh data
              </button>
              <button
                type="button"
                onClick={handleDownloadReport}
                disabled={reportBusy}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {reportBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Unduh PDF
              </button>
              <a
                href="/scan"
                className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
              >
                <QrCode className="mr-2 h-4 w-4" />
                Mode Pemindai QR
              </a>
            </div>
          </div>
        </header>

        {(feedback || error) && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              error
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error ?? feedback}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard
            icon={<Users className="h-5 w-5 text-slate-500" />}
            label="Total undangan"
            value={stats.total}
            helper={isLoading ? "memuat..." : "seluruh program studi"}
          />
          <StatCard
            icon={<Send className="h-5 w-5 text-slate-500" />}
            label="Sudah dikirim"
            value={stats.sent}
            helper={`${Math.max(stats.total - stats.sent, 0)} draft`}
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5 text-slate-500" />}
            label="Konfirmasi hadir"
            value={stats.confirmed}
            helper={`${stats.responseRate}% response rate`}
          />
          <StatCard
            icon={<Smartphone className="h-5 w-5 text-slate-500" />}
            label="Menunggu scan"
            value={stats.pendingScan}
            helper="butuh verifikasi QR"
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-4 rounded-3xl bg-white p-6 shadow-sm lg:col-span-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-60 flex-1">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Acara Aktif
                </p>
                <select
                  value={selectedEventId ?? ""}
                  onChange={(e) => void handleChangeEvent(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  {!events.length && <option value="">Belum ada acara</option>}
                  {events.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <details className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-4">
              <summary className="cursor-pointer text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">
                Tambah Acara Baru
              </summary>
              <form onSubmit={handleCreateEvent} className="mt-4 grid gap-3 md:grid-cols-2">
                <FormField
                  label="Nama acara"
                  name="name"
                  placeholder="Nama acara"
                  value={eventForm.name}
                  onChange={(e) =>
                    setEventForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                />
                <FormField
                  label="Tanggal"
                  name="date"
                  placeholder="Jumat, 13 Februari 2026"
                  value={eventForm.date}
                  onChange={(e) =>
                    setEventForm((prev) => ({ ...prev, date: e.target.value }))
                  }
                  required
                />
                <FormField
                  label="Waktu"
                  name="time"
                  placeholder="17.45 WIB"
                  value={eventForm.time}
                  onChange={(e) =>
                    setEventForm((prev) => ({ ...prev, time: e.target.value }))
                  }
                  required
                />
                <FormField
                  label="Lokasi"
                  name="venue"
                  placeholder="Gedung Pascasarjana Lantai 7 Universitas Islam Malang"
                  value={eventForm.venue}
                  onChange={(e) =>
                    setEventForm((prev) => ({ ...prev, venue: e.target.value }))
                  }
                  required
                />
                <div className="md:col-span-2">
                  <FormField
                    label="Registrasi"
                    name="gate"
                    placeholder="Registrasi dibuka pukul 17.00 WIB"
                    value={eventForm.gate}
                    onChange={(e) =>
                      setEventForm((prev) => ({ ...prev, gate: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={eventBusy}
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {eventBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Simpan acara
                  </button>
                </div>
              </form>
            </details>
          </div>
          <div className="space-y-4 rounded-3xl bg-white p-6 shadow-sm lg:col-span-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Detail acara</h2>
                <p className="text-sm text-slate-500">
                  Informasi otomatis tersemat di undangan digital.
                </p>
              </div>
              <CalendarDays className="h-6 w-6 text-slate-400" />
            </div>
            <div className="space-y-4">
              <EventRow label="Nama acara" value={selectedEvent?.name ?? "-"} />
              <EventRow label="Tanggal" value={selectedEvent?.date ?? "-"} />
              <EventRow label="Waktu" value={selectedEvent?.time ?? "-"} />
              <EventRow label="Lokasi" value={selectedEvent?.venue ?? "-"} />
              <EventRow label="Registrasi" value={selectedEvent?.gate ?? "-"} />
            </div>
          </div>
          <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-lg lg:col-span-2">
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">
              undangan digital
            </p>
            <h3 className="mt-4 text-2xl font-semibold">
              Template Email siap kirim
            </h3>
            <p className="mt-3 text-sm text-slate-300">
              API menggunakan email resmi sehingga panitia tinggal tekan satu
              tombol untuk mengirim undangan.
            </p>
            <div className="mt-6 grid gap-4 text-sm">
              <div className="rounded-2xl border border-white/20 bg-white/5 p-3 backdrop-blur">
                <p className="text-xs text-slate-300">Contoh pengiriman email</p>
                <pre className="mt-2 text-xs text-emerald-200">
                  {`{
  to: "peserta@contoh.com",
  subject: "Undangan • Pelepasan Calon Wisudawan/wati",
  body: "Tautan undangan: undangan.ftunisma.online/invite/INV-001"
}`}
                </pre>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                Menampilkan {filteredAttendees.length} dari {attendees.length}{" "}
                peserta
              </p>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => setPageIndex((prev) => Math.max(1, prev - 1))}
                  disabled={pageIndex === 1}
                  className="rounded-full border border-slate-200 px-3 py-1 font-semibold transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Prev
                </button>
                <span>
                  Hal {pageIndex} /{" "}
                  {Math.min(
                    5,
                    Math.max(1, Math.ceil(attendees.length / pageSize))
                  )}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPageIndex((prev) =>
                      prev < Math.min(5, Math.ceil(attendees.length / pageSize))
                        ? prev + 1
                        : prev
                    )
                  }
                  disabled={
                    pageIndex >=
                    Math.min(5, Math.ceil(attendees.length / pageSize))
                  }
                  className="rounded-full border border-slate-200 px-3 py-1 font-semibold transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-2">
            <details
              open
              className="overflow-hidden rounded-3xl bg-white shadow-sm"
            >
              <summary className="cursor-pointer list-none bg-slate-50 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">
                Tambah peserta manual
              </summary>
              <form
                onSubmit={handleAddAttendee}
                className="space-y-5 px-6 pb-6 pt-4"
              >
                <div>
                  <h2 className="text-lg font-semibold">Tambah peserta</h2>
                  <p className="text-sm text-slate-500">
                    Simpan data peserta sekaligus lengkapi NPM.
                  </p>
                </div>
                <div className="space-y-4">
                  <FormField
                    label="Nama lengkap"
                    name="name"
                    placeholder="cth. Salsabila Rahma"
                    value={formData.name}
                    onChange={handleFormChange}
                    required
                  />
                  <FormField
                    label="Program studi (opsional)"
                    name="program"
                    placeholder="cth. Teknik Informatika"
                    value={formData.program}
                    onChange={handleFormChange}
                  />
                  <FormField
                    label="Email"
                    name="email"
                    placeholder="nama@email.com"
                    value={formData.email}
                    onChange={handleFormChange}
                    required
                  />
                  <FormField
                    label="NPM"
                    name="npm"
                    placeholder="cth. 21901053019"
                    value={formData.npm}
                    onChange={handleFormChange}
                  />
                  <FormField
                    label="Nomor kursi (opsional)"
                    name="seat"
                    placeholder="A25"
                    value={formData.seat}
                    onChange={handleFormChange}
                  />
                </div>
                <button
                  type="submit"
                  disabled={formBusy}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {formBusy && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Tambahkan peserta
                </button>
              </form>
            </details>

            <details className="overflow-hidden rounded-3xl border border-dashed border-slate-300 bg-white/80 shadow-sm">
              <summary className="cursor-pointer list-none bg-slate-50 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">
                Impor dari CSV
              </summary>
              <form
                onSubmit={handleImportCsv}
                className="space-y-4 px-6 pb-6 pt-4"
              >
                <div>
                  <h2 className="text-lg font-semibold">Impor dari CSV</h2>
                  <p className="text-sm text-slate-500">
                    Format kolom minimal:{" "}
                    <code className="font-mono">name</code>,{" "}
                    <code className="font-mono">email</code>. Kolom opsional:{" "}
                    <code className="font-mono">program</code>,{" "}
                    <code className="font-mono">npm</code>,{" "}
                    <code className="font-mono">seat</code>.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-white"
                  required
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-semibold text-slate-700">
                      Program default
                    </span>
                    <input
                      value={defaultProgram}
                      onChange={(e) => setDefaultProgram(e.target.value)}
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-semibold text-slate-700">
                      Nomor kursi default
                    </span>
                    <input
                      value={defaultSeat}
                      onChange={(e) => setDefaultSeat(e.target.value)}
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={importBusy}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {importBusy && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Impor CSV
                </button>
              </form>
            </details>
          </div>

          <div className="space-y-4 rounded-3xl bg-white p-6 shadow-sm lg:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Daftar peserta</h2>
                <p className="text-xs text-slate-500">
                  Ringkas dengan pencarian instan; kirim email & validasi QR dari
                  satu tempat.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="hidden text-sm text-slate-500 sm:block">
                  {isLoading
                    ? "Memuat..."
                    : `${stats.responseRate}% sudah konfirmasi`}
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as "all" | InviteStatus);
                    setPageIndex(1);
                  }}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  <option value="all">Semua status</option>
                  <option value="draft">Belum dikirim</option>
                  <option value="sent">Menunggu konfirmasi</option>
                  <option value="confirmed">Sudah konfirmasi</option>
                </select>
                <input
                  type="search"
                  placeholder="Cari nama / prodi / email / npm…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-56 rounded-2xl border border-slate-200 px-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPageIndex(1);
                  }}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  {[5, 10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}/halaman
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Peserta</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">NPM</th>
                    <th className="px-4 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredAttendees.map((attendee) => (
                    <tr key={attendee.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedId(attendee.id)}
                          className="text-left"
                        >
                          <p className="font-semibold text-slate-900">
                            {attendee.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {attendee.program}
                          </p>
                          <p className="text-xs text-slate-400">
                            {attendee.email}
                          </p>
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                            statusTheme[attendee.status].badge
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              statusTheme[attendee.status].dot
                            }`}
                          />
                          {statusTheme[attendee.status].label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {attendee.npm}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleSendEmail(attendee)}
                            disabled={emailActionId === attendee.id}
                            className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {emailActionId === attendee.id ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Kirim Email
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleConfirmAttendance(attendee)}
                            disabled={actionId === attendee.id}
                            className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {actionId === attendee.id ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            {attendee.status === "confirmed"
                              ? "Batalkan"
                              : "Konfirmasi"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAttendee(attendee)}
                            disabled={deleteId === attendee.id}
                            className="inline-flex items-center rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deleteId === attendee.id ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filteredAttendees.length && !isLoading && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-6 text-center text-sm text-slate-500"
                      >
                        Belum ada data peserta. Tambahkan melalui formulir di
                        sebelah kiri.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {selectedAttendee && (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    QR konfirmasi
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    {selectedAttendee.name}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {buildInviteLink(
                      selectedAttendee.id,
                      selectedEvent?.linkPrefix
                    )}
                  </p>
                </div>
                <QrCode className="h-6 w-6 text-slate-300" />
              </div>
              <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-6">
                <QRCodeSVG
                  value={JSON.stringify({
                    inviteId: selectedAttendee.id,
                    name: selectedAttendee.name,
                    npm: selectedAttendee.npm,
                  })}
                  size={180}
                />
                <p className="text-center text-xs text-slate-500">
                  Tunjukkan QR ini pada meja registrasi atau pindai melalui
                  halaman /scan untuk sinkron real-time.
                </p>
              </div>
            </div>
            <div className="space-y-4 rounded-3xl bg-slate-900 p-6 text-white shadow-lg">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">
                Timeline konfirmasi
              </p>
              <ul className="space-y-4 text-sm">
                  <TimelineItem
                    title="Undangan dibuat"
                    value={new Date(selectedAttendee.createdAt).toLocaleString(
                      "id-ID"
                    )}
                  />
                <TimelineItem
                  title="Terkirim via Email"
                  value={
                    selectedAttendee.emailSent
                      ? "Sudah dikirim"
                      : "Belum dikirim"
                  }
                />
                <TimelineItem
                  title="QR discan"
                  value={
                    selectedAttendee.status === "confirmed"
                      ? new Date(
                          selectedAttendee.confirmedAt ??
                            selectedAttendee.updatedAt
                        ).toLocaleString("id-ID")
                      : "Menunggu scan"
                  }
                />
              </ul>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    catatan panitia
                  </p>
                <p className="mt-2">
                  Gunakan mode pemindai pada perangkat mobile panitia untuk
                  mempercepat registrasi dan mengurangi antrean.
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Konversi hadir
                </p>
                <h3 className="mt-2 text-2xl font-semibold">
                  {stats.responseRate}%
                </h3>
              </div>
              <LineChart className="h-6 w-6 text-slate-300" />
            </div>
            <div className="mt-6 space-y-2 text-sm">
              <ProgressRow label="Konfirmasi" value={stats.responseRate} />
              <ProgressRow
                label="Belum merespons"
                value={100 - stats.responseRate}
                tone="bg-amber-200"
              />
            </div>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Rekap program studi
            </p>
            <div className="mt-4 space-y-3 text-sm">
              {[...new Set(attendees.map((item) => item.program))].map(
                (program) => {
                  const total = attendees.filter(
                    (item) => item.program === program
                  ).length;
                  const confirmed = attendees.filter(
                    (item) =>
                      item.program === program && item.status === "confirmed"
                  ).length;
                  return (
                    <div
                      key={program}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {program}
                        </p>
                        <p className="text-xs text-slate-500">
                          {confirmed}/{total} hadir
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-emerald-600">
                        {total ? Math.round((confirmed / total) * 100) : 0}%
                      </span>
                    </div>
                  );
                }
              )}
              {!attendees.length && (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-500">
                  Data program akan muncul otomatis setelah peserta
                  ditambahkan.
                </p>
              )}
            </div>
          </div>
          <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-lg">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
              Alur scan QR
            </p>
            <h3 className="mt-2 text-xl font-semibold">
              Validasi langsung di pintu masuk
            </h3>
            <ol className="mt-4 space-y-3 text-sm text-slate-200">
              <li>1. Petugas membuka halaman /scan pada perangkat mobile.</li>
              <li>
                2. QR tamu dipindai, endpoint /api/attendees/[id]/confirm
                menandai status hadir.
              </li>
              <li>3. Dashboard ini otomatis menggambarkan progres terbaru.</li>
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        {icon}
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
          realtime
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-xs text-slate-400">{helper}</p>
    </div>
  );
}

function FormField(
  props: InputHTMLAttributes<HTMLInputElement> & {
    label: string;
  }
) {
  const { label, ...rest } = props;
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-semibold text-slate-700">{label}</span>
      <input
        {...rest}
        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
      />
    </label>
  );
}

function EventRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function TimelineItem({ title, value }: { title: string; value?: string }) {
  return (
    <li className="flex items-start gap-3">
      <div className="mt-1 h-2 w-2 rounded-full bg-emerald-300" />
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          {title}
        </p>
        <p className="text-sm text-white">{value || "-"}</p>
      </div>
    </li>
  );
}

function ProgressRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${tone || "bg-emerald-400"}`}
          style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}
