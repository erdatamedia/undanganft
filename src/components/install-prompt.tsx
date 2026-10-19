"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

const DISMISS_KEY = "install_prompt_dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PromptView =
  | { platform: "ios" }
  | { platform: "android"; event: BeforeInstallPromptEvent };

export function InstallPrompt() {
  const [view, setView] = useState<PromptView | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // ignore — installability prompt just won't be available
      });
    }
  }, []);

  useEffect(() => {
    let alreadyDismissed = false;
    try {
      alreadyDismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // ignore — storage may be unavailable (private mode, etc.)
    }
    if (alreadyDismissed) return;

    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const ua = navigator.userAgent;

    if (/iphone|ipad|ipod/i.test(ua)) {
      // One-off client-only detection (user agent) on mount — no SSR-safe
      // alternative, and a single extra render here is harmless.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView({ platform: "ios" });
      return;
    }

    if (/android/i.test(ua)) {
      const handler = (e: Event) => {
        e.preventDefault();
        setView({ platform: "android", event: e as BeforeInstallPromptEvent });
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  const dismiss = () => {
    setView(null);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  };

  const handleInstall = async () => {
    if (view?.platform !== "android") return;
    await view.event.prompt();
    await view.event.userChoice;
    dismiss();
  };

  if (!view) return null;

  return (
    <div className="rounded-2xl bg-[#1B4332] text-white p-4 shadow-sm relative">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/10 text-white/70"
      >
        <X size={16} />
      </button>
      {view.platform === "android" ? (
        <div className="pr-6">
          <p className="text-sm font-semibold mb-1">Instal aplikasi ini di HP Anda</p>
          <p className="text-xs text-white/70 mb-3">
            Tambahkan ke layar utama agar bisa cek cepat status verifikasi WD2 kapan saja.
          </p>
          <button
            onClick={handleInstall}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-[#1B4332] text-xs font-semibold hover:bg-white/90"
          >
            <Download size={14} /> Instal Aplikasi
          </button>
        </div>
      ) : (
        <div className="pr-6">
          <p className="text-sm font-semibold mb-1">Tambahkan ke Layar Utama</p>
          <p className="text-xs text-white/70">
            Tap tombol <Share size={12} className="inline -mt-0.5" /> <strong>Share</strong> di Safari, lalu pilih{" "}
            <strong>&quot;Add to Home Screen&quot;</strong> agar bisa cek cepat status verifikasi WD2.
          </p>
        </div>
      )}
    </div>
  );
}
