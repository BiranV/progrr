"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import SidePanel from "@/components/ui/side-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Beef,
  Copy as CopyIcon,
  Droplets,
  Edit2,
  FileDown,
  FileText,
  Flame,
  Trash2,
  Wheat,
} from "lucide-react";
import {
  copyTextToClipboard,
  downloadPdfFile,
  downloadTextFile,
} from "@/lib/plan-export";
import { toast } from "sonner";

interface FoodLibraryDetailsDialogProps {
  food: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFoodUpdate?: () => void;
}

export default function FoodLibraryDetailsDialog({
  food,
  open,
  onOpenChange,
  onFoodUpdate,
}: FoodLibraryDetailsDialogProps) {
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(
    null
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const exportText = React.useMemo(() => {
    if (!food) return "";

    const name = String(food?.name ?? "").trim() || "-";
    const calories = String(food?.calories ?? "").trim() || "-";
    const protein = String(food?.protein ?? "").trim() || "-";
    const carbs = String(food?.carbs ?? "").trim() || "-";
    const fat = String(food?.fat ?? "").trim() || "-";

    const lines: string[] = [];
    lines.push(`Food: ${name}`);
    lines.push("Values per 100g");
    lines.push("");
    lines.push(`Calories: ${calories} kcal`);
    lines.push(`Protein: ${protein} g`);
    lines.push(`Carbs: ${carbs} g`);
    lines.push(`Fat: ${fat} g`);
    return lines.join("\n");
  }, [food]);

  const exportFilenameBase = React.useMemo(() => {
    const name = String(food?.name ?? "").trim();
    const id = String(food?.id ?? "").trim();
    return `food-${name || id || "item"}`;
  }, [food]);

  const handleCopy = async () => {
    if (!food) return;
    try {
      await copyTextToClipboard(exportText);
      toast.success("Copied to clipboard");
    } catch (err) {
      console.error("Failed to copy food", err);
      toast.error("Failed to copy");
    }
  };

  const handleDownloadText = () => {
    if (!food) return;
    try {
      downloadTextFile(exportFilenameBase, exportText);
    } catch (err) {
      console.error("Failed to download food text", err);
      toast.error("Failed to download text");
    }
  };

  const handleDownloadPdf = () => {
    if (!food) return;
    try {
      const title = String(food?.name ?? "Food").trim() || "Food";
      downloadPdfFile(exportFilenameBase, `Food: ${title}`, exportText);
    } catch (err) {
      console.error("Failed to download food PDF", err);
      toast.error("Failed to download PDF");
    }
  };

  const [formData, setFormData] = React.useState<any>({});

  const resetForm = (current: any | null) => {
    setValidationError(null);
    if (current) {
      setFormData({
        name: String(current?.name ?? ""),
        calories: String(current?.calories ?? ""),
        protein: String(current?.protein ?? ""),
        carbs: String(current?.carbs ?? ""),
        fat: String(current?.fat ?? ""),
      });
    } else {
      setFormData({
        name: "",
        calories: "",
        protein: "",
        carbs: "",
        fat: "",
      });
    }
  };

  // Reset editing state when panel opens/closes or selected food changes
  React.useEffect(() => {
    if (!open) return;
    setShowDeleteConfirm(false);
    if (!food) {
      setIsEditing(true);
      resetForm(null);
      return;
    }
    setIsEditing(false);
    resetForm(food);
  }, [open, food]);

  const getInputProps = (field: string) => ({
    value: formData[field] || "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      if (validationError) setValidationError(null);
      setFormData((prev: any) => ({ ...prev, [field]: e.target.value }));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const name = String(formData.name ?? "").trim();
      if (!name) throw new Error("Food name is required");

      const payload: any = {
        name,
        calories: String(formData.calories ?? "").trim(),
        protein: String(formData.protein ?? "").trim(),
        carbs: String(formData.carbs ?? "").trim(),
        fat: String(formData.fat ?? "").trim(),
      };

      if (food?.id) {
        await db.entities.FoodLibrary.update(food.id, payload);
      } else {
        await db.entities.FoodLibrary.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foodLibrary"] });
      queryClient.invalidateQueries({ queryKey: ["mealPlans"] });
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      onFoodUpdate?.();
      toast.success(food ? "Food updated" : "Food created");
      if (!food) {
        onOpenChange(false);
      } else {
        setIsEditing(false);
      }
    },
    onError: (err: any) => {
      setValidationError(String(err?.message ?? "Failed to save"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!food?.id) return;
      await db.entities.FoodLibrary.delete(String(food.id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foodLibrary"] });
      queryClient.invalidateQueries({ queryKey: ["mealPlans"] });
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      onFoodUpdate?.();
      toast.success("Food deleted");
      setShowDeleteConfirm(false);
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(String(err?.message ?? "Failed to delete"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    saveMutation.mutate();
  };

  const renderViewMode = () => {
    const calories = String(food?.calories ?? "").trim() || "-";
    const protein = String(food?.protein ?? "").trim() || "-";
    const carbs = String(food?.carbs ?? "").trim() || "-";
    const fat = String(food?.fat ?? "").trim() || "-";

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xl font-semibold text-gray-900 dark:text-white truncate">
              {String(food?.name ?? "-")}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Values per 100g
            </div>
          </div>

          <div className="shrink-0 flex flex-wrap gap-2 items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-rose-600 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200"
              title="Download PDF"
              aria-label="Download PDF"
              onClick={handleDownloadPdf}
            >
              <FileDown className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
              title="Download Text"
              aria-label="Download Text"
              onClick={handleDownloadText}
            >
              <FileText className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-200"
              title="Copy to clipboard"
              aria-label="Copy to clipboard"
              onClick={handleCopy}
            >
              <CopyIcon className="w-4 h-4" />
            </Button>

            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <Flame className="w-4 h-4 text-orange-500" />
              <span>Calories</span>
            </div>
            <div className="mt-1 font-medium text-gray-900 dark:text-white">
              {calories} kcal
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <Beef className="w-4 h-4 text-blue-500" />
              <span>Protein</span>
            </div>
            <div className="mt-1 font-medium text-gray-900 dark:text-white">
              {protein} g
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <Wheat className="w-4 h-4 text-yellow-500" />
              <span>Carbs</span>
            </div>
            <div className="mt-1 font-medium text-gray-900 dark:text-white">
              {carbs} g
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <Droplets className="w-4 h-4 text-purple-500" />
              <span>Fat</span>
            </div>
            <div className="mt-1 font-medium text-gray-900 dark:text-white">
              {fat} g
            </div>
          </div>
        </div>

        <div className="pt-2">
          {!showDeleteConfirm ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={!food?.id}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Food
            </Button>
          ) : (
            <div className="p-4 border border-red-200 bg-red-50 dark:bg-red-900/10 rounded-lg space-y-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-red-900 dark:text-red-100">
                  Delete food?
                </div>
                <div className="text-xs text-red-800 dark:text-red-200 leading-relaxed font-medium">
                  This will remove <strong>{String(food?.name ?? "this food")}</strong> from the
                  library. This cannot be undone.
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  type="button"
                  disabled={!food?.id || deleteMutation.isPending}
                  onClick={async () => await deleteMutation.mutateAsync()}
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEditMode = () => (
    <form id="food-form" className="space-y-6" onSubmit={handleSubmit}>
      {validationError ? (
        <div className="text-sm text-red-600 dark:text-red-400">
          {validationError}
        </div>
      ) : null}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Food Name *
        </label>
        <Input {...getInputProps("name")} />
      </div>

      <div className="text-xs text-gray-600 dark:text-gray-400">
        All values below are per 100g.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Calories (per 100g)
          </label>
          <Input placeholder="e.g., 200 (kcal)" {...getInputProps("calories")} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Protein (per 100g)
          </label>
          <Input placeholder="e.g., 20 (g)" {...getInputProps("protein")} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Carbs (per 100g)
          </label>
          <Input placeholder="e.g., 30 (g)" {...getInputProps("carbs")} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Fat (per 100g)
          </label>
          <Input placeholder="e.g., 10 (g)" {...getInputProps("fat")} />
        </div>
      </div>

      <div className="h-2" />
    </form>
  );

  return (
    <>
      <SidePanel
        open={open}
        onOpenChange={onOpenChange}
        title={isEditing ? (food ? "Edit Food" : "New Food") : "Food Details"}
        description={
          isEditing
            ? food
              ? "Update food text information"
              : "Add a new food to your library"
            : `View details for ${String(food?.name ?? "Food")}`
        }
        widthClassName="w-full sm:w-[540px] lg:w-[600px]"
        footer={
          isEditing ? (
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                type="button"
                onClick={() => (food ? setIsEditing(false) : onOpenChange(false))}
                disabled={saveMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" form="food-form" disabled={saveMutation.isPending}>
                {saveMutation.isPending
                  ? "Saving..."
                  : food
                    ? "Save Changes"
                    : "Create Food"}
              </Button>
            </div>
          ) : (
            <div className="flex justify-start" />
          )
        }
      >
        {!food && !isEditing ? (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            No food selected
          </div>
        ) : isEditing ? (
          renderEditMode()
        ) : (
          renderViewMode()
        )}
      </SidePanel>
    </>
  );
}
