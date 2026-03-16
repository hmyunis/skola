import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, Loader2, Plus, Search, Target, Trophy, Zap } from "lucide-react";
import {
  fetchArenaStats,
  fetchLeaderboard,
  type ArenaPlayerStats,
  type CustomQuiz,
} from "@/services/arena";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ARENA_TITLE_PROGRESSION, DEFAULT_PLAYER_STATS } from "./constants";
import { getTitle } from "./utils";
import { CreateQuizDialog } from "./components/CreateQuizDialog";
import { CustomQuizzesList } from "./components/CustomQuizzesList";
import { Leaderboard } from "./components/Leaderboard";
import { QuizBattle } from "./components/QuizBattle";

const ArenaPage = () => {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [playingCustomQuiz, setPlayingCustomQuiz] = useState<CustomQuiz | null>(null);
  const [leaderboardSearchInput, setLeaderboardSearchInput] = useState("");
  const [leaderboardSearch, setLeaderboardSearch] = useState("");
  const leaderboardObserverRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setLeaderboardSearch(leaderboardSearchInput.trim()), 300);
    return () => clearTimeout(timeout);
  }, [leaderboardSearchInput]);

  const statsQuery = useQuery({
    queryKey: ["arenaStats"],
    queryFn: fetchArenaStats,
  });

  const leaderboardQuery = useInfiniteQuery({
    queryKey: ["leaderboard", leaderboardSearch],
    queryFn: ({ pageParam = 1 }) =>
      fetchLeaderboard({
        page: pageParam,
        limit: 20,
        search: leaderboardSearch || undefined,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.lastPage ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
  });

  const leaderboard = useMemo(
    () => leaderboardQuery.data?.pages.flatMap((page) => page.data) || [],
    [leaderboardQuery.data],
  );
  const isFetchingMoreLeaderboard = leaderboardQuery.isFetchingNextPage;
  const hasMoreLeaderboard = leaderboardQuery.hasNextPage;
  const fetchMoreLeaderboard = leaderboardQuery.fetchNextPage;

  const lastLeaderboardRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isFetchingMoreLeaderboard) return;
      if (leaderboardObserverRef.current) leaderboardObserverRef.current.disconnect();
      leaderboardObserverRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMoreLeaderboard) {
          fetchMoreLeaderboard();
        }
      });
      if (node) leaderboardObserverRef.current.observe(node);
    },
    [isFetchingMoreLeaderboard, hasMoreLeaderboard, fetchMoreLeaderboard],
  );

  useEffect(() => {
    return () => {
      if (leaderboardObserverRef.current) leaderboardObserverRef.current.disconnect();
    };
  }, []);

  const playerStats = statsQuery.data || DEFAULT_PLAYER_STATS;
  const title = playerStats.title || getTitle(playerStats.xp);
  const accuracy = playerStats.totalAnswers > 0
    ? Math.round((playerStats.correctAnswers / playerStats.totalAnswers) * 100)
    : 0;

  const handleUpdateStats = useCallback((stats: ArenaPlayerStats) => {
    queryClient.setQueryData(["arenaStats"], stats);
    setPlayingCustomQuiz(null);
  }, [queryClient]);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl">
      <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Gamification</p>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">The Arena</h1>
        </div>
        <Button size="sm" className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3 w-3" />
          Create Quiz
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-widest text-primary">Title</p>
            <p className="text-lg font-black mt-1">{statsQuery.isLoading ? "..." : title}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-primary" />
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">XP</p>
            </div>
            <p className="text-2xl font-black tabular-nums mt-1">{playerStats.xp.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1">
              <Trophy className="h-3 w-3 text-amber-500" />
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Wins</p>
            </div>
            <p className="text-2xl font-black tabular-nums mt-1">{playerStats.wins}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1">
              <Flame className="h-3 w-3 text-amber-500" />
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Streak</p>
            </div>
            <p className="text-2xl font-black tabular-nums mt-1">{playerStats.streak}</p>
            {playerStats.bestStreak > 0 && (
              <p className="text-[9px] text-muted-foreground mt-0.5">Best: {playerStats.bestStreak}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1">
              <Target className="h-3 w-3 text-primary" />
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Accuracy</p>
            </div>
            <p className="text-2xl font-black tabular-nums mt-1">{accuracy}%</p>
          </CardContent>
        </Card>
      </div>

      <QuizBattle
        onUpdateStats={handleUpdateStats}
        customQuiz={playingCustomQuiz}
      />

      <CustomQuizzesList onPlay={(quiz) => setPlayingCustomQuiz(quiz)} />

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Leaderboard</h2>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search players..."
            value={leaderboardSearchInput}
            onChange={(event) => setLeaderboardSearchInput(event.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {leaderboardQuery.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <div className="h-5 w-5 bg-muted animate-pulse" />
                <div className="h-6 w-6 bg-muted animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-24 bg-muted animate-pulse" />
                  <div className="h-2.5 w-16 bg-muted animate-pulse" />
                </div>
                <div className="h-4 w-10 bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        ) : leaderboardQuery.isError ? (
          <div className="border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Could not load leaderboard right now.
          </div>
        ) : (
          <>
            <Leaderboard data={leaderboard} lastItemRef={lastLeaderboardRef} />
            {leaderboardQuery.isFetchingNextPage && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>

      <div className="border border-border p-4 space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Title Progression</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ARENA_TITLE_PROGRESSION).map(([name, minXp]) => {
            const achieved = playerStats.xp >= minXp;
            return (
              <div
                key={name}
                className={cn(
                  "px-2.5 py-1.5 border text-[10px] font-bold uppercase tracking-wider",
                  achieved
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "border-border text-muted-foreground/40"
                )}
              >
                {name}
                <span className="ml-1 font-normal">{minXp}+</span>
              </div>
            );
          })}
        </div>
      </div>

      <CreateQuizDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["arenaQuizzes"] });
        }}
      />
    </div>
  );
};

export default ArenaPage;
