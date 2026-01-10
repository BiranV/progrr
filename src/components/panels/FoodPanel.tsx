"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGenericDetailsPanel } from "@/components/ui/entity/GenericDetailsPanel";
import { useEntityPanelState } from "@/components/ui/entity/useEntityPanelState";
import { EntityEditFooter } from "@/components/ui/entity/EntityEditFooter";
import { EntityDeleteConfirm } from "@/components/ui/entity/EntityDeleteConfirm";
import { EntityStatusChip } from "@/components/ui/entity/EntityStatusChip";
import { EntityInfoGrid } from "@/components/ui/entity/EntityInfoGrid";
import { ReadonlyInfoCard } from "@/components/ui/entity/ReadonlyInfoCard";
import {
  Beef,
  Copy as CopyIcon,
  Droplets,
  Edit2,
  FileDown,
  FileText,
  Flame,
  RotateCcw,
  Trash2,
  Wheat,
  XCircle,
} from "lucide-react";
import {
  copyTextToClipboard,
  downloadPdfFile,
  downloadTextFile,
} from "@/lib/plan-export";
import { toast } from "sonner";

export function FoodDetailsContent({
  food,
  onFoodUpdate,
  createNew,
}: {
  food: any | null;
  onFoodUpdate?: () => void;
  createNew?: boolean;
}) {
  const queryClient = useQueryClient();

  const panel = useGenericDetailsPanel();
  const open = panel.open;

  const panelState = useEntityPanelState();

  const foodId = String(food?.id ?? "").trim();

  const [validationError, setValidationError] = React.useState<string | null>(
    null
  );
  const [deleteInfoMessage, setDeleteInfoMessage] = React.useState<string | null>(
    null
  );

  const exportText = React.useMemo(() => {
    if (!food) return "";

    const lines: string[] = [];

    const addLine = (label: string, value: unknown, unit?: string) => {
      const raw = String(value ?? "").trim();
      if (!raw) return;
      lines.push(`${label}: ${raw}${unit ? ` ${unit}` : ""}`);
    };

    const name = String(food?.name ?? "").trim() || "-";
    lines.push(`Food: ${name}`);
    lines.push("Values per 100g");
    lines.push("");

    // Main macros (always included, even if empty)
    lines.push(`Calories: ${String(food?.calories ?? "-").trim() || "-"} kcal`);
    lines.push(`Protein: ${String(food?.protein ?? "-").trim() || "-"} g`);
    lines.push(`Carbs: ${String(food?.carbs ?? "-").trim() || "-"} g`);
    lines.push(`Fat: ${String(food?.fat ?? "-").trim() || "-"} g`);

    // Extra nutrition (only if present)
    const extraLinesStart = lines.length;
    addLine("Fiber", food?.fiber, "g");
    addLine("Sugars", food?.sugars, "g");
    addLine("Saturated fat", food?.saturatedFat, "g");
    addLine("Trans fat", food?.transFat, "g");
    addLine("Cholesterol", food?.cholesterol, "mg");
    addLine("Sodium", food?.sodium, "mg");
    addLine("Potassium", food?.potassium, "mg");
    addLine("Calcium", food?.calcium, "mg");
    addLine("Iron", food?.iron, "mg");
    addLine("Vitamin A", food?.vitaminA, "µg");
    addLine("Vitamin C", food?.vitaminC, "mg");
    addLine("Vitamin D", food?.vitaminD, "µg");
    addLine("Vitamin B12", food?.vitaminB12, "µg");
    const hasExtras = lines.length > extraLinesStart;

    // Metadata / source (only if present)
    const metaLines: string[] = [];
    const servingSizeRaw = String(food?.servingSize ?? "").trim();
    const servingUnitRaw = String(food?.servingUnit ?? "").trim();
    if (servingSizeRaw) {
      metaLines.push(
        `Serving size: ${servingSizeRaw}${servingUnitRaw ? ` ${servingUnitRaw}` : ""}`
      );
    }
    const sourceRaw = String(food?.source ?? "").trim();
    if (sourceRaw) metaLines.push(`Source: ${sourceRaw}`);
    const externalIdRaw = String(food?.externalId ?? "").trim();
    if (externalIdRaw) metaLines.push(`External ID: ${externalIdRaw}`);

    if (hasExtras || metaLines.length) lines.push("");
    if (metaLines.length) {
      lines.push("Info");
      lines.push(...metaLines);
      lines.push("");
    }

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

  const toOptionalNumber = (value: unknown) => {
    const raw = String(value ?? "").trim();
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };

  const toOptionalString = (value: unknown) => {
    const raw = String(value ?? "").trim();
    return raw ? raw : undefined;
  };

  const resetForm = (current: any | null) => {
    setValidationError(null);
    if (current) {
      setFormData({
        name: String(current?.name ?? ""),
        calories: String(current?.calories ?? ""),
        protein: String(current?.protein ?? ""),
        carbs: String(current?.carbs ?? ""),
        fat: String(current?.fat ?? ""),
        fiber: String(current?.fiber ?? ""),
        sugars: String(current?.sugars ?? ""),
        saturatedFat: String(current?.saturatedFat ?? ""),
        transFat: String(current?.transFat ?? ""),
        cholesterol: String(current?.cholesterol ?? ""),
        sodium: String(current?.sodium ?? ""),
        potassium: String(current?.potassium ?? ""),
        calcium: String(current?.calcium ?? ""),
        iron: String(current?.iron ?? ""),
        vitaminA: String(current?.vitaminA ?? ""),
        vitaminC: String(current?.vitaminC ?? ""),
        vitaminD: String(current?.vitaminD ?? ""),
        vitaminB12: String(current?.vitaminB12 ?? ""),
        servingSize: String(current?.servingSize ?? ""),
        servingUnit: String(current?.servingUnit ?? ""),
      });
    } else {
      setFormData({
        name: "",
        calories: "",
        protein: "",
        carbs: "",
        fat: "",
        fiber: "",
        sugars: "",
        saturatedFat: "",
        transFat: "",
        cholesterol: "",
        sodium: "",
        potassium: "",
        calcium: "",
        iron: "",
        vitaminA: "",
        vitaminC: "",
        vitaminD: "",
        vitaminB12: "",
        servingSize: "",
        servingUnit: "",
      });
    }
  };

  // Reset editing state when panel opens/closes or selected food changes
  React.useEffect(() => {
    if (!open) return;
    panelState.cancelDelete();
    setDeleteInfoMessage(null);
    if (!food) {
      resetForm(null);
      if (createNew) {
        panelState.startEdit();
      } else {
        panelState.cancelEdit();
      }
      return;
    }
    panelState.cancelEdit();
    resetForm(food);
  }, [
    open,
    foodId,
    createNew,
    panelState.cancelDelete,
    panelState.startEdit,
    panelState.cancelEdit,
  ]);

  const unarchiveMutation = useMutation({
    mutationFn: async () => {
      if (!food?.id) return null;
      return db.entities.FoodLibrary.update(String(food.id), {
        status: "ACTIVE",
      } as any);
    },
    onSuccess: () => {
      setDeleteInfoMessage(null);
      queryClient.invalidateQueries({ queryKey: ["foodLibrary"] });
      queryClient.invalidateQueries({ queryKey: ["mealPlans"] });
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      onFoodUpdate?.();
      toast.success("Food restored to active");
    },
    onError: (err: any) => {
      toast.error(String(err?.message ?? "Failed to restore"));
    },
  });

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
        calories: toOptionalString(formData.calories),
        protein: toOptionalString(formData.protein),
        carbs: toOptionalString(formData.carbs),
        fat: toOptionalString(formData.fat),
        fiber: toOptionalNumber(formData.fiber),
        sugars: toOptionalNumber(formData.sugars),
        saturatedFat: toOptionalNumber(formData.saturatedFat),
        transFat: toOptionalNumber(formData.transFat),
        cholesterol: toOptionalNumber(formData.cholesterol),
        sodium: toOptionalNumber(formData.sodium),
        potassium: toOptionalNumber(formData.potassium),
        calcium: toOptionalNumber(formData.calcium),
        iron: toOptionalNumber(formData.iron),
        vitaminA: toOptionalNumber(formData.vitaminA),
        vitaminC: toOptionalNumber(formData.vitaminC),
        vitaminD: toOptionalNumber(formData.vitaminD),
        vitaminB12: toOptionalNumber(formData.vitaminB12),
        servingSize: toOptionalNumber(formData.servingSize),
        servingUnit: toOptionalString(formData.servingUnit),
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
        panel.close();
      } else {
        panelState.cancelEdit();
      }
    },
    onError: (err: any) => {
      setValidationError(String(err?.message ?? "Failed to save"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!food?.id) return;
      return db.entities.FoodLibrary.delete(String(food.id));
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["foodLibrary"] });
      queryClient.invalidateQueries({ queryKey: ["mealPlans"] });
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      onFoodUpdate?.();

      const status = String(result?.status ?? "").trim().toUpperCase();
      if (status === "ARCHIVED") {
        setDeleteInfoMessage(
          "This food is currently used inside one or more active meal plans, so it cannot be deleted. It has been archived instead. Remove it from active plans if you want to delete it."
        );
        panelState.cancelDelete();
        return;
      }

      toast.success("Food deleted");
      panelState.cancelDelete();
      panel.close();
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

    const renderSimpleRow = (
      label: string,
      value: unknown,
      unit?: string
    ) => {
      const raw = String(value ?? "").trim();
      if (!raw) return null;
      return (
        <div className="flex items-center justify-between gap-4 py-2 border-b border-gray-100 dark:border-gray-800">
          <div className="text-sm text-gray-600 dark:text-gray-300">{label}</div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {raw}
            {unit ? ` ${unit}` : ""}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-xl font-semibold text-gray-900 dark:text-white truncate">
                {String(food?.name ?? "-")}
              </div>
              {String((food as any)?.status ?? "").trim().toUpperCase() ===
                "ARCHIVED" ? (
                <EntityStatusChip
                  status={String((food as any)?.status ?? "")}
                  size="sm"
                  className="shrink-0"
                />
              ) : null}
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

            {String((food as any)?.status ?? "").trim().toUpperCase() ===
              "ARCHIVED" && !panelState.isEditing ? (
              <Button
                variant="outline"
                size="sm"
                disabled={unarchiveMutation.isPending}
                onClick={() => unarchiveMutation.mutate()}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {unarchiveMutation.isPending
                  ? "Restoring..."
                  : "Return to active"}
              </Button>
            ) : null}

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetForm(food);
                panelState.startEdit();
              }}
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        <EntityInfoGrid>
          <ReadonlyInfoCard
            icon={Flame}
            label="Calories"
            value={`${calories} kcal`}
            iconClassName="text-orange-500"
          />
          <ReadonlyInfoCard
            icon={Beef}
            label="Protein"
            value={`${protein} g`}
            iconClassName="text-blue-500"
          />
          <ReadonlyInfoCard
            icon={Wheat}
            label="Carbs"
            value={`${carbs} g`}
            iconClassName="text-yellow-500"
          />
          <ReadonlyInfoCard
            icon={Droplets}
            label="Fat"
            value={`${fat} g`}
            iconClassName="text-purple-500"
          />
        </EntityInfoGrid>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              More nutrition (per 100g)
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Simple values below the main macros.
            </div>
          </div>

          <div className="px-3">
            {renderSimpleRow("Fiber", food?.fiber, "g")}
            {renderSimpleRow("Sugars", food?.sugars, "g")}
            {renderSimpleRow("Saturated fat", food?.saturatedFat, "g")}
            {renderSimpleRow("Trans fat", food?.transFat, "g")}
            {renderSimpleRow("Cholesterol", food?.cholesterol, "mg")}
            {renderSimpleRow("Sodium", food?.sodium, "mg")}
            {renderSimpleRow("Potassium", food?.potassium, "mg")}
            {renderSimpleRow("Calcium", food?.calcium, "mg")}
            {renderSimpleRow("Iron", food?.iron, "mg")}
            {renderSimpleRow("Vitamin A", food?.vitaminA, "µg")}
            {renderSimpleRow("Vitamin C", food?.vitaminC, "mg")}
            {renderSimpleRow("Vitamin D", food?.vitaminD, "µg")}
            {renderSimpleRow("Vitamin B12", food?.vitaminB12, "µg")}

            {!String(food?.fiber ?? "").trim() &&
              !String(food?.sugars ?? "").trim() &&
              !String(food?.saturatedFat ?? "").trim() &&
              !String(food?.transFat ?? "").trim() &&
              !String(food?.cholesterol ?? "").trim() &&
              !String(food?.sodium ?? "").trim() &&
              !String(food?.potassium ?? "").trim() &&
              !String(food?.calcium ?? "").trim() &&
              !String(food?.iron ?? "").trim() &&
              !String(food?.vitaminA ?? "").trim() &&
              !String(food?.vitaminC ?? "").trim() &&
              !String(food?.vitaminD ?? "").trim() &&
              !String(food?.vitaminB12 ?? "").trim() ? (
              <div className="py-3 text-sm text-gray-500 dark:text-gray-400">
                No extra values available for this food.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
            <div className="text-sm font-medium text-gray-900 dark:text-white">Info</div>
          </div>
          <div className="px-3">
            {renderSimpleRow("Serving size", food?.servingSize, String(food?.servingUnit ?? "").trim() || undefined)}
            {renderSimpleRow("Source", food?.source)}
            {renderSimpleRow("External ID", food?.externalId)}
            {!String(food?.servingSize ?? "").trim() &&
              !String(food?.source ?? "").trim() &&
              !String(food?.externalId ?? "").trim() ? (
              <div className="py-3 text-sm text-gray-500 dark:text-gray-400">
                No extra info.
              </div>
            ) : null}
          </div>
        </div>

        <div className="pt-2">
          {!panelState.showDeleteConfirm ? (
            <Button
              type="button"
              variant="destructive"
              onClick={panelState.requestDelete}
              disabled={!food?.id}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Food
            </Button>
          ) : (
            <EntityDeleteConfirm
              title="Delete food?"
              description={
                <>
                  This will remove <strong>{String(food?.name ?? "this food")}</strong> from the
                  library. This cannot be undone.
                </>
              }
              confirmLabel={deleteMutation.isPending ? "Deleting..." : "Delete"}
              disabled={!food?.id || deleteMutation.isPending}
              onCancel={panelState.cancelDelete}
              onConfirm={async () => await deleteMutation.mutateAsync()}
            />
          )}
        </div>
      </div>
    );
  };

  const renderEditMode = () => (
    <form id="food-form" className="space-y-6" onSubmit={handleSubmit}>
      {validationError ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-50 dark:bg-slate-900/60 px-4 min-h-12 py-2">
          <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300">
            <XCircle className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm text-slate-700 dark:text-slate-200 break-words">
              {validationError}
            </div>
          </div>
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

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3">
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          More nutrition (optional)
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          Keep simple: leave empty if you don’t have the value.
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fiber (g)
            </label>
            <Input placeholder="e.g., 3.2" {...getInputProps("fiber")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sugars (g)
            </label>
            <Input placeholder="e.g., 10" {...getInputProps("sugars")} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Saturated fat (g)
            </label>
            <Input placeholder="e.g., 2" {...getInputProps("saturatedFat")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Trans fat (g)
            </label>
            <Input placeholder="e.g., 0" {...getInputProps("transFat")} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cholesterol (mg)
            </label>
            <Input placeholder="e.g., 30" {...getInputProps("cholesterol")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sodium (mg)
            </label>
            <Input placeholder="e.g., 200" {...getInputProps("sodium")} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Potassium (mg)
            </label>
            <Input placeholder="e.g., 350" {...getInputProps("potassium")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Calcium (mg)
            </label>
            <Input placeholder="e.g., 120" {...getInputProps("calcium")} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Iron (mg)
            </label>
            <Input placeholder="e.g., 2" {...getInputProps("iron")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Vitamin A (µg)
            </label>
            <Input placeholder="e.g., 50" {...getInputProps("vitaminA")} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Vitamin C (mg)
            </label>
            <Input placeholder="e.g., 12" {...getInputProps("vitaminC")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Vitamin D (µg)
            </label>
            <Input placeholder="e.g., 2" {...getInputProps("vitaminD")} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Vitamin B12 (µg)
            </label>
            <Input placeholder="e.g., 0.6" {...getInputProps("vitaminB12")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Serving size
            </label>
            <Input placeholder="e.g., 30" {...getInputProps("servingSize")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Serving unit
            </label>
            <Input placeholder="e.g., g, ml" {...getInputProps("servingUnit")} />
          </div>
        </div>
      </div>

      <div className="h-2" />
    </form>
  );

  React.useEffect(() => {
    if (!open) return;

    panel.setTitle(
      panelState.isEditing ? (food ? "Edit Food" : "New Food") : "Food Details"
    );
    panel.setDescription(
      panelState.isEditing
        ? food
          ? "Update food text information"
          : "Add a new food to your library"
        : `View details for ${String(food?.name ?? "Food")}`
    );

    panel.setFooter(
      panelState.isEditing ? (
        <EntityEditFooter
          isNew={!food}
          isLoading={saveMutation.isPending}
          formId="food-form"
          onCancel={() => (food ? panelState.cancelEdit() : panel.close())}
          createLabel="Create Food"
          creatingLabel="Saving..."
          savingLabel="Saving..."
        />
      ) : undefined
    );
  }, [
    open,
    panel,
    panelState,
    food,
    saveMutation.isPending,
  ]);

  return (
    <>
      {deleteInfoMessage ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 px-3 py-2 mb-4">
          <div className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Archived (not deleted)
          </div>
          <div className="text-xs text-amber-800 dark:text-amber-200 mt-1 leading-relaxed">
            {deleteInfoMessage}
          </div>
        </div>
      ) : null}

      {!food && !panelState.isEditing ? (
        <div className="text-sm text-gray-600 dark:text-gray-300">
          No food selected
        </div>
      ) : panelState.isEditing ? (
        renderEditMode()
      ) : (
        renderViewMode()
      )}
    </>
  );
}
