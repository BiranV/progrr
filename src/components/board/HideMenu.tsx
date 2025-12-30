"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { Column } from "@/types";

interface HideMenuProps {
  columns: Column[];
  hiddenColumns: Set<string>;
  onChange: (hidden: Set<string>) => void;
  onClose: () => void;
}

export default function HideMenu({
  columns,
  hiddenColumns,
  onChange,
  onClose,
}: HideMenuProps) {
  const handleColumnToggle = (columnId: string, hide: boolean) => {
    const newHidden = new Set(hiddenColumns);
    if (hide) {
      newHidden.add(columnId);
    } else {
      newHidden.delete(columnId);
    }
    onChange(newHidden);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-full left-0 mt-2 z-50"
    >
      <Card className="w-64 shadow-lg border-[#E1E5F3] dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg font-bold text-[#323338] dark:text-gray-200">
            Show/Hide Columns
          </CardTitle>
          <button
            onClick={onClose}
            className="text-[#676879] hover:text-[#323338] dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-3">
          {columns.map((column) => {
            const isHidden = hiddenColumns.has(column.id);
            return (
              <div key={column.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`column-${column.id}`}
                  checked={!isHidden}
                  onCheckedChange={(checked) =>
                    handleColumnToggle(column.id, !checked as boolean)
                  }
                />
                <label
                  htmlFor={`column-${column.id}`}
                  className="flex items-center gap-2 text-sm cursor-pointer flex-1 text-gray-700 dark:text-gray-300"
                >
                  {isHidden ? (
                    <EyeOff className="w-4 h-4 text-[#676879] dark:text-gray-500" />
                  ) : (
                    <Eye className="w-4 h-4 text-[#0073EA] dark:text-blue-400" />
                  )}
                  <span
                    className={
                      isHidden
                        ? "text-[#676879] dark:text-gray-500"
                        : "text-[#323338] dark:text-gray-200"
                    }
                  >
                    {column.title}
                  </span>
                </label>
              </div>
            );
          })}

          {hiddenColumns.size > 0 && (
            <div className="pt-3 border-t border-[#E1E5F3] dark:border-gray-700">
              <button
                onClick={() => onChange(new Set())}
                className="text-sm text-[#0073EA] hover:underline dark:text-blue-400"
              >
                Show all columns
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
