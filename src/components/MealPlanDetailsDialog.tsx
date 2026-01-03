"use client";

import React from "react";
import { db } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MealPlan, Meal, Food } from "@/types";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-gray-800">
        <DialogHeader>
          <DialogTitle>Meal Plan Details</DialogTitle>
        </DialogHeader>

        {!plan ? (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            No plan selected
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-1">
              <div className="text-xl font-semibold text-gray-900 dark:text-white">
                {plan.name}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {plan.goal ? (
                  <span className="capitalize">
                    {String(plan.goal).replace(/[_-]/g, " ")}
                  </span>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">
                    Goal: -
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
                <div className="text-gray-500 dark:text-gray-400">Calories</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {plan.dailyCalories ? `${plan.dailyCalories} kcal` : "-"}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
                <div className="text-gray-500 dark:text-gray-400">Protein</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {plan.dailyProtein ? `${plan.dailyProtein} g` : "-"}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
                <div className="text-gray-500 dark:text-gray-400">Carbs</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {plan.dailyCarbs ? `${plan.dailyCarbs} g` : "-"}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
                <div className="text-gray-500 dark:text-gray-400">Fat</div>
                <div className="font-medium text-gray-900 dark:text-white">
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
                          {(meal.foods || []).length} foods
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
                                  {food.protein ? `P ${food.protein}` : ""}
                                  {food.carbs ? ` C ${food.carbs}` : ""}
                                  {food.fat ? ` F ${food.fat}` : ""}
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
      </DialogContent>
    </Dialog>
  );
}
