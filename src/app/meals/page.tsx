"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UtensilsCrossed } from "lucide-react";
import { db } from "@/lib/db";
import { MealDetailsContent } from "@/components/panels/MealPlanPanel";
import { getCookie, setCookie } from "@/lib/client-cookies";
import { type DataTableColumn } from "@/components/ui/table/DataTable";
import { EntityPageLayout } from "@/components/ui/entity/EntityPageLayout";
import { EntityToolbar } from "@/components/ui/entity/EntityToolbar";
import { EntityTableSection } from "@/components/ui/entity/EntityTableSection";
import { GenericDetailsPanel } from "@/components/ui/entity/GenericDetailsPanel";
import { useEntityTableState } from "@/hooks/useEntityTableState";
import { usePlanGuards } from "@/hooks/use-plan-guards";
import { Button } from "@/components/ui/button";

type MealPlanRow = {
  id: string;
  name?: string;
  dailyCalories?: string | number;
  dailyProtein?: string | number;
  dailyCarbs?: string | number;
  dailyFat?: string | number;
  goal?: string;
  status?: string;
};

export default function MealsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");

  // Unified Details/Create/Edit Panel State (mirror of CLIENTS)
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [detailsPlanId, setDetailsPlanId] = React.useState<string | null>(null);

  const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const;
  const [pageSize, setPageSize] = React.useState(() => {
    if (typeof window === "undefined") return 10;
    const raw = getCookie("progrr_meal_plans_rows_per_page");
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
    setCookie("progrr_meal_plans_rows_per_page", String(pageSize), {
      maxAgeSeconds: 60 * 60 * 24 * 365,
    });
  }, [pageSize]);

  const { data: mealPlans = [], isLoading } = useQuery({
    queryKey: ["mealPlans"],
    queryFn: () => db.entities.MealPlan.list("-created_date"),
  });

  const filteredMealPlans = (mealPlans as MealPlanRow[]).filter((p) =>
    String(p?.name ?? "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const table = useEntityTableState<MealPlanRow, "status">({
    rows: filteredMealPlans,
    statusKey: "status",
    pageSize,
  });

  const columns = React.useMemo(() => {
    const cols: Array<DataTableColumn<MealPlanRow>> = [
      {
        key: "name",
        header: "Meal Plan",
        sortable: true,
        renderCell: (plan) => (
          <span className="font-medium">{String(plan.name ?? "-")}</span>
        ),
      },
      {
        key: "dailyCalories",
        header: "Calories",
        sortable: true,
        renderCell: (plan) => (
          <>{String(plan.dailyCalories ?? "").trim() || "-"} kcal</>
        ),
      },
      {
        key: "dailyProtein",
        header: "Protein",
        sortable: true,
        renderCell: (plan) => (
          <>{String(plan.dailyProtein ?? "").trim() || "-"} g</>
        ),
      },
      {
        key: "dailyCarbs",
        header: "Carbs",
        sortable: true,
        renderCell: (plan) => (
          <>{String(plan.dailyCarbs ?? "").trim() || "-"} g</>
        ),
      },
      {
        key: "dailyFat",
        header: "Fat",
        sortable: true,
        renderCell: (plan) => (
          <>{String(plan.dailyFat ?? "").trim() || "-"} g</>
        ),
      },
      {
        key: "goal",
        header: "Goal",
        sortable: true,
        renderCell: (plan) => String(plan.goal ?? "").trim() || "-",
      },
    ];

    return cols;
  }, []);

  const handleOpenDetails = (plan: MealPlanRow) => {
    setDetailsPlanId(plan.id);
    setDetailsOpen(true);
  };

  const handleCloseDetails = (open: boolean) => {
    setDetailsOpen(open);
    if (!open) {
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
    "You’ve reached the limit for your current plan. Upgrade to continue.";

  return (
    <EntityPageLayout
      title="Meal Plans"
      subtitle="Create and manage nutrition programs"
      primaryAction={{
        label: "Add Meal Plan",
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
            Upgrade
          </Button>
        </div>
      ) : null}

      <EntityToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search meal plans"
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
              icon: UtensilsCrossed,
              title:
                table.visibleRows.length === 0
                  ? search
                    ? "No meal plans found"
                    : "No meal plans yet"
                  : search
                    ? "No active meal plans match your search"
                    : "No active meal plans",
              description:
                table.visibleRows.length === 0
                  ? search
                    ? "Try searching for a different meal plan."
                    : "Create your first one."
                  : undefined,
            }}
          />

          {table.archived.rows.length ? (
            <EntityTableSection
              title="Archived Meal Plans"
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
                icon: UtensilsCrossed,
                title: "No archived meal plans",
              }}
            />
          ) : null}
        </div>
      )}

      {/* Unified Meal Plan Details Panel */}
      <GenericDetailsPanel
        open={detailsOpen}
        onOpenChange={handleCloseDetails}
        defaultTitle="Meal Plan Details"
        widthClassName="w-full sm:w-[560px] lg:w-[720px]"
      >
        <MealDetailsContent
          planId={detailsPlanId}
          createNew={detailsOpen && !detailsPlanId}
          onMealPlanUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["mealPlans"] });
            queryClient.invalidateQueries({ queryKey: ["meals"] });
            queryClient.invalidateQueries({ queryKey: ["foods"] });
            queryClient.invalidateQueries({ queryKey: ["planFoods"] });
          }}
        />
      </GenericDetailsPanel>
    </EntityPageLayout>
  );
}
