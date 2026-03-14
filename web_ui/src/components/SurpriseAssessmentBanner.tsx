import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, X } from "lucide-react";
import {
  fetchAnnouncements,
  getDismissedAnnouncementIds,
  dismissAnnouncement,
  type Announcement,
} from "@/services/admin";
import { useClassroomStore } from "@/stores/classroomStore";

const SURPRISE_ASSESSMENT_TITLE = "Surprise Assessment Alarm";

function isActive(a: Announcement): boolean {
  if (!a.expiresAt) return true;
  return new Date(a.expiresAt) > new Date();
}

export function SurpriseAssessmentBanner() {
  const activeClassroomId = useClassroomStore((s) => s.activeClassroom?.id);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => getDismissedAnnouncementIds());
  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ["announcements", activeClassroomId],
    queryFn: fetchAnnouncements,
    enabled: !!activeClassroomId,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const alarm = useMemo(() => {
    return announcements
      .filter((a) => a.title === SURPRISE_ASSESSMENT_TITLE)
      .filter(isActive)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [announcements]);

  if (!alarm || dismissedIds.includes(alarm.id)) return null;

  return (
    <div className="border-2 border-destructive bg-destructive/10 p-4 sm:p-5 relative">
      <button
        onClick={() => {
          dismissAnnouncement(alarm.id);
          setDismissedIds((prev) => [...prev, alarm.id]);
        }}
        className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center text-destructive/80 hover:text-destructive"
        aria-label="Dismiss surprise assessment alert"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <AlertTriangle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.28em] text-destructive font-black">
            Emergency Notice
          </p>
          <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-destructive">
            Surprise Assessment In Progress
          </h2>
          <p className="text-xs sm:text-sm text-destructive/90">
            {alarm.content}
          </p>
        </div>
      </div>
    </div>
  );
}
