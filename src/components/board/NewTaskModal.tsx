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
import { Board } from "@/types";

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  board: Board | null;
  onSubmit: (groupId: string, title: string) => Promise<void>;
}

export default function NewTaskModal({
  isOpen,
  onClose,
  board,
  onSubmit,
}: NewTaskModalProps) {
  const [taskData, setTaskData] = useState({
    title: "",
    groupId: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize groupId when board changes or modal opens
  useEffect(() => {
    if (board?.groups && board.groups.length > 0) {
      setTaskData((prev) => ({
        ...prev,
        groupId: prev.groupId || board.groups![0].id,
      }));
    }
  }, [board, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskData.title.trim() || !taskData.groupId) return;

    setIsSubmitting(true);
    try {
      await onSubmit(taskData.groupId, taskData.title);
      setTaskData({ title: "", groupId: board?.groups?.[0]?.id || "" });
      onClose();
    } catch (error) {
      console.error("Error creating task:", error);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#323338] dark:text-gray-200">
            Create New Task
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label
              htmlFor="title"
              className="text-[#323338] dark:text-gray-200 font-medium"
            >
              Task Title *
            </Label>
            <Input
              id="title"
              value={taskData.title}
              onChange={(e) =>
                setTaskData((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Enter task title..."
              className="rounded-xl border-[#E1E5F3] dark:border-gray-700 h-12 focus:ring-2 focus:ring-[#0073EA]/20"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[#323338] dark:text-gray-200 font-medium">
              Group
            </Label>
            <Select
              value={taskData.groupId}
              onValueChange={(value) =>
                setTaskData((prev) => ({ ...prev, groupId: value }))
              }
            >
              <SelectTrigger className="w-full rounded-xl border-[#E1E5F3] dark:border-gray-700 h-12">
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                {board?.groups?.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      <span>{group.title}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl h-12 px-6"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !taskData.title.trim() || !taskData.groupId || isSubmitting
              }
              className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-xl h-12 px-6 font-medium"
            >
              {isSubmitting ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
