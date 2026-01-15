"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col",
        month: "space-y-3",

        // Header: month label left, arrows right (SaaS booking style)
        caption:
          "flex items-center justify-between px-1 pb-3 border-b border-border/60",
        caption_label: "text-2xl font-semibold tracking-tight",
        nav: "flex items-center gap-2",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-10 w-10 rounded-lg border-0 bg-primary text-primary-foreground p-0 shadow-sm opacity-95 hover:opacity-100 hover:bg-primary/90"
        ),
        nav_button_previous: "static",
        nav_button_next: "static",

        // 7 equal columns (repeat(7, minmax(0, 1fr)))
        table: "w-full border-collapse",
        head_row: "grid grid-cols-7 gap-1 pt-3",
        head_cell:
          "h-9 w-full grid place-items-center text-xl font-semibold text-foreground/90",
        row: "grid grid-cols-7 gap-1",
        cell: "h-11 w-full p-0 flex items-center justify-center",

        // 44x44 tap target; square cell like the reference UI
        day: cn(
          buttonVariants({ variant: "ghost" }),
          [
            "h-11 w-11 p-0",
            "rounded-lg",
            "text-base font-medium leading-none",
            "aria-selected:opacity-100",
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
            "focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-100 disabled:hover:bg-transparent",
          ].join(" ")
        ),
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "ring-1 ring-primary/35",
        day_outside:
          "day-outside text-muted-foreground/70 opacity-45 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-35",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className, ...props }) => {
          if (orientation === "left") {
            return (
              <ChevronLeft className={cn("h-4 w-4", className)} {...props} />
            );
          }
          return (
            <ChevronRight className={cn("h-4 w-4", className)} {...props} />
          );
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
