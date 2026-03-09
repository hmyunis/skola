import { useState, useEffect } from "react";
import {
  loadAnnouncements,
  getDismissedAnnouncementIds,
  dismissAnnouncement,
  type Announcement,
} from "@/services/admin";
import { Megaphone, Pin, AlertTriangle, X, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const priorityConfig = {
  low: { label: "Low", color: "bg-muted text-muted-foreground border-border" },
  normal: { label: "Normal", color: "bg-primary/10 text-primary border-primary/30" },
  high: { label: "High", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  urgent: { label: "Urgent", color: "bg-destructive/10 text-destructive border-destructive/30" },
};

const Announcements = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [showDismissed, setShowDismissed] = useState(false);

  useEffect(() => {
    setAnnouncements(loadAnnouncements());
    setDismissed(getDismissedAnnouncementIds());
  }, []);

  // Only show announcements targeted at students/all, not expired
  const relevant = announcements
    .filter((a) => a.targetAudience === "all" || a.targetAudience === "students")
    .filter((a) => {
      if (!a.expiresAt) return true;
      return new Date(a.expiresAt) > new Date();
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const active = relevant.filter((a) => !dismissed.includes(a.id));
  const dismissedItems = relevant.filter((a) => dismissed.includes(a.id));

  const handleDismiss = (id: string) => {
    dismissAnnouncement(id);
    setDismissed((prev) => [...prev, id]);
  };

  const displayList = showDismissed ? dismissedItems : active;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl">
      <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Updates</p>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Announcements</h1>
        </div>
        <Button
          size="sm"
          variant={showDismissed ? "default" : "outline"}
          className="w-full sm:w-auto"
          onClick={() => setShowDismissed(!showDismissed)}
        >
          {showDismissed ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          {showDismissed ? `Active (${active.length})` : `Dismissed (${dismissedItems.length})`}
        </Button>
      </div>

      {displayList.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          {showDismissed ? "No dismissed announcements" : "No announcements right now"}
        </div>
      ) : (
        <div className="space-y-2">
          {displayList.map((a) => {
            const pCfg = priorityConfig[a.priority];
            const isDismissed = dismissed.includes(a.id);
            return (
              <div
                key={a.id}
                className={cn(
                  "border p-3 sm:p-4 space-y-2 transition-colors",
                  isDismissed ? "opacity-60 border-border" : a.pinned ? "border-primary/30 bg-primary/5" : "border-border hover:bg-accent/20"
                )}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  {a.pinned && <Pin className="h-3 w-3 text-primary fill-primary" />}
                  {a.priority === "urgent" && <AlertTriangle className="h-3 w-3 text-destructive" />}
                  <span className={cn("px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider", pCfg.color)}>
                    {pCfg.label}
                  </span>
                  <div className="flex-1" />
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                  {!isDismissed && (
                    <button
                      onClick={() => handleDismiss(a.id)}
                      className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <h3 className="text-sm font-bold">{a.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{a.content}</p>
                <p className="text-[10px] text-muted-foreground">
                  By {a.createdBy}{a.expiresAt ? ` · Expires ${a.expiresAt}` : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Announcements;
