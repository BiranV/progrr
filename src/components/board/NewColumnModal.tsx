"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { X, Plus } from "lucide-react";

const columnTypes = [
  { value: "text", label: "Text" },
  { value: "status", label: "Status" },
  { value: "date", label: "Date" },
  { value: "people", label: "People" },
  { value: "number", label: "Number" },
  { value: "budget", label: "Budget" },
  { value: "priority", label: "Priority" },
  { value: "checkbox", label: "Checkbox" },
  { value: "dropdown", label: "Dropdown" },
  { value: "tags", label: "Tags" },
];

interface NewColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export default function NewColumnModal({
  isOpen,
  onClose,
  onSubmit,
}: NewColumnModalProps) {
  const [columnData, setColumnData] = useState({
    title: "",
    type: "text",
  });
  const [dropdownOptions, setDropdownOptions] = useState([
    { value: "option1", label: "Option 1", color: "#787D80" },
    { value: "option2", label: "Option 2", color: "#0073EA" },
  ]);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const colorOptions = [
    "#787D80",
    "#0073EA",
    "#00C875",
    "#FFCB00",
    "#E2445C",
    "#A25DDC",
    "#00D9FF",
  ];

  const handleAddOption = () => {
    if (newOptionLabel.trim()) {
      const newOption = {
        value: newOptionLabel.toLowerCase().replace(/\s+/g, "_"),
        label: newOptionLabel.trim(),
        color: colorOptions[dropdownOptions.length % colorOptions.length],
      };
      setDropdownOptions([...dropdownOptions, newOption]);
      setNewOptionLabel("");
    }
  };

  const handleRemoveOption = (indexToRemove: number) => {
    setDropdownOptions(
      dropdownOptions.filter((_, index) => index !== indexToRemove)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!columnData.title.trim()) return;

    setIsSubmitting(true);
    try {
      const dataToSubmit: any = {
        title: columnData.title,
        type: columnData.type,
      };

      // Add default options based on column type
      if (columnData.type === "status") {
        dataToSubmit.options = {
          choices: [
            { label: "Not Started", color: "#C4C4C4" },
            { label: "Working on it", color: "#FFCB00" },
            { label: "Done", color: "#00C875" },
            { label: "Stuck", color: "#E2445C" },
          ],
        };
      } else if (columnData.type === "dropdown") {
        dataToSubmit.options = {
          choices: dropdownOptions,
        };
      } else if (columnData.type === "budget") {
        dataToSubmit.options = {
          currency: "USD",
        };
      } else if (columnData.type === "priority") {
        dataToSubmit.options = {
          choices: [
            { value: "low", label: "Low", color: "#787D80" },
            { value: "medium", label: "Medium", color: "#FFCB00" },
            { value: "high", label: "High", color: "#FDAB3D" },
            { value: "critical", label: "Critical", color: "#E2445C" },
          ],
        };
      }

      await onSubmit(dataToSubmit);
      // Reset form
      setColumnData({ title: "", type: "text" });
      setDropdownOptions([
        { value: "option1", label: "Option 1", color: "#787D80" },
        { value: "option2", label: "Option 2", color: "#0073EA" },
      ]);
      onClose();
    } catch (error) {
      console.error("Error creating column:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Column</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Column Title</Label>
            <Input
              id="title"
              value={columnData.title}
              onChange={(e) =>
                setColumnData({ ...columnData, title: e.target.value })
              }
              placeholder="e.g., Due Date, Priority"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Column Type</Label>
            <Select
              value={columnData.type}
              onValueChange={(value) =>
                setColumnData({ ...columnData, type: value })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {columnTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {columnData.type === "dropdown" && (
            <div className="space-y-2">
              <Label>Options</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                {dropdownOptions.map((option, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-2 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: option.color }}
                      />
                      <span className="text-sm">{option.label}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(index)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newOptionLabel}
                  onChange={(e) => setNewOptionLabel(e.target.value)}
                  placeholder="New option..."
                  className="h-8 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddOption}
                  disabled={!newOptionLabel.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !columnData.title}>
              {isSubmitting ? "Adding..." : "Add Column"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
