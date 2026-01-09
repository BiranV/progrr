"use client";

import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
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
};

export default function PlansPage() {
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

  const filteredPlans = (plans as WorkoutPlan[]).filter((plan: WorkoutPlan) =>
    String(plan?.name ?? "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const rows = React.useMemo(() => {
    return filteredPlans.map((p: any) => {
      const id = String(p?.id ?? "");
      return {
        id,
        name: String(p?.name ?? ""),
        duration: String(p?.duration ?? ""),
        difficulty: String(p?.difficulty ?? ""),
        goal: String(p?.goal ?? ""),
        exercisesCount: Number(exerciseCountByPlanId[id] ?? 0),
      } satisfies PlanRow;
    });
  }, [filteredPlans, exerciseCountByPlanId]);

  const sortedRows = React.useMemo(() => {
    if (!sortConfig) return rows;

    const collator = new Intl.Collator(["he", "en"], {
      sensitivity: "base",
      numeric: true,
    });

    return [...rows].sort((a, b) => {
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
  }, [rows, sortConfig]);

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
    () => paginate(sortedRows, page),
    [paginate, sortedRows, page]
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
      ) : rows.length === 0 ? (
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
                    className="px-4 py-3 text-right font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort("exercisesCount")}
                  >
                    <div className="flex items-center justify-end gap-2">
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
                      {String(row.goal ?? "").trim() || "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
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
      )}

      <WorkoutPlanDetailsDialog
        open={detailsOpen}
        onOpenChange={handleCloseDetails}
        planId={detailsPlanId}
      />
    </div>
  );
}
