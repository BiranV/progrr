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
  Beef,
  Wheat,
  Droplets,
} from "lucide-react";
import MealPlanDialog from "@/components/MealPlanDialog";
import MealPlanDetailsDialog from "@/components/MealPlanDetailsDialog";
import { MealPlan, Meal, Food, PlanFood, FoodLibrary } from "@/types";
import { toast } from "sonner";
import { useRefetchOnVisible } from "@/hooks/use-refetch-on-visible";

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

  useRefetchOnVisible(() => {
    queryClient.invalidateQueries({ queryKey: ["mealPlans"] });
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
            <UtensilsCrossed className="w-12 h-12 text-indigo-500 dark:text-indigo-400 mx-auto mb-4" />
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
              role="button"
              tabIndex={0}
              onClick={() => handleDetails(plan)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleDetails(plan);
                }
              }}
              className="hover:shadow-lg cursor-pointer transition-shadow duration-200 flex flex-col h-full dark:bg-gray-800 dark:border-gray-700"
            >
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="space-y-1 min-w-0">
                  <CardTitle className="text-xl font-semibold truncate">
                    {plan.name}
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-500 dark:text-gray-400">
                    Total values
                  </CardDescription>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(plan);
                    }}
                    className="p-2 text-gray-600 dark:text-gray-400
               hover:text-indigo-600
               hover:bg-indigo-50 dark:hover:bg-indigo-900
               rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(plan.id);
                    }}
                    className="p-2 text-gray-600 dark:text-gray-400
               hover:text-red-600
               hover:bg-red-50 dark:hover:bg-red-900
               rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="px-5 py-2">
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-500" />
                      <span>
                        Calories:{" "}
                        {String(plan.dailyCalories ?? "").trim() || "-"} kcal
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Beef className="w-4 h-4 text-blue-500" />
                      <span>
                        Protein: {String(plan.dailyProtein ?? "").trim() || "-"}{" "}
                        g
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wheat className="w-4 h-4 text-yellow-500" />
                      <span>
                        Carbs: {String(plan.dailyCarbs ?? "").trim() || "-"} g
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-purple-500" />
                      <span>
                        Fat: {String(plan.dailyFat ?? "").trim() || "-"} g
                      </span>
                    </div>
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
