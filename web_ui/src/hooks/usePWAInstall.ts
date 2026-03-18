import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "skola-pwa-install-dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MANUAL_PROMPT_DELAY_MS = 3000;

function readDismissedUntil(): number {
  try {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    const dismissedAt = dismissed ? Number.parseInt(dismissed, 10) : 0;
    if (!Number.isNaN(dismissedAt) && dismissedAt > 0) {
      return dismissedAt + DISMISS_DURATION_MS;
    }
  } catch {}
  return 0;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isManualInstall, setIsManualInstall] = useState(false);
  const [dismissedUntil, setDismissedUntil] = useState<number>(() => readDismissedUntil());

  useEffect(() => {
    // Check if already installed (includes iOS standalone mode)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const isMobileBrowser = /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent);
    let installPromptCaptured = false;
    const maybeEnableManualInstall = () => {
      if (installPromptCaptured || !isMobileBrowser) return;
      if (Date.now() >= readDismissedUntil()) {
        setIsManualInstall(true);
        setCanInstall(true);
      }
    };

    const handler = (e: Event) => {
      e.preventDefault();
      installPromptCaptured = true;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsManualInstall(false);
      setCanInstall(Date.now() >= readDismissedUntil());
    };

    window.addEventListener("beforeinstallprompt", handler);
    const manualInstallTimer = window.setTimeout(maybeEnableManualInstall, MANUAL_PROMPT_DELAY_MS);

    const installedHandler = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setIsManualInstall(false);
      setDeferredPrompt(null);
      setDismissedUntil(0);
      try {
        localStorage.removeItem(DISMISSED_KEY);
      } catch {}
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.clearTimeout(manualInstallTimer);
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  useEffect(() => {
    if (isInstalled) {
      setCanInstall(false);
      return;
    }

    if (!deferredPrompt && !isManualInstall) {
      setCanInstall(false);
      return;
    }

    const now = Date.now();
    if (now >= dismissedUntil) {
      setCanInstall(true);
      return;
    }

    setCanInstall(false);
    const timeout = window.setTimeout(() => {
      setCanInstall(true);
    }, dismissedUntil - now);

    return () => window.clearTimeout(timeout);
  }, [deferredPrompt, dismissedUntil, isInstalled, isManualInstall]);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setCanInstall(false);
    if (outcome === "accepted") {
      setIsInstalled(true);
      setDismissedUntil(0);
      try {
        localStorage.removeItem(DISMISSED_KEY);
      } catch {}
      return true;
    }

    const dismissedAt = Date.now();
    setDismissedUntil(dismissedAt + DISMISS_DURATION_MS);
    try {
      localStorage.setItem(DISMISSED_KEY, dismissedAt.toString());
    } catch {}
    return false;
  };

  const dismiss = () => {
    setCanInstall(false);
    setIsManualInstall(false);
    const dismissedAt = Date.now();
    setDismissedUntil(dismissedAt + DISMISS_DURATION_MS);
    try {
      localStorage.setItem(DISMISSED_KEY, dismissedAt.toString());
    } catch {}
  };

  return { canInstall, isInstalled, isManualInstall, install, dismiss };
}
