"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Loader2, Plus, ShieldCheck, Trash2, Upload, Users } from "lucide-react";

type Eligible = { id: string; npm: string; name: string; program: string | null };
type VRow = { npm: string; name: string; program: string | null; hasPhoto: boolean };
type Wd2Account = { id: string; email: string };
type Doc = { kind: "yudisium" | "wisuda"; filename: string; size: number; updatedAt: string };

const DOC_KINDS: { kind: Doc["kind"]; label: string }[] = [
  { kind: "yudisium", label: "Undangan Yudisium" },
  { kind: "wisuda", label: "Undangan Wisuda Fakultas" },
];

export default function YudisiumAdminPage() {
  const { id: eventId } = useParams<{ id: string }>();

  const [eligible, setEligible] = useState<Eligible[]>([]);
  const [wd2Accounts, setWd2Accounts] = useState<Wd2Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const [addForm, setAddForm] = useState({ npm: "", name: "", program: "" });
  const [addBusy, setAddBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  const [vrows, setVrows] = useState<VRow[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docBusy, setDocBusy] = useState<string | null>(null);

  const [wd2Form, setWd2Form] = useState({ email: "" });
  const [wd2Busy, setWd2Busy] = useState(false);
  const [generatedWd2Password, setGeneratedWd2Password] = useState<string | null>(null);

  const [resetNpm, setResetNpm] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [generatedResetPassword, setGeneratedResetPassword] = useState<string | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async () => {
    const [eligibleRes, wd2Res, docsRes] = await Promise.all([
      fetch(`/api/events/${eventId}/mahasiswa-eligible`, { credentials: "include" }),
      fetch(`/api/wd2-accounts`, { credentials: "include" }),
      fetch(`/api/events/${eventId}/lampiran`, { credentials: "include" }),
    ]);
    const vRes = await fetch(`/api/events/${eventId}/foto-videotron`, { credentials: "include" });
    if (vRes.ok) setVrows((await vRes.json()).rows ?? []);
    if (docsRes.ok) setDocs((await docsRes.json()).documents ?? []);
    if (eligibleRes.ok) setEligible((await eligibleRes.json()).eligible ?? []);
    if (wd2Res.ok) setWd2Accounts((await wd2Res.json()).accounts ?? []);
  }, [eventId]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const handleUploadDoc = async (kind: Doc["kind"], file: File | undefined) => {
    if (!file) return;
    setDocBusy(kind);
    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", file);
      const res = await fetch(`/api/events/${eventId}/lampiran`, { method: "POST", credentials: "include", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal mengunggah PDF");
      setDocs(data.documents ?? []);
      showToast("Lampiran PDF tersimpan.");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setDocBusy(null);
    }
  };

  const handleDeleteDoc = async (kind: Doc["kind"]) => {
    if (!confirm("Hapus lampiran PDF ini?")) return;
    setDocBusy(kind);
    const res = await fetch(`/api/events/${eventId}/lampiran?kind=${kind}`, { method: "DELETE", credentials: "include" });
    if (res.ok) setDocs((await res.json()).documents ?? []);
    else showToast("Gagal menghapus lampiran.", "err");
    setDocBusy(null);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.npm.trim() || !addForm.name.trim()) return;
    setAddBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/mahasiswa-eligible`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(addForm),
      });
      if (!res.ok) throw new Error("Gagal menambah mahasiswa eligible");
      setAddForm({ npm: "", name: "", program: "" });
      await fetchData();
      showToast("Mahasiswa ditambahkan ke daftar eligible.");
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setAddBusy(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/events/${eventId}/mahasiswa-eligible/import`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal mengimpor");
      await fetchData();
      showToast(`Berhasil mengimpor ${data.imported} mahasiswa.`);
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setImportBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleCreateWd2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wd2Form.email.trim()) return;
    setWd2Busy(true);
    try {
      const res = await fetch(`/api/wd2-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(wd2Form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal membuat akun WD2");
      setGeneratedWd2Password(data.password);
      setWd2Form({ email: "" });
      await fetchData();
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setWd2Busy(false);
    }
  };

  const handleDeleteWd2 = async (accountId: string) => {
    if (!confirm("Hapus akun WD2 ini?")) return;
    await fetch(`/api/wd2-accounts/${accountId}`, { method: "DELETE", credentials: "include" });
    await fetchData();
    showToast("Akun WD2 dihapus.");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetNpm.trim()) return;
    setResetBusy(true);
    try {
      const res = await fetch(`/api/mahasiswa-accounts/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ npm: resetNpm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal reset password");
      setGeneratedResetPassword(data.password);
    } catch (err) {
      showToast((err as Error).message, "err");
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link href={`/events/${eventId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#1B4332] transition-colors">
        <ArrowLeft size={15} /> Kembali ke Acara
      </Link>

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#40916C]">Yudisium & Wisuda Pelepasan</p>
        <h1 className="mt-1 text-xl font-bold text-[#1A1A2E]">Kelola Mahasiswa & Reviewer WD2</h1>
      </div>

      {toast && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          toast.type === "err" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}>
          {toast.msg}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-[#40916C]" size={24} />
        </div>
      ) : (
        <>
          {/* Eligible list */}
          <div className="rounded-2xl bg-white border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#1A1A2E] flex items-center gap-2">
                <Users size={16} className="text-[#40916C]" /> Daftar Mahasiswa Eligible ({eligible.length})
              </h3>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={importBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#40916C] disabled:opacity-50"
              >
                {importBusy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Import Excel
              </button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
            </div>

            {eligible.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Belum ada mahasiswa eligible. Import dari Excel atau tambah manual.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 mb-4">
                {eligible.map((item) => (
                  <div key={item.id} className="py-2 text-sm flex items-center justify-between">
                    <div>
                      <span className="font-medium text-[#1A1A2E]">{item.name}</span>
                      <span className="text-slate-400 ml-2">{item.npm}</span>
                    </div>
                    {item.program && <span className="text-xs text-slate-400">{item.program}</span>}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAdd} className="grid grid-cols-[1fr_1.5fr_1fr_auto] gap-2 pt-3 border-t border-slate-100">
              <input
                value={addForm.npm}
                onChange={(e) => setAddForm((f) => ({ ...f, npm: e.target.value }))}
                placeholder="NPM"
                required
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#1B4332] focus:outline-none"
              />
              <input
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nama Lengkap"
                required
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#1B4332] focus:outline-none"
              />
              <input
                value={addForm.program}
                onChange={(e) => setAddForm((f) => ({ ...f, program: e.target.value }))}
                placeholder="Prodi"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#1B4332] focus:outline-none"
              />
              <button
                type="submit"
                disabled={addBusy}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#40916C] disabled:opacity-50"
              >
                <Plus size={13} /> Tambah
              </button>
            </form>
          </div>

          {/* Lampiran undangan PDF */}
          <div className="rounded-2xl bg-white border border-slate-100 p-5">
            <h3 className="text-sm font-bold text-[#1A1A2E] flex items-center gap-2 mb-1">
              <FileText size={16} className="text-[#40916C]" /> Lampiran Undangan (PDF)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              PDF resmi ditampilkan ke mahasiswa sebagai modal di halaman daftar &amp; dashboard. Maks 10MB.
            </p>
            <div className="space-y-2">
              {DOC_KINDS.map(({ kind, label }) => {
                const doc = docs.find((d) => d.kind === kind);
                return (
                  <div key={kind} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-slate-100">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1A1A2E]">{label}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {doc ? `${doc.filename} · ${(doc.size / 1024).toFixed(0)} KB` : "Belum diunggah"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {doc && (
                        <>
                          <a
                            href={`/api/mahasiswa/lampiran/${kind}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-[#40916C]"
                          >
                            Lihat
                          </a>
                          <button
                            onClick={() => handleDeleteDoc(kind)}
                            disabled={docBusy === kind}
                            className="text-rose-500 hover:text-rose-700"
                            title="Hapus"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#40916C] cursor-pointer">
                        {docBusy === kind ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                        {doc ? "Ganti" : "Unggah"}
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            void handleUploadDoc(kind, e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Foto videotron */}
          <div className="rounded-2xl bg-white border border-slate-100 p-5">
            <h3 className="text-sm font-bold text-[#1A1A2E] mb-1">
              Foto Videotron ({vrows.filter((r) => r.hasPhoto).length}/{vrows.length})
            </h3>
            <p className="text-xs text-slate-500 mb-4">Foto semi formal dari mahasiswa, dikelompokkan per prodi.</p>
            {Object.entries(
              vrows.reduce<Record<string, VRow[]>>((acc, r) => {
                (acc[r.program ?? "Tanpa prodi"] ||= []).push(r);
                return acc;
              }, {})
            ).map(([prodi, list]) => (
              <details key={prodi} className="mb-2">
                <summary className="cursor-pointer text-sm font-semibold text-[#1B4332]">
                  {prodi} · {list.filter((r) => r.hasPhoto).length}/{list.length}
                </summary>
                <div className="mt-2 divide-y divide-slate-100">
                  {list.map((r) => (
                    <div key={r.npm} className="py-1.5 text-sm flex items-center justify-between">
                      <span>
                        {r.name} <span className="text-slate-400">{r.npm}</span>
                      </span>
                      {r.hasPhoto ? (
                        <span className="flex gap-3 text-xs font-semibold text-[#40916C]">
                          <a href={`/api/events/${eventId}/foto-videotron/${r.npm}`} target="_blank" rel="noreferrer">Lihat</a>
                          <a href={`/api/events/${eventId}/foto-videotron/${r.npm}?download=1`}>Unduh</a>
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600">Belum</span>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>

          {/* WD2 accounts */}
          <div className="rounded-2xl bg-white border border-slate-100 p-5">
            <h3 className="text-sm font-bold text-[#1A1A2E] flex items-center gap-2 mb-4">
              <ShieldCheck size={16} className="text-[#40916C]" /> Akun WD2 (Reviewer Pembayaran)
            </h3>

            {wd2Accounts.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Belum ada akun WD2.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {wd2Accounts.map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-100">
                    <span className="text-sm text-[#1A1A2E]">{acc.email}</span>
                    <button
                      onClick={() => handleDeleteWd2(acc.id)}
                      className="text-rose-500 hover:text-rose-700"
                      title="Hapus"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {generatedWd2Password && (
              <div className="mb-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm">
                Password akun WD2 baru (simpan sekarang, tidak akan ditampilkan lagi):{" "}
                <span className="font-mono font-bold">{generatedWd2Password}</span>
              </div>
            )}

            <form onSubmit={handleCreateWd2} className="flex gap-2 pt-3 border-t border-slate-100">
              <input
                type="email"
                value={wd2Form.email}
                onChange={(e) => setWd2Form({ email: e.target.value })}
                placeholder="email@ftunisma.ac.id"
                required
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#1B4332] focus:outline-none"
              />
              <button
                type="submit"
                disabled={wd2Busy}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#40916C] disabled:opacity-50"
              >
                {wd2Busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Buat Akun WD2
              </button>
            </form>
          </div>

          {/* Reset mahasiswa password */}
          <div className="rounded-2xl bg-white border border-slate-100 p-5">
            <h3 className="text-sm font-bold text-[#1A1A2E] mb-4">Reset Password Mahasiswa</h3>
            {generatedResetPassword && (
              <div className="mb-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm">
                Password baru (sampaikan ke mahasiswa, tidak akan ditampilkan lagi):{" "}
                <span className="font-mono font-bold">{generatedResetPassword}</span>
              </div>
            )}
            <form onSubmit={handleResetPassword} className="flex gap-2">
              <input
                value={resetNpm}
                onChange={(e) => setResetNpm(e.target.value)}
                placeholder="NPM mahasiswa"
                required
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#1B4332] focus:outline-none"
              />
              <button
                type="submit"
                disabled={resetBusy}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:border-slate-300 disabled:opacity-50"
              >
                Reset Password
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
