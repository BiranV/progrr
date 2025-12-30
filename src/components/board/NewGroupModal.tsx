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

const colorOptions = [
  { name: "Ocean Blue", value: "#0073EA" },
  { name: "Success Green", value: "#00C875" },
  { name: "Warning Orange", value: "#FFCB00" },
  { name: "Danger Red", value: "#E2445C" },
  { name: "Purple", value: "#A25DDC" },
  { name: "Teal", value: "#00D9FF" },
  { name: "Gray", value: "#676879" },
];

interface NewGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; color: string }) => Promise<void>;
}

export default function NewGroupModal({
  isOpen,
  onClose,
  onSubmit,
}: NewGroupModalProps) {
  const [groupData, setGroupData] = useState({
    title: "",
    color: "#0073EA", // Default color
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupData.title.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(groupData);
      setGroupData({ title: "", color: "#0073EA" }); // Reset form
      onClose();
    } catch (error) {
      console.error("Error creating group:", error);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#323338] dark:text-gray-200">
            Add New Group
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label
              htmlFor="group-title"
              className="text-[#323338] dark:text-gray-200 font-medium"
            >
              Group Title *
            </Label>
            <Input
              id="group-title"
              value={groupData.title}
              onChange={(e) =>
                setGroupData((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="e.g., To Do, In Progress"
              className="rounded-xl border-[#E1E5F3] dark:border-gray-700 h-12 focus:ring-2 focus:ring-[#0073EA]/20"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[#323338] dark:text-gray-200 font-medium">
              Group Color
            </Label>
            <div className="flex gap-2 flex-wrap">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() =>
                    setGroupData((prev) => ({ ...prev, color: color.value }))
                  }
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${
                    groupData.color === color.value
                      ? "border-[#323338] dark:border-gray-200 scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>
          <DialogFooter className="pt-6">
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
              disabled={!groupData.title.trim() || isSubmitting}
              className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-xl h-12 px-6 font-medium"
            >
              {isSubmitting ? "Creating..." : "Create Group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
