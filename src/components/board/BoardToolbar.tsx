"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Filter,
  ArrowUpDown,
  EyeOff,
  Layers,
  UserCircle,
  Plus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";

interface BoardToolbarProps {
  onSearch: (query: string) => void;
  onFilterClick: () => void;
  onSortClick: () => void;
  onHideClick: () => void;
  onGroupByClick: () => void;
  onPersonFilterClick: () => void;
  onNewItem: () => void;
}

export default function BoardToolbar({
  onSearch,
  onFilterClick,
  onSortClick,
  onHideClick,
  onGroupByClick,
  onPersonFilterClick,
  onNewItem,
}: BoardToolbarProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <Button
          onClick={onNewItem}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Item
        </Button>
        <div className="h-8 w-[1px] bg-gray-200 dark:bg-gray-700 mx-2" />
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search"
            className="pl-8 w-[200px]"
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onPersonFilterClick}
          className="text-gray-600 dark:text-gray-300"
        >
          <UserCircle className="w-4 h-4 mr-2" />
          Person
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onFilterClick}
          className="text-gray-600 dark:text-gray-300"
        >
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onSortClick}
          className="text-gray-600 dark:text-gray-300"
        >
          <ArrowUpDown className="w-4 h-4 mr-2" />
          Sort
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onHideClick}
          className="text-gray-600 dark:text-gray-300"
        >
          <EyeOff className="w-4 h-4 mr-2" />
          Hide
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onGroupByClick}
          className="text-gray-600 dark:text-gray-300"
        >
          <Layers className="w-4 h-4 mr-2" />
          Group By
        </Button>
      </div>
      <div className="flex items-center gap-2">
        {/* Right side actions if any */}
      </div>
    </div>
  );
}
