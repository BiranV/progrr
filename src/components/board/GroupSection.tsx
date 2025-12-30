"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { Item, Column, Board } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import ItemRow from "./ItemRow";
import ColumnHeader from "./ColumnHeader";
import GroupSummaryRow from "./GroupSummaryRow";

const DRAG_HANDLE_WIDTH = 24;
const CHECKBOX_WIDTH = 32;
const ADD_COLUMN_WIDTH = 50;

interface GroupSectionProps {
  group: any; // Define Group type properly later
  items: Item[];
  columns: Column[];
  onAddItem: (groupId: string, title: string) => Promise<void>;
  onUpdateItem: (itemId: string, data: any) => void;
  onDeleteItem: (itemId: string) => void;
  onReorderItems: (
    groupId: string,
    sourceIndex: number,
    destinationIndex: number
  ) => void;
  onUpdateColumn: (columnId: string, data: any) => void;
  onDeleteColumn: (columnId: string) => void;
  onAddColumn: () => void;
  isLoading?: boolean;
  onDeleteGroup: (groupId: string) => void;
  onHideColumnFromGroup?: (groupId: string, columnId: string) => void;
  onEditItem?: (item: Item) => void;
}

export default function GroupSection({
  group,
  items,
  columns,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onReorderItems,
  onUpdateColumn,
  onDeleteColumn,
  onAddColumn,
  isLoading,
  onDeleteGroup,
  onHideColumnFromGroup,
  onEditItem,
}: GroupSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(group.collapsed || false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");

  const handleAddItemLocal = async () => {
    if (newItemTitle.trim()) {
      await onAddItem(group.id, newItemTitle.trim());
      setNewItemTitle("");
      setIsAddingItem(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddItemLocal();
    } else if (e.key === "Escape") {
      setIsAddingItem(false);
      setNewItemTitle("");
    }
  };

  const handleDeleteGroupClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      window.confirm(
        `Are you sure you want to delete the group "${group.title}" and all its tasks? This cannot be undone.`
      )
    ) {
      onDeleteGroup(group.id);
    }
  };

  const getEffectiveColumns = () => {
    const visibleBoardColumns =
      group.visible_columns && group.visible_columns.length > 0
        ? columns.filter((col) => group.visible_columns.includes(col.id))
        : columns;

    const customColumns = group.custom_columns || [];

    const combinedColumns = [...visibleBoardColumns, ...customColumns];
    const uniqueColumnIds = new Set();
    const effectiveCols: Column[] = [];
    for (const col of combinedColumns) {
      if (!uniqueColumnIds.has(col.id)) {
        uniqueColumnIds.add(col.id);
        effectiveCols.push(col);
      }
    }
    return effectiveCols;
  };

  const effectiveColumns = getEffectiveColumns();
  const taskColumn = effectiveColumns.find((col) => col.id === "task");
  const otherColumns = effectiveColumns.filter((col) => col.id !== "task");

  // Calculate total width for min-width
  const totalColumnsWidth = effectiveColumns.reduce(
    (acc, col) => acc + (col.width || 150),
    0
  );
  const totalMinWidth =
    DRAG_HANDLE_WIDTH + CHECKBOX_WIDTH + totalColumnsWidth + ADD_COLUMN_WIDTH;

  return (
    <div className="mb-8">
      {/* Group Header */}
      <div className="flex items-center gap-2 mb-2 group/header">
        <div className="flex items-center gap-2 flex-1">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
              group.color ? `text-[${group.color}]` : "text-blue-500"
            }`}
            style={{ color: group.color || "#0073EA" }}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>

          <h3
            className="text-lg font-bold px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-text border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all"
            style={{ color: group.color || "#0073EA" }}
          >
            {group.title}
          </h3>

          <span className="text-sm text-gray-400 font-medium">
            {items.length} items
          </span>

          <div className="opacity-0 group-hover/header:opacity-100 transition-opacity ml-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="w-4 h-4 text-gray-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={handleDeleteGroupClick}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Group
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <div className="overflow-x-auto pb-4">
          <div className="min-w-fit inline-block">
            {/* Column Headers */}
            <div
              className="flex items-stretch border-y border-[#E1E5F3] dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-20 shadow-sm"
              style={{ minWidth: `${totalMinWidth}px` }}
            >
              {/* Spacer for Drag Handle */}
              <div
                className="flex-shrink-0 border-r border-[#E1E5F3] dark:border-gray-700 bg-white dark:bg-gray-800"
                style={{
                  width: DRAG_HANDLE_WIDTH,
                  position: "sticky",
                  left: 0,
                  zIndex: 30,
                }}
              />

              {/* Spacer for Checkbox */}
              <div
                className="flex-shrink-0 border-r border-[#E1E5F3] dark:border-gray-700 bg-white dark:bg-gray-800"
                style={{
                  width: CHECKBOX_WIDTH,
                  position: "sticky",
                  left: DRAG_HANDLE_WIDTH,
                  zIndex: 30,
                }}
              />

              {/* Task Column Header */}
              {taskColumn && (
                <div
                  className="flex-shrink-0 sticky z-30 bg-white dark:bg-gray-800"
                  style={{
                    width: taskColumn.width || 250,
                    left: DRAG_HANDLE_WIDTH + CHECKBOX_WIDTH,
                  }}
                >
                  <ColumnHeader
                    column={taskColumn}
                    onUpdateColumn={onUpdateColumn}
                    onDeleteColumn={onDeleteColumn}
                    groupId={group.id}
                  />
                </div>
              )}

              {/* Other Column Headers */}
              {otherColumns.map((column) => (
                <div
                  key={column.id}
                  className="flex-shrink-0 bg-white dark:bg-gray-800"
                  style={{ width: column.width || 150 }}
                >
                  <ColumnHeader
                    column={column}
                    onUpdateColumn={onUpdateColumn}
                    onDeleteColumn={onDeleteColumn}
                    groupId={group.id}
                  />
                </div>
              ))}

              {/* Add Column Button */}
              <div
                className="flex-shrink-0 flex items-center justify-center border-l border-[#E1E5F3] dark:border-gray-700"
                style={{ width: ADD_COLUMN_WIDTH }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onAddColumn}
                  className="h-8 w-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Plus className="w-4 h-4 text-gray-500" />
                </Button>
              </div>
            </div>

            {/* Items List */}
            <Droppable droppableId={group.id} type="item">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="bg-white dark:bg-gray-800"
                >
                  {items.map((item, index) => (
                    <Draggable
                      key={item.id}
                      draggableId={item.id}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <ItemRow
                          item={item}
                          columns={effectiveColumns}
                          onUpdate={onUpdateItem}
                          onDelete={onDeleteItem}
                          onEdit={onEditItem}
                          index={index}
                          isDragging={snapshot.isDragging}
                          draggableProvided={provided}
                          dragHandleWidth={DRAG_HANDLE_WIDTH}
                          checkboxWidth={CHECKBOX_WIDTH}
                          totalMinWidth={totalMinWidth}
                          actionColumnWidth={ADD_COLUMN_WIDTH}
                        />
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>

            {/* Add Item Row */}
            <div
              className="flex items-stretch border-b border-[#E1E5F3] dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              style={{ minWidth: `${totalMinWidth}px` }}
            >
              <div
                className="flex-shrink-0 border-r border-transparent"
                style={{
                  width: DRAG_HANDLE_WIDTH,
                  position: "sticky",
                  left: 0,
                  zIndex: 10,
                  backgroundColor: "inherit",
                }}
              />
              <div
                className="flex-shrink-0 border-r border-[#E1E5F3] dark:border-gray-700"
                style={{
                  width: CHECKBOX_WIDTH,
                  position: "sticky",
                  left: DRAG_HANDLE_WIDTH,
                  zIndex: 10,
                  backgroundColor: "inherit",
                }}
              />

              <div
                className="flex-shrink-0 flex items-center px-2 border-r border-[#E1E5F3] dark:border-gray-700"
                style={{
                  width: taskColumn?.width || 250,
                  position: "sticky",
                  left: DRAG_HANDLE_WIDTH + CHECKBOX_WIDTH,
                  zIndex: 10,
                  backgroundColor: "inherit",
                }}
              >
                {isAddingItem ? (
                  <Input
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    onKeyDown={handleKeyPress}
                    onBlur={() => {
                      if (!newItemTitle.trim()) setIsAddingItem(false);
                      else handleAddItemLocal();
                    }}
                    placeholder="+ Add Item"
                    className="h-8 border-blue-500 focus:ring-0"
                    autoFocus
                  />
                ) : (
                  <div
                    onClick={() => setIsAddingItem(true)}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer w-full h-8 px-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm">+ Add Item</span>
                  </div>
                )}
              </div>

              {/* Empty cells for other columns */}
              {otherColumns.map((col) => (
                <div
                  key={col.id}
                  className="flex-shrink-0 border-r border-[#E1E5F3] dark:border-gray-700"
                  style={{ width: col.width || 150 }}
                />
              ))}

              <div
                className="flex-shrink-0"
                style={{ width: ADD_COLUMN_WIDTH }}
              />
            </div>

            {/* Group Summary Row */}
            <GroupSummaryRow
              items={items}
              columns={effectiveColumns}
              groupId={group.id}
              dragHandleWidth={DRAG_HANDLE_WIDTH}
              checkboxWidth={CHECKBOX_WIDTH}
              totalMinWidth={totalMinWidth}
              actionColumnWidth={ADD_COLUMN_WIDTH}
            />
          </div>
        </div>
      )}
    </div>
  );
}
