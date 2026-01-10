"use client";

import React from "react";
import { db } from "@/lib/db";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import SidePanel from "@/components/ui/side-panel";
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
  Copy as CopyIcon,
  Edit2,
  FileDown,
  FileText,
  Plus,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  copyTextToClipboard,
  downloadPdfFile,
  downloadTextFile,
  formatWorkoutPlanText,
} from "@/lib/plan-export";
import { toast } from "sonner";
import { Exercise, ExerciseLibrary, PlanExercise, WorkoutPlan } from "@/types";
import { extractYouTubeVideoId, toYouTubeEmbedUrl } from "@/lib/youtube";

const DIFFICULTY_VALUES = ["beginner", "intermediate", "advanced"] as const;
const CUSTOM_VALUE = "__custom__";

const WORKOUT_GOAL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "fat_loss", label: "Fat Loss" },
  { value: "muscle_gain", label: "Muscle Gain" },
  { value: "strength", label: "Strength" },
  { value: "hypertrophy", label: "Hypertrophy" },
  { value: "endurance", label: "Endurance" },
  { value: "conditioning", label: "Conditioning" },
  { value: "athletic_performance", label: "Athletic Performance" },
  { value: "mobility", label: "Mobility" },
  { value: "flexibility", label: "Flexibility" },
  { value: "rehab", label: "Rehab / Injury Prevention" },
  { value: "general_fitness", label: "General Fitness" },
  { value: "beginner_foundation", label: "Beginner Foundation" },
  { value: "powerlifting", label: "Powerlifting" },
  { value: "weightlifting", label: "Olympic Weightlifting" },
  { value: "cross_training", label: "Cross Training" },
];

function normalizeDifficulty(
  value: unknown
): (typeof DIFFICULTY_VALUES)[number] | "" {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const v = raw.toLowerCase().replace(/\s+/g, " ");
  if ((DIFFICULTY_VALUES as readonly string[]).includes(v)) return v as any;

  if (v === "beginner" || v === "easy" || v === "starter") return "beginner";
  if (v === "intermediate" || v === "medium") return "intermediate";
  if (v === "advanced" || v === "hard") return "advanced";

  if (raw === "Beginner") return "beginner";
  if (raw === "Intermediate") return "intermediate";
  if (raw === "Advanced") return "advanced";

  return "";
}

