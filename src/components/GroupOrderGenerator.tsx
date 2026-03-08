import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shuffle, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function GroupOrderGenerator() {
  const [count, setCount] = useState("");
  const [order, setOrder] = useState<number[]>([]);
  const [rolling, setRolling] = useState(false);

  const maxGroups = Math.min(Math.max(parseInt(count) || 0, 0), 99);

  const roll = useCallback(() => {
    if (maxGroups < 2) return;
    setRolling(true);
    setOrder([]);

    // Animate through a few random states before settling
    let ticks = 0;
    const totalTicks = 6;
    const interval = setInterval(() => {
      ticks++;
      setOrder(shuffle(Array.from({ length: maxGroups }, (_, i) => i + 1)));
      if (ticks >= totalTicks) {
        clearInterval(interval);
        setRolling(false);
      }
    }, 120);
  }, [maxGroups]);

  const reset = () => {
    setOrder([]);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shuffle className="h-4 w-4 text-primary" />
          <CardTitle className="text-xs">Group Order Generator</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Randomly generate presentation or activity order for groups.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="number"
            min={2}
            max={99}
            value={count}
            onChange={(e) => {
              setCount(e.target.value);
              setOrder([]);
            }}
            placeholder="Number of groups"
            className="h-9 text-sm max-w-[200px]"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={roll}
              disabled={maxGroups < 2 || rolling}
              className="gap-1.5"
            >
              <Shuffle className="h-3 w-3" />
              {rolling ? "Rolling..." : order.length ? "Re-roll" : "Roll"}
            </Button>
            {order.length > 0 && (
              <Button size="sm" variant="outline" onClick={reset}>
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {order.length > 0 && (
            <motion.div
              key={order.join(",")}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="grid gap-1.5"
              style={{
                gridTemplateColumns: `repeat(auto-fill, minmax(${order.length > 20 ? "56px" : "72px"}, 1fr))`,
              }}
            >
              {order.map((groupNum, idx) => (
                <motion.div
                  key={`${idx}-${groupNum}`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: rolling ? 0 : idx * 0.04, duration: 0.2 }}
                  className={`flex items-center gap-1.5 p-2 border text-xs font-bold transition-colors ${
                    idx === 0
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-foreground"
                  }`}
                >
                  <span className="text-[9px] text-muted-foreground tabular-nums w-4 shrink-0">
                    {idx + 1}.
                  </span>
                  <span className="tabular-nums">G{groupNum}</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
