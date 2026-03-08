import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a Date to 12-hour time string: "9:00 AM", "1:30 PM" */
export function formatTime12(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Convert 24-hour number to 12-hour label: 8 → "8 AM", 13 → "1 PM" */
export function hourTo12(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour} ${period}`;
}

/** Convert Date to "HH:MM" string for <input type="time"> */
export function dateToTimeInput(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Convert "HH:MM" time string to a Date based on a reference date */
export function timeInputToDate(base: Date, timeStr: string): Date {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}
