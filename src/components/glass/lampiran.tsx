"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, X } from "lucide-react";

type Kind = "yudisium" | "wisuda";
export type Attachments = { yudisium: boolean; wisuda: boolean };

const LABEL: Record<Kind, string> = {
  yudisium: "Lampiran Undangan Yudisium",
  wisuda: "Lampiran Undangan Wisuda Fakultas",
};

/** Tombol PDF lampiran undangan; PDF tampil di modal mengambang tanpa pindah halaman. */
export function LampiranButtons({ attachments }: { attachments: Attachments | null | undefined }) {
  const [open, setOpen] = useState<Kind | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const kinds = (["yudisium", "wisuda"] as Kind[]).filter((k) => attachments?.[k]);
  if (!kinds.length) return null;

  return (
    <>
      <div className="grid gap-2">
        {kinds.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setOpen(kind)}
            className="glass-btn flex items-center justify-center gap-2 w-full"
          >
            <FileText size={16} className="text-[#1B4332]" />
            {LABEL[kind]}
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-6"
          onClick={() => setOpen(null)}
          role="dialog"
          aria-modal="true"
          aria-label={LABEL[open]}
        >
          <div
            className="glass-card-strong flex flex-col w-full sm:max-w-3xl h-[88dvh] sm:h-[85vh] !rounded-b-none sm:!rounded-b-[28px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/50">
              <p className="text-sm font-bold text-[#11291f] truncate">{LABEL[open]}</p>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={`/api/mahasiswa/lampiran/${open}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl text-slate-600"
                  aria-label="Buka di tab baru"
                >
                  <ExternalLink size={18} />
                </a>
                <a
                  href={`/api/mahasiswa/lampiran/${open}?download=1`}
                  className="p-2 rounded-xl text-slate-600"
                  aria-label="Unduh PDF"
                >
                  <Download size={18} />
                </a>
                <button onClick={() => setOpen(null)} className="p-2 rounded-xl text-slate-600" aria-label="Tutup">
                  <X size={20} />
                </button>
              </div>
            </div>
            <iframe
              title={LABEL[open]}
              src={`/api/mahasiswa/lampiran/${open}#toolbar=0`}
              className="flex-1 w-full bg-white"
            />
            <p className="px-4 py-2 text-[11px] text-slate-500 text-center">
              PDF tidak tampil di perangkat Anda? Gunakan tombol buka / unduh di kanan atas.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
