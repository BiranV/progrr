"use client";

import React, { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { GripVertical, Trash2, Maximize2 } from "lucide-react";
import { DraggableProvided } from "@hello-pangea/dnd";
import { Item, Column } from "@/types";

import StatusCell from "./cells/StatusCell";
import TextCell from "./cells/TextCell";
import GenericCell from "./cells/GenericCell";
import PeopleCell from "./cells/PeopleCell";
import DateCell from "./cells/DateCell";
import NumberCell from "./cells/NumberCell";
import BudgetCell from "./cells/BudgetCell";
import CheckboxCell from "./cells/CheckboxCell";
import DropdownCell from "./cells/DropdownCell";
import PriorityCell from "./cells/PriorityCell";
import TagsCell from "./cells/TagsCell";

interface ItemRowProps {
  item: Item;
  columns: Column[];
  onUpdate: (id: string, data: any) => void;
  onDelete: (id: string) => void;
  onEdit?: (item: Item) => void;
  index: number;
  isDragging: boolean;
  draggableProvided: DraggableProvided;
  dragHandleWidth?: number;
  checkboxWidth?: number;
  taskColumnWidth?: number;
  priorityColumnWidth?: number;
  totalMinWidth?: number;
  actionColumnWidth?: number;
}

export default function ItemRow({
  item,
  columns,
  onUpdate,
  onDelete,
  onEdit,
  index,
  isDragging,
  draggableProvided,
  dragHandleWidth = 24,
  checkboxWidth = 32,
  taskColumnWidth = 250,
  priorityColumnWidth = 120,
  totalMinWidth = 800,
  actionColumnWidth = 80,
}: ItemRowProps) {
  const [isSelected, setIsSelected] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${item.name}"?`)) {
      onDelete(item.id);
    }
  };

  const renderCell = (column: Column) => {
    const value = column.id === "task" ? item.name : item[column.id];
    const commonProps = {
      value,
      options: column.options,
      onUpdate: (newValue: any) => {
        if (column.id === "task") {
          onUpdate(item.id, { name: newValue });
        } else {
          onUpdate(item.id, { [column.id]: newValue });
        }
      },
    };

    switch (column.type) {
      case "status":
        return <StatusCell {...commonProps} />;
      case "people":
        return <PeopleCell {...commonProps} />;
      case "date":
        return <DateCell {...commonProps} />;
      case "number":
        return <NumberCell {...commonProps} />;
      case "budget":
        return <BudgetCell {...commonProps} />;
      case "checkbox":
        return <CheckboxCell {...commonProps} />;
      case "dropdown":
        return <DropdownCell {...commonProps} />;
      case "priority":
        return <PriorityCell {...commonProps} />;
      case "tags":
        return <TagsCell {...commonProps} />;
      case "text":
      default:
        return <TextCell {...commonProps} />;
    }
  };

  return (
    <div
      ref={draggableProvided.innerRef}
      {...draggableProvided.draggableProps}
      style={{
        ...draggableProvided.draggableProps.style,
        minWidth: `${totalMinWidth}px`,
      }}
      className={`flex items-stretch border-b border-[#E1E5F3] dark:border-gray-700 hover:bg-[#F5F6F8] dark:hover:bg-gray-800 transition-colors group min-h-[40px] ${
        isDragging ? "opacity-80 shadow-lg" : ""
      }`}
    >
      {/* Drag Handle */}
      <div
        {...draggableProvided.dragHandleProps}
        className="flex-shrink-0 flex items-center justify-center cursor-grab hover:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-white dark:bg-gray-800 group-hover:bg-[#F5F6F8] dark:group-hover:bg-gray-700"
        style={{
          width: dragHandleWidth,
          position: "sticky",
          left: 0,
          zIndex: 10,
        }}
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>

      {/* Checkbox */}
      <div
        className="flex-shrink-0 flex items-center justify-center border-r border-[#E1E5F3] dark:border-gray-700 bg-white dark:bg-gray-800 group-hover:bg-[#F5F6F8] dark:group-hover:bg-gray-700"
        style={{
          width: checkboxWidth,
          position: "sticky",
          left: dragHandleWidth,
          zIndex: 10,
        }}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => setIsSelected(checked === true)}
          className="data-[state=checked]:bg-[#0073EA] data-[state=checked]:border-[#0073EA]"
        />
      </div>

      {/* Cells */}
      {columns.map((column) => (
        <div
          key={column.id}
          className={`flex-shrink-0 flex items-center px-2 border-r border-[#E1E5F3] dark:border-gray-700 ${
            column.id === "task"
              ? "bg-white dark:bg-gray-800 group-hover:bg-[#F5F6F8] dark:group-hover:bg-gray-700 sticky z-10"
              : ""
          }`}
          style={{
            width: column.width || 150,
            left:
              column.id === "task"
                ? dragHandleWidth + checkboxWidth
                : undefined,
          }}
        >
          {renderCell(column)}
        </div>
      ))}

      {/* Action Column */}
      <div
        className="flex-shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-1"
        style={{ width: actionColumnWidth }}
      >
        {onEdit && (
          <button
            onClick={() => onEdit(item)}
            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="Open Item"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={handleDelete}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          title="Delete Item"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
