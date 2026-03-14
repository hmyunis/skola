import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Flag } from "lucide-react";
import { saveUserReport, type UserReport } from "@/services/admin";
import { reportResource } from "@/services/resources";
import { reportLoungeContent } from "@/services/lounge";
import { useAuth } from "@/stores/authStore";
import { toast } from "@/hooks/use-toast";

const REPORT_REASONS = [
  "Harassment",
  "Spam",
  "Offensive content",
  "Copyright violation",
  "Academic dishonesty",
  "Misinformation",
  "Other",
];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: UserReport["type"];
  contentId: string;
  contentPreview: string;
  contentAuthor: string;
}

export function ReportDialog({
  open,
  onOpenChange,
  contentType,
  contentId,
  contentPreview,
  contentAuthor,
}: ReportDialogProps) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  const { userName } = useAuth();

  const handleSubmit = async () => {
    if (!reason) return;
    const resolvedReason = reason === "Other" && details.trim() ? details.trim() : reason;
    try {
      if (contentType === "resource") {
        await reportResource(contentId, { reason: resolvedReason, details: details.trim() || undefined });
      } else if (contentType === "post" || contentType === "reply") {
        await reportLoungeContent({
          contentType,
          contentId,
          reason: resolvedReason,
          details: details.trim() || undefined,
        });
      } else {
        saveUserReport({
          id: `report-${Date.now()}`,
          type: contentType,
          contentId,
          content: contentPreview.slice(0, 200),
          author: contentAuthor,
          reason: resolvedReason,
          reportedBy: userName,
          reportedAt: new Date().toISOString(),
          status: "pending",
        });
      }
      toast({ title: "Report Submitted", description: "An admin will review this content." });
      setReason("");
      setDetails("");
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Report Failed",
        description: err?.message || "Could not submit report.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wider text-sm flex items-center gap-2">
            <Flag className="h-4 w-4 text-destructive" /> Report Content
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground line-clamp-2 border border-border p-2">
            "{contentPreview.slice(0, 120)}{contentPreview.length > 120 ? "…" : ""}"
          </p>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Reason</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {reason === "Other" && (
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Details</label>
              <Textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe the issue..."
                className="min-h-[60px] text-sm resize-none"
                rows={2}
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!reason || (reason === "Other" && !details.trim())}
              onClick={handleSubmit}
            >
              <Flag className="h-3 w-3" /> Submit Report
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
