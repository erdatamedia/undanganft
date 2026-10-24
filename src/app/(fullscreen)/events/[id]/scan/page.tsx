"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Scanner } from "@yudiel/react-qr-scanner";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CameraOff,
  CheckCircle2,
  Keyboard,
  Maximize2,
  Minimize2,
  QrCode,
  Radio,
  Users,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { ScanNameSearch } from "@/components/scan-name-search";

type Agenda = "yudisium" | "pelepasan";
type Lane = "Scanner 1" | "Scanner 2" | "Manual" | "Nama";
type Mode = "omni" | "camera" | "off";

type Live = {
  eventName: string;
  dualAgenda: boolean;
  agenda: Agenda;
  total: number;
  hadir: number;
  hadirYudisium: number;
  hadirPelepasan: number;
  perProgram: { program: string; total: number; hadir: number }[];
  recent: { id: string; name: string; program: string; npm: string; at: string; agenda: Agenda }[];
};

type Outcome =
  | { kind: "idle" }
  | { kind: "success" | "already"; name: string; program: string; npm: string; seat: string; at: string; lane: Lane; agenda: Agenda }
  | { kind: "error"; message: string; lane: Lane };

type Job = { code: string; lane: Lane };

const time = (v: string) => new Date(v).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Mengambil kode undangan dari URL /invite/<token>, JSON {"inviteId"}, atau teks polos. */
function parseCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Kode undangan kosong.");
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parts = new URL(trimmed).pathname.split("/").filter(Boolean);
      const i = parts.findIndex((p) => p.toLowerCase() === "invite");
      if (i >= 0 && parts[i + 1]) return decodeURIComponent(parts[i + 1]);
    } catch {
      /* lanjut ke bentuk lain */
    }
  }
  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as { inviteId?: string };
    if (!parsed.inviteId) throw new Error("Payload scanner tidak memuat inviteId.");
    return parsed.inviteId;
  }
  return trimmed;
}

const normalizeId = (v: string) => v.trim().replace(/\s+/g, " ").toUpperCase();
const inNoCapture = (el: EventTarget | Element | null) =>
  Boolean((el as HTMLElement | null)?.closest?.("[data-name-search]"));

