"use client";

import React from "react";
import { db } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WorkoutPlan, Exercise } from "@/types";

interface WorkoutPlanDetailsDialogProps {
  plan: WorkoutPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WorkoutPlanDetailsDialog({
  plan,
  open,
  onOpenChange,
}: WorkoutPlanDetailsDialogProps) {
  const { data: exercises = [] } = useQuery({
    queryKey: ["exercises", plan?.id, "details"],
    queryFn: async () => {
      if (!plan) return [];
      const rows = await db.entities.Exercise.filter({
        workoutPlanId: plan.id,
      });
      return [...rows].sort(
        (a: Exercise, b: Exercise) => (a.order || 0) - (b.order || 0)
      );
    },
    enabled: !!plan && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-gray-800">
        <DialogHeader>
          <DialogTitle>Workout Plan Details</DialogTitle>
        </DialogHeader>

        {!plan ? (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            No plan selected
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-1">
              <div className="text-xl font-semibold text-gray-900 dark:text-white">
                {plan.name}
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
                {plan.duration ? <span> · {plan.duration}</span> : null}
                {plan.goal ? <span> · {plan.goal}</span> : null}
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
                Exercises
              </div>
              {exercises.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  No exercises
                </div>
              ) : (
                <div className="space-y-2">
                  {exercises.map((e: any, idx: number) => (
                    <div
                      key={e.id || idx}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">
                            {e.name || "-"}
                          </div>
                        </div>
                        <div className="shrink-0 text-xs text-gray-600 dark:text-gray-300">
                          {e.sets ? <span>{e.sets} sets</span> : null}
                          {e.sets && e.reps ? <span> · </span> : null}
                          {e.reps ? <span>{e.reps} reps</span> : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
