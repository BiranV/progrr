"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  format,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  differenceInDays,
  isWithinInterval,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { Board, Item, Column } from "@/types";

const TIMELINE_ITEM_HEIGHT = 32; // px
const DAY_CELL_WIDTH = 40; // px

interface TimelineItemBarProps {
  item: Item;
  board: Board | null;
  startDate: Date;
  endDate: Date;
  timelineStartDate: Date;
  zoomLevel: string;
  startDateColId: string;
  endDateColId: string;
}

const TimelineItemBar = ({
  item,
  board,
  startDate,
  endDate,
  timelineStartDate,
  zoomLevel,
  startDateColId,
  endDateColId,
}: TimelineItemBarProps) => {
  const itemStartDateStr = item[startDateColId];
  const itemEndDateStr = item[endDateColId];

  if (!itemStartDateStr || !itemEndDateStr) return null;

  const itemStart = new Date(itemStartDateStr);
  const itemEnd = new Date(itemEndDateStr);

  // Ensure dates are valid
  if (isNaN(itemStart.getTime()) || isNaN(itemEnd.getTime())) return null;

  // Ensure itemStart is before or same as itemEnd
  const displayStart = itemStart > itemEnd ? itemEnd : itemStart;
  const displayEnd = itemStart > itemEnd ? itemStart : itemEnd;

  // Check if the item falls within the current timeline view
  if (
    !isWithinInterval(displayStart, {
      start: timelineStartDate,
      end: endDate,
    }) &&
    !isWithinInterval(displayEnd, { start: timelineStartDate, end: endDate }) &&
    !(displayStart < timelineStartDate && displayEnd > endDate)
  ) {
    return null;
  }

  const offsetDays = Math.max(
    0,
    differenceInDays(displayStart, timelineStartDate)
  );
  let durationDays = differenceInDays(displayEnd, displayStart) + 1;

  // Adjust duration if item extends beyond timeline view
  if (displayStart < timelineStartDate) {
    durationDays = differenceInDays(displayEnd, timelineStartDate) + 1;
  }
  if (displayEnd > endDate) {
    durationDays =
      differenceInDays(
        endDate,
        displayStart < timelineStartDate ? timelineStartDate : displayStart
      ) + 1;
  }
  durationDays = Math.max(1, durationDays); // Minimum 1 day width

  // Adjust width based on zoom
  // Simplified zoom logic for now, assuming 'week' is default and maps to 1x
  // If zoomLevel is 'month', we might want to squeeze it.
  // The legacy code had some logic: (zoomLevel === 'week' ? 1 : (zoomLevel === 'month' ? (30/7) : (1/7) ))
  // Wait, if zoomLevel is month, we show a whole month, so days should be narrower?
  // Or maybe the legacy code meant something else.
  // Let's stick to a simple constant width for now or try to replicate.
  // If zoomLevel is 'month', we show ~30 days. If 'week', ~7 days.
  // If container width is fixed, day width changes.
  // But here DAY_CELL_WIDTH is constant 40px.
  // So 'month' view would be very wide (30 * 40 = 1200px).
  // 'week' view would be 7 * 40 = 280px.
  // The legacy code logic seems to adjust width multiplier?
  // Let's just use DAY_CELL_WIDTH for now and assume horizontal scroll.

  const left = offsetDays * DAY_CELL_WIDTH;
  const width = durationDays * DAY_CELL_WIDTH - 4; // -4 for padding/margin

  const priorityColumn = board?.columns?.find((col) => col.type === "priority");
  const priorityValue = priorityColumn ? item[priorityColumn.id] : undefined;
  const priorityOption = (priorityColumn as any)?.options?.choices?.find(
    (c: any) => c.value === priorityValue
  );
  const barColor = priorityOption?.color || board?.color || "#0073EA";

  return (
    <div
      className="absolute h-[28px] rounded flex items-center px-2 text-white text-xs font-medium truncate shadow-sm"
      style={{
        left: `${left}px`,
        width: `${width}px`,
        top: "2px", // Small offset from top of row
        backgroundColor: barColor,
        opacity: 0.9,
      }}
      title={`${item.name} (${format(displayStart, "MMM d")} - ${format(
        displayEnd,
        "MMM d"
      )})`}
    >
      {item.name}
    </div>
  );
};

interface TimelineViewProps {
  board: Board | null;
  items: Item[];
}

