"use client";

import React, { useState } from "react";
import { ChevronDown, Settings, Edit3, EyeOff, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Column } from "@/types";

interface ColumnHeaderProps {
  column: Column;
  onUpdateColumn: (id: string, data: Partial<Column>) => void;
  onDeleteColumn: (id: string) => void;
  style?: React.CSSProperties;
  groupId?: string;
}

export default function ColumnHeader({
  column,
  onUpdateColumn,
  onDeleteColumn,
  style,
  groupId,
}: ColumnHeaderProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(column.title);

  const handleRename = () => {
    if (newTitle.trim() && newTitle !== column.title) {
      onUpdateColumn(column.id, { title: newTitle.trim() });
    }
    setIsRenaming(false);
  };

  const handleHideFromGroup = () => {
    if (
      window.confirm(
        `Hide the column "${column.title}" from this group? You can show it again later.`
      )
    ) {
      onDeleteColumn(column.id); // This will now hide instead of delete
    }
  };

  if (isRenaming) {
    return (
      <div
        className="flex items-center justify-between px-3 py-2 border-l border-[#E1E5F3] dark:border-gray-700 bg-white dark:bg-gray-800"
        style={{
          width: column.width || 150,
          minWidth: column.width || 150,
          ...style,
        }}
      >
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRename();
            if (e.key === "Escape") setIsRenaming(false);
          }}
          className="h-full p-0 border-none focus:ring-0 text-sm font-medium flex-1 bg-transparent"
          autoFocus
        />
        <div className="flex">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRename}
            className="h-6 w-6"
          >
            <Check className="w-3 h-3 text-green-500" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsRenaming(false)}
            className="h-6 w-6"
          >
            <X className="w-3 h-3 text-red-500" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div
          className="flex items-center justify-between px-3 py-3 border-l border-[#E1E5F3] dark:border-gray-700 group hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer"
          style={{
            width: column.width || 150,
            minWidth: column.width || 150,
            ...style,
          }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-medium text-[#323338] dark:text-gray-200 text-sm truncate">
              {column.title}
            </span>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Settings className="w-3 h-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" />
            <ChevronDown className="w-3 h-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" />
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => setIsRenaming(true)}>
          <Edit3 className="w-3 h-3 mr-2" />
          Rename Column
        </DropdownMenuItem>
        <DropdownMenuItem disabled>Change Column Type</DropdownMenuItem>
        <DropdownMenuItem disabled>Configure Column</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleHideFromGroup}
          className="text-orange-600 focus:text-orange-600 focus:bg-orange-50 dark:focus:bg-orange-900/20"
        >
          <EyeOff className="w-3 h-3 mr-2" />
          Hide from Group
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
