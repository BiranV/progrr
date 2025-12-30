"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Item, Board } from "@/types";
import { db } from "@/lib/db";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  isPast,
} from "date-fns";
import { motion } from "framer-motion";

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CalendarModal({ isOpen, onClose }: CalendarModalProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [items, setItems] = useState<Item[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadCalendarData();
    }
  }, [isOpen]);

  const loadCalendarData = async () => {
    setIsLoading(true);
    try {
      // Fetch all items and boards
      // Note: In a real app with many items, we should filter by date range
      const itemsData = await db.entities.Item.filter({});
      const boardsData = await db.entities.Board.filter({});
      setItems(itemsData);
      setBoards(boardsData);
    } catch (error) {
      console.error("Error loading calendar data:", error);
    }
    setIsLoading(false);
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get items with due dates
  const getItemsForDate = (date: Date) => {
    return items.filter((item) => {
      // Check explicit due_date field
      if (item.due_date && isSameDay(new Date(item.due_date), date)) {
        return true;
      }

      // Fallback to checking columns if needed (legacy support)
      const board = boards.find((b) => b.id === item.board_id);
      const dueDateColumn = board?.columns?.find((col) => col.type === "date");
      if (dueDateColumn) {
        const colValue =
          item[dueDateColumn.id] || item.data?.[dueDateColumn.id];
        if (colValue && isSameDay(new Date(colValue), date)) {
          return true;
        }
      }

      return false;
    });
  };

  const getItemStatus = (item: Item) => {
    return item.status || "Not Started";
  };

  const isOverdue = (item: Item, date: Date) => {
    const status = getItemStatus(item);
    return (
      isPast(date) && status !== "Done" && status !== "done" && !isToday(date)
    );
  };

  const previousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
    );
  };

  const nextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)
    );
  };

  const selectedDateItems = selectedDate ? getItemsForDate(selectedDate) : [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#323338] dark:text-gray-100 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-[#0073EA]" />
            Calendar Overview
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-[#323338] dark:text-gray-100">
              {format(currentDate, "MMMM yyyy")}
            </h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={previousMonth}
                className="h-8 w-8 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={nextMonth}
                className="h-8 w-8 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {/* Calendar Grid */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="p-2 text-center text-sm font-medium text-[#676879] dark:text-gray-400"
              >
                {day}
              </div>
            ))}

            {monthDays.map((date, index) => {
              const dayItems = getItemsForDate(date);
              const hasOverdue = dayItems.some((item) => isOverdue(item, date));
              const isSelected = selectedDate && isSameDay(date, selectedDate);

              return (
                <motion.div
                  key={date.toISOString()}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.01 }}
                  className={`
                    relative p-2 min-h-[60px] border rounded-lg cursor-pointer transition-all hover:shadow-md
                    ${
                      isSameMonth(date, currentDate)
                        ? "bg-white dark:bg-gray-800 border-[#E1E5F3] dark:border-gray-700"
                        : "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
                    }
                    ${
                      isToday(date)
                        ? "ring-2 ring-[#0073EA] ring-opacity-50"
                        : ""
                    }
                    ${isSelected ? "bg-[#0073EA] text-white" : ""}
                    ${
                      hasOverdue
                        ? "border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800"
                        : ""
                    }
                  `}
                  onClick={() => setSelectedDate(date)}
                >
                  <div
                    className={`text-sm font-medium mb-1 ${
                      isSelected
                        ? "text-white"
                        : isToday(date)
                        ? "text-[#0073EA]"
                        : "text-[#323338] dark:text-gray-200"
                    }`}
                  >
                    {format(date, "d")}
                  </div>

                  {dayItems.length > 0 && (
                    <div className="space-y-1">
                      {dayItems.slice(0, 2).map((item, itemIndex) => {
                        const isItemOverdue = isOverdue(item, date);

                        return (
                          <div
                            key={item.id}
                            className={`text-xs p-1 rounded truncate ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : isItemOverdue
                                ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200"
                                : "bg-[#F5F6F8] text-[#323338] dark:bg-gray-700 dark:text-gray-200"
                            }`}
                            title={item.name}
                          >
                            {item.name}
                          </div>
                        );
                      })}
                      {dayItems.length > 2 && (
                        <div
                          className={`text-xs ${
                            isSelected
                              ? "text-white/80"
                              : "text-[#676879] dark:text-gray-400"
                          }`}
                        >
                          +{dayItems.length - 2} more
                        </div>
                      )}
                    </div>
                  )}

                  {hasOverdue && (
                    <AlertCircle className="absolute top-1 right-1 w-3 h-3 text-red-500" />
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Selected Date Details */}
          {selectedDate && selectedDateItems.length > 0 && (
            <div className="mt-6 p-4 bg-[#F5F6F8] dark:bg-gray-800 rounded-xl">
              <h4 className="font-bold text-[#323338] dark:text-gray-100 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {format(selectedDate, "EEEE, MMMM d, yyyy")} (
                {selectedDateItems.length} tasks)
              </h4>
              <div className="space-y-2">
                {selectedDateItems.map((item) => {
                  const status = getItemStatus(item);
                  const board = boards.find((b) => b.id === item.board_id);
                  const isItemOverdue = isOverdue(item, selectedDate);

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: board?.color || "#0073EA" }}
                        />
                        <div>
                          <p className="font-medium text-[#323338] dark:text-gray-200">
                            {item.name}
                          </p>
                          <p className="text-sm text-[#676879] dark:text-gray-400">
                            {board?.title}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isItemOverdue && (
                          <Badge className="bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-200 dark:border-red-800">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Overdue
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className="dark:text-gray-200 dark:border-gray-600"
                        >
                          {status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button
            onClick={onClose}
            className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-xl h-12 px-6"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
