"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCcw,
  Search,
  Upload,
  UserPlus,
  Video,
  VideoOff,
} from "lucide-react";

type Student = {
  mahasiswaId: string;
  npm: string;
  name: string;
  email: string | null;
  fakultasStatus: string | null;
  univStatus: string | null;
  pickedUp: boolean;
  handedAt: string | null;
  undanganGiven: boolean;
  togaGiven: boolean;
  checkStatus: "pending" | "valid" | "issue" | null;
  checkNote: string | null;
  yudisiumStatus: string | null;
};

type SlotKey = "fakultas" | "univ" | "handover";
const SLOTS: { key: SlotKey; label: string; hint: string }[] = [
  { key: "fakultas", label: "Bukti Bayar Fakultas", hint: "Wisuda pelepasan fakultas" },
  { key: "univ", label: "Bukti Bayar Univ", hint: "Wisuda universitas" },
  { key: "handover", label: "Foto Serah-Terima", hint: "Mahasiswa + undangan/toga" },
];

const MAX_SIDE = 1280;

function toResizedDataUri(source: CanvasImageSource, width: number, height: number): string {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

function fileToResizedDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(toResizedDataUri(img, img.naturalWidth, img.naturalHeight));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => reject(new Error("Gambar tidak dapat dibaca"));
    img.src = url;
  });
}

const badge = (text: string, tone: "ok" | "wait" | "bad" | "muted") => {
  const cls = {
    ok: "bg-emerald-100 text-emerald-700",
    wait: "bg-amber-100 text-amber-700",
    bad: "bg-rose-100 text-rose-700",
    muted: "bg-slate-100 text-slate-600",
  }[tone];
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>{text}</span>;
};

const payTone = (s: string | null): "ok" | "wait" | "bad" | "muted" =>
  s === "approved" ? "ok" : s === "desk" || s === "pending" ? "wait" : s === "rejected" ? "bad" : "muted";

