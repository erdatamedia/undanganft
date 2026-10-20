import type { DayPoint } from "@/lib/dashboard-stats";

export type DonutSlice = { label: string; value: number; color: string };

export function Donut({ slices, size = 164, thickness = 18, centerLabel }: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel: string;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col xl:flex-row items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EEF1F4" strokeWidth={thickness} />
          {total > 0 &&
            slices.filter((slice) => slice.value > 0).map((slice) => {
              const length = (slice.value / total) * circumference;
              const el = (
                <circle
                  key={slice.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={thickness}
                  strokeLinecap="round"
                  strokeDasharray={`${Math.max(length - 4, 0)} ${circumference}`}
                  strokeDashoffset={-offset}
                  className="chart-donut"
                />
              );
              offset += length;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-[#1A1A2E]">{total}</span>
          <span className="text-xs text-slate-400">{centerLabel}</span>
        </div>
      </div>
      <ul className="space-y-2 text-sm w-full">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="font-semibold text-[#1A1A2E]">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DayBars({ days }: { days: DayPoint[] }) {
  const max = Math.max(1, ...days.flatMap((d) => [d.registered, d.pickedUp]));
  const height = 150;

  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {days.map((d, i) => (
          <div key={d.day} className="flex-1 flex items-end justify-center gap-[3px] h-full" title={`${d.label}: ${d.registered} daftar, ${d.pickedUp} ambil`}>
            <div
              className="chart-bar w-full max-w-[9px] rounded-t-md bg-[#40916C]"
              style={{ height: `${(d.registered / max) * 100}%`, minHeight: d.registered ? 4 : 2, animationDelay: `${i * 35}ms`, opacity: d.registered ? 1 : 0.25 }}
            />
            <div
              className="chart-bar w-full max-w-[9px] rounded-t-md bg-[#1B4332]/80"
              style={{ height: `${(d.pickedUp / max) * 100}%`, minHeight: d.pickedUp ? 4 : 2, animationDelay: `${i * 35 + 60}ms`, opacity: d.pickedUp ? 1 : 0.25 }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-2">
        {days.map((d, i) => (
          <span key={d.day} className="flex-1 text-center text-[9px] text-slate-400">
            {i % 2 === 0 ? d.label : ""}
          </span>
        ))}
      </div>
      <div className="flex gap-4 mt-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#40916C]" /> Pendaftaran</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#1B4332]/80" /> Pengambilan</span>
      </div>
    </div>
  );
}

export function ProgressRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold text-[#1A1A2E]">
          {value}
          <span className="text-slate-400 font-normal"> / {total}</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full chart-progress" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
