"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, ClipboardCheck, GraduationCap, LogOut } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/auth/login";
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-60 flex flex-col bg-white border-r border-slate-100 text-[#1A1A2E] z-40">
      <div className="p-6 flex items-center gap-3">
        <span className="inline-flex p-2.5 rounded-xl bg-[#1B4332] text-white">
          <GraduationCap size={18} />
        </span>
        <div>
          <h1 className="text-sm font-bold leading-tight">FT UNISMA</h1>
          <p className="text-[11px] text-slate-400">Sistem Undangan Digital</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <NavLink
          href="/dashboard"
          icon={<LayoutDashboard size={17} />}
          label="Dashboard"
          active={pathname === "/dashboard"}
        />
        <NavLink
          href="/events"
          icon={<CalendarDays size={17} />}
          label="Acara"
          active={pathname.startsWith("/events")}
        />
        <NavLink
          href="/wd2/review"
          icon={<ClipboardCheck size={17} />}
          label="Review Pembayaran"
          active={false}
        />
      </nav>

      <div className="p-4 border-t border-slate-100">
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-50 hover:text-[#1A1A2E] transition-colors"
        >
          <LogOut size={17} />
          Keluar
        </button>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-colors ${
        active
          ? "bg-[#1B4332] text-white font-semibold shadow-sm"
          : "text-slate-500 hover:bg-slate-50 hover:text-[#1A1A2E]"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
