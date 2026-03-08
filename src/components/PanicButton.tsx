import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";

export function PanicButton() {
  const [flashing, setFlashing] = useState(false);

  return (
    <>
      <button
        onClick={() => setFlashing(true)}
        className="relative overflow-hidden border-2 border-destructive px-6 py-3 font-black uppercase tracking-[0.15em] text-sm group hover:scale-[1.02] transition-transform"
      >
        {/* Hazard stripes background */}
        <div className="absolute inset-0 hazard-stripes opacity-90" />
        <span className="relative z-10 flex items-center gap-2 text-foreground drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">
          <AlertTriangle className="h-4 w-4" />
          SURPRISE ASSESSMENT
        </span>
      </button>

      <AnimatePresence>
        {flashing && (
          <motion.div
            className="fixed inset-0 z-[200] bg-destructive flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 1, 0.2, 1, 0.1, 0.8, 0],
            }}
            transition={{ duration: 2, ease: "easeInOut" }}
            onAnimationComplete={() => setFlashing(false)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: [0, 1, 1, 0] }}
              transition={{ duration: 2 }}
              className="text-destructive-foreground text-center"
            >
              <AlertTriangle className="h-20 w-20 mx-auto mb-4" />
              <p className="text-3xl font-black uppercase tracking-[0.3em]">
                SURPRISE ASSESSMENT
              </p>
              <p className="text-sm uppercase tracking-widest mt-2 opacity-80">
                Brace yourselves
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
