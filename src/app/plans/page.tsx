"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  Search,
  Dumbbell,
  Clock,
  Target,
  BarChart,
  Edit,
  Trash2,
  FileDown,
  FileText,
  Copy,
} from "lucide-react";
import PlanDialog from "@/components/PlanDialog";
import WorkoutPlanDetailsDialog from "@/components/WorkoutPlanDetailsDialog";
import { WorkoutPlan } from "@/types";
import {
  copyTextToClipboard,
  downloadPdfFile,
  downloadTextFile,
  formatWorkoutPlanText,
} from "@/lib/plan-export";
import { toast } from "sonner";

export default function PlansPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingPlan, setEditingPlan] = React.useState<WorkoutPlan | null>(
    null
  );
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [detailsPlan, setDetailsPlan] = React.useState<WorkoutPlan | null>(
    null
  );

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["workoutPlans"],
    queryFn: () => db.entities.WorkoutPlan.list("-created_date"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await db.entities.WorkoutPlan.delete(id);

      // New model: PlanExercise rows
      const planExercises = await db.entities.PlanExercise.filter({
        workoutPlanId: id,
      });
      await Promise.all(
        planExercises.map((e: any) => db.entities.PlanExercise.delete(e.id))
      );

      // Legacy cleanup: Exercise rows
      const legacyExercises = await db.entities.Exercise.filter({
        workoutPlanId: id,
      });
      await Promise.all(
        legacyExercises.map((e: any) => db.entities.Exercise.delete(e.id))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workoutPlans"] });
    },
  });

  const filteredPlans = plans.filter((plan: WorkoutPlan) =>
    plan.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (plan: WorkoutPlan) => {
    setEditingPlan(plan);
    setDialogOpen(true);
  };

  const handleDetails = (plan: WorkoutPlan) => {
    setDetailsPlan(plan);
    setDetailsOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this workout plan?")) {
      deleteMutation.mutate(id);
    }
  };

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

  const exportPlan = async (
    plan: WorkoutPlan,
    kind: "pdf" | "txt" | "copy"
  ) => {
    try {
      const planExerciseRows = await db.entities.PlanExercise.filter({
        workoutPlanId: plan.id,
      });

      const sortedPlanExercises = [...planExerciseRows].sort(
        (a: any, b: any) => (a.order || 0) - (b.order || 0)
      );

      let exportRows: any[] = [];

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

        exportRows = sortedPlanExercises.map((row: any) => {
          const lib = libById.get(String(row.exerciseLibraryId ?? "").trim());
          return {
            name: lib?.name ?? "-",
            videoKind: lib?.videoKind ?? null,
            videoUrl: lib?.videoUrl ?? null,
            sets: row?.sets,
            reps: row?.reps,
            restSeconds: row?.restSeconds,
          };
        });
      } else {
        // Fallback legacy
        const rows = await db.entities.Exercise.filter({
          workoutPlanId: plan.id,
        });
        exportRows = [...rows].sort(
          (a: any, b: any) => (a.order || 0) - (b.order || 0)
        );
      }

      const text = formatWorkoutPlanText(plan, exportRows as any);
      const filenameBase = `Workout Plan - ${plan.name || ""}`;

      if (kind === "pdf") {
        downloadPdfFile(filenameBase, `Workout Plan: ${plan.name || ""}`, text);
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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Workout Plans
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create and manage workout routines
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingPlan(null);
            setDialogOpen(true);
          }}
          className="min-w-[120px] bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Plus className="w-5 h-5 mr-2" />
          Workout Plan
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workout plans"
            className="pl-10"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          Loading workout plans...
        </div>
      ) : filteredPlans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Dumbbell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {search
                ? "No workout plans found"
                : "No workout plans yet. Create your first one!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlans.map((plan: WorkoutPlan) => (
            <Card
              key={plan.id}
              className="h-[240px] hover:shadow-lg transition-shadow dark:bg-gray-800 dark:border-gray-700"
            >
              <CardContent className="px-5 flex flex-col h-full">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold truncate">
                      {plan.name}
                    </h3>
                    <span className="inline-flex items-center gap-1 text-sm text-gray-500 mt-1 capitalize truncate">
                      <BarChart className="w-4 h-4 shrink-0" />
                      {plan.difficulty || "Not specified"}
                    </span>
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
                </div>

                {/* Body */}
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 flex-1">
                  <div className="flex items-center gap-2 truncate">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {formatDurationWeeks(plan.duration) || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 truncate">
                    <Target className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {plan.goal || "No goal set"}
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
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
                    className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-200 dark:hover:bg-indigo-900/45"
                    onClick={() => handleDetails(plan)}
                  >
                    Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PlanDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingPlan(null);
        }}
        plan={editingPlan}
      />

      <WorkoutPlanDetailsDialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setDetailsPlan(null);
        }}
        plan={detailsPlan}
      />
    </div>
  );
}
