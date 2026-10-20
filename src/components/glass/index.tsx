import type { ReactNode } from "react";

export function GlassCard({
  children,
  className = "",
  strong = false,
}: {
  children: ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return (
    <div className={`${strong ? "glass-card-strong" : "glass-card"} glass-enter p-5 ${className}`}>
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#40916C] mb-2">{children}</p>
  );
}

type Tone = "ok" | "wait" | "bad" | "info" | "muted";

const toneCls: Record<Tone, string> = {
  ok: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  wait: "bg-amber-400/20 text-amber-700 border-amber-400/40",
  bad: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  info: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  muted: "bg-slate-500/10 text-slate-600 border-slate-400/30",
};

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-semibold ${toneCls[tone]}`}>
      {children}
    </span>
  );
}

export function GlassSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="glass-sheet-backdrop" onClick={onClose}>
      <div className="glass-sheet" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
