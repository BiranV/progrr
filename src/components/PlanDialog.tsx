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
import SidePanel from "@/components/ui/side-panel";
import { Plus, Trash2, XCircle } from "lucide-react";
import { WorkoutPlan, PlanExercise, ExerciseLibrary } from "@/types";
import { toast } from "sonner";

const DIFFICULTY_VALUES = ["beginner", "intermediate", "advanced"] as const;

function normalizeDifficulty(
  value: unknown
): (typeof DIFFICULTY_VALUES)[number] | "" {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const v = raw.toLowerCase().replace(/\s+/g, " ");
  if ((DIFFICULTY_VALUES as readonly string[]).includes(v)) return v as any;

  // Accept common labels
  if (v === "beginner" || v === "easy" || v === "starter") return "beginner";
  if (v === "intermediate" || v === "medium") return "intermediate";
  if (v === "advanced" || v === "hard") return "advanced";

  // Accept title-case legacy values (e.g., "Beginner")
  if (raw === "Beginner") return "beginner";
  if (raw === "Intermediate") return "intermediate";
  if (raw === "Advanced") return "advanced";

  return "";
}

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
  const [validationError, setValidationError] = React.useState<string | null>(
    null
  );
  const planExercisesHydrationRef = React.useRef<{
    planId: string | null;
    applied: boolean;
  }>({ planId: null, applied: false });
  const [formData, setFormData] = React.useState<Partial<WorkoutPlan>>({
    name: "",
    difficulty: "",
    duration: "",
    goal: "",
    notes: "",
  });

  const { data: exerciseLibrary = [] } = useQuery({
    queryKey: ["exerciseLibrary"],
    queryFn: async () => {
      const rows = await db.entities.ExerciseLibrary.list();
      return [...rows].sort((a: ExerciseLibrary, b: ExerciseLibrary) =>
        String(a.name ?? "")
          .trim()
          .localeCompare(String(b.name ?? "").trim())
      );
    },
    enabled: open,
  });

  const { data: queryPlanExercises } = useQuery({
    queryKey: ["planExercises", plan?.id, "edit"],
    queryFn: async () => {
      if (!plan?.id) return [];
      const rows = await db.entities.PlanExercise.filter({
        workoutPlanId: plan.id,
      });
      return [...rows].sort(
        (a: PlanExercise, b: PlanExercise) => (a.order || 0) - (b.order || 0)
      );
    },
    enabled: !!plan && open,
  });

  const existingPlanExercises = queryPlanExercises || [];

  const [planExercises, setPlanExercises] = React.useState<
    Partial<PlanExercise>[]
  >([]);

  React.useEffect(() => {
    setValidationError(null);
    if (plan) {
      setFormData({
        name: plan.name || "",
        difficulty: normalizeDifficulty(plan.difficulty) || "",
        duration: plan.duration || "",
        goal: plan.goal || "",
        notes: plan.notes || "",
      });
      // Hydrate exercises once the query returns for this plan
      planExercisesHydrationRef.current = {
        planId: String(plan.id ?? "") || null,
        applied: false,
      };
      // Clear while loading so we don't show stale rows from a previous plan
      setPlanExercises([]);
    } else {
      setFormData({
        name: "",
        difficulty: "",
        duration: "",
        goal: "",
        notes: "",
      });
      setPlanExercises([]);
      planExercisesHydrationRef.current = { planId: null, applied: false };
    }
  }, [plan, open]);

  React.useEffect(() => {
    if (!open) return;
    if (!plan?.id) return;
    if (!queryPlanExercises) return; // still loading

    const expectedPlanId = planExercisesHydrationRef.current.planId;
    const currentPlanId = String(plan.id ?? "");
    if (!expectedPlanId || expectedPlanId !== currentPlanId) return;
    if (planExercisesHydrationRef.current.applied) return;

    // Apply exactly once per open/edit session so we don't overwrite user edits
    setPlanExercises(queryPlanExercises);
    planExercisesHydrationRef.current = {
      planId: currentPlanId,
      applied: true,
    };
  }, [queryPlanExercises, plan?.id, open]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<WorkoutPlan>) => {
      let planId: string;
      if (plan) {
        await db.entities.WorkoutPlan.update(plan.id, data);
        planId = plan.id;

        // Delete removed PlanExercise rows
        const currentIds = planExercises
          .map((e) => String(e.id ?? "").trim())
          .filter(Boolean);
        const rowsToDelete = existingPlanExercises.filter(
          (e: any) => !currentIds.includes(String(e.id ?? "").trim())
        );
        await Promise.all(
          rowsToDelete.map((e: any) => db.entities.PlanExercise.delete(e.id))
        );
      } else {
        const newPlan = await db.entities.WorkoutPlan.create(data);
        planId = newPlan.id;
      }

      // Save PlanExercise rows
      for (let i = 0; i < planExercises.length; i++) {
        const row = planExercises[i] as any;
        const exerciseLibraryId = String(row.exerciseLibraryId ?? "").trim();
        const rowData: any = {
          workoutPlanId: planId,
          exerciseLibraryId,
          sets: String(row.sets ?? "").trim(),
          reps: String(row.reps ?? "").trim(),
          restSeconds:
            typeof row.restSeconds === "number" ? row.restSeconds : undefined,
          order: i,
        };

        if (row.id) {
          await db.entities.PlanExercise.update(String(row.id), rowData);
        } else {
          await db.entities.PlanExercise.create(rowData);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workoutPlans"] });
      queryClient.invalidateQueries({ queryKey: ["planExercises"] });
      onOpenChange(false);
      toast.success(plan ? "Workout plan updated" : "Workout plan created");
    },
    onError: (error: any) => {
      const msg = error?.message || "Failed to save workout plan";
      setValidationError(msg);
      toast.error(String(msg));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    setValidationError(null);
    const name = String(formData.name ?? "").trim();
    if (!name) {
      setValidationError("Plan name is required");
      return;
    }

    const difficulty = normalizeDifficulty(formData.difficulty);
    if (!difficulty) {
      setValidationError("Difficulty is required");
      return;
    }

    const duration = String(formData.duration ?? "").trim();
    if (!duration) {
      setValidationError("Duration is required");
      return;
    }

    const goal = String(formData.goal ?? "").trim();
    if (!goal) {
      setValidationError("Goal is required");
      return;
    }

    for (const row of planExercises) {
      const exId = String((row as any)?.exerciseLibraryId ?? "").trim();
      if (!exId) {
        setValidationError("Each exercise must be selected from the library");
        return;
      }
    }

    saveMutation.mutate({ ...formData, name, difficulty, duration, goal });
  };

  const difficultySelectValue =
    normalizeDifficulty((formData as any).difficulty) ||
    normalizeDifficulty((plan as any)?.difficulty) ||
    "";

  const addExercise = () => {
    setPlanExercises([
      ...planExercises,
      { exerciseLibraryId: "", sets: "", reps: "", restSeconds: undefined },
    ]);
  };

  const updatePlanExercise = (index: number, patch: Partial<PlanExercise>) => {
    setPlanExercises((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...patch };
      return updated;
    });
  };

  const updateRestSeconds = (index: number, value: string) => {
    const raw = String(value ?? "").trim();
    if (!raw) {
      updatePlanExercise(index, { restSeconds: undefined });
      return;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
      updatePlanExercise(index, { restSeconds: undefined });
      return;
    }

    updatePlanExercise(index, { restSeconds: Math.max(0, parsed) });
  };

  const removeExercise = (index: number) => {
    setPlanExercises(planExercises.filter((_, i) => i !== index));
  };

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title={plan ? "Edit Workout Plan" : "Create Workout Plan"}
      description={plan ? String(plan?.name ?? "").trim() : undefined}
      widthClassName="w-full sm:w-[560px] lg:w-[720px]"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saveMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="workout-plan-form"
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending
              ? "Saving..."
              : plan
              ? "Update Plan"
              : "Create Plan"}
          </Button>
        </div>
      }
    >
      <form
        id="workout-plan-form"
        onSubmit={handleSubmit}
        noValidate
        className="space-y-6"
      >
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

        {/* Plan Details */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Plan Name *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => (
                validationError && setValidationError(null),
                setFormData({ ...formData, name: e.target.value })
              )}
              placeholder="e.g., Full Body Strength"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Difficulty *
              </label>
              <Select
                value={difficultySelectValue}
                onValueChange={(value) => (
                  validationError && setValidationError(null),
                  setFormData({
                    ...formData,
                    difficulty: normalizeDifficulty(value) || "",
                  })
                )}
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
                Duration *
              </label>
              <Input
                value={formData.duration}
                onChange={(e) => (
                  validationError && setValidationError(null),
                  setFormData({ ...formData, duration: e.target.value })
                )}
                placeholder="e.g., 8 weeks"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Goal *
            </label>
            <Input
              value={formData.goal}
              onChange={(e) => (
                validationError && setValidationError(null),
                setFormData({ ...formData, goal: e.target.value })
              )}
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
            {planExercises.map((row, index) => (
              <div
                key={index}
                className="flex flex-col sm:flex-row gap-3 items-start p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                    <div className="sm:col-span-3">
                      <Select
                        value={String((row as any).exerciseLibraryId ?? "")}
                        onValueChange={(value) =>
                          updatePlanExercise(index, {
                            exerciseLibraryId: value,
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select exercise" />
                        </SelectTrigger>
                        <SelectContent>
                          {exerciseLibrary.map((ex) => (
                            <SelectItem key={ex.id} value={ex.id}>
                              {ex.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Input
                      value={String((row as any).sets ?? "")}
                      onChange={(e) =>
                        updatePlanExercise(index, { sets: e.target.value })
                      }
                      placeholder="Sets"
                      className="sm:col-span-1"
                    />
                    <Input
                      value={String((row as any).reps ?? "")}
                      onChange={(e) =>
                        updatePlanExercise(index, { reps: e.target.value })
                      }
                      placeholder="Reps"
                      className="sm:col-span-1"
                    />

                    <div className="sm:col-span-1">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={String((row as any).restSeconds ?? "")}
                        onChange={(e) =>
                          updateRestSeconds(index, e.target.value)
                        }
                        placeholder="Rest"
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeExercise(index)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors self-end sm:self-auto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            {planExercises.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                No exercises added yet. Click "Add Exercise" to get started.
              </p>
            )}
          </div>
        </div>
      </form>
    </SidePanel>
  );
}
