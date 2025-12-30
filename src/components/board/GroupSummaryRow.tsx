"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Calendar, Hash, CheckCircle2, Users, DollarSign } from "lucide-react";
import { format, min, max } from "date-fns";
import { Item, Column } from "@/types";

interface GroupSummaryRowProps {
  items: Item[];
  columns: Column[];
  groupId: string;
  dragHandleWidth?: number;
  checkboxWidth?: number;
  taskColumnWidth?: number;
  priorityColumnWidth?: number;
  actionColumnWidth?: number;
  totalMinWidth?: number;
}

export default function GroupSummaryRow({
  items,
  columns,
  groupId,
  dragHandleWidth = 24,
  checkboxWidth = 32,
  taskColumnWidth = 250,
  priorityColumnWidth = 120,
  actionColumnWidth = 50,
  totalMinWidth = 800,
}: GroupSummaryRowProps) {
  const getSummaryForColumn = (column: Column) => {
    const values = items
      .map((item) => (column.id === "task" ? item.name : item[column.id]))
      .filter((val) => val !== null && val !== undefined && val !== "");

    if (values.length === 0) {
      return { type: "empty", content: "-" };
    }

    switch (column.type) {
      case "status": {
        const statusCounts: Record<string, number> = {};
        values.forEach((status) => {
          statusCounts[status as string] =
            (statusCounts[status as string] || 0) + 1;
        });

        const statusChoices = column.options?.choices || [
          { label: "Not Started", color: "#C4C4C4" },
          { label: "Working on it", color: "#FFCB00" },
          { label: "Done", color: "#00C875" },
          { label: "Stuck", color: "#E2445C" },
        ];
        return {
          type: "status_summary_colors",
          content: (
            <div className="flex h-full w-full">
              {statusChoices.map((choice: { label: string; color: string }) => {
                const count = statusCounts[choice.label] || 0;
                if (count === 0) return null;
                const percentage = (count / items.length) * 100;
                return (
                  <div
                    key={choice.label}
                    className="h-full flex items-center justify-center text-[10px] text-white font-medium transition-all hover:opacity-90"
                    style={{
                      backgroundColor: choice.color || "#e5e7eb",
                      width: `${percentage}%`,
                    }}
                    title={`${count} ${choice.label} (${Math.round(
                      percentage
                    )}%)`}
                  >
                    {percentage > 15 && `${Math.round(percentage)}%`}
                  </div>
                );
              })}
            </div>
          ),
        };
      }

      case "number": {
        const sum = values.reduce((acc, val) => acc + (Number(val) || 0), 0);
        return {
          type: "number",
          content: (
            <div className="flex flex-col items-center justify-center w-full">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Sum: {sum}
              </span>
            </div>
          ),
        };
      }

      default:
        return { type: "empty", content: "" };
    }
  };

  return (
    <div
      className="flex items-stretch border-b border-[#E1E5F3] dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 min-h-[32px]"
      style={{ minWidth: `${totalMinWidth}px` }}
    >
      {/* Spacer for Drag Handle */}
      <div
        className="flex-shrink-0 border-r border-[#E1E5F3] dark:border-gray-700"
        style={{
          width: dragHandleWidth,
          position: "sticky",
          left: 0,
          zIndex: 10,
          backgroundColor: "inherit",
        }}
      />

      {/* Spacer for Checkbox */}
      <div
        className="flex-shrink-0 border-r border-[#E1E5F3] dark:border-gray-700"
        style={{
          width: checkboxWidth,
          position: "sticky",
          left: dragHandleWidth,
          zIndex: 10,
          backgroundColor: "inherit",
        }}
      />

      {/* Columns */}
      {columns.map((column) => {
        const summary = getSummaryForColumn(column);

        return (
          <div
            key={column.id}
            className={`flex-shrink-0 flex items-center justify-center border-r border-[#E1E5F3] dark:border-gray-700 ${
              column.id === "task"
                ? "sticky z-10 bg-gray-50 dark:bg-gray-800/50 font-medium text-sm text-gray-500 dark:text-gray-400 justify-end pr-4"
                : ""
            }`}
            style={{
              width: column.width || 150,
              left:
                column.id === "task"
                  ? dragHandleWidth + checkboxWidth
                  : undefined,
            }}
          >
            {column.id === "task" ? (
              <span>{items.length} items</span>
            ) : (
              summary.content
            )}
          </div>
        );
      })}

      {/* Spacer for Action Column */}
      <div className="flex-shrink-0" style={{ width: actionColumnWidth }} />
    </div>
  );
}
