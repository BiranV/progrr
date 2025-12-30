"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { Item, Board, Column } from "@/types";

interface TaskEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Item | null;
  board: Board | null;
  onUpdate: (itemId: string, data: any) => void;
  onDelete: (itemId: string) => void;
}

export default function TaskEditModal({
  isOpen,
  onClose,
  task,
  board,
  onUpdate,
  onDelete,
}: TaskEditModalProps) {
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (task && board) {
      // Initialize form data with current task values
      setFormData({ ...task });
    }
  }, [task, board]);

  if (!task || !board) return null;

  const handleSave = () => {
    onUpdate(task.id, formData);
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      onDelete(task.id);
      onClose();
    }
  };

  const renderField = (column: Column) => {
    const value = formData[column.id];

    switch (column.type) {
      case "text":
        return (
          <Input
            value={value || ""}
            onChange={(e) =>
              setFormData({ ...formData, [column.id]: e.target.value })
            }
            placeholder={`Enter ${column.title.toLowerCase()}...`}
          />
        );

      case "status":
        // Assuming column.options exists for status columns, though it's not in the basic Column interface
        // We might need to extend Column interface or cast it
        const statusOptions = (column as any).options?.choices || [
          { label: "Done", color: "#00C875" },
          { label: "Working on it", color: "#FDAB3D" },
          { label: "Stuck", color: "#E2445C" },
          { label: "Not Started", color: "#C4C4C4" },
        ];

        return (
          <Select
            value={value || ""}
            onValueChange={(newValue) =>
              setFormData({ ...formData, [column.id]: newValue })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((choice: any) => (
                <SelectItem key={choice.label} value={choice.label}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: choice.color }}
                    />
                    <span>{choice.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "priority":
        const priorityOptions = (column as any).options?.choices || [
          { label: "Critical", color: "#333333" },
          { label: "High", color: "#401694" },
          { label: "Medium", color: "#5559DF" },
          { label: "Low", color: "#579BFC" },
        ];

        return (
          <Select
            value={value || ""}
            onValueChange={(newValue) =>
              setFormData({ ...formData, [column.id]: newValue })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              {priorityOptions.map((choice: any) => (
                <SelectItem key={choice.label} value={choice.label}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: choice.color }}
                    />
                    <span>{choice.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "people":
        return (
          <Input
            value={value || ""}
            onChange={(e) =>
              setFormData({ ...formData, [column.id]: e.target.value })
            }
            placeholder="Enter person name..."
          />
        );

      case "date":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(new Date(value), "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={value ? new Date(value) : undefined}
                onSelect={(date) =>
                  setFormData({
                    ...formData,
                    [column.id]: date ? date.toISOString() : undefined,
                  })
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );

      case "number":
        return (
          <Input
            type="number"
            value={value || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                [column.id]: parseFloat(e.target.value) || 0,
              })
            }
            placeholder="Enter number..."
          />
        );

      default:
        return (
          <Input
            value={value || ""}
            onChange={(e) =>
              setFormData({ ...formData, [column.id]: e.target.value })
            }
            placeholder={`Enter ${column.title.toLowerCase()}...`}
          />
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#323338] dark:text-gray-200 flex items-center justify-between">
            Edit Task
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Task Title */}
          <div className="space-y-2">
            <Label className="text-[#323338] dark:text-gray-200 font-medium text-base">
              Task Title
            </Label>
            <Input
              value={formData.name || ""}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Enter task title..."
              className="text-lg font-medium"
            />
          </div>

          {/* Dynamic Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {board.columns
              ?.filter((col) => col.id !== "name") // Exclude name/title as it's handled above
              .map((column) => (
                <div key={column.id} className="space-y-2">
                  <Label className="text-[#323338] dark:text-gray-200 font-medium">
                    {column.title}
                  </Label>
                  {renderField(column)}
                </div>
              ))}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete Task
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="bg-[#0073EA] hover:bg-[#0056B3] text-white"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
