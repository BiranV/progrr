"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, X } from "lucide-react";
import { motion } from "framer-motion";
import { Column } from "@/types";

interface SortMenuProps {
  sortBy: string | null;
  sortDirection: "asc" | "desc";
  columns: Column[];
  onChange: (field: string, direction: "asc" | "desc") => void;
  onClose: () => void;
}

export default function SortMenu({
  sortBy,
  sortDirection,
  columns,
  onChange,
  onClose,
}: SortMenuProps) {
  const sortOptions = [
    { id: "name", label: "Task Name", type: "text" },
    { id: "created_at", label: "Created Date", type: "date" },
    { id: "updated_at", label: "Updated Date", type: "date" },
    ...columns.map((col) => ({ id: col.id, label: col.title, type: col.type })),
  ];

  const handleSort = (field: string) => {
    const newDirection =
      sortBy === field && sortDirection === "asc" ? "desc" : "asc";
    onChange(field, newDirection);
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
            Sort By
          </CardTitle>
          <button
            onClick={onClose}
            className="text-[#676879] hover:text-[#323338] dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-1">
          {sortOptions.map((option) => (
            <Button
              key={option.id}
              variant="ghost"
              className={`w-full justify-between h-auto p-3 ${
                sortBy === option.id
                  ? "bg-[#E1E5F3] dark:bg-gray-700 text-[#0073EA] dark:text-blue-400"
                  : "hover:bg-[#F5F6F8] dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}
              onClick={() => handleSort(option.id)}
            >
              <span>{option.label}</span>
              {sortBy === option.id &&
                (sortDirection === "asc" ? (
                  <ArrowUp className="w-4 h-4" />
                ) : (
                  <ArrowDown className="w-4 h-4" />
                ))}
            </Button>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
