"use client";

import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Plus,
  Search,
  ClipboardList,
  ArrowUpDown,
} from "lucide-react";
import WorkoutPlanDetailsDialog from "@/components/WorkoutPlanDetailsDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkoutPlan } from "@/types";
import { useRefetchOnVisible } from "@/hooks/use-refetch-on-visible";
import { getCookie, setCookie } from "@/lib/client-cookies";

type PlanRow = {
  id: string;
  name?: string;
  duration?: string;
  difficulty?: string;
  goal?: string;
  exercisesCount?: number;
  status?: string;
};

export default function PlansPage() {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="p-8 flex justify-center">
        <div className="text-center text-gray-600">Loading...</div>
      </div>
    );
  }

  if (user?.role === "client") {
    return <ClientPlansPage />;
  }

  // Default: admin UI
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");

  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [detailsPlanId, setDetailsPlanId] = React.useState<string | null>(null);

  const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const;
  const [pageSize, setPageSize] = React.useState(() => {
    if (typeof window === "undefined") return 10;
    const raw = getCookie("progrr_workout_plans_rows_per_page");
    const parsed = raw ? Number(raw) : NaN;
    if (
      Number.isFinite(parsed) &&
      (PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed)
    ) {
      return parsed;
    }
    return 10;
  });

  const [page, setPage] = React.useState(1);
  const [sortConfig, setSortConfig] = React.useState<{
    key: keyof PlanRow;
    direction: "asc" | "desc";
  } | null>(null);

  React.useEffect(() => {
    setCookie("progrr_workout_plans_rows_per_page", String(pageSize), {
      maxAgeSeconds: 60 * 60 * 24 * 365,
    });
  }, [pageSize]);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["workoutPlans"],
    queryFn: () => db.entities.WorkoutPlan.list("-created_date"),
  });

  const normalizeWorkoutPlanStatus = React.useCallback((value: unknown) => {
    const raw = String(value ?? "").trim().toUpperCase();
    if (raw === "ARCHIVED") return "ARCHIVED";
    if (raw === "DELETED") return "DELETED";
    if (raw === "ACTIVE") return "ACTIVE";
    // Back-compat: if missing/unknown, treat as ACTIVE.
    return "ACTIVE";
  }, []);

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

  const filteredAll = (plans as WorkoutPlan[]).filter((plan: WorkoutPlan) =>
    String(plan?.name ?? "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const activePlans = React.useMemo(() => {
    return filteredAll.filter((p: any) => {
      const status = normalizeWorkoutPlanStatus(p?.status);
      return status !== "ARCHIVED" && status !== "DELETED";
    });
  }, [filteredAll, normalizeWorkoutPlanStatus]);

  const archivedPlans = React.useMemo(() => {
    return filteredAll.filter((p: any) => {
      const status = normalizeWorkoutPlanStatus(p?.status);
      return status === "ARCHIVED";
    });
  }, [filteredAll, normalizeWorkoutPlanStatus]);

  const buildRow = React.useCallback(
    (p: any) => {
      const id = String(p?.id ?? "");
      return {
        id,
        name: String(p?.name ?? ""),
        duration: String(p?.duration ?? ""),
        difficulty: String(p?.difficulty ?? ""),
        goal: String(p?.goal ?? ""),
        exercisesCount: Number(exerciseCountByPlanId[id] ?? 0),
        status: normalizeWorkoutPlanStatus(p?.status),
      } satisfies PlanRow;
    },
    [exerciseCountByPlanId, normalizeWorkoutPlanStatus]
  );

  const activeRows = React.useMemo(
    () => activePlans.map(buildRow),
    [activePlans, buildRow]
  );

  const archivedRows = React.useMemo(
    () => archivedPlans.map(buildRow),
    [archivedPlans, buildRow]
  );

  const sortRows = React.useCallback(
    (rowsIn: PlanRow[]) => {
      if (!sortConfig) return rowsIn;

      const collator = new Intl.Collator(["he", "en"], {
        sensitivity: "base",
        numeric: true,
      });

      return [...rowsIn].sort((a, b) => {
        const direction = sortConfig.direction === "asc" ? 1 : -1;

        if (sortConfig.key === "exercisesCount") {
          const aN = Number(a.exercisesCount ?? 0);
          const bN = Number(b.exercisesCount ?? 0);
          if (aN !== bN) return (aN - bN) * direction;
          return String(a.id).localeCompare(String(b.id));
        }

        const aValue = String((a as any)[sortConfig.key] ?? "").trim();
        const bValue = String((b as any)[sortConfig.key] ?? "").trim();

        const aEmpty = aValue.length === 0;
        const bEmpty = bValue.length === 0;
        if (aEmpty && !bEmpty) return 1;
        if (!aEmpty && bEmpty) return -1;

        const cmp = collator.compare(aValue, bValue);
        if (cmp !== 0) return cmp * direction;
        return String(a.id).localeCompare(String(b.id));
      });
    },
    [sortConfig]
  );

  const sortedActive = React.useMemo(
    () => sortRows(activeRows),
    [activeRows, sortRows]
  );

  const sortedArchived = React.useMemo(
    () => sortRows(archivedRows),
    [archivedRows, sortRows]
  );

  const handleSort = (key: keyof PlanRow) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  };

  React.useEffect(() => {
    setPage(1);
  }, [search, sortConfig?.key, sortConfig?.direction, pageSize]);

  const paginate = React.useCallback(
    (rowsIn: PlanRow[], currentPage: number) => {
      const totalPages = Math.max(1, Math.ceil(rowsIn.length / pageSize));
      const safePage = Math.min(Math.max(1, currentPage), totalPages);
      const start = (safePage - 1) * pageSize;
      const pagedRows = rowsIn.slice(start, start + pageSize);
      return {
        pagedRows,
        totalPages,
        page: safePage,
        totalCount: rowsIn.length,
      };
    },
    [pageSize]
  );

  const paging = React.useMemo(
    () => paginate(sortedActive, page),
    [paginate, sortedActive, page]
  );

  const handleOpenDetails = (row: PlanRow) => {
    setDetailsPlanId(row.id);
    setDetailsOpen(true);
  };

  const handleCloseDetails = (openNext: boolean) => {
    setDetailsOpen(openNext);
    if (!openNext) {
      setTimeout(() => setDetailsPlanId(null), 200);
    }
  };

  const handleCreatePlan = () => {
    setDetailsPlanId(null);
    setDetailsOpen(true);
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

  const formatWorkoutGoalLabel = React.useCallback((value: any) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";

    const goals: Array<{ value: string; label: string }> = [
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

    const match = goals.find(
      (g) => String(g.value).toLowerCase() === raw.toLowerCase()
    );
    return match ? match.label : raw;
  }, []);

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
          onClick={handleCreatePlan}
          className="min-w-[120px] bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Plus className="w-5 h-5 mr-2" />
          Workout Plan
        </Button>
      </div>

      {/* Search + Pagination settings */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="max-w-md relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workout plans"
            className="pl-10"
          />
        </div>

        <div className="w-[180px]">
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              const next = Number(v);
              if (!Number.isFinite(next)) return;
              setPageSize(next);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Rows per page" />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} rows
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          Loading workout plans...
        </div>
      ) : sortedActive.length === 0 && sortedArchived.length === 0 ? (
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
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th
                      className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center gap-2">
                        Plan
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => handleSort("duration")}
                    >
                      <div className="flex items-center gap-2">
                        Duration
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => handleSort("difficulty")}
                    >
                      <div className="flex items-center gap-2">
                        Difficulty
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => handleSort("goal")}
                    >
                      <div className="flex items-center gap-2">
                        Goal
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => handleSort("exercisesCount")}
                    >
                      <div className="flex items-center gap-2">
                        Exercises
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paging.pagedRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer transition-colors"
                      onClick={() => handleOpenDetails(row)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleOpenDetails(row);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium">
                          {String(row.name ?? "-")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {formatDurationWeeks(row.duration) || "-"}
                      </td>
                      <td className="px-4 py-3 capitalize">
                        {String(row.difficulty ?? "").trim() || "-"}
                      </td>
                      <td className="px-4 py-3">
                        {formatWorkoutGoalLabel(row.goal) || "-"}
                      </td>
                      <td className="px-4 py-3">
                        {Number(row.exercisesCount ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t bg-gray-50/60 dark:bg-gray-700/40">
              <div className="text-xs text-gray-600 dark:text-gray-300">
                Page {paging.page} of {paging.totalPages}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={paging.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={paging.page >= paging.totalPages}
                  onClick={() =>
                    setPage((p) => Math.min(paging.totalPages, p + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </div>

          {sortedArchived.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border">
              <div className="px-4 py-3 border-b bg-gray-50/60 dark:bg-gray-700/40">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Archived Workout Plans
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                  These plans are archived (usually because they were assigned to clients).
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Plan</th>
                      <th className="px-4 py-3 text-left font-medium">Duration</th>
                      <th className="px-4 py-3 text-left font-medium">Difficulty</th>
                      <th className="px-4 py-3 text-left font-medium">Goal</th>
                      <th className="px-4 py-3 text-left font-medium">Exercises</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedArchived.map((row) => (
                      <tr
                        key={row.id}
                        className="border-t hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer transition-colors"
                        onClick={() => handleOpenDetails(row)}
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium">
                            {String(row.name ?? "-")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {formatDurationWeeks(row.duration) || "-"}
                        </td>
                        <td className="px-4 py-3 capitalize">
                          {String(row.difficulty ?? "").trim() || "-"}
                        </td>
                        <td className="px-4 py-3">
                          {formatWorkoutGoalLabel(row.goal) || "-"}
                        </td>
                        <td className="px-4 py-3">
                          {Number(row.exercisesCount ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <WorkoutPlanDetailsDialog
        open={detailsOpen}
        onOpenChange={handleCloseDetails}
        planId={detailsPlanId}
      />
    </div>
  );
}

function ClientPlansPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["clientPlans", "all-coaches"],
    queryFn: async () => {
      const res = await fetch("/api/auth/client/plans", {
        method: "GET",
        credentials: "include",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `Request failed (${res.status})`);
      }
      return payload as {
        ok: boolean;
        blocks: Array<{
          adminId: string;
          label: string;
          mealPlans: Array<{
            id: string;
            name: string;
            goal?: string;
            notes?: string;
            dailyCalories?: string;
            dailyProtein?: string;
            dailyCarbs?: string;
            dailyFat?: string;
            meals: Array<{
              id: string;
              type?: string;
              name?: string;
              order?: number;
              foods: Array<{
                id: string;
                name?: string;
                amount?: string;
                calories?: string | number;
                protein?: string | number;
                carbs?: string | number;
                fat?: string | number;
              }>;
            }>;
          }>;
          workoutPlans: Array<{
            id: string;
            name: string;
            goal?: string;
            notes?: string;
            difficulty?: string;
            duration?: string;
            exercises: Array<{
              id: string;
              name?: string;
              sets?: string;
              reps?: string;
              restSeconds?: number;
              videoKind?: string | null;
              videoUrl?: string | null;
              order?: number;
            }>;
          }>;
        }>;
      };
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 bg-[#F5F6F8] dark:bg-gray-900 min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading plans...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-[#F5F6F8] dark:bg-gray-900 min-h-screen">
        <div className="text-red-600 dark:text-red-300">
          {String((error as any)?.message ?? "Failed to load plans")}
        </div>
      </div>
    );
  }

  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];

  const toTitleCase = (value: any) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    return raw
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(" ");
  };

  const formatRest = (restSeconds: any) => {
    const n = Number(restSeconds);
    if (!Number.isFinite(n) || n <= 0) return "";
    const m = Math.floor(n / 60);
    const s = n % 60;
    if (m && s) return `${m}m ${s}s`;
    if (m) return `${m}m`;
    return `${s}s`;
  };

  return (
    <div className="p-8 bg-[#F5F6F8] dark:bg-gray-900 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Plans
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Reference only. No tracking or edits here.
        </p>
      </div>

      {blocks.length === 0 ? (
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-6 text-sm text-gray-600 dark:text-gray-300">
            No linked coaches found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {blocks.map((block) => {
            return (
              <Card
                key={block.adminId}
                className="dark:bg-gray-800 dark:border-gray-700"
              >
                <CardContent className="p-6 space-y-6">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {String(block.label || "Coach")}
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      Meal Plans
                    </div>

                    {block.mealPlans.length === 0 ? (
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        No meal plans assigned.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {block.mealPlans.map((plan) => (
                          <div key={plan.id} className="space-y-2">
                            <div className="text-base font-medium text-gray-900 dark:text-white">
                              {String(plan.name || "Meal Plan")}
                            </div>

                            <div className="text-sm text-gray-700 dark:text-gray-300">
                              {plan.goal ? `Goal: ${toTitleCase(plan.goal)}` : ""}
                              {plan.goal && plan.notes ? " · " : ""}
                              {plan.notes ? String(plan.notes) : ""}
                            </div>

                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Structure: Meals
                            </div>

                            {(plan.dailyCalories ||
                              plan.dailyProtein ||
                              plan.dailyCarbs ||
                              plan.dailyFat) && (
                                <div className="text-sm text-gray-700 dark:text-gray-300">
                                  <div className="font-medium">Daily targets</div>
                                  <div className="mt-1">
                                    {plan.dailyCalories
                                      ? `Calories ${String(plan.dailyCalories)} kcal`
                                      : null}
                                    {plan.dailyCalories &&
                                      (plan.dailyProtein || plan.dailyCarbs || plan.dailyFat)
                                      ? " · "
                                      : null}
                                    {plan.dailyProtein
                                      ? `Protein ${String(plan.dailyProtein)} g`
                                      : null}
                                    {plan.dailyProtein &&
                                      (plan.dailyCarbs || plan.dailyFat)
                                      ? " · "
                                      : null}
                                    {plan.dailyCarbs
                                      ? `Carbs ${String(plan.dailyCarbs)} g`
                                      : null}
                                    {plan.dailyCarbs && plan.dailyFat ? " · " : null}
                                    {plan.dailyFat
                                      ? `Fat ${String(plan.dailyFat)} g`
                                      : null}
                                  </div>
                                </div>
                              )}

                            <div className="space-y-3">
                              {plan.meals.map((meal, idx) => (
                                <div key={meal.id} className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                                    {idx + 1}. {toTitleCase(meal.type || "Meal")}
                                    {meal.name ? `: ${toTitleCase(meal.name)}` : ""}
                                  </div>

                                  {meal.foods.length === 0 ? (
                                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                                      No foods.
                                    </div>
                                  ) : (
                                    <div className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                      {meal.foods.map((food, foodIdx) => {
                                        const macros = [
                                          food.protein != null && String(food.protein).trim()
                                            ? `P ${String(food.protein).trim()}`
                                            : "",
                                          food.carbs != null && String(food.carbs).trim()
                                            ? `C ${String(food.carbs).trim()}`
                                            : "",
                                          food.fat != null && String(food.fat).trim()
                                            ? `F ${String(food.fat).trim()}`
                                            : "",
                                          food.calories != null && String(food.calories).trim()
                                            ? `${String(food.calories).trim()} kcal`
                                            : "",
                                        ].filter(Boolean);

                                        return (
                                          <div key={food.id} className="flex gap-2">
                                            <div className="w-5 text-right text-gray-400">
                                              {foodIdx + 1}.
                                            </div>
                                            <div className="min-w-0 flex-1">
                                              <div className="truncate">
                                                {toTitleCase(food.name || "-")}
                                                {food.amount ? ` — ${String(food.amount)}` : ""}
                                              </div>
                                              {macros.length ? (
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                  {macros.join(" · ")}
                                                </div>
                                              ) : null}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      Workout Plans
                    </div>

                    {block.workoutPlans.length === 0 ? (
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        No workout plans assigned.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {block.workoutPlans.map((plan) => (
                          <div key={plan.id} className="space-y-2">
                            <div className="text-base font-medium text-gray-900 dark:text-white">
                              {String(plan.name || "Workout Plan")}
                            </div>

                            <div className="text-sm text-gray-700 dark:text-gray-300">
                              {plan.goal ? `Goal: ${toTitleCase(plan.goal)}` : ""}
                              {(plan.goal && (plan.difficulty || plan.duration)) ? " · " : ""}
                              {plan.difficulty ? `Difficulty: ${toTitleCase(plan.difficulty)}` : ""}
                              {plan.difficulty && plan.duration ? " · " : ""}
                              {plan.duration ? `Duration: ${String(plan.duration)}` : ""}
                            </div>

                            {plan.notes ? (
                              <div className="text-sm text-gray-700 dark:text-gray-300">
                                {String(plan.notes)}
                              </div>
                            ) : null}

                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Structure: Workouts
                            </div>

                            <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                              {plan.exercises.length === 0 ? (
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                  No exercises.
                                </div>
                              ) : (
                                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                  {plan.exercises.map((ex, idx) => {
                                    const sets = String(ex.sets ?? "").trim();
                                    const reps = String(ex.reps ?? "").trim();
                                    const rest = formatRest(ex.restSeconds);
                                    const detail = [
                                      sets ? `${sets} sets` : "",
                                      reps ? `${reps} reps` : "",
                                      rest ? `Rest ${rest}` : "",
                                    ]
                                      .filter(Boolean)
                                      .join(" · ");

                                    return (
                                      <div key={ex.id}>
                                        <div>
                                          {idx + 1}. {toTitleCase(ex.name || "-")}
                                          {detail ? ` — ${detail}` : ""}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
