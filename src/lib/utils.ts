import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimeRange(startTime: string, endTime: string): string {
  const start = String(startTime ?? "").trim();
  const end = String(endTime ?? "").trim();
  if (!start && !end) return "";
  if (!end) return start;
  if (!start) return end;
  return `${start}-${end}`;
}
