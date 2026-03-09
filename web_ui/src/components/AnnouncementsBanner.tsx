import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  loadAnnouncements,
  getDismissedAnnouncementIds,
  dismissAnnouncement,
  type Announcement,
} from "@/services/admin";
import { X, Megaphone, ChevronRight, AlertTriangle, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const priorityStyles = {
  low: "border-border bg-muted/50",
  normal: "border-primary/30 bg-primary/5",
  high: "border-amber-500/30 bg-amber-500/5",
  urgent: "border-destructive/30 bg-destructive/5",
};

export function AnnouncementsBanner() {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    setAnnouncements(loadAnnouncements());
    setDismissed(getDismissedAnnouncementIds());
  }, []);

  // Filter: not dismissed, target "all" or "students", not expired
  const visible = announcements
    .filter((a) => !dismissed.includes(a.id))
    .filter((a) => a.targetAudience === "all" || a.targetAudience === "students")
    .filter((a) => {
      if (!a.expiresAt) return true;
      return new Date(a.expiresAt) > new Date();
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const pOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      return pOrder[a.priority] - pOrder[b.priority];
    })
    .slice(0, 3); // Show max 3

  const handleDismiss = (id: string) => {
    dismissAnnouncement(id);
    setDismissed((prev) => [...prev, id]);
  };

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((a) => (
        <div
          key={a.id}
          className={cn(
            "border p-3 flex items-start gap-3 transition-colors",
            priorityStyles[a.priority]
          )}
        >
          <div className="shrink-0 mt-0.5">
            {a.priority === "urgent" ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : a.pinned ? (
              <Pin className="h-4 w-4 text-primary fill-primary" />
            ) : (
              <Megaphone className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold leading-tight">{a.title}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{a.content}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => handleDismiss(a.id)}
              className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={() => navigate("/announcements")}
        className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors font-bold"
      >
        View all announcements <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}
