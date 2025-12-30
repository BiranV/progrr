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
import { WorkoutPlan, Exercise } from "@/types";

interface PlanDialogProps {
  plan: WorkoutPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PlanDialog({
  plan,
  open,
  onOpenChange,
}: PlanDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState<Partial<WorkoutPlan>>({
    name: "",
    difficulty: "",
    duration: "",
    goal: "",
    notes: "",
  });

  const { data: queryExercises } = useQuery({
    queryKey: ["exercises", plan?.id],
    queryFn: () => db.entities.Exercise.filter({ workoutPlanId: plan?.id }),
    enabled: !!plan && open,
  });

  const existingExercises = queryExercises || [];

  const [exercises, setExercises] = React.useState<Partial<Exercise>[]>([]);

  React.useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name || "",
        difficulty: plan.difficulty || "",
        duration: plan.duration || "",
        goal: plan.goal || "",
        notes: plan.notes || "",
      });
    } else {
      setFormData({
        name: "",
        difficulty: "",
        duration: "",
        goal: "",
        notes: "",
      });
      setExercises([]);
    }
  }, [plan, open]);

  React.useEffect(() => {
    if (queryExercises && queryExercises.length > 0) {
      const sorted = [...queryExercises].sort(
        (a: Exercise, b: Exercise) => (a.order || 0) - (b.order || 0)
      );
      setExercises((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(sorted)) return prev;
        return sorted;
      });
    } else if (!plan) {
      setExercises([]);
    }
  }, [queryExercises, plan]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<WorkoutPlan>) => {
      let planId: string;
      if (plan) {
        await db.entities.WorkoutPlan.update(plan.id, data);
        planId = plan.id;

        // Delete removed exercises
        const currentExerciseIds = exercises
          .map((e) => e.id)
          .filter(Boolean) as string[];
        const exercisesToDelete = existingExercises.filter(
          (e: Exercise) => !currentExerciseIds.includes(e.id)
        );
        await Promise.all(
          exercisesToDelete.map((e: Exercise) =>
            db.entities.Exercise.delete(e.id)
          )
        );
      } else {
        const newPlan = await db.entities.WorkoutPlan.create(data);
        planId = newPlan.id;
      }

      // Save exercises
      for (let i = 0; i < exercises.length; i++) {
        const exercise = exercises[i];
        const exerciseData = {
          workoutPlanId: planId,
          name: exercise.name || "",
          sets: exercise.sets || "",
          reps: exercise.reps || "",
          order: i,
        };

        if (exercise.id) {
          await db.entities.Exercise.update(exercise.id, exerciseData);
        } else {
          await db.entities.Exercise.create(exerciseData);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workoutPlans"] });
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const addExercise = () => {
    setExercises([...exercises, { name: "", sets: "", reps: "" }]);
  };

  const updateExercise = (
    index: number,
    field: keyof Exercise,
    value: string
  ) => {
    const updated = [...exercises];
    updated[index] = { ...updated[index], [field]: value };
    setExercises(updated);
  };

  const removeExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {plan ? "Edit Workout Plan" : "Create Workout Plan"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Plan Details */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Plan Name *
              </label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Full Body Strength"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Difficulty
                </label>
                <Select
                  value={formData.difficulty}
                  onValueChange={(value) =>
                    setFormData({ ...formData, difficulty: value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Duration
                </label>
                <Input
                  value={formData.duration}
                  onChange={(e) =>
                    setFormData({ ...formData, duration: e.target.value })
                  }
                  placeholder="e.g., 8 weeks"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Goal
              </label>
              <Input
                value={formData.goal}
                onChange={(e) =>
                  setFormData({ ...formData, goal: e.target.value })
                }
                placeholder="e.g., Build muscle, Lose fat"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <Textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
                placeholder="Additional notes about this plan..."
              />
            </div>
          </div>

          {/* Exercises */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Exercises
              </h3>
              <Button
                type="button"
                onClick={addExercise}
                variant="outline"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Exercise
              </Button>
            </div>

            <div className="space-y-3">
              {exercises.map((exercise, index) => (
                <div
                  key={index}
                  className="flex gap-3 items-start p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <Input
                      value={exercise.name}
                      onChange={(e) =>
                        updateExercise(index, "name", e.target.value)
                      }
                      placeholder="Exercise name"
                    />
                    <Input
                      value={exercise.sets}
                      onChange={(e) =>
                        updateExercise(index, "sets", e.target.value)
                      }
                      placeholder="Sets"
                    />
                    <Input
                      value={exercise.reps}
                      onChange={(e) =>
                        updateExercise(index, "reps", e.target.value)
                      }
                      placeholder="Reps"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExercise(index)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {exercises.length === 0 && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                  No exercises added yet. Click "Add Exercise" to get started.
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending
                ? "Saving..."
                : plan
                ? "Update Plan"
                : "Create Plan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
