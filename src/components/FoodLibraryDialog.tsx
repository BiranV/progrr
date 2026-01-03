"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface FoodLibraryDialogProps {
  food: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FoodLibraryDialog({
  food,
  open,
  onOpenChange,
}: FoodLibraryDialogProps) {
  const queryClient = useQueryClient();

  const [name, setName] = React.useState("");
  const [calories, setCalories] = React.useState("");
  const [protein, setProtein] = React.useState("");
  const [carbs, setCarbs] = React.useState("");
  const [fat, setFat] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setName(String(food?.name ?? ""));
    setCalories(String(food?.calories ?? ""));
    setProtein(String(food?.protein ?? ""));
    setCarbs(String(food?.carbs ?? ""));
    setFat(String(food?.fat ?? ""));
  }, [food, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Food name is required");

      const data: any = {
        name: trimmedName,
        calories: calories.trim(),
        protein: protein.trim(),
        carbs: carbs.trim(),
        fat: fat.trim(),
      };

      if (food?.id) {
        await db.entities.FoodLibrary.update(food.id, data);
      } else {
        await db.entities.FoodLibrary.create(data);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["foodLibrary"] });
      onOpenChange(false);
      toast.success(food ? "Food updated" : "Food created");
    },
    onError: (err: any) => {
      toast.error(String(err?.message ?? "Failed to save"));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{food ? "Edit Food" : "Create Food"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Food Name *
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Calories
              </label>
              <Input
                placeholder="e.g., 200"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Protein
              </label>
              <Input
                placeholder="e.g., 20"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Carbs
              </label>
              <Input
                placeholder="e.g., 30"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fat
              </label>
              <Input
                placeholder="e.g., 10"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending
                ? "Saving..."
                : food
                ? "Update Food"
                : "Create Food"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