export default function EventScanPage() {
  const { id: eventId } = useParams<{ id: string }>();

  const [agenda, setAgenda] = useState<Agenda>("yudisium");
  const [live, setLive] = useState<Live | null>(null);
  const [online, setOnline] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  const [modes, setModes] = useState<{ a: Mode; b: Mode }>({ a: "omni", b: "camera" });
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [camA, setCamA] = useState("");
  const [camB, setCamB] = useState("");
  const [camOn, setCamOn] = useState<{ a: boolean; b: boolean }>({ a: false, b: false });
  const [manualCode, setManualCode] = useState("");

  const agendaRef = useRef(agenda);
  const soundRef = useRef(sound);
  const queueRef = useRef<Job[]>([]);
  const workingRef = useRef(false);
  const recentCodes = useRef(new Map<string, number>());
  const manualInputRef = useRef<HTMLInputElement>(null);
  const bufferRef = useRef("");
  const audioRef = useRef<AudioContext | null>(null);
  const prevRecentRef = useRef<string>("");

  const omniLane: Lane | null = modes.a === "omni" ? "Scanner 1" : modes.b === "omni" ? "Scanner 2" : null;
  const omniActive = omniLane !== null;

  useEffect(() => {
    agendaRef.current = agenda;
    soundRef.current = sound;
  }, [agenda, sound]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const beep = useCallback((ok: boolean) => {
    if (!soundRef.current) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioRef.current ??= new Ctx();
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = ok ? 880 : 220;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (ok ? 0.12 : 0.28));
    } catch {
      /* audio tidak tersedia */
    }
  }, []);

  // ── Data realtime (polling ringan tiap 2 detik) ──
  const loadLive = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/live?agenda=${agendaRef.current}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (res.status === 401) {
        window.location.href = `/auth/login?redirect=/events/${eventId}/scan`;
        return;
      }
      if (!res.ok) throw new Error("gagal");
      const data = (await res.json()) as Live;
      setLive(data);
      setOnline(true);
      setUpdatedAt(new Date().toISOString());

      // tandai check-in baru agar menyala sebentar
      const signature = data.recent.map((r) => `${r.id}:${r.at}`).join("|");
      if (prevRecentRef.current && signature !== prevRecentRef.current) {
        const known = new Set(prevRecentRef.current.split("|"));
        const fresh = new Set(data.recent.filter((r) => !known.has(`${r.id}:${r.at}`)).map((r) => `${r.id}:${r.at}`));
        if (fresh.size) {
          setFreshIds(fresh);
          setTimeout(() => setFreshIds(new Set()), 2500);
        }
      }
      prevRecentRef.current = signature;
    } catch {
      setOnline(false);
    }
  }, [eventId]);

  useEffect(() => {
    const tick = () => {
      if (!document.hidden) void loadLive();
    };
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 2000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [loadLive, agenda]);

  // ── Antrean scan: scan dari dua scanner diproses berurutan, tidak ada yang terlewat ──
  const runJob = useCallback(
    async (job: Job) => {
      try {
        const id = normalizeId(parseCode(job.code));
        const res = await fetch(`/api/attendees/${encodeURIComponent(id)}/confirm`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agenda: agendaRef.current }),
        });
        if (res.status === 401) {
          window.location.href = `/auth/login?redirect=/events/${eventId}/scan`;
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "QR tidak valid");
        const at =
          agendaRef.current === "pelepasan" ? data.pelepasanConfirmedAt ?? data.updatedAt : data.confirmedAt ?? data.updatedAt;
        setOutcome({
          kind: data.alreadyConfirmed ? "already" : "success",
          name: data.name,
          program: data.program,
          npm: data.npm,
          seat: data.seat,
          at,
          lane: job.lane,
          agenda: agendaRef.current,
        });
        beep(!data.alreadyConfirmed);
        void loadLive();
      } catch (err) {
        setOutcome({ kind: "error", message: (err as Error).message, lane: job.lane });
        beep(false);
      }
    },
    [beep, eventId, loadLive]
  );

  const pump = useCallback(async () => {
    if (workingRef.current) return;
    workingRef.current = true;
    setBusy(true);
    try {
      while (queueRef.current.length) {
        const job = queueRef.current.shift()!;
        await runJob(job);
      }
    } finally {
      workingRef.current = false;
      setBusy(false);
    }
  }, [runJob]);

  const submit = useCallback(
    (code: string, lane: Lane) => {
      const clean = code.trim();
      if (!clean) return;
      // Kamera memindai terus-menerus: abaikan kode yang sama dalam 4 detik; keyboard 1,5 detik.
      const key = `${lane === "Scanner 1" || lane === "Scanner 2" ? "s" : lane}:${clean}`;
      const nowMs = Date.now();
      const last = recentCodes.current.get(key) ?? 0;
      if (nowMs - last < (lane === "Manual" || lane === "Nama" ? 800 : 4000)) return;
      recentCodes.current.set(key, nowMs);
      queueRef.current.push({ code: clean, lane });
      void pump();
    },
    [pump]
  );

  // ── Scanner Omni (keyboard wedge): menangkap ketikan global kecuali di area pencarian nama ──
  useEffect(() => {
    if (!omniActive || !omniLane) return;
    const lane = omniLane;
    const flush = () => {
      const buffered = bufferRef.current.trim();
      bufferRef.current = "";
      setManualCode("");
      if (buffered) submit(buffered, lane);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (inNoCapture(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Enter" || e.key === "NumpadEnter" || e.key === "Tab") {
        e.preventDefault();
        flush();
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        bufferRef.current = bufferRef.current.slice(0, -1);
        setManualCode(bufferRef.current);
        return;
      }
      if (e.key.length === 1) {
        e.preventDefault();
        bufferRef.current += e.key;
        setManualCode(bufferRef.current);
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      if (inNoCapture(e.target)) return;
      e.preventDefault();
      const text = e.clipboardData?.getData("text")?.trim();
      if (text) submit(text, lane);
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("paste", onPaste, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("paste", onPaste, true);
    };
  }, [omniActive, omniLane, submit]);

  // Fokus awal ke kolom Omni agar scanner yang mengirim teks (bukan tombol keyboard) juga terbaca.
  useEffect(() => {
    if (omniActive) manualInputRef.current?.focus({ preventScroll: true });
  }, [omniActive]);

  // ── Daftar kamera (label baru tersedia setelah izin diberikan) ──
  const refreshCameras = useCallback(async () => {
    try {
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
      setCameras(devices);
    } catch {
      /* tidak ada kamera */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void refreshCameras(), 0);
    return () => clearTimeout(t);
  }, [refreshCameras]);

  const startCamera = async (which: "a" | "b") => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop()); // hanya untuk memunculkan izin & label kamera
      await refreshCameras();
      setCamOn((c) => ({ ...c, [which]: true }));
    } catch {
      setOutcome({ kind: "error", message: "Kamera tidak bisa diakses (izin ditolak atau butuh HTTPS).", lane: which === "a" ? "Scanner 1" : "Scanner 2" });
    }
  };

  const setMode = (which: "a" | "b", mode: Mode) => {
    setModes((m) => {
      const other = which === "a" ? "b" : "a";
      // Satu perangkat keyboard saja: dua scanner Omni otomatis masuk ke satu jalur yang sama.
      if (mode === "omni" && m[other] === "omni") return { ...m, [which]: mode, [other]: "camera" };
      return { ...m, [which]: mode };
    });
    if (mode !== "camera") setCamOn((c) => ({ ...c, [which]: false }));
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      /* ditolak browser */
    }
  };
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const pct = live && live.total ? Math.round((live.hadir / live.total) * 100) : 0;
  const agendaLabel = (a: Agenda) => (a === "pelepasan" ? "Pelepasan" : "Yudisium");

  // ── Panel scanner ──
  const scannerPanel = (which: "a" | "b") => {
    const mode = modes[which];
    const lane: Lane = which === "a" ? "Scanner 1" : "Scanner 2";
    const deviceId = which === "a" ? camA : camB;
    const setDevice = which === "a" ? setCamA : setCamB;
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-bold text-[#1A1A2E]">
            <QrCode className="h-4 w-4 text-[#40916C]" /> {lane}
          </p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              mode === "off" ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${mode === "off" ? "bg-slate-400" : "bg-emerald-500"}`} />
            {mode === "off" ? "Mati" : mode === "omni" ? "Siap (Omni)" : camOn[which] ? "Kamera aktif" : "Kamera belum dinyalakan"}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1">
          {([
            ["omni", "Omni", <Keyboard key="k" className="h-4 w-4" />],
            ["camera", "Kamera", <Camera key="c" className="h-4 w-4" />],
            ["off", "Mati", <CameraOff key="o" className="h-4 w-4" />],
          ] as const).map(([m, label, icon]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(which, m)}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors ${
                mode === m ? "bg-white text-[#1B4332] shadow-sm" : "text-slate-500"
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {mode === "omni" && (
          <div className="mt-3">
            <p className="text-xs text-slate-500">
              Arahkan scanner Omni ke QR. Hasil terbaca otomatis; dua scanner Omni yang tersambung ke laptop ini
              sama-sama masuk ke jalur ini dan diproses bergantian.
            </p>
            <input
              ref={manualInputRef}
              value={manualCode}
              onChange={(e) => {
                bufferRef.current = e.target.value;
                setManualCode(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  const v = manualCode.trim();
                  bufferRef.current = "";
                  setManualCode("");
                  if (v) submit(v, "Manual");
                }
              }}
              placeholder="Kode terbaca / ketik ID lalu Enter"
              data-name-search
              className="mt-2 w-full rounded-xl border border-slate-200 bg-[#F8FAF9] px-4 py-3 font-mono text-sm text-[#1A1A2E] placeholder:text-slate-400 focus:border-[#1B4332] focus:outline-none"
            />
          </div>
        )}

        {mode === "camera" && (
          <div className="mt-3 space-y-2" data-name-search>
            <div className="flex gap-2">
              <select
                value={deviceId}
                onChange={(e) => setDevice(e.target.value)}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-[#1A1A2E] focus:border-[#1B4332] focus:outline-none"
              >
                <option value="">Kamera bawaan</option>
                {cameras.map((c, i) => (
                  <option key={c.deviceId || i} value={c.deviceId}>
                    {c.label || `Kamera ${i + 1}`}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => (camOn[which] ? setCamOn((c) => ({ ...c, [which]: false })) : void startCamera(which))}
                className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold ${
                  camOn[which] ? "border border-slate-200 text-slate-600" : "bg-[#1B4332] text-white"
                }`}
              >
                {camOn[which] ? "Matikan" : "Nyalakan"}
              </button>
            </div>
            <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-900">
              {camOn[which] ? (
                <Scanner
                  key={`${which}-${deviceId}`}
                  onScan={(codes) => codes.forEach((c) => submit(c.rawValue, lane))}
                  onError={() => setCamOn((c) => ({ ...c, [which]: false }))}
                  constraints={deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" }}
                  scanDelay={300}
                  sound={false}
                  classNames={{ container: "h-full w-full", video: "h-full w-full object-cover" }}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                  <CameraOff className="h-7 w-7" />
                  <span className="text-xs">Tekan Nyalakan untuk memulai</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Hasil scan terakhir ──
  const outcomeCard = (() => {
    if (outcome.kind === "idle") {
      return (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
          <QrCode className="h-10 w-10 text-slate-300" />
          <p className="mt-3 text-lg font-semibold text-slate-500">Menunggu scan…</p>
          <p className="text-sm text-slate-400">Scan QR peserta atau cari namanya di bawah.</p>
        </div>
      );
    }
    if (outcome.kind === "error") {
      return (
        <div className="min-h-56 rounded-2xl border-2 border-rose-300 bg-rose-50 p-6">
          <div className="flex items-center gap-2 text-rose-700">
            <XCircle className="h-6 w-6" />
            <p className="text-sm font-bold uppercase tracking-wider">Gagal • {outcome.lane}</p>
          </div>
          <p className="mt-4 text-2xl font-bold text-rose-800">{outcome.message}</p>
        </div>
      );
    }
    const ok = outcome.kind === "success";
    return (
      <div className={`min-h-56 rounded-2xl border-2 p-6 ${ok ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
        <div className={`flex items-center justify-between gap-2 ${ok ? "text-emerald-700" : "text-amber-700"}`}>
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
            {ok ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            {ok ? "Hadir tercatat" : "Sudah tercatat hadir"}
          </p>
          <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold">{outcome.lane}</span>
        </div>
        <p className="mt-4 text-3xl font-extrabold leading-tight text-[#1A1A2E]">{outcome.name}</p>
        <p className="mt-1 text-base text-slate-600">{outcome.program}</p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          {[
            ["NPM", outcome.npm],
            ["Kursi", outcome.seat],
            [ok ? "Waktu" : "Hadir sejak", outcome.at ? time(outcome.at) : "-"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white/80 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
              <p className="truncate font-semibold text-[#1A1A2E]">{value}</p>
            </div>
          ))}
        </div>
        {live?.dualAgenda && <p className="mt-3 text-xs font-semibold text-slate-500">Agenda: {agendaLabel(outcome.agenda)}</p>}
      </div>
    );
  })();

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#1A1A2E]">
      {/* Bar atas */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/events/${eventId}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:border-slate-300"
          >
            <ArrowLeft className="h-4 w-4" /> Acara
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#40916C]">Pemindai Kehadiran</p>
            <p className="max-w-[46vw] truncate text-sm font-semibold text-[#1A1A2E]">{live?.eventName ?? "Memuat…"}</p>
          </div>
        </div>

        {live?.dualAgenda && (
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            {(["yudisium", "pelepasan"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAgenda(a)}
                className={`min-h-11 rounded-lg px-6 text-sm font-bold transition-colors ${
                  agenda === a ? "bg-[#1B4332] text-white shadow" : "text-slate-500"
                }`}
              >
                {agendaLabel(a)}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              online ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            {online ? `Live • ${updatedAt ? time(updatedAt) : "…"}` : "Terputus"}
          </span>
          <span className="hidden font-mono text-sm font-semibold text-slate-500 md:inline">
            {now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <button
            type="button"
            onClick={() => setSound((v) => !v)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600"
            aria-label={sound ? "Matikan suara" : "Nyalakan suara"}
          >
            {sound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600"
            aria-label="Layar penuh"
          >
            {fullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Tiga kolom: scanner | live | hasil + cari nama */}
      <main className="grid gap-4 p-4 lg:grid-cols-2 xl:grid-cols-[minmax(320px,0.9fr)_minmax(440px,1.25fr)_minmax(340px,1fr)]">
        {/* Kolom 1: dua scanner */}
        <section className="space-y-4">
          {scannerPanel("a")}
          {scannerPanel("b")}
        </section>

        {/* Kolom 2: kehadiran realtime */}
        <section className="space-y-4 lg:order-last xl:order-none">
          <div className="rounded-2xl bg-[#1B4332] p-6 text-white shadow-sm">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#74C69D]">
                <Users className="h-4 w-4" /> Hadir {live?.dualAgenda ? agendaLabel(agenda) : ""} • realtime
              </p>
              <span className="text-xs text-white/60">{pct}%</span>
            </div>
            <div className="mt-2 flex items-end gap-3">
              <p className="text-7xl font-extrabold leading-none tabular-nums xl:text-8xl">{live ? live.hadir : "–"}</p>
              <p className="pb-2 text-xl text-white/70">/ {live ? live.total : "–"} peserta</p>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-[#74C69D] transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            {live?.dualAgenda && (
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                {(["yudisium", "pelepasan"] as const).map((a) => (
                  <div key={a} className={`rounded-xl px-4 py-3 ${agenda === a ? "bg-white/20" : "bg-white/10"}`}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">{agendaLabel(a)}</p>
                    <p className="text-2xl font-bold tabular-nums">
                      {a === "yudisium" ? live.hadirYudisium : live.hadirPelepasan}
                      <span className="text-sm font-normal text-white/60"> / {live.total}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#40916C]">Per Program Studi</p>
            <div className="mt-3 space-y-3">
              {(live?.perProgram ?? []).map((p) => {
                const v = p.total ? Math.round((p.hadir / p.total) * 100) : 0;
                return (
                  <div key={p.program}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-semibold">{p.program}</span>
                      <span className="shrink-0 tabular-nums text-slate-500">
                        <b className="text-[#1A1A2E]">{p.hadir}</b> / {p.total} ({v}%)
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[#40916C] transition-all duration-700" style={{ width: `${v}%` }} />
                    </div>
                  </div>
                );
              })}
              {live && live.perProgram.length === 0 && <p className="text-sm text-slate-400">Belum ada peserta.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#40916C]">Check-in Terbaru</p>
            <ul className="mt-3 divide-y divide-slate-100">
              {(live?.recent ?? []).map((r) => (
                <li
                  key={`${r.id}:${r.at}`}
                  className={`flex items-center justify-between gap-3 px-2 py-2.5 transition-colors duration-1000 ${
                    freshIds.has(`${r.id}:${r.at}`) ? "rounded-lg bg-emerald-100" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{r.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {r.program} • {r.npm}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-semibold text-[#1B4332]">{time(r.at)}</span>
                </li>
              ))}
              {live && live.recent.length === 0 && <li className="py-3 text-sm text-slate-400">Belum ada yang hadir.</li>}
            </ul>
          </div>
        </section>

        {/* Kolom 3: hasil scan terakhir + cari nama */}
        <section className="space-y-4">
          {outcomeCard}
          <ScanNameSearch
            eventId={eventId}
            agenda={agenda}
            busy={busy}
            onConfirm={(id) => submit(id, "Nama")}
          />
        </section>
      </main>
    </div>
  );
}
