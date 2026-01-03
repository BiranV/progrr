"use client";

import React from "react";
import { db } from "@/lib/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Plus,
  Search,
  Trash2,
  Edit,
  UtensilsCrossed,
  Flame,
  Dumbbell,
  FileDown,
  FileText,
  Copy,
} from "lucide-react";
import MealPlanDialog from "@/components/MealPlanDialog";
import MealPlanDetailsDialog from "@/components/MealPlanDetailsDialog";
import { MealPlan, Meal, Food, PlanFood, FoodLibrary } from "@/types";
import {
  copyTextToClipboard,
  downloadPdfFile,
  downloadTextFile,
  formatMealPlanText,
} from "@/lib/plan-export";
import { toast } from "sonner";

export default function MealsPage() {
  const [search, setSearch] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingPlan, setEditingPlan] = React.useState<MealPlan | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [detailsPlan, setDetailsPlan] = React.useState<MealPlan | null>(null);
  const queryClient = useQueryClient();

  const { data: mealPlans = [], isLoading } = useQuery({
    queryKey: ["mealPlans"],
    queryFn: () => db.entities.MealPlan.list("-created_date"),
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      const meals = await db.entities.Meal.filter({ mealPlanId: id });
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
      return db.entities.MealPlan.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mealPlans"] });
    },
  });

  const filteredPlans = mealPlans.filter((plan: MealPlan) =>
    plan.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (plan: MealPlan) => {
    setEditingPlan(plan);
    setDialogOpen(true);
  };

  const handleDetails = (plan: MealPlan) => {
    setDetailsPlan(plan);
    setDetailsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this meal plan?")) {
      deletePlanMutation.mutate(id);
    }
  };

  const handleCloseDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingPlan(null);
    }
  };

  const exportPlan = async (plan: MealPlan, kind: "pdf" | "txt" | "copy") => {
    try {
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
            foods: [...foods].sort(
              (a: Food, b: Food) => (a.order || 0) - (b.order || 0)
            ),
          };
        })
      );

      const meals = [...mealsWithFoods].sort(
        (a: any, b: any) => (a.order || 0) - (b.order || 0)
      );

      const text = formatMealPlanText(plan, meals);
      const filenameBase = `Meal Plan - ${plan.name || ""}`;

      if (kind === "pdf") {
        downloadPdfFile(filenameBase, `Meal Plan: ${plan.name || ""}`, text);
      } else if (kind === "txt") {
        downloadTextFile(filenameBase, text);
      } else {
        await copyTextToClipboard(text);
        toast.success("Copied to clipboard");
      }
    } catch (err: any) {
      toast.error(String(err?.message ?? "Failed to export plan"));
    }
  };

  return (
    <div className="p-8 bg-[#F5F6F8] dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Meal Plans
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create and manage nutrition programs
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="min-w-[120px] bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Plus className="w-5 h-5 mr-2" />
          Meal Plan
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search meal plans"
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          Loading meal plans...
        </div>
      ) : filteredPlans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UtensilsCrossed className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {search
                ? "No meal plans found"
                : "No meal plans yet. Create your first one!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlans.map((plan: MealPlan) => (
            <Card
              key={plan.id}
              className="hover:shadow-lg transition-shadow duration-200 flex flex-col h-full dark:bg-gray-800 dark:border-gray-700"
            >
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-xl font-semibold">
                    {plan.name}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4" />
                    <span className="capitalize">
                      {plan.goal || "Nutrition Plan"}
                    </span>
                  </CardDescription>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(plan)}
                    className="p-2 text-gray-600 dark:text-gray-400
               hover:text-indigo-600
               hover:bg-indigo-50 dark:hover:bg-indigo-900
               rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(plan.id)}
                    className="p-2 text-gray-600 dark:text-gray-400
               hover:text-red-600
               hover:bg-red-50 dark:hover:bg-red-900
               rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="px-5 py-2 flex-1 flex flex-col">
                <div className="space-y-4 flex-1">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                      <Flame className="w-4 h-4 text-orange-500" />
                      <span>
                        {plan.dailyCalories
                          ? `${plan.dailyCalories} kcal`
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                      <Dumbbell className="w-4 h-4 text-blue-500" />
                      <span>
                        {plan.dailyProtein
                          ? `${plan.dailyProtein}g Protein`
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                      <span className="w-2 h-2 rounded-full bg-yellow-400" />
                      <span>Carbs: {plan.dailyCarbs || 0}g</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      <span>Fat: {plan.dailyFat || 0}g</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-rose-600 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200"
                      title="Download PDF"
                      aria-label="Download PDF"
                      onClick={() => exportPlan(plan, "pdf")}
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
                      onClick={() => exportPlan(plan, "txt")}
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
                      onClick={() => exportPlan(plan, "copy")}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-200 dark:hover:bg-indigo-900/45 border-0 font-medium"
                      onClick={() => handleDetails(plan)}
                    >
                      Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <MealPlanDialog
        plan={editingPlan}
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
      />

      <MealPlanDetailsDialog
        plan={detailsPlan}
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setDetailsPlan(null);
        }}
      />
    </div>
  );
}
