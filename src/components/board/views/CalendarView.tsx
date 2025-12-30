"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
} from "date-fns";
import { Board, Item, Column } from "@/types";

interface CalendarEventProps {
  item: Item;
  board: Board | null;
  onEdit: (item: Item) => void;
}

const CalendarEvent = ({ item, board, onEdit }: CalendarEventProps) => {
  const priorityColumn = board?.columns?.find((col) => col.type === "priority");
  const priorityValue = priorityColumn ? item[priorityColumn.id] : undefined;
  const priorityOption = (priorityColumn as any)?.options?.choices?.find(
    (c: any) => c.value === priorityValue
  );

  return (
    <div
      className="p-1.5 mb-1 bg-white dark:bg-gray-800 rounded-md shadow-sm border border-[#E1E5F3] dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105"
      title={item.name}
      onClick={(e) => {
        e.stopPropagation();
        onEdit(item);
      }}
    >
      <div className="flex items-center gap-1.5">
        {priorityOption && (
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: priorityOption.color || "#ccc" }}
          />
        )}
        <p className="text-xs font-medium text-[#323338] dark:text-gray-200 truncate">
          {item.name}
        </p>
      </div>
    </div>
  );
};

interface CalendarViewProps {
  board: Board | null;
  items: Item[];
  onUpdateItem: (itemId: string, data: any) => void;
  onDeleteItem: (itemId: string) => void;
  onEditItem: (item: Item) => void;
}

export default function CalendarView({
  board,
  items,
  onUpdateItem,
  onDeleteItem,
  onEditItem,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dateColumnId, setDateColumnId] = useState<string | null>(null);

  useEffect(() => {
    // Try to find a 'date' type column to use for events
    const dateCol = board?.columns?.find((col) => col.type === "date");
    if (dateCol) {
      setDateColumnId(dateCol.id);
    } else {
      // If no 'date' column, try to find 'due_date' (common default)
      const dueDateCol = board?.columns?.find((col) => col.id === "due_date");
      if (dueDateCol && dueDateCol.type === "date") {
        setDateColumnId(dueDateCol.id);
      }
    }
  }, [board]);

  const renderHeader = () => {
    return (
      <div className="flex justify-between items-center mb-4 px-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-xl font-semibold text-[#323338] dark:text-gray-200">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    );
  };

  const renderDays = () => {
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return (
      <div className="grid grid-cols-7 text-center text-xs font-medium text-[#676879] dark:text-gray-400 mb-2">
        {daysOfWeek.map((day) => (
          <div key={day} className="py-2 border-b dark:border-gray-700">
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const dateFormat = "d";
    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, dateFormat);
        const cloneDay = day;

        // Find items for this day
        const dayItems = dateColumnId
          ? items.filter((item) => {
              const itemDate = item[dateColumnId];
              return itemDate && isSameDay(new Date(itemDate), cloneDay);
            })
          : [];

        days.push(
          <div
            className={`min-h-[100px] p-2 border border-gray-100 dark:border-gray-700 relative ${
              !isSameMonth(day, monthStart)
                ? "bg-gray-50 dark:bg-gray-900 text-gray-400"
                : "bg-white dark:bg-gray-800"
            }`}
            key={day.toString()}
          >
            <span
              className={`text-sm font-medium block mb-1 ${
                isSameDay(day, new Date())
                  ? "text-blue-600 bg-blue-50 dark:bg-blue-900/20 w-6 h-6 rounded-full flex items-center justify-center"
                  : "text-[#323338] dark:text-gray-300"
              }`}
            >
              {formattedDate}
            </span>
            <div className="space-y-1 overflow-y-auto max-h-[80px]">
              {dayItems.map((item) => (
                <CalendarEvent
                  key={item.id}
                  item={item}
                  board={board}
                  onEdit={onEditItem}
                />
              ))}
            </div>
          </div>
        );
        day = new Date(day.setDate(day.getDate() + 1)); // Use setDate to avoid timezone issues with addDays sometimes? No, addDays is better but this is legacy logic adaptation
        // Actually, let's use date-fns addDays logic implicitly by loop
        // Wait, `day` is updated at end of loop.
        // `day = addDays(day, 1)` is safer.
        // But here `day` is a Date object, `setDate` mutates it.
        // `eachDayOfInterval` is cleaner but let's stick to this loop structure for now.
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {rows}
      </div>
    );
  };

  if (!dateColumnId) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="max-w-md mx-auto">
          <h3 className="text-xl font-semibold mb-2">
            Calendar view requires a Date column
          </h3>
          <p>Please add a 'Date' type column to enable Calendar view.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 p-6 overflow-y-auto">
      {renderHeader()}
      {renderDays()}
      {renderCells()}
    </div>
  );
}