export default function PengambilanPage() {
  const { id: eventId } = useParams<{ id: string }>();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [searching, setSearching] = useState(false);

  const [showRegister, setShowRegister] = useState(false);
  const [regForm, setRegForm] = useState({ name: "", npm: "", email: "" });
  const [regBusy, setRegBusy] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<SlotKey>("fakultas");
  const [photos, setPhotos] = useState<Record<SlotKey, string | null>>({ fakultas: null, univ: null, handover: null });
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [undanganGiven, setUndanganGiven] = useState(true);
  const [togaGiven, setTogaGiven] = useState(true);
  const [skipUniv, setSkipUniv] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const [rekap, setRekap] = useState<Student[]>([]);
  const [totals, setTotals] = useState({ registered: 0, pickedUp: 0, pendingCheck: 0, issues: 0 });

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadRekap = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/pengambilan/rekap`, { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setRekap(data.rows ?? []);
    setTotals(data.totals ?? { registered: 0, pickedUp: 0, pendingCheck: 0, issues: 0 });
  }, [eventId]);

  useEffect(() => {
    void loadRekap();
  }, [loadRekap]);

  useEffect(() => {
    const stream = streamRef.current;
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  // search (debounced)
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/events/${eventId}/pengambilan?q=${encodeURIComponent(query)}`, {
        credentials: "include",
      });
      if (res.ok) setResults((await res.json()).students ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, eventId]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setCameraError("Kamera tidak bisa diakses (izin ditolak / butuh HTTPS). Gunakan tombol Unggah File sebagai gantinya.");
      setCameraOn(false);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  const nextEmptySlot = (current: SlotKey, nextPhotos: Record<SlotKey, string | null>): SlotKey => {
    const order = SLOTS.map((s) => s.key);
    const start = order.indexOf(current);
    for (let i = 1; i <= order.length; i++) {
      const key = order[(start + i) % order.length];
      if (!nextPhotos[key]) return key;
    }
    return current;
  };

  const setPhoto = (slot: SlotKey, dataUri: string) => {
    const next = { ...photos, [slot]: dataUri };
    setPhotos(next);
    setActiveSlot(nextEmptySlot(slot, next));
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setPhoto(activeSlot, toResizedDataUri(video, video.videoWidth, video.videoHeight));
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setPhoto(activeSlot, await fileToResizedDataUri(file));
    } catch (err) {
      showToast((err as Error).message, "err");
    }
    e.target.value = "";
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/pengambilan/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(regForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal mendaftarkan");
      setNewPassword(data.password);
      setSelected({
        mahasiswaId: data.mahasiswa.id,
        npm: data.mahasiswa.npm,
        name: data.mahasiswa.name,
        email: data.mahasiswa.email,
        fakultasStatus: null,
        univStatus: null,
        pickedUp: false,
        handedAt: null,
        undanganGiven: false,
        togaGiven: false,
        checkStatus: null,
        checkNote: null,
        yudisiumStatus: null,
      });
      setShowRegister(false);
      setRegForm({ name: "", npm: "", email: "" });
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setRegBusy(false);
    }
  };

  const resetForm = () => {
    setSelected(null);
    setPhotos({ fakultas: null, univ: null, handover: null });
    setActiveSlot("fakultas");
    setNote("");
    setSkipUniv(false);
    setUndanganGiven(true);
    setTogaGiven(true);
    setNewPassword(null);
    setQuery("");
    setResults([]);
  };

  const canSave =
    selected &&
    photos.fakultas &&
    photos.handover &&
    (skipUniv ? note.trim() : photos.univ) &&
    (undanganGiven || togaGiven);

  const handleSave = async () => {
    if (!selected || !canSave) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}/pengambilan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mahasiswaId: selected.mahasiswaId,
          fakultas: photos.fakultas,
          univ: skipUniv ? undefined : photos.univ,
          handover: photos.handover,
          undanganGiven,
          togaGiven,
          skipUniv,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal menyimpan");
      showToast(`Serah-terima ${selected.name} tersimpan.`);
      resetForm();
      void loadRekap();
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href={`/events/${eventId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#1B4332] transition-colors"
      >
        <ArrowLeft size={15} /> Kembali ke Acara
      </Link>

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#40916C]">Meja Pengambilan</p>
        <h1 className="mt-1 text-xl font-bold text-[#1A1A2E]">Serah-Terima Undangan &amp; Toga</h1>
        <p className="text-sm text-slate-500 mt-1">
          Foto bukti bayar &amp; serah-terima disimpan, lalu diverifikasi susulan oleh WD2.
        </p>
      </div>

      {toast && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            toast.type === "err"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-5">
        {/* Kiri: pencarian mahasiswa */}
        <div className="rounded-2xl bg-white border border-slate-100 p-5 space-y-4">
          <h3 className="text-sm font-bold text-[#1A1A2E]">1. Pilih Mahasiswa</h3>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari NPM atau nama…"
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm focus:border-[#1B4332] focus:outline-none"
            />
            {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
          </div>

          {results.length > 0 && !selected && (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
              {results.map((s) => (
                <button
                  key={s.mahasiswaId}
                  onClick={() => {
                    setSelected(s);
                    setResults([]);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#1A1A2E]">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.npm}</p>
                  </div>
                  {s.pickedUp && badge("Sudah ambil", "ok")}
                </button>
              ))}
            </div>
          )}

          {query.trim().length >= 2 && !searching && results.length === 0 && !selected && (
            <p className="text-xs text-slate-400">Tidak ditemukan. Daftarkan sebagai mahasiswa baru di bawah.</p>
          )}

          {!selected && (
            <>
              <button
                onClick={() => setShowRegister((v) => !v)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#40916C]"
              >
                <UserPlus size={15} /> Daftarkan mahasiswa baru
              </button>
              {showRegister && (
                <form onSubmit={handleRegister} className="space-y-2 rounded-xl bg-slate-50 p-4">
                  <input
                    required
                    placeholder="Nama lengkap"
                    value={regForm.name}
                    onChange={(e) => setRegForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <input
                    required
                    placeholder="NPM"
                    value={regForm.npm}
                    onChange={(e) => setRegForm((f) => ({ ...f, npm: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <input
                    type="email"
                    placeholder="Email (opsional)"
                    value={regForm.email}
                    onChange={(e) => setRegForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={regBusy}
                    className="w-full rounded-lg bg-[#1B4332] text-white text-sm font-semibold py-2.5 disabled:opacity-50"
                  >
                    {regBusy ? "Mendaftarkan…" : "Daftarkan & Pilih"}
                  </button>
                </form>
              )}
            </>
          )}

          {selected && (
            <div className="rounded-xl border border-[#40916C]/30 bg-[#F8FAF9] p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-[#1A1A2E]">{selected.name}</p>
                  <p className="text-xs text-slate-500">{selected.npm}</p>
                </div>
                <button onClick={resetForm} className="text-xs text-slate-500 underline">
                  Ganti
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {badge(`Fakultas: ${selected.fakultasStatus ?? "belum"}`, payTone(selected.fakultasStatus))}
                {badge(`Univ: ${selected.univStatus ?? "belum"}`, payTone(selected.univStatus))}
                {selected.pickedUp && badge("Pernah diserahkan", "ok")}
              </div>
              {newPassword && (
                <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs">
                  Akun baru dibuat. Password mahasiswa (tampil sekali):{" "}
                  <span className="font-mono font-bold text-sm">{newPassword}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Kanan: webcam + foto */}
        <div className="rounded-2xl bg-white border border-slate-100 p-5 space-y-4">
          <h3 className="text-sm font-bold text-[#1A1A2E]">2. Ambil Foto</h3>

          <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            {!cameraOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-300 text-sm px-6 text-center">
                <VideoOff size={28} />
                <span>Kamera belum aktif</span>
              </div>
            )}
          </div>
          {cameraError && <p className="text-xs text-rose-600">{cameraError}</p>}

          <div className="flex flex-wrap gap-2">
            {cameraOn ? (
              <>
                <button onClick={capture} className="inline-flex items-center gap-1.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold px-4 py-2.5">
                  <Camera size={15} /> Ambil: {SLOTS.find((s) => s.key === activeSlot)?.label}
                </button>
                <button onClick={stopCamera} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold px-4 py-2.5">
                  <VideoOff size={15} /> Matikan
                </button>
              </>
            ) : (
              <button onClick={startCamera} className="inline-flex items-center gap-1.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold px-4 py-2.5">
                <Video size={15} /> Nyalakan Kamera
              </button>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold px-4 py-2.5"
            >
              <Upload size={15} /> Unggah File
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {SLOTS.map((slot) => {
              const disabled = slot.key === "univ" && skipUniv;
              return (
                <button
                  key={slot.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => setActiveSlot(slot.key)}
                  className={`rounded-xl border p-2 text-left transition-colors ${
                    activeSlot === slot.key ? "border-[#1B4332] bg-[#F8FAF9]" : "border-slate-200"
                  } ${disabled ? "opacity-40" : ""}`}
                >
                  <div className="aspect-[4/3] rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center mb-2">
                    {photos[slot.key] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photos[slot.key]!} alt={slot.label} className="w-full h-full object-cover" />
                    ) : (
                      <Camera size={18} className="text-slate-300" />
                    )}
                  </div>
                  <p className="text-[11px] font-semibold text-[#1A1A2E] leading-tight">{slot.label}</p>
                  <p className="text-[10px] text-slate-400 leading-tight">{slot.hint}</p>
                  {photos[slot.key] && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhotos((p) => ({ ...p, [slot.key]: null }));
                        setActiveSlot(slot.key);
                      }}
                      className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-500 underline cursor-pointer"
                    >
                      <RefreshCcw size={10} /> Ulang
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={undanganGiven} onChange={(e) => setUndanganGiven(e.target.checked)} />
              Undangan diserahkan
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={togaGiven} onChange={(e) => setTogaGiven(e.target.checked)} />
              Toga diserahkan
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={skipUniv} onChange={(e) => setSkipUniv(e.target.checked)} />
              Lewati bukti univ (wajib isi catatan)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan (opsional)…"
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#1B4332] focus:outline-none"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1B4332] text-white text-sm font-semibold py-3 disabled:opacity-40"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            Simpan Serah-Terima
          </button>
        </div>
      </div>

      {/* Rekap */}
      <div className="rounded-2xl bg-white border border-slate-100 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-bold text-[#1A1A2E]">Rekap Pengambilan</h3>
          <a
            href={`/api/events/${eventId}/pengambilan/rekap?format=excel`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5"
          >
            <Download size={13} /> Ekspor Excel
          </a>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            ["Terdaftar", totals.registered],
            ["Sudah ambil", totals.pickedUp],
            ["Menunggu verifikasi WD2", totals.pendingCheck],
            ["Bermasalah", totals.issues],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-xl bg-[#F8FAF9] border border-slate-100 px-4 py-3">
              <p className="text-2xl font-bold text-[#1A1A2E]">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="py-2 pr-3">Nama</th>
                <th className="py-2 pr-3">NPM</th>
                <th className="py-2 pr-3">Fakultas</th>
                <th className="py-2 pr-3">Univ</th>
                <th className="py-2 pr-3">Pengambilan</th>
                <th className="py-2">Verifikasi WD2</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rekap.map((r) => (
                <tr key={r.mahasiswaId}>
                  <td className="py-2 pr-3 font-medium text-[#1A1A2E]">{r.name}</td>
                  <td className="py-2 pr-3 text-slate-500">{r.npm}</td>
                  <td className="py-2 pr-3">{badge(r.fakultasStatus ?? "-", payTone(r.fakultasStatus))}</td>
                  <td className="py-2 pr-3">{badge(r.univStatus ?? "-", payTone(r.univStatus))}</td>
                  <td className="py-2 pr-3">
                    {r.pickedUp ? badge("Sudah", "ok") : badge("Belum", "muted")}
                  </td>
                  <td className="py-2">
                    {r.checkStatus
                      ? badge(
                          r.checkStatus === "valid" ? "Valid" : r.checkStatus === "issue" ? "Bermasalah" : "Menunggu",
                          r.checkStatus === "valid" ? "ok" : r.checkStatus === "issue" ? "bad" : "wait"
                        )
                      : "-"}
                    {r.checkNote && <span className="block text-[11px] text-rose-600 mt-0.5">{r.checkNote}</span>}
                  </td>
                </tr>
              ))}
              {rekap.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Belum ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
