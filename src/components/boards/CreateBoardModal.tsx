"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lock, Globe } from "lucide-react";
import { Board } from "@/types";

const colorOptions = [
  { name: "Ocean Blue", value: "#0073EA" },
  { name: "Success Green", value: "#00C875" },
  { name: "Warning Orange", value: "#FFCB00" },
  { name: "Danger Red", value: "#E2445C" },
  { name: "Purple", value: "#A25DDC" },
  { name: "Teal", value: "#00D9FF" },
];

interface CreateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Board>) => Promise<void>;
}

export default function CreateBoardModal({
  isOpen,
  onClose,
  onSubmit,
}: CreateBoardModalProps) {
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    color: string;
    visibility: "private" | "public" | "workspace";
  }>({
    title: "",
    description: "",
    color: "#0073EA",
    visibility: "private",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setIsSubmitting(true);
    try {
      const boardData: Partial<Board> = {
        ...formData,
        columns: [
          {
            id: "task",
            title: "Task",
            type: "text",
            width: 250,
          },
          {
            id: "priority",
            title: "Priority",
            type: "dropdown",
            width: 120,
            options: {
              choices: [
                { value: "low", label: "Low", color: "#787D80" },
                { value: "medium", label: "Medium", color: "#FFCB00" },
                { value: "high", label: "High", color: "#FDAB3D" },
                { value: "critical", label: "Critical", color: "#E2445C" },
              ],
            },
          },
          {
            id: "status",
            title: "Status",
            type: "status",
            width: 150,
            options: {
              choices: [
                { label: "Not Started", color: "#C4C4C4" },
                { label: "Working on it", color: "#FFCB00" },
                { label: "Done", color: "#00C875" },
                { label: "Stuck", color: "#E2445C" },
              ],
            },
          },
          {
            id: "owner",
            title: "Owner",
            type: "people",
            width: 150,
          },
          {
            id: "due_date",
            title: "Due Date",
            type: "date",
            width: 150,
          },
        ],
        groups: [
          {
            id: "group1",
            title: "New Group",
            color: formData.color,
            board_id: "", // Will be set by backend or parent
          },
        ],
      };

      await onSubmit(boardData);
      setFormData({
        title: "",
        description: "",
        color: "#0073EA",
        visibility: "private",
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Board</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Board Name</Label>
            <Input
              id="title"
              placeholder="e.g., Marketing Projects"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="What is this board for?"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Board Color</Label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, color: color.value })
                    }
                    className={`w-8 h-8 rounded-full transition-all ${
                      formData.color === color.value
                        ? "ring-2 ring-offset-2 ring-gray-400 scale-110"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select
                value={formData.visibility}
                onValueChange={(value: "private" | "public" | "workspace") =>
                  setFormData({ ...formData, visibility: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      <span>Private</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="public">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      <span>Public</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.title.trim()}
            >
              {isSubmitting ? "Creating..." : "Create Board"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
