"use client";

import React from "react";
import { db } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";
import SidePanel from "@/components/ui/side-panel";
import { Button } from "@/components/ui/button";
import {
  Beef,
  Copy as CopyIcon,
  Droplets,
  FileDown,
  FileText,
  Flame,
  Wheat,
} from "lucide-react";
import {
  copyTextToClipboard,
  downloadPdfFile,
  downloadTextFile,
  formatMealPlanText,
} from "@/lib/plan-export";
import { toast } from "sonner";
import { MealPlan, Meal, Food, PlanFood, FoodLibrary } from "@/types";

interface MealPlanDetailsDialogProps {
  plan: MealPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toTitleCase(value: any) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

export default function MealPlanDetailsDialog({
  plan,
  open,
  onOpenChange,
}: MealPlanDetailsDialogProps) {
  const { data: meals = [] } = useQuery({
    queryKey: ["meals", plan?.id, "details"],
    queryFn: async () => {
      if (!plan) return [];
      const rows = await db.entities.Meal.filter({ mealPlanId: plan.id });
      const mealsWithFoods = await Promise.all(
        rows.map(async (meal: Meal) => {
          const planFoodRows = await db.entities.PlanFood.filter({
            mealId: meal.id,
          });

          const sortedPlanFoods = [...planFoodRows].sort(
            (a: PlanFood, b: PlanFood) => (a.order || 0) - (b.order || 0)
          );

          if (sortedPlanFoods.length) {
            const ids = Array.from(
              new Set(
                sortedPlanFoods
                  .map((r: any) => String(r.foodLibraryId ?? "").trim())
                  .filter(Boolean)
              )
            );

            const libs = await Promise.all(
              ids.map(async (id) => {
                try {
                  return await db.entities.FoodLibrary.get(id);
                } catch {
                  return null;
                }
              })
            );
            const libById = new Map(
              libs.filter(Boolean).map((l: any) => [String(l.id), l])
            );

            const foods = sortedPlanFoods.map((row: any) => {
              const lib = libById.get(String(row.foodLibraryId ?? "").trim());
              return {
                id: row.id,
                name: lib?.name ?? "-",
                amount: row?.amount ?? "",
                protein: lib?.protein ?? "",
                carbs: lib?.carbs ?? "",
                fat: lib?.fat ?? "",
                calories: lib?.calories ?? "",
              };
            });

            return { ...meal, foods };
          }

          // Legacy fallback
          const foods = await db.entities.Food.filter({ mealId: meal.id });
          return {
            ...meal,
            foods: foods.sort(
              (a: Food, b: Food) => (a.order || 0) - (b.order || 0)
            ),
          };
        })
      );
      return mealsWithFoods.sort(
        (a: Meal, b: Meal) => (a.order || 0) - (b.order || 0)
      );
    },
    enabled: !!plan && open,
  });

  const exportText = React.useMemo(() => {
    if (!plan) return "";
    return formatMealPlanText(plan, meals as any);
  }, [plan, meals]);

  const exportFilenameBase = React.useMemo(() => {
    const name = String(plan?.name ?? "").trim();
    const id = String((plan as any)?.id ?? "").trim();
    return `meal-plan-${name || id || "plan"}`;
  }, [plan]);

  const handleCopy = async () => {
    if (!plan) return;
    try {
      await copyTextToClipboard(exportText);
      toast.success("Copied to clipboard");
    } catch (err) {
      console.error("Failed to copy meal plan", err);
      toast.error("Failed to copy");
    }
  };

  const handleDownloadText = () => {
    if (!plan) return;
    try {
      downloadTextFile(exportFilenameBase, exportText);
    } catch (err) {
      console.error("Failed to download meal plan text", err);
      toast.error("Failed to download text");
    }
  };

  const handleDownloadPdf = () => {
    if (!plan) return;
    try {
      downloadPdfFile(
        exportFilenameBase,
        String(plan.name ?? "Meal Plan").trim() || "Meal Plan",
        exportText
      );
    } catch (err) {
      console.error("Failed to download meal plan PDF", err);
      toast.error("Failed to download PDF");
    }
  };

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Meal Plan Details"
      widthClassName="w-full sm:w-[560px] lg:w-[720px]"
    >
      {!plan ? (
        <div className="text-sm text-gray-600 dark:text-gray-300">
          No plan selected
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xl font-semibold text-gray-900 dark:text-white truncate">
                {String(plan.name ?? "-")}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Total values
                {String(plan.goal ?? "").trim() ? (
                  <span>
                    {" "}
                    ·{" "}
                    <span className="capitalize">
                      {String(plan.goal).replace(/[_-]/g, " ")}
                    </span>
                  </span>
                ) : null}
              </div>
            </div>

            <div className="shrink-0 flex flex-wrap gap-2">
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
                className="text-green-600 hover:text-green-700 dark:text-green-300 dark:hover:text-green-200"
                title="Copy to clipboard"
                aria-label="Copy to clipboard"
                onClick={handleCopy}
              >
                <CopyIcon className="w-4 h-4" />
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
                {plan.dailyCalories ? `${plan.dailyCalories} kcal` : "-"}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Beef className="w-4 h-4 text-blue-500" />
                <span>Protein</span>
              </div>
              <div className="mt-1 font-medium text-gray-900 dark:text-white">
                {plan.dailyProtein ? `${plan.dailyProtein} g` : "-"}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Wheat className="w-4 h-4 text-yellow-500" />
                <span>Carbs</span>
              </div>
              <div className="mt-1 font-medium text-gray-900 dark:text-white">
                {plan.dailyCarbs ? `${plan.dailyCarbs} g` : "-"}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Droplets className="w-4 h-4 text-purple-500" />
                <span>Fat</span>
              </div>
              <div className="mt-1 font-medium text-gray-900 dark:text-white">
                {plan.dailyFat ? `${plan.dailyFat} g` : "-"}
              </div>
            </div>
          </div>

          {plan.notes ? (
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                Notes
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                {plan.notes}
              </div>
            </div>
          ) : null}

          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Meals
            </div>
            {meals.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                No meals
              </div>
            ) : (
              <div className="space-y-3">
                {meals.map((meal: any, idx: number) => (
                  <div
                    key={meal.id || idx}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        {String(meal.name ?? "").trim() ? (
                          <>
                            <div className="font-medium text-gray-900 dark:text-white truncate">
                              {String(meal.name ?? "").trim()}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {toTitleCase(meal.type) || "Meal"}
                            </div>
                          </>
                        ) : (
                          <div className="font-medium text-gray-900 dark:text-white truncate">
                            {toTitleCase(meal.type) || "Meal"}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-xs text-gray-600 dark:text-gray-300">
                        per 100g
                      </div>
                    </div>

                    {(meal.foods || []).length ? (
                      <div className="mt-2 space-y-1">
                        {(meal.foods || []).map(
                          (food: any, foodIdx: number) => (
                            <div
                              key={food.id || foodIdx}
                              className="flex items-center justify-between gap-3 text-xs text-gray-600 dark:text-gray-300"
                            >
                              <div className="min-w-0 truncate">
                                {food.name || "-"}
                                {food.amount ? (
                                  <span className="text-gray-500 dark:text-gray-400">
                                    {" "}
                                    · {food.amount}
                                  </span>
                                ) : null}
                              </div>
                              <div className="shrink-0 text-gray-500 dark:text-gray-400">
                                {[
                                  food.protein ? `P ${food.protein}` : "",
                                  food.carbs ? `C ${food.carbs}` : "",
                                  food.fat ? `F ${food.fat}` : "",
                                ]
                                  .filter((v): v is string => Boolean(v))
                                  .join(" · ")}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        No foods
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </SidePanel>
  );
}
