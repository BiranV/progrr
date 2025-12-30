"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";
import { motion } from "framer-motion";
import { Board } from "@/types";

export interface FilterState {
  status: string[];
  priority: string[];
  people: string[];
}

interface FilterPanelProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onClose: () => void;
  board: Board | null;
}

export default function FilterPanel({
  filters,
  onChange,
  onClose,
  board,
}: FilterPanelProps) {
  const statusColumn = board?.columns?.find((col) => col.type === "status");
  const statusChoices = statusColumn?.options?.choices || [
    { label: "Not Started", color: "#C4C4C4" },
    { label: "Working on it", color: "#FFCB00" },
    { label: "Done", color: "#00C875" },
    { label: "Stuck", color: "#E2445C" },
  ];

  const priorities = ["Low", "Medium", "High", "Critical"];

  const handleStatusChange = (status: string, checked: boolean) => {
    const newStatuses = checked
      ? [...filters.status, status]
      : filters.status.filter((s) => s !== status);
    onChange({ ...filters, status: newStatuses });
  };

  const handlePriorityChange = (priority: string, checked: boolean) => {
    const newPriorities = checked
      ? [...filters.priority, priority]
      : filters.priority.filter((p) => p !== priority);
    onChange({ ...filters, priority: newPriorities });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-full left-0 mt-2 z-50"
    >
      <Card className="w-80 shadow-lg border-[#E1E5F3] dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg font-bold text-[#323338] dark:text-gray-200">
            Filter Items
          </CardTitle>
          <button
            onClick={onClose}
            className="text-[#676879] hover:text-[#323338] dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Filter */}
          <div>
            <h4 className="font-medium text-[#323338] dark:text-gray-200 mb-3">
              Status
            </h4>
            <div className="space-y-2">
              {statusChoices.map((choice: any) => (
                <div key={choice.label} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${choice.label}`}
                    checked={filters.status.includes(choice.label)}
                    onCheckedChange={(checked) =>
                      handleStatusChange(choice.label, checked as boolean)
                    }
                  />
                  <label
                    htmlFor={`status-${choice.label}`}
                    className="flex items-center gap-2 text-sm cursor-pointer text-gray-700 dark:text-gray-300"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: choice.color }}
                    />
                    <span>{choice.label}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Priority Filter */}
          <div>
            <h4 className="font-medium text-[#323338] dark:text-gray-200 mb-3">
              Priority
            </h4>
            <div className="space-y-2">
              {priorities.map((priority) => (
                <div key={priority} className="flex items-center space-x-2">
                  <Checkbox
                    id={`priority-${priority}`}
                    checked={filters.priority.includes(priority)}
                    onCheckedChange={(checked) =>
                      handlePriorityChange(priority, checked as boolean)
                    }
                  />
                  <label
                    htmlFor={`priority-${priority}`}
                    className="text-sm cursor-pointer text-gray-700 dark:text-gray-300"
                  >
                    {priority}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Clear Filters */}
          {(filters.status.length > 0 || filters.priority.length > 0) && (
            <div className="pt-3 border-t border-[#E1E5F3] dark:border-gray-700">
              <button
                onClick={() =>
                  onChange({
                    status: [],
                    people: filters.people,
                    priority: [],
                  })
                }
                className="text-sm text-[#E2445C] hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
