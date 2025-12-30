"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  CalendarDays,
  MoreHorizontal,
  Users,
  List,
  Sparkles,
} from "lucide-react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { format } from "date-fns";
import { Board, Item, Column } from "@/types";

// Helper functions
const getStatusColumns = (board: Board | null) => {
  return board?.columns?.filter((col) => col.type === "status") || [];
};

const getPeopleColumns = (board: Board | null) => {
  return board?.columns?.filter((col) => col.type === "people") || [];
};

const getUniqueValues = (items: Item[], columnId: string) => {
  const values = items.map((item) => item[columnId]).filter(Boolean);
  return Array.from(new Set(values));
};

// Standard status colors - consistent with the rest of the system
const getStandardStatusColors = () =>
  ({
    "Not Started": "#C4C4C4",
    "Working on it": "#FFCB00",
    Done: "#00C875",
    Stuck: "#E2445C",
  } as Record<string, string>);

// Color palettes for people grouping
const peopleColorPalette = [
  "#6C5CE7",
  "#A29BFE",
  "#FD79A8",
  "#E17055",
  "#00B894",
  "#0984E3",
  "#6C5CE7",
  "#FDCB6E",
];

const getRandomGradient = (index: number) => {
  const gradients = [
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
    "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
    "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  ];
  return gradients[index % gradients.length];
};

interface KanbanCardProps {
  item: Item;
  index: number;
  board: Board | null;
  groupingType: string;
  onEdit: (item: Item) => void;
}

const KanbanCard = ({
  item,
  index,
  board,
  groupingType,
  onEdit,
}: KanbanCardProps) => {
  const priorityColumn = board?.columns?.find((col) => col.type === "priority");
  const priorityValue = priorityColumn ? item[priorityColumn.id] : undefined;
  const priorityOption = (priorityColumn as any)?.options?.choices?.find(
    (c: any) => c.value === priorityValue
  );

  const ownerColumn = board?.columns?.find((col) => col.type === "people");
  const ownerValue = ownerColumn ? item[ownerColumn.id] : undefined;

  const statusColumn = board?.columns?.find((col) => col.type === "status");
  const statusValue = statusColumn ? item[statusColumn.id] : undefined;
  const statusOption = (statusColumn as any)?.options?.choices?.find(
    (c: any) => c.label === statusValue
  );

  const dueDateColumn = board?.columns?.find(
    (col) =>
      col.type === "date" &&
      (col.id.toLowerCase().includes("due") ||
        col.title.toLowerCase().includes("due"))
  );
  const dueDateValue = dueDateColumn ? item[dueDateColumn.id] : undefined;

  // Determine card accent color based on grouping
  const getCardAccentColor = () => {
    if (groupingType === "status" && priorityOption) {
      return priorityOption.color;
    } else if (groupingType === "people" && statusOption) {
      return statusOption.color;
    }
    return "#E1E5F3";
  };

  return (
    <Draggable
      draggableId={`item-${item.id}`}
      index={index}
      key={`item-${item.id}`}
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`relative p-4 mb-4 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-l-4 hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 cursor-pointer ${
            snapshot.isDragging
              ? "shadow-2xl ring-4 ring-blue-200 scale-105"
              : ""
          }`}
          style={{
            borderLeftColor: getCardAccentColor(),
            background: snapshot.isDragging
              ? "linear-gradient(135deg, #ffffff 0%, #f8faff 100%)"
              : undefined, // Let CSS handle default bg
            ...provided.draggableProps.style,
          }}
          onClick={(e) => {
            if (snapshot.isDragging) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            onEdit(item);
          }}
        >
          {/* Sparkle decoration for dragging */}
          {snapshot.isDragging && (
            <div className="absolute -top-2 -right-2">
              <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
            </div>
          )}

          <div className="flex justify-between items-start mb-3">
            <h4 className="font-bold text-lg text-gray-800 dark:text-gray-200 leading-tight pr-2">
              {item.name}
            </h4>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item);
              }}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>

          {/* Tags row */}
          <div className="flex flex-wrap gap-2 mb-3">
            {groupingType === "people" && statusOption && (
              <span
                className="px-3 py-1 text-xs font-semibold rounded-full shadow-sm"
                style={{
                  backgroundColor: `${statusOption.color}20`,
                  color: statusOption.color,
                  border: `1px solid ${statusOption.color}40`,
                }}
              >
                {statusOption.label}
              </span>
            )}

            {groupingType === "status" && priorityOption && (
              <span
                className="px-3 py-1 text-xs font-semibold rounded-full shadow-sm"
                style={{
                  backgroundColor: `${priorityOption.color}20`,
                  color: priorityOption.color,
                  border: `1px solid ${priorityOption.color}40`,
                }}
              >
                {priorityOption.label}
              </span>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              {dueDateValue && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                  <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-blue-700 dark:text-blue-300 font-medium">
                    {format(new Date(dueDateValue), "MMM d")}
                  </span>
                </div>
              )}
            </div>

            {ownerValue && (
              <div
                className="flex items-center justify-center w-8 h-8 rounded-full text-white font-bold text-sm shadow-md"
                style={{
                  background: getRandomGradient(ownerValue.charCodeAt(0)),
                }}
                title={ownerValue}
              >
                {ownerValue.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
};

interface KanbanViewProps {
  board: Board | null;
  items: Item[];
  onUpdateItem: (itemId: string, data: any) => void;
  onDeleteItem: (itemId: string) => void;
  onReorderItems?: (
    groupId: string,
    sourceIndex: number,
    destinationIndex: number
  ) => void;
  onEditItem: (item: Item) => void;
}

export default function KanbanView({
  board,
  items,
  onUpdateItem,
  onDeleteItem,
  onReorderItems,
  onEditItem,
}: KanbanViewProps) {
  const [groupBy, setGroupBy] = useState("status");

  if (!board)
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="animate-pulse">Board data not available.</div>
      </div>
    );

  // Get available grouping options
  const statusColumnsDef = getStatusColumns(board);
  const peopleColumnsDef = getPeopleColumns(board);

  const canGroupByStatus = statusColumnsDef.length > 0;
  const canGroupByPeople = peopleColumnsDef.length > 0;

  if (!canGroupByStatus && !canGroupByPeople) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="max-w-md mx-auto">
          <h3 className="text-xl font-semibold mb-2">
            Kanban view requires grouping columns
          </h3>
          <p>
            Please add either a 'Status' or 'People' type column to enable
            Kanban view.
          </p>
        </div>
      </div>
    );
  }

  // Auto-switch grouping if current one is invalid
  // Note: In a real app, use useEffect for side effects like this
  // For now, we just render based on availability
  const effectiveGroupBy =
    groupBy === "status" && !canGroupByStatus
      ? "people"
      : groupBy === "people" && !canGroupByPeople
      ? "status"
      : groupBy;

  const activeColumnDefinition =
    effectiveGroupBy === "status" ? statusColumnsDef[0] : peopleColumnsDef[0];

  if (!activeColumnDefinition)
    return (
      <div className="p-4 text-center text-gray-500">
        No suitable column definition found for grouping.
      </div>
    );

  let columnsData: any[] = [];

  if (
    effectiveGroupBy === "status" &&
    (activeColumnDefinition as any).options?.choices
  ) {
    const standardColors = getStandardStatusColors();
    columnsData = (activeColumnDefinition as any).options.choices.map(
      (choice: any, index: number) => ({
        id: `status-${choice.label}`,
        title: choice.label,
        color: standardColors[choice.label] || choice.color || "#666666",
        gradient: getRandomGradient(index),
        items: items
          .filter((item) => item[activeColumnDefinition.id] === choice.label)
          .sort((a, b) => (a.order_index || 0) - (b.order_index || 0)),
        originalValue: choice.label,
      })
    );
  } else if (effectiveGroupBy === "people") {
    const uniquePeople = getUniqueValues(items, activeColumnDefinition.id);

    // Create columns for people with assigned tasks
    columnsData = uniquePeople.map((person: any, index) => ({
      id: `people-${person}`,
      title: person,
      color: peopleColorPalette[index % peopleColorPalette.length],
      gradient: getRandomGradient(index),
      items: items
        .filter((item) => item[activeColumnDefinition.id] === person)
        .sort((a, b) => (a.order_index || 0) - (b.order_index || 0)),
      originalValue: person,
    }));

    // Add column for unassigned tasks
    const unassignedItems = items
      .filter(
        (item) =>
          !item[activeColumnDefinition.id] ||
          item[activeColumnDefinition.id] === "" ||
          item[activeColumnDefinition.id] === null
      )
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

    if (unassignedItems.length > 0 || uniquePeople.length === 0) {
      columnsData.unshift({
        id: "people-unassigned",
        title: "Unassigned",
        color: "#9CA3AF", // Gray color for unassigned
        gradient: "linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)",
        items: unassignedItems,
        originalValue: null,
      });
    }
  }

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    // Extract actual item ID from draggableId
    const itemId = draggableId.replace("item-", "");
    const itemToMove = items.find((i) => i.id.toString() === itemId);

    if (!itemToMove) {
      console.error("Item to move not found:", itemId);
      return;
    }

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    if (source.droppableId === destination.droppableId) {
      // Reordering within same column
      // In this simplified version, we just update the order_index
      // A real implementation would need to recalculate order_index for all items in the column
      // For now, we'll just update the moved item's order_index to be between neighbors
      // But since we don't have easy access to neighbors here without recalculating,
      // we might skip reordering logic for now or implement a simple swap
      console.log(
        "Reordering within column not fully implemented in this view"
      );
    } else {
      // Moving between columns - this is where we change status/person
      const destColumn = columnsData.find(
        (col) => col.id === destination.droppableId
      );

      if (destColumn) {
        const newValue = destColumn.originalValue;
        onUpdateItem(itemToMove.id, {
          [activeColumnDefinition.id]: newValue,
        });
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
            Kanban Board
          </h2>
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
            <Button
              variant={effectiveGroupBy === "status" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setGroupBy("status")}
              disabled={!canGroupByStatus}
              className={`text-sm ${
                effectiveGroupBy === "status" ? "shadow-sm" : ""
              }`}
            >
              Status
            </Button>
            <Button
              variant={effectiveGroupBy === "people" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setGroupBy("people")}
              disabled={!canGroupByPeople}
              className={`text-sm ${
                effectiveGroupBy === "people" ? "shadow-sm" : ""
              }`}
            >
              People
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex h-full gap-6">
            {columnsData.map((column) => (
              <div
                key={column.id}
                className="flex-shrink-0 w-80 flex flex-col h-full max-h-full"
              >
                {/* Column Header */}
                <div
                  className="flex items-center justify-between p-4 rounded-t-xl mb-2 shadow-sm"
                  style={{ background: column.gradient }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-lg shadow-sm">
                      {column.title}
                    </span>
                    <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                      {column.items.length}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-white hover:bg-white/20 rounded-full"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {/* Droppable Area */}
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto px-2 pb-2 rounded-b-xl transition-colors ${
                        snapshot.isDraggingOver
                          ? "bg-blue-50/50 dark:bg-blue-900/10"
                          : "bg-transparent"
                      }`}
                    >
                      {column.items.map((item: Item, index: number) => (
                        <KanbanCard
                          key={item.id}
                          item={item}
                          index={index}
                          board={board}
                          groupingType={effectiveGroupBy}
                          onEdit={onEditItem}
                        />
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}
