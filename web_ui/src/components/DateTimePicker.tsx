import { useEffect, useMemo, useState } from "react";
import { CalendarIcon, Clock3, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function isValidDate(value?: string): boolean {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick date & time",
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);

  const parsed = useMemo(() => {
    if (!isValidDate(value)) return undefined;
    return new Date(value);
  }, [value]);

  const [selected, setSelected] = useState<Date | undefined>(parsed);

  useEffect(() => {
    setSelected(parsed);
  }, [parsed]);

  const timeValue = selected
    ? `${String(selected.getHours()).padStart(2, "0")}:${String(selected.getMinutes()).padStart(2, "0")}`
    : "";

  const applyDate = (nextDate?: Date) => {
    if (!nextDate) return;
    const base = selected || new Date();
    nextDate.setHours(base.getHours(), base.getMinutes(), 0, 0);
    setSelected(nextDate);
    onChange(nextDate.toISOString());
  };

  const applyTime = (nextTime: string) => {
    const [h, m] = nextTime.split(":");
    if (!selected || h === undefined || m === undefined) return;
    const next = new Date(selected);
    next.setHours(Number(h), Number(m), 0, 0);
    setSelected(next);
    onChange(next.toISOString());
  };

  const clear = () => {
    setSelected(undefined);
    onChange("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "min-h-9 h-auto justify-start items-start text-left font-normal text-xs w-full py-2",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 mr-1.5 mt-0.5 shrink-0" />
          <span className="whitespace-normal break-words leading-tight">
            {selected ? format(selected, "MMM d, yyyy h:mm a") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 space-y-3 z-[100]" align="start" side="bottom" sideOffset={4}>
        <Calendar
          mode="single"
          selected={selected}
          onSelect={applyDate}
          initialFocus
          className="p-0 pointer-events-auto"
        />
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Clock3 className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="time"
              value={timeValue}
              onChange={(e) => applyTime(e.target.value)}
              disabled={!selected}
              className="h-8 pl-7 text-xs"
            />
          </div>
          <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={clear}>
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
