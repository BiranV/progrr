"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";

interface TextCellProps {
  value: string;
  onUpdate: (value: string) => void;
}

export default function TextCell({ value, onUpdate }: TextCellProps) {
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
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyPress}
        className="border-none bg-transparent p-0 h-auto focus:ring-0 text-[#323338] dark:text-gray-200 font-medium"
        autoFocus
      />
    );
  }

  return (
    <div
      className="cursor-pointer text-[#323338] dark:text-gray-200 font-medium hover:bg-[#E1E5F3] dark:hover:bg-gray-700 hover:rounded px-2 py-1 -mx-2 -my-1 transition-colors truncate"
      onClick={() => setIsEditing(true)}
    >
      {value || "Enter text..."}
    </div>
  );
}
