import { Crown, Flame, Medal } from "lucide-react";
import type { LeaderboardEntry } from "@/services/arena";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/authStore";

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-4 w-4 text-amber-500" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-400" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-700" />;
  return <span className="text-xs font-black tabular-nums text-muted-foreground">#{rank}</span>;
}

interface LeaderboardProps {
  data: LeaderboardEntry[];
  lastItemRef?: (node: HTMLDivElement | null) => void;
}

export function Leaderboard({ data, lastItemRef }: LeaderboardProps) {
  const { user } = useAuth();
  const currentAnonId = user?.anonymousId || user?.anonymous_id;

  return (
    <div className="border border-border overflow-x-auto">
      <div className="min-w-[400px]">
        <div className="grid grid-cols-[36px_1fr_56px_44px_56px] sm:grid-cols-[48px_1fr_80px_64px_64px_80px] gap-1 px-3 py-2 bg-muted/50 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">XP</span>
          <span className="text-right">Wins</span>
          <span className="text-right hidden sm:block">Acc%</span>
          <span className="text-right">Streak</span>
        </div>
        {data.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No players match your search</div>
        ) : (
          data.map((entry, idx) => {
            const isCurrentUser = currentAnonId === entry.anonymous_id;
            const isLast = idx === data.length - 1;
            return (
              <div
                key={`${entry.rank}-${entry.anonymous_id}`}
                ref={isLast ? lastItemRef : undefined}
                className={cn(
                  "grid grid-cols-[36px_1fr_56px_44px_56px] sm:grid-cols-[48px_1fr_80px_64px_64px_80px] gap-1 px-3 py-2.5 border-b border-border last:border-b-0 items-center",
                  isCurrentUser
                    ? "bg-primary/10 border-l-2 border-l-primary"
                    : entry.rank <= 3 && "bg-accent/30"
                )}
              >
                <div className="flex items-center justify-center">
                  <RankIcon rank={entry.rank} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">
                    {entry.anonymous_id}
                    {isCurrentUser && (
                      <span className="ml-1.5 text-[10px] font-bold text-primary uppercase tracking-wider">(You)</span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{entry.title}</p>
                </div>
                <p className="text-xs font-black tabular-nums text-right">{entry.xp.toLocaleString()}</p>
                <p className="text-xs tabular-nums text-right text-muted-foreground">{entry.wins}</p>
                <p className="text-xs tabular-nums text-right text-muted-foreground hidden sm:block">{entry.accuracy}%</p>
                <div className="flex items-center justify-end gap-1">
                  {entry.streak > 0 && <Flame className="h-3 w-3 text-amber-500" />}
                  <span className="text-xs tabular-nums font-medium">{entry.streak}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
