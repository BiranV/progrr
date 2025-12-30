"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Item, Column } from "@/types";

interface GroupSummaryProps {
  items: Item[];
  columns: Column[];
}

export default function GroupSummary({ items, columns }: GroupSummaryProps) {
  // Calculate summary stats
  const statusColumn = columns.find((col) => col.type === "status");
  const numberColumns = columns.filter((col) => col.type === "number");

  const statusCounts: Record<string, number> = {};
  let totalBudget = 0;

  items.forEach((item) => {
    // Count statuses
    const status = item.status || "Not Started";
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    // Sum numbers (assuming budget column)
    numberColumns.forEach((col) => {
      const value = item[col.id];
      if (typeof value === "number") {
        totalBudget += value;
      }
    });
  });

  const completedCount = statusCounts["Done"] || statusCounts["done"] || 0;
  const totalCount = items.length;

  if (totalCount === 0) return null;

  return (
    <div className="flex items-center gap-4">
      {/* Status Summary */}
      <div className="flex items-center gap-2">
        {Object.entries(statusCounts).map(([status, count]) => {
          const color = getStatusColor(status);
          return (
            <div key={status} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-[#676879] dark:text-gray-400">
                {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className="w-16 h-2 bg-[#E1E5F3] dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#00C875] transition-all duration-300"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>
        <span className="text-xs text-[#676879] dark:text-gray-400">
          {Math.round((completedCount / totalCount) * 100)}%
        </span>
      </div>

      {/* Total Budget */}
      {totalBudget > 0 && (
        <Badge
          variant="outline"
          className="text-xs border-[#E1E5F3] dark:border-gray-700"
        >
          ${totalBudget.toLocaleString()}
        </Badge>
      )}
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status.toLowerCase()) {
    case "done":
    case "completed":
      return "#00C875";
    case "working on it":
    case "working":
    case "in progress":
      return "#FFCB00";
    case "stuck":
      return "#E2445C";
    default:
      return "#C4C4C4";
  }
}
