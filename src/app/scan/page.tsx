"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  QrCode,
  Shield,
  Smartphone,
  Wifi,
} from "lucide-react";
import type { AttendeeRecord } from "@/lib/storage";

type ScanPayload = {
  inviteId: string;
  name?: string;
  npm?: string;
};

export default function ScanPage() {
  const [scanned, setScanned] = useState<AttendeeRecord | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState<string>(
    "Fokuskan kursor pada kolom di bawah lalu scan menggunakan perangkat Omni 1D/2D."
  );
  const [lastPayload, setLastPayload] = useState<ScanPayload | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [scanMode, setScanMode] = useState<"hardware" | "camera">("hardware");
  const manualInputRef = useRef<HTMLInputElement>(null);
  const lastSubmittedRef = useRef<string>("");
  const lastSubmitAtRef = useRef<number>(0);
  const scanBufferRef = useRef("");

  const redirectToLogin = useCallback(() => {
    window.location.href = "/auth/login?redirect=%2Fscan";
  }, []);

  useEffect(() => {
    const ensureFocus = () => {
      if (scanMode === "hardware") {
        manualInputRef.current?.focus({ preventScroll: true });
      }
    };

    // initial
    ensureFocus();

    const onClick = () => ensureFocus();
    const onWindowFocus = () => ensureFocus();
    const onVis = () => {
      if (!document.hidden) ensureFocus();
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [scanMode]);

  const parseScannerInput = (raw: string): ScanPayload => {
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new Error("Kode undangan kosong.");
    }

    if (trimmed.startsWith("{")) {
      const parsed = JSON.parse(trimmed) as ScanPayload;
      if (!parsed.inviteId) {
        throw new Error("Payload scanner tidak memuat inviteId.");
      }
      return parsed;
    }

    return { inviteId: trimmed };
  };

  const normalizeInviteId = (value: string) =>
    value.trim().replace(/\s+/g, " ").toUpperCase();

  const confirmAttendance = useCallback(async (payload: ScanPayload) => {
    setStatus("loading");
    setMessage("Memproses konfirmasi...");
    const normalizedId = normalizeInviteId(payload.inviteId);
    setLastPayload({ ...payload, inviteId: normalizedId });
    try {
      const res = await fetch(
        `/api/attendees/${encodeURIComponent(normalizedId)}/confirm`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "QR tidak valid");
      let latest = data as AttendeeRecord;
      try {
        const detailRes = await fetch(
          `/api/attendees/${encodeURIComponent(normalizedId)}`,
          {
            credentials: "include",
            cache: "no-store",
          }
        );
        if (detailRes.ok) {
          latest = (await detailRes.json()) as AttendeeRecord;
        }
      } catch {
        // fallback ke payload confirm jika fetch detail gagal
      }
      setScanned(latest);
      setStatus("success");
      setMessage("QR sah. Status hadir diperbarui.");
    } catch (err) {
      setStatus("error");
      setMessage((err as Error).message);
    }
  }, [redirectToLogin]);

  const submitManualPayload = useCallback(async (value: string) => {
    if (!value.trim()) return;
    if (status === "loading") return;
    const now = Date.now();
    if (
      value === lastSubmittedRef.current &&
      now - lastSubmitAtRef.current < 800
    ) {
      return; // ignore rapid duplicate scans
    }
    try {
      const payload = parseScannerInput(value);
      lastSubmittedRef.current = payload.inviteId;
      lastSubmitAtRef.current = Date.now();
      await confirmAttendance(payload);
      setManualCode("");
    } catch (err) {
      setStatus("error");
      setMessage((err as Error).message);
    }
  }, [confirmAttendance, status]);

  useEffect(() => {
    if (scanMode !== "hardware") return;

    const flushBuffer = () => {
      const buffered = scanBufferRef.current.trim();
      if (!buffered) return;
      setManualCode(buffered);
      void submitManualPayload(buffered);
      scanBufferRef.current = "";
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (scanMode !== "hardware") return;

      // Cegah shortcut browser (Ctrl/Cmd) saat mode scanner aktif agar tidak buka tab/fokus address bar.
      if (event.ctrlKey || event.metaKey || event.altKey) {
        event.preventDefault();
        return;
      }

      if (
        event.key === "Enter" ||
        event.key === "NumpadEnter" ||
        event.key === "Tab"
      ) {
        event.preventDefault();
        flushBuffer();
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        scanBufferRef.current = scanBufferRef.current.slice(0, -1);
        setManualCode(scanBufferRef.current);
        return;
      }

      if (event.key.length === 1) {
        event.preventDefault();
        scanBufferRef.current += event.key;
        setManualCode(scanBufferRef.current);
      }
    };

    const onPaste = (event: ClipboardEvent) => {
      event.preventDefault();
      const text = event.clipboardData?.getData("text")?.trim() || "";
      if (!text) return;
      scanBufferRef.current = text;
      setManualCode(text);
      void submitManualPayload(text);
      scanBufferRef.current = "";
    };

    const forceRefocus = () => {
      manualInputRef.current?.focus({ preventScroll: true });
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("paste", onPaste, true);
    window.addEventListener("blur", forceRefocus);

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("paste", onPaste, true);
      window.removeEventListener("blur", forceRefocus);
    };
  }, [scanMode, submitManualPayload]);

  const handleDetected = async (detectedCodes: { rawValue: string }[]) => {
    if (!detectedCodes.length || status === "loading") return;
    try {
      const payload = JSON.parse(detectedCodes[0].rawValue) as ScanPayload;
      if (!payload.inviteId) throw new Error("Payload QR tidak valid");
      await confirmAttendance(payload);
    } catch (err) {
      setStatus("error");
      setMessage((err as Error).message);
    }
  };

  const handleManualSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!manualCode) return;
    await submitManualPayload(manualCode);
  };

  const handleManualChange = (event: ChangeEvent<HTMLInputElement>) => {
    const incoming = event.target.value;
    if (status === "loading") return;

    // Jika scanner mengirim CR ("\r"), LF ("\n"), atau CRLF di akhir, anggap sebagai trigger submit
    if (incoming.includes("\r") || incoming.includes("\n")) {
      const cleaned = incoming.replace(/[\r\n]/g, "");
      scanBufferRef.current = cleaned;
      setManualCode(cleaned);
      void submitManualPayload(cleaned);
      scanBufferRef.current = "";
      return;
    }

    // Kalau tidak ada terminator, simpan saja sementara
    scanBufferRef.current = incoming;
    setManualCode(incoming);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-12 pt-8">
        <header className="flex flex-col gap-4 text-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 text-sm text-emerald-300"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali ke dashboard
          </Link>
          <h1 className="text-2xl font-semibold">Mode Pemindai Kehadiran</h1>
          <p className="text-sm text-slate-300">
            Gunakan scanner Omni (keyboard wedge) sebagai perangkat utama.
            Kamera internal tetap tersedia sebagai cadangan.
          </p>
        </header>
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setScanMode("hardware")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                scanMode === "hardware"
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-800 text-slate-300"
              }`}
            >
              <Wifi className="h-4 w-4" />
              Scanner Omni
            </button>
            <button
              type="button"
              onClick={() => setScanMode("camera")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                scanMode === "camera"
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-800 text-slate-300"
              }`}
            >
              <Smartphone className="h-4 w-4" />
              Kamera Internal
            </button>
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">
            Mode scanner membaca hasil 1D/2D sebagai teks otomatis; mode kamera
            memanfaatkan webcam perangkat.
          </p>
        </div>

        {scanMode === "camera" && (
          <div className="overflow-hidden rounded-3xl bg-slate-900/60 shadow-xl backdrop-blur">
            <div className="relative aspect-[3/4] w-full">
              <Scanner
                onScan={handleDetected}
                onError={(err) => {
                  setStatus("error");
                  setMessage((err as Error).message);
                }}
                classNames={{
                  container: "h-full w-full",
                  video: "h-full w-full object-cover",
                }}
                components={{
                  tracker: (detectedCodes, ctx) => {
                    if (!detectedCodes?.length) return;
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = "#22c55e";
                    for (const code of detectedCodes) {
                      const pts = code.cornerPoints;
                      if (!pts) continue;
                      ctx.beginPath();
                      ctx.moveTo(pts[0].x, pts[0].y);
                      for (let i = 1; i < pts.length; i++)
                        ctx.lineTo(pts[i].x, pts[i].y);
                      ctx.closePath();
                      ctx.stroke();
                    }
                  },
                }}
              />
              <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-emerald-400/70" />
            </div>
          </div>
        )}

        <div
          className={`rounded-3xl border px-5 py-4 text-sm ${
            status === "error"
              ? "border-rose-500/40 bg-rose-500/10 text-rose-100"
              : status === "success"
              ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
              : "border-slate-700 bg-slate-800/80 text-slate-200"
          }`}
        >
          {status === "loading" && (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memproses...
            </span>
          )}
          {status !== "loading" && message}
        </div>

        {scanned && (
          <div className="rounded-3xl border border-emerald-400/40 bg-emerald-400/5 p-6 text-sm text-emerald-50">
            <div className="flex items-center gap-2 text-emerald-200">
              <CheckCircle2 className="h-5 w-5" />
              QR tervalidasi
            </div>
            {scanned.photoData && (
              <div className="mt-4 flex justify-center">
                <img
                  src={scanned.photoData}
                  alt={`Foto ${scanned.name}`}
                  className="h-28 w-28 rounded-2xl border border-white/20 object-cover"
                />
              </div>
            )}
            <p className="mt-3 text-2xl font-semibold text-white">
              {scanned.name}
            </p>
            <p className="text-slate-200">{scanned.program}</p>
            <div className="mt-4 grid gap-3 text-xs text-slate-200 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="uppercase tracking-[0.2em] text-slate-400">
                  invite id
                </p>
                <p className="text-base text-white">{scanned.id}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="uppercase tracking-[0.2em] text-slate-400">
                  npm
                </p>
                <p className="text-base text-white">{scanned.npm}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="uppercase tracking-[0.2em] text-slate-400">
                  waktu scan
                </p>
                <p className="text-base text-white">
                  {new Date(
                    scanned.confirmedAt ?? scanned.updatedAt
                  ).toLocaleString("id-ID")}
                </p>
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={handleManualSubmit}
          className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6"
        >
          <p className="text-sm text-slate-300">
            Kolom utama scanner Omni. Setiap hasil scan akan terbaca sebagai
            teks dan dikirim otomatis (termasuk QR JSON).
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              ref={manualInputRef}
              value={manualCode}
              onChange={handleManualChange}
              placeholder='MOH ROMLI atau {"inviteId":"MOH ROMLI"}'
              className="flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" ||
                  e.key === "NumpadEnter" ||
                  e.key === "Tab"
                ) {
                  e.preventDefault();
                  void submitManualPayload(
                    (e.currentTarget as HTMLInputElement).value
                  );
                }
              }}
              onFocus={(e) => e.currentTarget.select()}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
            />
            <button
              type="submit"
              disabled={!manualCode}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <QrCode className="h-4 w-4" /> Verifikasi manual
            </button>
          </div>
        </form>

        {lastPayload && (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            <div className="flex items-center gap-2 text-slate-100">
              <Shield className="h-4 w-4" />
              Log terakhir
            </div>
            <p className="mt-2 text-xs text-slate-400">Payload:</p>
            <pre className="mt-2 rounded-2xl bg-slate-950/60 p-3 text-xs text-slate-200">
              {JSON.stringify(lastPayload, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
