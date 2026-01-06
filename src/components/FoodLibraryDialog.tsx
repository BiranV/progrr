"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import SidePanel from "@/components/ui/side-panel";
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
      await queryClient.invalidateQueries({ queryKey: ["mealPlans"] });
      await queryClient.invalidateQueries({ queryKey: ["meals"] });
      onOpenChange(false);
      toast.success(food ? "Food updated" : "Food created");
    },
    onError: (err: any) => {
      toast.error(String(err?.message ?? "Failed to save"));
    },
  });

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title={food ? "Edit Food" : "Create Food"}
      widthClassName="w-full sm:w-[560px]"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={saveMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="food-library-form"
            className="w-full sm:w-auto"
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending
              ? "Saving..."
              : food
              ? "Update Food"
              : "Create Food"}
          </Button>
        </div>
      }
    >
      <form
        id="food-library-form"
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Food Name *
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="text-xs text-gray-600 dark:text-gray-400">
          All values below are per 100g.
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Calories (per 100g)
            </label>
            <Input
              placeholder="e.g., 200 (kcal)"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Protein (per 100g)
            </label>
            <Input
              placeholder="e.g., 20 (g)"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Carbs (per 100g)
            </label>
            <Input
              placeholder="e.g., 30 (g)"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fat (per 100g)
            </label>
            <Input
              placeholder="e.g., 10 (g)"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
            />
          </div>
        </div>

        <div className="h-2" />
      </form>
    </SidePanel>
  );
}
