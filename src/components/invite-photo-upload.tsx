"use client";

import { useEffect, useState } from "react";
import { Loader2, Upload } from "lucide-react";

type Props = {
  inviteId: string;
  initialPhotoData?: string | null;
};

export function InvitePhotoUpload({ inviteId, initialPhotoData }: Props) {
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setPhotoData(initialPhotoData ?? null);
  }, [initialPhotoData]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const handleUpload = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("photo", file);

      const res = await fetch(`/api/attendees/${encodeURIComponent(inviteId)}/photo`, {
        method: "POST",
        body: form,
      });

      const data = (await res.json()) as { message?: string; photoData?: string | null };
      if (!res.ok) throw new Error(data.message || "Gagal mengunggah foto.");

      setPhotoData(data.photoData ?? previewUrl ?? null);
      setMessage("Foto berhasil disimpan.");
      setFile(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl bg-white/10 p-6 text-sm shadow-lg backdrop-blur">
      <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">
        Foto Peserta (Opsional)
      </p>
      <p className="mt-2 text-sm text-slate-300">
        Unggah foto agar panitia dapat melihatnya saat QR Anda dipindai.
      </p>

      <div className="mt-4 flex justify-center">
        <img
          src={previewUrl ?? photoData ?? "/file.svg"}
          alt="Foto peserta"
          className="h-36 w-36 rounded-2xl border border-white/20 object-cover"
        />
      </div>
      <p className="mt-2 text-center text-xs text-slate-400">
        {previewUrl
          ? "Pratinjau foto baru. Klik Simpan Foto untuk menyimpan."
          : photoData
          ? "Foto tersimpan."
          : "Belum ada foto tersimpan."}
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="flex-1 rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-500 file:px-4 file:py-2 file:text-white"
        />
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || busy}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Simpan Foto
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-2xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm text-rose-100">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-3 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100">
          {message}
        </p>
      )}
    </section>
  );
}
