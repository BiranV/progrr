"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";
import { format } from "date-fns";

interface DateCellProps {
  value: string;
  onUpdate: (value: string) => void;
}

export default function DateCell({ value, onUpdate }: DateCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");

  const handleSave = () => {
    onUpdate(editValue);
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(value || "");
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <Input
        type="date"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyPress}
        className="border-none bg-transparent p-0 h-auto focus:ring-0 text-[#323338] dark:text-gray-200"
        autoFocus
      />
    );
  }

  if (!value) {
    return (
      <div
        className="cursor-pointer text-[#676879] dark:text-gray-400 hover:bg-[#E1E5F3] dark:hover:bg-gray-700 hover:rounded px-2 py-1 -mx-2 -my-1 transition-colors flex items-center gap-2"
        onClick={() => setIsEditing(true)}
      >
        <Calendar className="w-4 h-4" />
        <span>Set date</span>
      </div>
    );
  }

  const isOverdue =
    new Date(value) < new Date() &&
    new Date(value).toDateString() !== new Date().toDateString();

  return (
    <div
      className={`cursor-pointer hover:opacity-80 transition-opacity px-2 py-1 -mx-2 -my-1 rounded text-sm ${
        isOverdue
          ? "bg-[#E2445C]/10 text-[#E2445C]"
          : "text-[#323338] dark:text-gray-200"
      }`}
      onClick={() => setIsEditing(true)}
    >
      {format(new Date(value), "MMM d")}
    </div>
  );
}
