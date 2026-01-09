"use client";

import React from "react";
import { db } from "@/lib/db";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import SidePanel from "@/components/ui/side-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Beef,
  Copy as CopyIcon,
  Droplets,
  Edit2,
  FileDown,
  FileText,
  Flame,
  Plus,
  Trash2,
  Wheat,
  X,
} from "lucide-react";
import {
  copyTextToClipboard,
  downloadPdfFile,
  downloadTextFile,
  formatMealPlanText,
} from "@/lib/plan-export";
import { toast } from "sonner";
import { Food, FoodLibrary, Meal, MealPlan, PlanFood } from "@/types";

interface MealPlanPanelProps {
  planId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type MealForm = Partial<Meal> & {
  planFoods?: Array<Partial<PlanFood> & { legacyName?: string }>;
};

const EMPTY_FOOD_LIBRARY: FoodLibrary[] = [];
const EMPTY_MEALS: any[] = [];

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

export default function MealPlanPanel({
  planId,
  open,
  onOpenChange,
}: MealPlanPanelProps) {
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(
    null
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const { data: plan } = useQuery({
    queryKey: ["mealPlan", planId],
    queryFn: async () => {
      if (!planId) return null;
      return (await db.entities.MealPlan.get(planId)) as MealPlan;
    },
    enabled: open && Boolean(planId),
  });

  const { data: foodLibraryData } = useQuery({
    queryKey: ["foodLibrary"],
    queryFn: async () => {
      const rows = (await db.entities.FoodLibrary.list()) as FoodLibrary[];
      return [...rows].sort((a: FoodLibrary, b: FoodLibrary) =>
        String(a.name ?? "")
          .trim()
          .localeCompare(String(b.name ?? "").trim())
      );
    },
    enabled: open && isEditing,
  });

  const foodLibrary = (foodLibraryData ?? EMPTY_FOOD_LIBRARY) as FoodLibrary[];

  const { data: detailsMeals = [] } = useQuery({
    queryKey: ["meals", planId, "details"],
    queryFn: async () => {
      if (!planId) return [];
      const rows = await db.entities.Meal.filter({ mealPlanId: planId });
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
    enabled: open && Boolean(planId) && !isEditing,
  });

  const { data: queryMealsData } = useQuery({
    queryKey: ["meals", planId],
    queryFn: async () => {
      if (!planId) return [];
      const meals = await db.entities.Meal.filter({ mealPlanId: planId });
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
    enabled: open && Boolean(planId) && isEditing,
  });

  const existingMeals = (queryMealsData ?? EMPTY_MEALS) as any[];

  const [formData, setFormData] = React.useState<Partial<MealPlan>>({
    name: "",
    goal: "",
    dailyCalories: "",
    dailyProtein: "",
    dailyCarbs: "",
    dailyFat: "",
    notes: "",
  });

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

    const existing = meals
      .map((m) => normalizeMealType((m as any)?.type))
      .map((x) => String(x ?? "").trim())
      .filter(Boolean);

    return Array.from(new Set([...defaults, ...existing]));
  }, [meals, normalizeMealType]);

  React.useEffect(() => {
    if (!open) return;
    setValidationError(null);
    setShowDeleteConfirm(false);

    if (!planId) {
      setIsEditing(true);
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
    } else {
      setIsEditing(false);
    }
  }, [open, planId]);

  React.useEffect(() => {
    if (!open) return;
    if (!isEditing) return;

    if (planId && plan) {
      setFormData({
        name: plan.name || "",
        goal: plan.goal || "",
        dailyCalories: plan.dailyCalories || "",
        dailyProtein: plan.dailyProtein || "",
        dailyCarbs: plan.dailyCarbs || "",
        dailyFat: plan.dailyFat || "",
        notes: plan.notes || "",
      });
    }
  }, [open, isEditing, planId, plan]);

  React.useEffect(() => {
    if (!open) return;
    if (!isEditing) return;
    if (!planId) return; // create mode: do not sync

    const queryMeals = existingMeals;
    if (Array.isArray(queryMeals) && queryMeals.length > 0) {
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
    } else {
      setMeals((prev) => (prev.length ? [] : prev));
    }
  }, [open, isEditing, planId, existingMeals, foodLibrary, normalizeMealType]);

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

  const exportText = React.useMemo(() => {
    if (!plan) return "";
    return formatMealPlanText(plan, detailsMeals as any);
  }, [plan, detailsMeals]);

  const exportFilenameBase = React.useMemo(() => {
    const name = String(plan?.name ?? "").trim();
    const id = String(planId ?? "").trim();
    return `meal-plan-${name || id || "plan"}`;
  }, [plan, planId]);

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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const name = String(formData.name ?? "").trim();
      if (!name) throw new Error("Plan name is required");

      for (const meal of meals) {
        for (const row of meal.planFoods || []) {
          const foodLibraryId = String((row as any)?.foodLibraryId ?? "").trim();
          if (!foodLibraryId) {
            throw new Error("Each food must be selected from the library");
          }
        }
      }

      const fmt = (n: number, decimals: number) => {
        if (!Number.isFinite(n)) return "";
        const v = Number(n.toFixed(decimals));
        return String(v);
      };

      const payload: Partial<MealPlan> = {
        ...formData,
        name,
        dailyCalories: fmt(computedDailyTotals.calories, 0),
        dailyProtein: fmt(computedDailyTotals.protein, 1),
        dailyCarbs: fmt(computedDailyTotals.carbs, 1),
        dailyFat: fmt(computedDailyTotals.fat, 1),
      };

      let nextPlanId: string;
      if (planId) {
        await db.entities.MealPlan.update(planId, payload);
        nextPlanId = planId;
      } else {
        const newPlan = await db.entities.MealPlan.create(payload);
        nextPlanId = String((newPlan as any).id);
      }

      const existingMealIds = meals
        .map((m) => m.id)
        .filter(Boolean) as string[];
      const mealsToDelete = (existingMeals as any[]).filter(
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
        const mealData: any = {
          mealPlanId: nextPlanId,
          type: normalizeMealType(meal.type),
          name: meal.name || "",
          order: i,
        };

        let mealId: string;
        if (meal.id) {
          await db.entities.Meal.update(meal.id, mealData);
          mealId = String(meal.id);
        } else {
          const newMeal = await db.entities.Meal.create(mealData);
          mealId = String((newMeal as any).id);
        }

        const existingLegacyFoods = await db.entities.Food.filter({ mealId });
        await Promise.all(
          existingLegacyFoods.map((f: Food) => db.entities.Food.delete(f.id))
        );

        if (meal.id) {
          const currentIds = (meal.planFoods || [])
            .map((pf) => String(pf.id ?? "").trim())
            .filter(Boolean);
          const existingPlanFoods = await db.entities.PlanFood.filter({
            mealId: String(meal.id),
          });
          const rowsToDelete = (existingPlanFoods as any[]).filter(
            (pf: PlanFood) => !currentIds.includes(String(pf.id ?? "").trim())
          );
          await Promise.all(
            rowsToDelete.map((pf: PlanFood) => db.entities.PlanFood.delete(pf.id))
          );
        }

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
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["mealPlans"] });
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      queryClient.invalidateQueries({ queryKey: ["foods"] });
      queryClient.invalidateQueries({ queryKey: ["planFoods"] });
      queryClient.invalidateQueries({ queryKey: ["mealPlan"] });
      toast.success(planId ? "Meal plan updated" : "Meal plan created");

      if (!planId) {
        onOpenChange(false);
      } else {
        setIsEditing(false);
      }
    },
    onError: (error: any) => {
      const msg = error?.message || "Failed to save meal plan";
      setValidationError(String(msg));
      toast.error(String(msg));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!planId) return;
      const meals = await db.entities.Meal.filter({ mealPlanId: planId });
      for (const meal of meals) {
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
      await db.entities.MealPlan.delete(planId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mealPlans"] });
      toast.success("Meal plan deleted");
      setShowDeleteConfirm(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(String(error?.message || "Failed to delete meal plan"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    saveMutation.mutate();
  };

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

  const panelTitle = isEditing
    ? planId
      ? "Edit Meal Plan"
      : "New Meal Plan"
    : "Meal Plan Details";

  const panelDescription = isEditing
    ? planId
      ? "Update meal plan"
      : "Create a new meal plan"
    : plan
      ? `View details for ${String(plan?.name ?? "Meal Plan")}`
      : "No plan selected";

  const renderViewMode = () => {
    if (!plan) {
      return (
        <div className="text-sm text-gray-600 dark:text-gray-300">
          No plan selected
        </div>
      );
    }

    return (
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
          {(detailsMeals as any[]).length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              No meals
            </div>
          ) : (
            <div className="space-y-3">
              {(detailsMeals as any[]).map((meal: any, idx: number) => (
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
                      {(meal.foods || []).map((food: any, foodIdx: number) => (
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
                      ))}
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

        <div className="pt-2">
          {!showDeleteConfirm ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={!planId}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Meal Plan
            </Button>
          ) : (
            <div className="p-4 border border-red-200 bg-red-50 dark:bg-red-900/10 rounded-lg space-y-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-red-900 dark:text-red-100">
                  Delete meal plan?
                </div>
                <div className="text-xs text-red-800 dark:text-red-200 leading-relaxed font-medium">
                  This will delete <strong>{String(plan?.name ?? "this plan")}</strong>. This
                  cannot be undone.
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
                  disabled={!planId || deleteMutation.isPending}
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
    <form id="meal-plan-form" className="space-y-6" onSubmit={handleSubmit}>
      {validationError ? (
        <div className="text-sm text-red-600 dark:text-red-400">
          {validationError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes
          </label>
          <Input
            placeholder="Optional"
            value={String(formData.notes ?? "")}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2 text-sm">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Calculated daily totals (from foods)
        </div>
        <div className="mt-1 font-medium text-gray-900 dark:text-white">
          {Math.round(computedDailyTotals.calories)} kcal ·{" "}
          {Number(computedDailyTotals.protein.toFixed(1))}g protein ·{" "}
          {Number(computedDailyTotals.carbs.toFixed(1))}g carbs ·{" "}
          {Number(computedDailyTotals.fat.toFixed(1))}g fat
        </div>
      </div>

      <div className="border-t pt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Meals</h3>
          <Button type="button" onClick={addMeal} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Meal
          </Button>
        </div>

        <div className="space-y-4">
          {meals.map((meal, mealIndex) => (
            <div
              key={meal.id || mealIndex}
              className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3"
            >
              <div className="flex flex-col sm:flex-row gap-3">
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
                  className="self-start sm:self-auto p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                  aria-label="Remove meal"
                  title="Remove meal"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Meal name
                </label>
                <Input
                  value={String(meal.name ?? "")}
                  onChange={(e) => updateMeal(mealIndex, "name", e.target.value)}
                  placeholder="Optional"
                />
              </div>

              {(meal.planFoods || []).map((row, foodIndex) => (
                <div
                  key={String((row as any).id ?? "") || foodIndex}
                  className="ml-4 flex flex-col sm:flex-row gap-2 items-start"
                >
                  <Select
                    value={String((row as any).foodLibraryId ?? "")}
                    onValueChange={(v) =>
                      updatePlanFood(mealIndex, foodIndex, {
                        foodLibraryId: v,
                      })
                    }
                  >
                    <SelectTrigger className="w-full sm:flex-1">
                      <SelectValue
                        placeholder={
                          String((row as any)?.legacyName ?? "").trim() || "Food"
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
                    placeholder="Amount (g)"
                    className="w-full sm:w-28"
                  />
                  <button
                    type="button"
                    onClick={() => removeFood(mealIndex, foodIndex)}
                    className="p-2 self-start"
                    aria-label="Remove food"
                    title="Remove food"
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

      <div className="h-2" />
    </form>
  );

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title={panelTitle}
      description={panelDescription}
      widthClassName="w-full sm:w-[560px] lg:w-[720px]"
      footer={
        isEditing ? (
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              type="button"
              onClick={() => (planId ? setIsEditing(false) : onOpenChange(false))}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" form="meal-plan-form" disabled={saveMutation.isPending}>
              {saveMutation.isPending
                ? "Saving..."
                : planId
                  ? "Save Changes"
                  : "Create Meal Plan"}
            </Button>
          </div>
        ) : (
          <div className="flex justify-start" />
        )
      }
    >
      {!planId && !isEditing ? (
        <div className="text-sm text-gray-600 dark:text-gray-300">
          No plan selected
        </div>
      ) : isEditing ? (
        renderEditMode()
      ) : (
        renderViewMode()
      )}
    </SidePanel>
  );
}
