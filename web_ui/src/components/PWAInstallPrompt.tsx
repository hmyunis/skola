import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export function PWAInstallPrompt() {
  const { canInstall, isManualInstall, install, dismiss } = usePWAInstall();
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstall = async () => {
    if (isInstalling) return;
    setIsInstalling(true);
    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  if (!canInstall) return null;

  return (
    <AnimatePresence>
      {canInstall && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed z-50 left-3 right-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:left-4 sm:right-4 md:left-auto md:right-4 md:bottom-4 md:w-[26rem]"
        >
          <div className="rounded-xl border border-border/80 bg-card/95 backdrop-blur shadow-xl p-3 sm:p-4 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/30 shrink-0">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <p className="text-sm font-bold tracking-wide">Install SKOLA</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isManualInstall
                    ? "Open your browser menu and choose Add to Home Screen (or Install App) to pin SKOLA."
                    : "Add to your home screen for quick access, offline support, and a native app experience."}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {!isManualInstall && (
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1.5 sm:w-auto"
                    onClick={handleInstall}
                    disabled={isInstalling}
                  >
                    <Download className="h-3 w-3" />
                    {isInstalling ? "Opening..." : "Install app"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={dismiss}
                  disabled={isInstalling}
                >
                  Not now (7 days)
                </Button>
              </div>
            </div>
            <button
              onClick={dismiss}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0 p-1"
              aria-label="Dismiss install prompt"
              disabled={isInstalling}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
