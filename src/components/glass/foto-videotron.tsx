"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Eyebrow, GlassCard, StatusPill } from "@/components/glass";

const MAX_SIDE = 900;

function resize(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Gambar tidak dapat dibaca"));
    img.src = url;
  });
}

/** Pengingat + unggah foto semi formal untuk videotron saat pemanggilan nama wisudawan. */
export function FotoVideotronCard() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/mahasiswa/foto-videotron")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPhoto(d?.photo ?? null))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataUri = await resize(file);
      const res = await fetch("/api/mahasiswa/foto-videotron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo: dataUri }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal mengunggah foto");
      setPhoto(data.photo);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    const res = await fetch("/api/mahasiswa/foto-videotron", { method: "DELETE" });
    if (res.ok) setPhoto(null);
    setBusy(false);
  };

  if (!loaded) return null;

  return (
    <GlassCard>
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Foto Videotron</Eyebrow>
        <StatusPill tone={photo ? "ok" : "wait"}>{photo ? "Sudah diunggah" : "Belum diunggah"}</StatusPill>
      </div>
      <p className="text-sm text-[#11291f] mb-3">
        {photo
          ? "Foto Anda akan tampil di layar videotron saat nama dipanggil. Anda bisa menggantinya kapan saja sebelum acara."
          : "Pengingat: unggah foto semi formal (berpakaian rapi, wajah jelas, latar polos) untuk ditampilkan di layar videotron saat pemanggilan nama wisudawan."}
      </p>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="Foto videotron" className="mx-auto mb-3 max-h-64 rounded-2xl object-cover shadow" />
      )}
      {error && <p className="glass-inset px-4 py-3 text-sm text-rose-700 mb-3">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="glass-btn glass-btn-primary flex-1 flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          {photo ? "Ganti Foto" : "Unggah Foto"}
        </button>
        {photo && (
          <button type="button" disabled={busy} onClick={remove} className="glass-btn px-4" aria-label="Hapus foto">
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </GlassCard>
  );
}
