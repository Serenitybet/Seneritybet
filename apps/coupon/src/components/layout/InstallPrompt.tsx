"use client";

import { useEffect, useState } from "react";

// Ne reproposer que 14 jours après un refus/une fermeture — jamais après une
// installation effective (appinstalled gère ce cas séparément, voir plus bas).
const DISMISS_KEY = "installPromptDismissedAt";
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
// Laisser le temps à la page de se charger avant d'interrompre le parieur —
// pas une bannière qui apparaît brutalement dès le premier rendu.
const SHOW_DELAY_MS = 2500;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari n'a pas de media query standard pour ça.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Bannière d'installation de l'app (PWA) — Android/Chrome capture
 * beforeinstallprompt et propose un bouton "Installer" déclenchant la vraie
 * boîte de dialogue native. iOS Safari ne déclenche jamais cet évènement
 * (limitation du navigateur, pas contournable) : on y affiche à la place des
 * instructions manuelles ("Partager" → "Sur l'écran d'accueil").
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [variant, setVariant] = useState<"android" | "ios" | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) return;

    let showTimer: ReturnType<typeof setTimeout> | undefined;

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVariant("android");
      showTimer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    }
    function onAppInstalled() {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
      setVisible(false);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    if (isIOS()) {
      showTimer = setTimeout(() => { setVariant("ios"); setVisible(true); }, SHOW_DELAY_MS);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      if (showTimer) clearTimeout(showTimer);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    // Boîte de dialogue native déjà tranchée (acceptée ou refusée) — dans
    // les deux cas, inutile de reproposer tout de suite.
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDeferredPrompt(null);
    setVisible(false);
  }

  if (!visible || !variant) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[70] p-3">
      <div className="max-w-md mx-auto bg-bg-secondary border border-bg-border rounded-xl shadow-lg p-3 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- icône statique 40px, next/image superflu ici */}
        <img src="/icons/icon-192.png" alt="" className="w-10 h-10 rounded-lg shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-txt-primary">Installer Serenitybet</p>
          <p className="text-xs text-txt-muted">
            {variant === "android"
              ? "Accédez plus vite à vos paris, comme une application."
              : "Appuyez sur Partager puis « Sur l'écran d'accueil »."}
          </p>
        </div>
        {variant === "android" && (
          <button onClick={install} className="btn-green px-3 py-1.5 text-xs shrink-0">
            Installer
          </button>
        )}
        <button onClick={dismiss} className="text-txt-muted text-lg leading-none shrink-0" aria-label="Fermer">
          ✕
        </button>
      </div>
    </div>
  );
}
