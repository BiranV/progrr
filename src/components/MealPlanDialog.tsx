"use client";

import React from "react";
import { db } from "@/lib/db";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X, Plus, Trash2, XCircle } from "lucide-react";
import { MealPlan, Meal, Food, FoodLibrary, PlanFood } from "@/types";

interface MealPlanDialogProps {
  plan: MealPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MealPlanDialog({
  plan,
  open,
  onOpenChange,
}: MealPlanDialogProps) {
  const queryClient = useQueryClient();
  const [validationError, setValidationError] = React.useState<string | null>(
    null
  );
  const [formData, setFormData] = React.useState<Partial<MealPlan>>({
    name: "",
    goal: "",
    dailyCalories: "",
    dailyProtein: "",
    dailyCarbs: "",
    dailyFat: "",
    notes: "",
  });

  const { data: foodLibrary = [] } = useQuery({
    queryKey: ["foodLibrary"],
    queryFn: async () => {
      const rows = await db.entities.FoodLibrary.list();
      return [...rows].sort((a: FoodLibrary, b: FoodLibrary) =>
        String(a.name ?? "")
          .trim()
          .localeCompare(String(b.name ?? "").trim())
      );
    },
    enabled: open,
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => db.entities.AppSettings.list(),
    enabled: open,
  });

  const { data: queryMeals } = useQuery({
    queryKey: ["meals", plan?.id],
    queryFn: async () => {
      if (!plan) return [];
      const meals = await db.entities.Meal.filter({ mealPlanId: plan.id });
      const mealsWithFoods = await Promise.all(
        meals.map(async (meal: Meal) => {
          const planFoods = await db.entities.PlanFood.filter({
            mealId: meal.id,
          });

          if (planFoods.length) {
            return {
              ...meal,
              planFoods: [...planFoods].sort(
                (a: PlanFood, b: PlanFood) => (a.order || 0) - (b.order || 0)
              ),
            };
          }

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

  const existingMeals = queryMeals || [];

  type MealForm = Partial<Meal> & {
    planFoods?: Array<Partial<PlanFood> & { legacyName?: string }>;
  };

  const [meals, setMeals] = React.useState<MealForm[]>([]);

  const normalizeMealType = React.useCallback((value: unknown) => {
    const v = String(value ?? "").trim();
    const key = v.toLowerCase();
    const map: Record<string, string> = {
      breakfast: "Breakfast",
      lunch: "Lunch",
      dinner: "Dinner",
      snack: "Snack",
    };
    return map[key] || v || "Breakfast";
  }, []);

  const computedDailyTotals = React.useMemo(() => {
    const byId = new Map<string, FoodLibrary>();
    for (const f of foodLibrary) {
      if (f?.id) byId.set(String(f.id), f);
    }

    const parseNum = (value: unknown) => {
      const n = Number.parseFloat(String(value ?? "").replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    };

    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;

    for (const meal of meals) {
      for (const row of meal.planFoods || []) {
        const foodLibraryId = String((row as any)?.foodLibraryId ?? "").trim();
        const grams = parseNum((row as any)?.amount);
        if (!foodLibraryId || grams <= 0) continue;

        const f = byId.get(foodLibraryId);
        if (!f) continue;

        const factor = grams / 100;
        calories += parseNum(f.calories) * factor;
        protein += parseNum(f.protein) * factor;
        carbs += parseNum(f.carbs) * factor;
        fat += parseNum(f.fat) * factor;
      }
    }

    return {
      calories,
      protein,
      carbs,
      fat,
    };
  }, [meals, foodLibrary]);

  const mealTypeOptions = React.useMemo(() => {
    const defaults = [
      "Breakfast",
      "Lunch",
      "Dinner",
      "Snack",
      "Brunch",
      "Pre Workout",
      "Post Workout",
      "Supper",
    ];

    const fromSettingsRaw = (appSettings?.[0] as any)?.mealTypes;
    const custom = Array.isArray(fromSettingsRaw)
      ? fromSettingsRaw.map((x: any) => String(x ?? "").trim()).filter(Boolean)
      : [];

    const existing = meals
      .map((m) => normalizeMealType((m as any)?.type))
      .map((x) => String(x ?? "").trim())
      .filter(Boolean);

    return Array.from(new Set([...defaults, ...custom, ...existing]));
  }, [appSettings, meals, normalizeMealType]);

  React.useEffect(() => {
    setValidationError(null);
    if (plan) {
      setFormData({
        name: plan.name || "",
        goal: plan.goal || "",
        dailyCalories: plan.dailyCalories || "",
        dailyProtein: plan.dailyProtein || "",
        dailyCarbs: plan.dailyCarbs || "",
        dailyFat: plan.dailyFat || "",
        notes: plan.notes || "",
      });
    } else {
      setFormData({
        name: "",
        goal: "",
        dailyCalories: "",
        dailyProtein: "",
        dailyCarbs: "",
        dailyFat: "",
        notes: "",
      });
      setMeals([]);
    }
  }, [plan, open]);

  React.useEffect(() => {
    if (queryMeals && queryMeals.length > 0) {
      const byName = new Map<string, string>();
      for (const f of foodLibrary) {
        const key = String(f.name ?? "")
          .trim()
          .toLowerCase();
        if (key && f.id) byName.set(key, f.id);
      }

      const normalized: MealForm[] = (queryMeals as any[]).map((meal) => {
        const existingPlanFoods = Array.isArray(meal.planFoods)
          ? (meal.planFoods as PlanFood[])
          : [];
        if (existingPlanFoods.length) {
          return {
            ...meal,
            type: normalizeMealType((meal as any)?.type),
            planFoods: existingPlanFoods,
          };
        }

        const legacyFoods = Array.isArray(meal.foods)
          ? (meal.foods as Food[])
          : [];

        const migratedPlanFoods = legacyFoods.map((lf) => {
          const legacyName = String(lf.name ?? "").trim();
          const matchedId = byName.get(legacyName.toLowerCase());
          return {
            foodLibraryId: matchedId || "",
            amount: lf.amount || "",
            legacyName,
          } satisfies Partial<PlanFood> & { legacyName?: string };
        });

        return {
          ...meal,
          type: normalizeMealType((meal as any)?.type),
          planFoods: migratedPlanFoods,
        };
      });

      setMeals((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(normalized)) return prev;
        return normalized;
      });
    } else if (!plan) {
      setMeals([]);
    }
  }, [queryMeals, plan, foodLibrary, normalizeMealType]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<MealPlan>) => {
      let planId: string;
      if (plan) {
        await db.entities.MealPlan.update(plan.id, data);
        planId = plan.id;
      } else {
        const newPlan = await db.entities.MealPlan.create(data);
        planId = newPlan.id;
      }

      // Handle meals and foods
      const existingMealIds = meals
        .map((m) => m.id)
        .filter(Boolean) as string[];
      const mealsToDelete = existingMeals.filter(
        (m: Meal) => !existingMealIds.includes(m.id)
      );

      for (const meal of mealsToDelete) {
        const planFoods = await db.entities.PlanFood.filter({
          mealId: meal.id,
        });
        await Promise.all(
          planFoods.map((pf: PlanFood) => db.entities.PlanFood.delete(pf.id))
        );
        const foods = await db.entities.Food.filter({ mealId: meal.id });
        await Promise.all(
          foods.map((f: Food) => db.entities.Food.delete(f.id))
        );
        await db.entities.Meal.delete(meal.id);
      }

      for (let i = 0; i < meals.length; i++) {
        const meal = meals[i];
        const mealData = {
          mealPlanId: planId,
          type: normalizeMealType(meal.type),
          name: meal.name || "",
          order: i,
        };

        let mealId: string;
        if (meal.id) {
          await db.entities.Meal.update(meal.id, mealData);
          mealId = meal.id;
        } else {
          const newMeal = await db.entities.Meal.create(mealData);
          mealId = newMeal.id;
        }

        // Remove any legacy foods when saving (migrates old plans to library-based foods)
        const existingLegacyFoods = await db.entities.Food.filter({ mealId });
        await Promise.all(
          existingLegacyFoods.map((f: Food) => db.entities.Food.delete(f.id))
        );

        // Delete removed PlanFood rows (edit only)
        if (meal.id) {
          const currentIds = (meal.planFoods || [])
            .map((pf) => String(pf.id ?? "").trim())
            .filter(Boolean);
          const existingPlanFoods = await db.entities.PlanFood.filter({
            mealId: meal.id,
          });
          const rowsToDelete = existingPlanFoods.filter(
            (pf: PlanFood) => !currentIds.includes(String(pf.id ?? "").trim())
          );
          await Promise.all(
            rowsToDelete.map((pf: PlanFood) =>
              db.entities.PlanFood.delete(pf.id)
            )
          );
        }

        // Save PlanFood rows
        for (let j = 0; j < (meal.planFoods || []).length; j++) {
          const row = (meal.planFoods || [])[j] as any;
          const foodLibraryId = String(row.foodLibraryId ?? "").trim();
          const rowData: any = {
            mealId,
            foodLibraryId,
            amount: String(row.amount ?? "").trim(),
            order: j,
          };

          if (row.id) {
            await db.entities.PlanFood.update(String(row.id), rowData);
          } else {
            await db.entities.PlanFood.create(rowData);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mealPlans"] });
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      queryClient.invalidateQueries({ queryKey: ["foods"] });
      queryClient.invalidateQueries({ queryKey: ["planFoods"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      setValidationError(error?.message || "Failed to save meal plan");
    },
  });

  const addMeal = () => {
    setMeals([
      ...meals,
      { type: mealTypeOptions[0] || "Breakfast", name: "", planFoods: [] },
    ]);
  };

  const updateMeal = (index: number, field: keyof Meal, value: any) => {
    const updated = [...meals];
    updated[index] = { ...updated[index], [field]: value };
    setMeals(updated);
  };

  const removeMeal = (index: number) => {
    setMeals(meals.filter((_, i) => i !== index));
  };

  const addFood = (mealIndex: number) => {
    const updated = [...meals];
    if (!updated[mealIndex].planFoods) updated[mealIndex].planFoods = [];
    updated[mealIndex].planFoods!.push({
      foodLibraryId: "",
      amount: "",
    } as Partial<PlanFood>);
    setMeals(updated);
  };

  const updatePlanFood = (
    mealIndex: number,
    foodIndex: number,
    patch: Partial<PlanFood> & { legacyName?: string }
  ) => {
    const updated = [...meals];
    if (
      updated[mealIndex].planFoods &&
      updated[mealIndex].planFoods![foodIndex]
    ) {
      updated[mealIndex].planFoods![foodIndex] = {
        ...updated[mealIndex].planFoods![foodIndex],
        ...patch,
      };
      setMeals(updated);
    }
  };

  const removeFood = (mealIndex: number, foodIndex: number) => {
    const updated = [...meals];
    if (updated[mealIndex].planFoods) {
      updated[mealIndex].planFoods = updated[mealIndex].planFoods!.filter(
        (_, i) => i !== foodIndex
      );
      setMeals(updated);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    setValidationError(null);
    const name = String(formData.name ?? "").trim();
    if (!name) {
      setValidationError("Plan name is required");
      return;
    }

    for (const meal of meals) {
      for (const row of meal.planFoods || []) {
        const foodLibraryId = String((row as any)?.foodLibraryId ?? "").trim();
        if (!foodLibraryId) {
          setValidationError("Each food must be selected from the library");
          return;
        }
      }
    }

    const fmt = (n: number, decimals: number) => {
      if (!Number.isFinite(n)) return "";
      const v = Number(n.toFixed(decimals));
      return String(v);
    };

    saveMutation.mutate({
      ...formData,
      name,
      // Auto-calc daily totals from selected foods (per 100g) * grams/100
      dailyCalories: fmt(computedDailyTotals.calories, 0),
      dailyProtein: fmt(computedDailyTotals.protein, 1),
      dailyCarbs: fmt(computedDailyTotals.carbs, 1),
      dailyFat: fmt(computedDailyTotals.fat, 1),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto dark:bg-gray-800">
        <DialogHeader>
          <DialogTitle>
            {plan ? "Edit Meal Plan" : "Create Meal Plan"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Plan Name *
              </label>
              <Input
                value={formData.name}
                onChange={(e) => (
                  validationError && setValidationError(null),
                  setFormData({ ...formData, name: e.target.value })
                )}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Goal
              </label>
              <Input
                placeholder="e.g., Weight Loss"
                value={formData.goal}
                onChange={(e) =>
                  setFormData({ ...formData, goal: e.target.value })
                }
              />
            </div>
          </div>

          <div className="rounded-xl border bg-white dark:bg-slate-900/30 px-4 py-3">
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Calculated daily totals (from foods)
            </div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {Math.round(computedDailyTotals.calories)} kcal ·{" "}
              {Number(computedDailyTotals.protein.toFixed(1))}g protein ·{" "}
              {Number(computedDailyTotals.carbs.toFixed(1))}g carbs ·{" "}
              {Number(computedDailyTotals.fat.toFixed(1))}g fat
            </div>
          </div>

          <div className="border-t pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Meals</h3>
              <Button
                type="button"
                onClick={addMeal}
                variant="outline"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Meal
              </Button>
            </div>

            <div className="space-y-4">
              {meals.map((meal, mealIndex) => (
                <div
                  key={mealIndex}
                  className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3"
                >
                  <div className="flex gap-3">
                    <Select
                      value={normalizeMealType(meal.type)}
                      onValueChange={(v) =>
                        updateMeal(mealIndex, "type", normalizeMealType(v))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {mealTypeOptions.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={() => removeMeal(mealIndex)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {(meal.planFoods || []).map((row, foodIndex) => (
                    <div
                      key={foodIndex}
                      className="ml-4 flex gap-2 items-start"
                    >
                      <Select
                        value={String((row as any).foodLibraryId ?? "")}
                        onValueChange={(v) =>
                          updatePlanFood(mealIndex, foodIndex, {
                            foodLibraryId: v,
                          })
                        }
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue
                            placeholder={
                              String((row as any)?.legacyName ?? "").trim() ||
                              "Food"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {foodLibrary.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={String((row as any).amount ?? "")}
                        onChange={(e) =>
                          updatePlanFood(mealIndex, foodIndex, {
                            amount: e.target.value,
                          })
                        }
                        placeholder="Amount"
                        className="w-24"
                      />
                      <button
                        type="button"
                        onClick={() => removeFood(mealIndex, foodIndex)}
                        className="p-2"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  <Button
                    type="button"
                    onClick={() => addFood(mealIndex)}
                    variant="ghost"
                    size="sm"
                    className="ml-4"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Food
                  </Button>
                </div>
              ))}

              {meals.length === 0 && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                  No meals added yet. Click "Add Meal" to get started.
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
