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
import { X, Plus, Trash2 } from "lucide-react";
import { MealPlan, Meal, Food } from "@/types";

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
  const [formData, setFormData] = React.useState<Partial<MealPlan>>({
    name: "",
    goal: "",
    dailyCalories: "",
    dailyProtein: "",
    dailyCarbs: "",
    dailyFat: "",
    notes: "",
  });

  const { data: queryMeals } = useQuery({
    queryKey: ["meals", plan?.id],
    queryFn: async () => {
      if (!plan) return [];
      const meals = await db.entities.Meal.filter({ mealPlanId: plan.id });
      const mealsWithFoods = await Promise.all(
        meals.map(async (meal: Meal) => {
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

  const [meals, setMeals] = React.useState<Partial<Meal>[]>([]);

  React.useEffect(() => {
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
      setMeals((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(queryMeals)) return prev;
        return queryMeals;
      });
    } else if (!plan) {
      setMeals([]);
    }
  }, [queryMeals, plan]);

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
          type: meal.type || "breakfast",
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

        // Save foods
        const existingFoodIds = (meal.foods || [])
          .map((f) => f.id)
          .filter(Boolean) as string[];
        if (meal.id) {
          const existingFoods = await db.entities.Food.filter({
            mealId: meal.id,
          });
          const foodsToDelete = existingFoods.filter(
            (f: Food) => !existingFoodIds.includes(f.id)
          );
          await Promise.all(
            foodsToDelete.map((f: Food) => db.entities.Food.delete(f.id))
          );
        }

        for (let j = 0; j < (meal.foods || []).length; j++) {
          const food = meal.foods![j];
          const foodData = {
            mealId,
            name: food.name,
            amount: food.amount || "",
            protein: food.protein || "",
            carbs: food.carbs || "",
            fat: food.fat || "",
            order: j,
          };

          if (food.id) {
            await db.entities.Food.update(food.id, foodData);
          } else {
            await db.entities.Food.create(foodData);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mealPlans"] });
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      queryClient.invalidateQueries({ queryKey: ["foods"] });
      onOpenChange(false);
    },
  });

  const addMeal = () => {
    setMeals([...meals, { type: "breakfast", name: "", foods: [] }]);
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
    if (!updated[mealIndex].foods) updated[mealIndex].foods = [];
    updated[mealIndex].foods!.push({
      name: "",
      amount: "",
      protein: "",
      carbs: "",
      fat: "",
    } as Food);
    setMeals(updated);
  };

  const updateFood = (
    mealIndex: number,
    foodIndex: number,
    field: keyof Food,
    value: any
  ) => {
    const updated = [...meals];
    if (updated[mealIndex].foods && updated[mealIndex].foods![foodIndex]) {
      updated[mealIndex].foods![foodIndex] = {
        ...updated[mealIndex].foods![foodIndex],
        [field]: value,
      };
      setMeals(updated);
    }
  };

  const removeFood = (mealIndex: number, foodIndex: number) => {
    const updated = [...meals];
    if (updated[mealIndex].foods) {
      updated[mealIndex].foods = updated[mealIndex].foods!.filter(
        (_, i) => i !== foodIndex
      );
      setMeals(updated);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {plan ? "Edit Meal Plan" : "Create Meal Plan"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">
                Plan Name *
              </label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>
            <Input
              placeholder="Goal"
              value={formData.goal}
              onChange={(e) =>
                setFormData({ ...formData, goal: e.target.value })
              }
            />
            <Input
              placeholder="Daily Calories"
              value={formData.dailyCalories}
              onChange={(e) =>
                setFormData({ ...formData, dailyCalories: e.target.value })
              }
            />
            <Input
              placeholder="Daily Protein (g)"
              value={formData.dailyProtein}
              onChange={(e) =>
                setFormData({ ...formData, dailyProtein: e.target.value })
              }
            />
            <Input
              placeholder="Daily Carbs (g)"
              value={formData.dailyCarbs}
              onChange={(e) =>
                setFormData({ ...formData, dailyCarbs: e.target.value })
              }
            />
            <Input
              placeholder="Daily Fat (g)"
              value={formData.dailyFat}
              onChange={(e) =>
                setFormData({ ...formData, dailyFat: e.target.value })
              }
            />
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
                      value={meal.type}
                      onValueChange={(v) => updateMeal(mealIndex, "type", v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="breakfast">Breakfast</SelectItem>
                        <SelectItem value="lunch">Lunch</SelectItem>
                        <SelectItem value="dinner">Dinner</SelectItem>
                        <SelectItem value="snack">Snack</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={() => removeMeal(mealIndex)}
                      className="p-2 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>

                  {(meal.foods || []).map((food, foodIndex) => (
                    <div
                      key={foodIndex}
                      className="ml-4 flex gap-2 items-start"
                    >
                      <Input
                        value={food.name}
                        onChange={(e) =>
                          updateFood(
                            mealIndex,
                            foodIndex,
                            "name",
                            e.target.value
                          )
                        }
                        placeholder="Food"
                        className="flex-1"
                      />
                      <Input
                        value={food.amount}
                        onChange={(e) =>
                          updateFood(
                            mealIndex,
                            foodIndex,
                            "amount",
                            e.target.value
                          )
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
