import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export function PWAInstallPrompt() {
  const { canInstall, install, dismiss } = usePWAInstall();

  if (!canInstall) return null;

  return (
    <AnimatePresence>
      {canInstall && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-16 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
        >
          <div className="bg-card border border-border shadow-lg p-4 flex items-start gap-3">
            <div className="p-2 bg-primary/10 border border-primary/30 shrink-0">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <p className="text-sm font-bold">Install SKOLA</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add to your home screen for quick access, offline support, and a native app experience.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-7 text-xs gap-1.5" onClick={install}>
                  <Download className="h-3 w-3" />
                  Install
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={dismiss}
                >
                  Not now
                </Button>
              </div>
            </div>
            <button
              onClick={dismiss}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