interface WorkoutPlanDetailsDialogProps {
  planId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WorkoutPlanDetailsDialog({
  planId,
  open,
  onOpenChange,
}: WorkoutPlanDetailsDialogProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(
    null
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleteInfoMessage, setDeleteInfoMessage] = React.useState<string | null>(
    null
  );

  const [difficultyMode, setDifficultyMode] = React.useState<
    "select" | "custom"
  >("select");
  const [goalMode, setGoalMode] = React.useState<"select" | "custom">(
    "select"
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

  const [planExercises, setPlanExercises] = React.useState<
    Partial<PlanExercise>[]
  >([]);

  const { data: plan } = useQuery({
    queryKey: ["workoutPlan", planId],
    queryFn: async () => {
      if (!planId) return null;
      return (await db.entities.WorkoutPlan.get(String(planId))) as any;
    },
    enabled: !!planId && open,
  });

  const unarchiveMutation = useMutation({
    mutationFn: async () => {
      if (!planId) return null;
      return db.entities.WorkoutPlan.update(planId, { status: "ACTIVE" } as any);
    },
    onSuccess: () => {
      setDeleteInfoMessage(null);
      queryClient.invalidateQueries({ queryKey: ["workoutPlans"] });
      queryClient.invalidateQueries({ queryKey: ["workoutPlan", planId] });
      toast.success("Workout plan restored to active");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to restore workout plan");
    },
  });

  const resetForm = (current: WorkoutPlan | null) => {
    setValidationError(null);
    if (current) {
      const rawDifficulty = String((current as any)?.difficulty ?? "").trim();
      const normalizedDifficulty = normalizeDifficulty(rawDifficulty);
      const difficultyValue = normalizedDifficulty || rawDifficulty;

      const rawGoal = String((current as any)?.goal ?? "").trim();
      const goalMatch = WORKOUT_GOAL_OPTIONS.find(
        (g) => String(g.value).toLowerCase() === rawGoal.toLowerCase()
      );
      const goalValue = goalMatch ? goalMatch.value : rawGoal;

      setFormData({
        name: current.name || "",
        difficulty: difficultyValue,
        duration: current.duration || "",
        goal: goalValue,
        notes: current.notes || "",
      });

      setDifficultyMode(difficultyValue && !normalizedDifficulty ? "custom" : "select");
      setGoalMode(goalValue && !goalMatch ? "custom" : "select");
    } else {
      setFormData({
        name: "",
        difficulty: "",
        duration: "",
        goal: "",
        notes: "",
      });

      setDifficultyMode("select");
      setGoalMode("select");
    }
  };

  React.useEffect(() => {
    if (!open) return;
    setShowDeleteConfirm(false);

    if (!planId) {
      setIsEditing(true);
      resetForm(null);
      setPlanExercises([]);
      planExercisesHydrationRef.current = { planId: null, applied: false };
      return;
    }

    setIsEditing(false);
    // keep current plan data if already loaded
    resetForm((plan as any) || null);
    setPlanExercises([]);
    planExercisesHydrationRef.current = {
      planId: String(planId),
      applied: false,
    };
  }, [open, planId]);

  React.useEffect(() => {
    if (!open) return;
    if (!planId) return;
    if (!plan) return;
    if (isEditing) return;
    resetForm(plan as any);
  }, [plan, open, planId, isEditing]);
  const formatDurationWeeks = (duration: any) => {
    const raw = String(duration ?? "").trim();
    if (!raw) return "";
    if (/^\d+$/.test(raw)) {
      const weeks = Number(raw);
      if (Number.isFinite(weeks))
        return `${weeks} week${weeks === 1 ? "" : "s"}`;
    }
    return raw;
  };

  const formatRest = (restSeconds: any) => {
    const raw = Number(restSeconds);
    if (!Number.isFinite(raw)) return "";
    const seconds = Math.max(0, Math.floor(raw));
    if (!seconds) return "";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m && s) return `${m}m ${s}s`;
    if (m) return `${m}m`;
    return `${s}s`;
  };

  const { data: exercises = [] } = useQuery({
    queryKey: ["workoutPlanExercises", planId, "details"],
    queryFn: async () => {
      if (!planId) return [];

      const planExerciseRows = await db.entities.PlanExercise.filter({
        workoutPlanId: planId,
      });

      const sortedPlanExercises = [...planExerciseRows].sort(
        (a: PlanExercise, b: PlanExercise) => (a.order || 0) - (b.order || 0)
      );

      if (sortedPlanExercises.length) {
        const ids = Array.from(
          new Set(
            sortedPlanExercises
              .map((r: any) => String(r.exerciseLibraryId ?? "").trim())
              .filter(Boolean)
          )
        );

        const libs = await Promise.all(
          ids.map(async (id) => {
            try {
              return await db.entities.ExerciseLibrary.get(id);
            } catch {
              return null;
            }
          })
        );
        const libById = new Map(
          libs.filter(Boolean).map((l: any) => [String(l.id), l])
        );

        return sortedPlanExercises.map((row: any) => {
          const lib = libById.get(String(row.exerciseLibraryId ?? "").trim());
          return {
            id: row.id,
            name: lib?.name ?? "-",
            guidelines: lib?.guidelines ?? "",
            videoKind: lib?.videoKind ?? null,
            videoUrl: lib?.videoUrl ?? null,
            sets: row?.sets,
            reps: row?.reps,
            restSeconds: row?.restSeconds,
          };
        });
      }

      // Legacy fallback
      const rows = await db.entities.Exercise.filter({
        workoutPlanId: planId,
      });
      return [...rows].sort(
        (a: Exercise, b: Exercise) => (a.order || 0) - (b.order || 0)
      );
    },
    enabled: !!planId && open,
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
    enabled: open && isEditing,
  });

  const { data: queryPlanExercises } = useQuery({
    queryKey: ["planExercises", planId, "edit"],
    queryFn: async () => {
      if (!planId) return [];
      const rows = await db.entities.PlanExercise.filter({
        workoutPlanId: planId,
      });
      return [...rows].sort(
        (a: PlanExercise, b: PlanExercise) => (a.order || 0) - (b.order || 0)
      );
    },
    enabled: open && isEditing && !!planId,
  });

  const existingPlanExercises = queryPlanExercises || [];

  React.useEffect(() => {
    if (!open) return;
    if (!isEditing) return;
    if (!planId) return;
    if (!queryPlanExercises) return;

    const expectedPlanId = planExercisesHydrationRef.current.planId;
    const currentPlanId = String(planId ?? "");
    if (!expectedPlanId || expectedPlanId !== currentPlanId) return;
    if (planExercisesHydrationRef.current.applied) return;

    setPlanExercises(queryPlanExercises);
    planExercisesHydrationRef.current = {
      planId: currentPlanId,
      applied: true,
    };
  }, [queryPlanExercises, planId, open, isEditing]);

  const exportText = React.useMemo(() => {
    if (!plan) return "";
    return formatWorkoutPlanText(plan, exercises as any);
  }, [plan, exercises]);

  const exportFilenameBase = React.useMemo(() => {
    const name = String(plan?.name ?? "").trim();
    const id = String((plan as any)?.id ?? "").trim();
    return `workout-plan-${name || id || "plan"}`;
  }, [plan]);

  const handleCopy = async () => {
    if (!plan) return;
    try {
      await copyTextToClipboard(exportText);
      toast.success("Copied to clipboard");
    } catch (err) {
      console.error("Failed to copy workout plan", err);
      toast.error("Failed to copy");
    }
  };

  const handleDownloadText = () => {
    if (!plan) return;
    try {
      downloadTextFile(exportFilenameBase, exportText);
    } catch (err) {
      console.error("Failed to download workout plan text", err);
      toast.error("Failed to download text");
    }
  };

  const handleDownloadPdf = () => {
    if (!plan) return;
    try {
      downloadPdfFile(
        exportFilenameBase,
        String(plan.name ?? "Workout Plan").trim() || "Workout Plan",
        exportText
      );
    } catch (err) {
      console.error("Failed to download workout plan PDF", err);
      toast.error("Failed to download PDF");
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const name = String(formData.name ?? "").trim();
      if (!name) throw new Error("Plan name is required");

      const rawDifficulty = String((formData as any).difficulty ?? "").trim();
      const difficulty =
        difficultyMode === "custom"
          ? rawDifficulty
          : normalizeDifficulty(rawDifficulty);
      if (!difficulty) throw new Error("Difficulty is required");

      const duration = String(formData.duration ?? "").trim();
      if (!duration) throw new Error("Duration is required");

      const goal = String(formData.goal ?? "").trim();
      if (!goal) throw new Error("Goal is required");

      for (const row of planExercises) {
        const exId = String((row as any)?.exerciseLibraryId ?? "").trim();
        if (!exId) throw new Error("Each exercise must be selected from the library");
      }

      let nextPlanId: string;
      const payload: any = {
        ...formData,
        name,
        difficulty,
        duration,
        goal,
      };

      if (planId) {
        await db.entities.WorkoutPlan.update(planId, payload);
        nextPlanId = planId;

        const currentIds = planExercises
          .map((e) => String((e as any).id ?? "").trim())
          .filter(Boolean);
        const rowsToDelete = (existingPlanExercises as any[]).filter(
          (e: any) => !currentIds.includes(String(e.id ?? "").trim())
        );
        await Promise.all(
          rowsToDelete.map((e: any) => db.entities.PlanExercise.delete(e.id))
        );
      } else {
        const created = await db.entities.WorkoutPlan.create(payload);
        nextPlanId = String((created as any).id);
      }

      for (let i = 0; i < planExercises.length; i++) {
        const row = planExercises[i] as any;
        const exerciseLibraryId = String(row.exerciseLibraryId ?? "").trim();
        const rowData: any = {
          workoutPlanId: nextPlanId,
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
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["workoutPlans"] });
      queryClient.invalidateQueries({ queryKey: ["workoutPlanExerciseCounts"] });
      queryClient.invalidateQueries({ queryKey: ["planExercises"] });
      queryClient.invalidateQueries({ queryKey: ["workoutPlan"] });
      toast.success(planId ? "Workout plan updated" : "Workout plan created");

      if (!planId) {
        onOpenChange(false);
      } else {
        setIsEditing(false);
      }
    },
    onError: (error: any) => {
      const msg = error?.message || "Failed to save workout plan";
      setValidationError(String(msg));
      toast.error(String(msg));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!planId) return;
      return db.entities.WorkoutPlan.delete(planId);
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["workoutPlans"] });
      queryClient.invalidateQueries({ queryKey: ["workoutPlanExerciseCounts"] });

