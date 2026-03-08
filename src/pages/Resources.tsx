import { FolderOpen } from "lucide-react";

const Resources = () => (
  <div className="p-4 md:p-6 space-y-4 max-w-5xl">
    <div className="border-b border-border pb-4">
      <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">File Hub</p>
      <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Resources</h1>
    </div>
    <div className="border border-dashed border-muted-foreground/30 p-12 flex flex-col items-center justify-center gap-3">
      <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-medium">Coming Soon</p>
      <p className="text-xs text-muted-foreground/60">File explorer with ratings</p>
    </div>
  </div>
);

export default Resources;
