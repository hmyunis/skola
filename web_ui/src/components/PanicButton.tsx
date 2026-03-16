import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Square } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAnnouncements, stopSurpriseAssessment, triggerSurpriseAssessment, type Announcement } from "@/services/admin";
import { toast } from "@/hooks/use-toast";
import { useClassroomStore } from "@/stores/classroomStore";

const SURPRISE_ASSESSMENT_TITLE = "Surprise Assessment Alarm";

function isActive(a: Announcement): boolean {
  if (!a.expiresAt) return true;
  return new Date(a.expiresAt) > new Date();
}

export function PanicButton() {
  const [flashing, setFlashing] = useState(false);
  const queryClient = useQueryClient();
  const activeClassroomId = useClassroomStore((s) => s.activeClassroom?.id);
  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ["announcements", activeClassroomId],
    queryFn: fetchAnnouncements,
    enabled: !!activeClassroomId,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const hasActiveAlarm = announcements.some(
    (announcement) => announcement.title === SURPRISE_ASSESSMENT_TITLE && isActive(announcement),
  );

  const triggerMutation = useMutation({
    mutationFn: triggerSurpriseAssessment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["announcements", activeClassroomId] });
      setFlashing(true);
      toast({
        title: "Alarm Triggered",
        description: "Surprise assessment alarm sent to the whole classroom.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Trigger Failed",
        description: error instanceof Error ? error.message : "Could not trigger surprise assessment alarm.",
        variant: "destructive",
      });
    },
  });

  const stopMutation = useMutation({
    mutationFn: stopSurpriseAssessment,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["announcements", activeClassroomId] });
      toast({
        title: "Alarm Stopped",
        description: result.stopped > 0
          ? `Stopped ${result.stopped} active surprise alarm${result.stopped > 1 ? "s" : ""}.`
          : "No active surprise alarm was running.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Stop Failed",
        description: error instanceof Error ? error.message : "Could not stop surprise assessment alarm.",
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {hasActiveAlarm ? (
          <button
            onClick={() => stopMutation.mutate()}
            disabled={stopMutation.isPending || triggerMutation.isPending}
            className="border border-foreground/30 px-4 py-3 text-xs font-black uppercase tracking-[0.15em] text-foreground hover:bg-accent transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span className="flex items-center gap-2">
              <Square className="h-3.5 w-3.5" />
              {stopMutation.isPending ? "STOPPING..." : "STOP ALARM"}
            </span>
          </button>
        ) : (
          <button
            onClick={() => triggerMutation.mutate()}
            disabled={triggerMutation.isPending || stopMutation.isPending}
            className="relative overflow-hidden border-2 border-destructive px-6 py-3 font-black uppercase tracking-[0.15em] text-sm group hover:scale-[1.02] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {/* Hazard stripes background */}
            <div className="absolute inset-0 hazard-stripes opacity-90" />
            <span className="relative z-10 flex items-center gap-2 text-destructive font-black [text-shadow:_-1px_-1px_0_hsl(var(--destructive-foreground)),_1px_-1px_0_hsl(var(--destructive-foreground)),_-1px_1px_0_hsl(var(--destructive-foreground)),_1px_1px_0_hsl(var(--destructive-foreground)),_0_0_8px_hsl(var(--destructive-foreground)/0.5)]">
              <AlertTriangle className="h-4 w-4" />
              {triggerMutation.isPending ? "TRIGGERING..." : "SURPRISE ASSESSMENT"}
            </span>
          </button>
        )}
      </div>

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
