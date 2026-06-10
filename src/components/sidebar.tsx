"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, LogOut } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/auth/login";
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-60 flex flex-col bg-[#1B4332] text-white z-40">
      <div className="p-6 border-b border-white/10">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#74C69D]">
          Fakultas Teknik
        </p>
        <h1 className="mt-1 text-lg font-bold leading-tight">UNISMA</h1>
        <p className="text-xs text-white/50 mt-0.5">Sistem Undangan Digital</p>
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
      </nav>

      <div className="p-4 border-t border-white/10">
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors"
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
          ? "bg-white/20 text-white font-semibold"
          : "text-white/60 hover:bg-white/10 hover:text-white"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
