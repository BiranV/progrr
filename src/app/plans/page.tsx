"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
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
  Dumbbell,
  ClipboardList,
  Clock,
  Target,
  BarChart,
  Edit,
  Trash2,
} from "lucide-react";
import PlanDialog from "@/components/PlanDialog";
import WorkoutPlanDetailsDialog from "@/components/WorkoutPlanDetailsDialog";
import ConfirmModal from "@/components/ui/confirm-modal";
import { WorkoutPlan } from "@/types";
import { useRefetchOnVisible } from "@/hooks/use-refetch-on-visible";

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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["workoutPlans"],
    queryFn: () => db.entities.WorkoutPlan.list("-created_date"),
  });

  useRefetchOnVisible(() => {
    queryClient.invalidateQueries({ queryKey: ["workoutPlans"] });
    queryClient.invalidateQueries({ queryKey: ["workoutPlanExerciseCounts"] });
  });

  const { data: exerciseCountByPlanId = {} } = useQuery({
    queryKey: ["workoutPlanExerciseCounts"],
    queryFn: async () => {
      const planExercises = await db.entities.PlanExercise.filter({});
      const legacyExercises = await db.entities.Exercise.filter({});

      const planCounts: Record<string, number> = {};
      for (const row of planExercises as any[]) {
        const planId = String((row as any)?.workoutPlanId ?? "").trim();
        if (!planId) continue;
        planCounts[planId] = (planCounts[planId] ?? 0) + 1;
      }

      const legacyCounts: Record<string, number> = {};
      for (const row of legacyExercises as any[]) {
        const planId = String((row as any)?.workoutPlanId ?? "").trim();
        if (!planId) continue;
        legacyCounts[planId] = (legacyCounts[planId] ?? 0) + 1;
      }

      const merged: Record<string, number> = {};
      const ids = new Set<string>([
        ...Object.keys(planCounts),
        ...Object.keys(legacyCounts),
      ]);
      ids.forEach((id) => {
        const planCount = planCounts[id] ?? 0;
        merged[id] = planCount > 0 ? planCount : legacyCounts[id] ?? 0;
      });

      return merged;
    },
    enabled: Array.isArray(plans) && plans.length > 0,
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
    const found = (plans as WorkoutPlan[]).find(
      (p) => String(p?.id) === String(id)
    );
    setDeleteTarget({
      id,
      name: String(found?.name ?? "").trim() || "this workout plan",
    });
    setDeleteConfirmOpen(true);
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
            <ClipboardList className="w-12 h-12 text-indigo-500 dark:text-indigo-400 mx-auto mb-4" />
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
                    Workout plan
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
                      <Clock className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                      <span>
                        Duration: {formatDurationWeeks(plan.duration) || "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 truncate">
                      <BarChart className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span className="truncate capitalize">
                        Difficulty: {plan.difficulty || "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 truncate">
                      <Target className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span className="truncate">Goal: {plan.goal || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2 truncate">
                      <Dumbbell className="w-4 h-4 shrink-0 text-violet-600 dark:text-violet-400" />
                      <span className="truncate">
                        Exercises: {exerciseCountByPlanId[String(plan.id)] ?? 0}
                      </span>
                    </div>
                  </div>
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

      <ConfirmModal
        open={deleteConfirmOpen}
        onOpenChange={(next) => {
          setDeleteConfirmOpen(next);
          if (!next) setDeleteTarget(null);
        }}
        title="Delete workout plan?"
        description={
          deleteTarget
            ? `This will permanently delete ${deleteTarget.name}. This cannot be undone.`
            : "This cannot be undone."
        }
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="destructive"
        confirmDisabled={!deleteTarget}
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
