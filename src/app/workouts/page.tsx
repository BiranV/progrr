"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { ClipboardList } from "lucide-react";
import { WorkoutDetailsContent } from "@/components/panels/WorkoutPlanPanel";
import { WorkoutPlan } from "@/types";
import { useRefetchOnVisible } from "@/hooks/use-refetch-on-visible";
import { getCookie, setCookie } from "@/lib/client-cookies";
import { type DataTableColumn } from "@/components/ui/table/DataTable";
import { EntityPageLayout } from "@/components/ui/entity/EntityPageLayout";
import { EntityToolbar } from "@/components/ui/entity/EntityToolbar";
import { EntityTableSection } from "@/components/ui/entity/EntityTableSection";
import { GenericDetailsPanel } from "@/components/ui/entity/GenericDetailsPanel";
import { useEntityTableState } from "@/hooks/useEntityTableState";
import { usePlanGuards } from "@/hooks/use-plan-guards";
import { Button } from "@/components/ui/button";

type PlanRow = {
  id: string;
  name?: string;
  duration?: string;
  difficulty?: string;
  goal?: string;
  exercisesCount?: number;
  status?: string;
};

export default function WorkoutPlansPage() {
  const router = useRouter();
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

  const filteredAll = (plans as WorkoutPlan[]).filter((plan: WorkoutPlan) =>
    String(plan?.name ?? "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

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
        status: (p as any)?.status,
      } satisfies PlanRow;
    },
    [exerciseCountByPlanId]
  );

  const rows = React.useMemo(() => {
    return filteredAll.map(buildRow);
  }, [filteredAll, buildRow]);

  const table = useEntityTableState<PlanRow, "status">({
    rows,
    statusKey: "status",
    pageSize,
  });

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

  const columns = React.useMemo(() => {
    const cols: Array<DataTableColumn<PlanRow>> = [
      {
        key: "name",
        header: "Plan",
        sortable: true,
        renderCell: (row) => (
          <span className="font-medium">{String(row.name ?? "-")}</span>
        ),
      },
      {
        key: "duration",
        header: "Duration",
        sortable: true,
        renderCell: (row) => formatDurationWeeks(row.duration) || "-",
      },
      {
        key: "difficulty",
        header: "Difficulty",
        sortable: true,
        renderCell: (row) => (
          <span className="capitalize">{String(row.difficulty ?? "").trim() || "-"}</span>
        ),
      },
      {
        key: "goal",
        header: "Goal",
        sortable: true,
        renderCell: (row) => formatWorkoutGoalLabel(row.goal) || "-",
      },
      {
        key: "exercisesCount",
        header: "Exercises",
        sortable: true,
        renderCell: (row) => Number(row.exercisesCount ?? 0),
      },
    ];
    return cols;
  }, [formatWorkoutGoalLabel]);

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

  const { data: planGuards } = usePlanGuards(true);
  const canCreatePlan = planGuards?.guards?.canCreatePlan?.allowed ?? true;
  const createPlanReason =
    planGuards?.guards?.canCreatePlan?.reason ||
    "You’ve reached the limit for your current subscription. Upgrade to continue.";

  const upgradeLabel = React.useMemo(() => {
    const tier = String(planGuards?.plan ?? "").toLowerCase();
    if (tier === "free") return "Upgrade to Basic";
    if (tier === "basic") return "Upgrade to Professional";
    if (tier === "professional") return "Upgrade to Advanced";
    return "View pricing";
  }, [planGuards?.plan]);

  return (
    <EntityPageLayout
      title="Workout Plans"
      subtitle="Create and manage workout routines"
      primaryAction={{
        label: "Add Workout Plan",
        onClick: handleCreatePlan,
        disabled: !canCreatePlan,
      }}
    >
      {!canCreatePlan ? (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
          <div className="pr-2">{createPlanReason}</div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => router.push("/pricing")}
          >
            {upgradeLabel}
          </Button>
        </div>
      ) : null}

      <EntityToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search workout plans"
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />

      {/* Content */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-500">Loading…</div>
      ) : (
        <div className="space-y-8">
          <EntityTableSection
            totalCount={table.active.rows.length}
            rows={table.active.paging.pagedRows}
            columns={columns}
            getRowId={(r) => String((r as any)?.id)}
            onRowClick={(r) => handleOpenDetails(r)}
            sortConfig={table.sortConfig}
            onSort={table.onSort}
            pagination={{
              page: table.active.paging.page,
              totalPages: table.active.paging.totalPages,
              onPageChange: table.active.setPage,
            }}
            emptyState={{
              icon: ClipboardList,
              title:
                table.visibleRows.length === 0
                  ? search
                    ? "No workout plans found"
                    : "No workout plans yet"
                  : search
                    ? "No active workout plans match your search"
                    : "No active workout plans",
              description:
                table.visibleRows.length === 0
                  ? search
                    ? "Try searching for a different workout plan."
                    : "Create your first one."
                  : undefined,
            }}
          />

          {table.archived.rows.length ? (
            <EntityTableSection
              title="Archived Workout Plans"
              variant="archived"
              totalCount={table.archived.rows.length}
              rows={table.archived.paging.pagedRows}
              columns={columns}
              getRowId={(r) => String((r as any)?.id)}
              onRowClick={(r) => handleOpenDetails(r)}
              sortConfig={table.sortConfig}
              onSort={table.onSort}
              pagination={{
                page: table.archived.paging.page,
                totalPages: table.archived.paging.totalPages,
                onPageChange: table.archived.setPage,
              }}
              emptyState={{
                icon: ClipboardList,
                title: "No archived workout plans",
              }}
            />
          ) : null}
        </div>
      )}

      {/* Unified Workout Plan Details Panel */}
      <GenericDetailsPanel
        open={detailsOpen}
        onOpenChange={handleCloseDetails}
        defaultTitle="Workout Plan Details"
        widthClassName="w-full sm:w-[560px] lg:w-[720px]"
      >
        <WorkoutDetailsContent
          planId={detailsPlanId}
          createNew={detailsOpen && !detailsPlanId}
          onWorkoutPlanUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["workoutPlans"] });
            queryClient.invalidateQueries({ queryKey: ["workoutPlanExerciseCounts"] });
          }}
        />
      </GenericDetailsPanel>
    </EntityPageLayout>
  );
}