export default function TimelineView({ board, items }: TimelineViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [zoomLevel, setZoomLevel] = useState("week"); // 'day', 'week', 'month'
  const [startDateColId, setStartDateColId] = useState<string | null>(null);
  const [endDateColId, setEndDateColId] = useState<string | null>(null);

  useEffect(() => {
    const dateCols = board?.columns?.filter((col) => col.type === "date");
    if (dateCols && dateCols.length >= 2) {
      setStartDateColId(dateCols[0].id); // Default to first date column
      setEndDateColId(dateCols[1].id); // Default to second date column
    } else if (dateCols && dateCols.length === 1) {
      setStartDateColId(dateCols[0].id);
      setEndDateColId(dateCols[0].id); // Use same for start/end if only one
    } else {
      // Fallback to common names if no 'date' type columns
      const sDate = board?.columns?.find(
        (c) => c.id === "startDate" || c.title.toLowerCase().includes("start")
      )?.id;
      const eDate = board?.columns?.find(
        (c) =>
          c.id === "endDate" ||
          c.id === "due_date" ||
          c.title.toLowerCase().includes("end") ||
          c.title.toLowerCase().includes("due")
      )?.id;
      if (sDate) setStartDateColId(sDate);
      if (eDate) setEndDateColId(eDate);
    }
  }, [board]);

  const { timelineStartDate, timelineEndDate, daysHeader } = useMemo(() => {
    let start, end;
    if (zoomLevel === "day") {
      start = currentDate;
      end = addDays(currentDate, 6); // Show 7 days
    } else if (zoomLevel === "week") {
      start = startOfWeek(currentDate);
      end = endOfWeek(currentDate);
    } else {
      // month
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
    }

    const days = eachDayOfInterval({ start, end });
    return {
      timelineStartDate: start,
      timelineEndDate: end,
      daysHeader: days,
    };
  }, [currentDate, zoomLevel]);

  if (!startDateColId) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="max-w-md mx-auto">
          <h3 className="text-xl font-semibold mb-2">
            Timeline view requires Date columns
          </h3>
          <p>
            Please add at least one 'Date' type column to enable Timeline view.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 p-6 overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if (zoomLevel === "week") setCurrentDate(subDays(currentDate, 7));
              else if (zoomLevel === "month")
                setCurrentDate(subMonths(currentDate, 1));
              else setCurrentDate(subDays(currentDate, 1));
            }}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-xl font-semibold text-[#323338] dark:text-gray-200 w-40 text-center">
            {zoomLevel === "month"
              ? format(currentDate, "MMMM yyyy")
              : zoomLevel === "week"
              ? `Week of ${format(timelineStartDate, "MMM d")}`
              : format(currentDate, "MMM d, yyyy")}
          </h2>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if (zoomLevel === "week") setCurrentDate(addDays(currentDate, 7));
              else if (zoomLevel === "month")
                setCurrentDate(addMonths(currentDate, 1));
              else setCurrentDate(addDays(currentDate, 1));
            }}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant={zoomLevel === "week" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setZoomLevel("week")}
          >
            Week
          </Button>
          <Button
            variant={zoomLevel === "month" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setZoomLevel("month")}
          >
            Month
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="min-w-max">
          {/* Header */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
            <div className="w-48 flex-shrink-0 p-2 font-medium text-sm border-r border-gray-200 dark:border-gray-700">
              Item
            </div>
            <div className="flex">
              {daysHeader.map((day) => (
                <div
                  key={day.toString()}
                  className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 p-2 text-center text-xs font-medium"
                  style={{ width: `${DAY_CELL_WIDTH}px` }}
                >
                  <div className="text-gray-500 dark:text-gray-400">
                    {format(day, "EEE")}
                  </div>
                  <div className="text-gray-900 dark:text-gray-200">
                    {format(day, "d")}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex hover:bg-gray-50 dark:hover:bg-gray-800/50 relative"
                style={{ height: `${TIMELINE_ITEM_HEIGHT}px` }}
              >
                <div className="w-48 flex-shrink-0 p-2 text-sm border-r border-gray-200 dark:border-gray-700 truncate flex items-center">
                  {item.name}
                </div>
                <div className="flex relative flex-grow">
                  {/* Grid lines */}
                  {daysHeader.map((day) => (
                    <div
                      key={day.toString()}
                      className="flex-shrink-0 border-r border-gray-100 dark:border-gray-800 h-full"
                      style={{ width: `${DAY_CELL_WIDTH}px` }}
                    />
                  ))}

                  {/* Item Bar */}
                  <TimelineItemBar
                    item={item}
                    board={board}
                    startDate={timelineStartDate}
                    endDate={timelineEndDate}
                    timelineStartDate={timelineStartDate}
                    zoomLevel={zoomLevel}
                    startDateColId={startDateColId!}
                    endDateColId={endDateColId || startDateColId!}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