      if (planId) {
        queryClient.invalidateQueries({ queryKey: ["workoutPlan", planId] });
      }

      const status = String(result?.status ?? "").trim().toUpperCase();
      if (status === "ARCHIVED") {
        setDeleteInfoMessage(
          "This workout plan is currently assigned to one or more clients, so it cannot be deleted. It has been archived instead. Remove it from clients if you want to delete it."
        );
        setShowDeleteConfirm(false);
        return;
      }

      toast.success("Workout plan deleted");
      setShowDeleteConfirm(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(String(error?.message || "Failed to delete workout plan"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    saveMutation.mutate();
  };

  const difficultySelectValue = React.useMemo(() => {
    if (difficultyMode === "custom") return CUSTOM_VALUE;
    return normalizeDifficulty((formData as any).difficulty) || "";
  }, [difficultyMode, formData]);

  const goalSelectValue = React.useMemo(() => {
    if (goalMode === "custom") return CUSTOM_VALUE;
    const raw = String((formData as any).goal ?? "").trim();
    const match = WORKOUT_GOAL_OPTIONS.find(
      (g) => String(g.value).toLowerCase() === raw.toLowerCase()
    );
    return match ? match.value : "";
  }, [goalMode, formData]);

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

  const renderEditMode = () => {
    return (
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

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Plan Name *
            </label>
            <Input
              value={String(formData.name ?? "")}
              onChange={(e) => (
                validationError && setValidationError(null),
                setFormData({ ...formData, name: e.target.value })
              )}
              placeholder="e.g., Full Body Strength"
            />
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="md:flex-[2]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Difficulty *
              </label>
              <Select
                value={difficultySelectValue}
                onValueChange={(value) => {
                  if (validationError) setValidationError(null);

                  if (value === CUSTOM_VALUE) {
                    setDifficultyMode("custom");
                    setFormData((prev) => {
                      const prevRaw = String((prev as any).difficulty ?? "").trim();
                      const prevNormalized = normalizeDifficulty(prevRaw);
                      return {
                        ...prev,
                        difficulty: prevNormalized ? "" : prevRaw,
                      };
                    });
                    return;
                  }

                  setDifficultyMode("select");
                  setFormData({
                    ...formData,
                    difficulty: normalizeDifficulty(value) || value,
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value={CUSTOM_VALUE}>Custom…</SelectItem>
                </SelectContent>
              </Select>

              {difficultyMode === "custom" ? (
                <Input
                  className="mt-2"
                  value={String((formData as any).difficulty ?? "")}
                  onChange={(e) => (
                    validationError && setValidationError(null),
                    setFormData({ ...formData, difficulty: e.target.value })
                  )}
                  placeholder="Custom difficulty"
                />
              ) : null}
            </div>

            <div className="md:flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Duration (weeks) *
              </label>
              <Input
                value={String(formData.duration ?? "")}
                onChange={(e) => (
                  validationError && setValidationError(null),
                  setFormData({ ...formData, duration: e.target.value })
                )}
                placeholder="e.g., 8"
              />
            </div>

            <div className="md:flex-[2]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Goal *
              </label>
              <Select
                value={goalSelectValue}
                onValueChange={(value) => {
                  if (validationError) setValidationError(null);

                  if (value === CUSTOM_VALUE) {
                    setGoalMode("custom");
                    setFormData((prev) => {
                      const prevRaw = String((prev as any).goal ?? "").trim();
                      const prevMatch = WORKOUT_GOAL_OPTIONS.find(
                        (g) => String(g.value).toLowerCase() === prevRaw.toLowerCase()
                      );
                      return { ...prev, goal: prevMatch ? "" : prevRaw };
                    });
                    return;
                  }

                  setGoalMode("select");
                  setFormData({ ...formData, goal: value });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select goal" />
                </SelectTrigger>
                <SelectContent>
                  {WORKOUT_GOAL_OPTIONS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_VALUE}>Custom…</SelectItem>
                </SelectContent>
              </Select>

              {goalMode === "custom" ? (
                <Input
                  className="mt-2"
                  value={String((formData as any).goal ?? "")}
                  onChange={(e) => (
                    validationError && setValidationError(null),
                    setFormData({ ...formData, goal: e.target.value })
                  )}
                  placeholder="Custom goal"
                />
              ) : null}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <Textarea
              value={String(formData.notes ?? "")}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={3}
              placeholder="Additional notes about this plan..."
            />
          </div>
        </div>

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
                          {(exerciseLibrary as any[]).map((ex: any) => (
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

            {planExercises.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                No exercises added yet. Click "Add Exercise" to get started.
              </p>
            ) : null}
          </div>
        </div>
      </form>
    );
  };

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
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-xl font-semibold text-gray-900 dark:text-white truncate">
                {plan.name}
              </div>
              {String((plan as any)?.status ?? "").trim().toUpperCase() ===
                "ARCHIVED" ? (
                <span className="shrink-0 text-[11px] px-2 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-900/10 dark:border-amber-800 dark:text-amber-200">
                  Archived
                </span>
              ) : null}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {plan.difficulty ? (
                <span className="capitalize">
                  {String(plan.difficulty).replace(/[_-]/g, " ")}
                </span>
              ) : (
                <span className="text-gray-500 dark:text-gray-400">
                  Difficulty: -
                </span>
              )}
              {plan.duration ? (
                <span> · {formatDurationWeeks(plan.duration)}</span>
              ) : null}
              {plan.goal ? (
                <span>
                  {" "}
                  ·{" "}
                  {(() => {
                    const raw = String(plan.goal ?? "").trim();
                    const match = WORKOUT_GOAL_OPTIONS.find(
                      (g) => String(g.value).toLowerCase() === raw.toLowerCase()
                    );
                    return match ? match.label : raw;
                  })()}
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

            {String((plan as any)?.status ?? "").trim().toUpperCase() ===
              "ARCHIVED" && !isEditing ? (
              <Button
                variant="outline"
                size="sm"
                disabled={unarchiveMutation.isPending}
                onClick={() => unarchiveMutation.mutate()}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {unarchiveMutation.isPending ? "Restoring..." : "Return to active"}
              </Button>
            ) : null}

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setValidationError(null);
                setIsEditing(true);
                resetForm(plan as any);
                setPlanExercises([]);
                planExercisesHydrationRef.current = {
                  planId: String(planId ?? ""),
                  applied: false,
                };
              }}
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        {deleteInfoMessage ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 px-3 py-2">
            <div className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Archived (not deleted)
            </div>
            <div className="text-xs text-amber-800 dark:text-amber-200 mt-1 leading-relaxed">
              {deleteInfoMessage}
            </div>
          </div>
        ) : null}

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
            Exercises
          </div>
          {exercises.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              No exercises
            </div>
          ) : (
            <div className="space-y-2">
              {exercises.map((e: any, idx: number) => {
                const restText = formatRest(e.restSeconds);
                return (
                  <div
                    key={e.id || idx}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2"
                  >
                    <div>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {e.name || "-"}
                        </div>

                        {String(e.guidelines ?? "").trim() ? (
                          <div className="mt-1 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                            {String(e.guidelines)}
                          </div>
                        ) : null}

                        {String(e.sets ?? "").trim() ||
                          String(e.reps ?? "").trim() ||
                          restText ? (
                          <div className="mt-2 text-sm text-gray-700 dark:text-gray-200 leading-5">
                            {String(e.sets ?? "").trim() ? (
                              <div>{String(e.sets).trim()} Sets</div>
                            ) : null}
                            {String(e.reps ?? "").trim() ? (
                              <div>{String(e.reps).trim()} Reps</div>
                            ) : null}
                            {restText ? <div>{restText} Rest</div> : null}
                          </div>
                        ) : null}

                        {String(e.videoKind ?? "") === "youtube" &&
                          String(e.videoUrl ?? "").trim()
                          ? (() => {
                            const embed = toYouTubeEmbedUrl(
                              String(e.videoUrl ?? "")
                            );
                            if (!embed) return null;

                            const id = extractYouTubeVideoId(
                              String(e.videoUrl ?? "")
                            );
                            const watchUrl = id
                              ? `https://www.youtube.com/watch?v=${id}`
                              : null;

                            return (
                              <div className="mt-2">
                                <div
                                  className="relative w-full overflow-hidden rounded-lg bg-black"
                                  style={{ paddingTop: "56.25%" }}
                                >
                                  {watchUrl ? (
                                    <a
                                      href={watchUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="absolute inset-0 z-10 cursor-pointer"
                                      title="Open video"
                                      aria-label="Open video"
                                    />
                                  ) : null}
                                  <iframe
                                    src={embed}
                                    title="Exercise video"
                                    className="absolute inset-0 h-full w-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                </div>
                              </div>
                            );
                          })()
                          : String(e.videoKind ?? "") === "upload" &&
                            String(e.videoUrl ?? "").trim()
                            ? (
                              <div className="mt-2">
                                <div
                                  className="relative w-full overflow-hidden rounded-lg bg-black"
                                  style={{ paddingTop: "56.25%" }}
                                >
                                  <video
                                    className="absolute inset-0 h-full w-full object-contain"
                                    controls
                                    preload="metadata"
                                    src={String(e.videoUrl ?? "").trim()}
                                  />
                                </div>
                              </div>
                            )
                            : null}
                      </div>
                    </div>
                  </div>
                );
              })}
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
              Delete Workout Plan
            </Button>
          ) : (
            <div className="p-4 border border-red-200 bg-red-50 dark:bg-red-900/10 rounded-lg space-y-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-red-900 dark:text-red-100">
                  Delete workout plan?
                </div>
                <div className="text-xs text-red-800 dark:text-red-200 leading-relaxed font-medium">
                  If this plan is assigned to any clients, it will be archived instead of deleted.
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
                  onClick={() => deleteMutation.mutate()}
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

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title={
        isEditing
          ? planId
            ? "Edit Workout Plan"
            : "Create Workout Plan"
          : "Workout Plan Details"
      }
      description={plan ? String(plan?.name ?? "").trim() : undefined}
      widthClassName="w-full sm:w-[560px] lg:w-[720px]"
      footer={
        isEditing ? (
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => (planId ? setIsEditing(false) : onOpenChange(false))}
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
                : planId
                  ? "Update Plan"
                  : "Create Plan"}
            </Button>
          </div>
        ) : undefined
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
