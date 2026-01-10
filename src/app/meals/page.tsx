"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, Plus, Search, UtensilsCrossed } from "lucide-react";
import MealPlanPanel from "@/components/panels/MealPlanPanel";
import { getCookie, setCookie } from "@/lib/client-cookies";

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

  const [page, setPage] = React.useState(1);
  const [sortConfig, setSortConfig] = React.useState<{
    key: keyof MealPlanRow;
    direction: "asc" | "desc";
  } | null>(null);

  React.useEffect(() => {
    setCookie("progrr_meal_plans_rows_per_page", String(pageSize), {
      maxAgeSeconds: 60 * 60 * 24 * 365,
    });
  }, [pageSize]);

  const { data: mealPlans = [], isLoading } = useQuery({
    queryKey: ["mealPlans"],
    queryFn: () => db.entities.MealPlan.list("-created_date"),
  });

  const normalizeMealPlanStatus = React.useCallback((value: unknown) => {
    const raw = String(value ?? "").trim().toUpperCase();
    if (raw === "ARCHIVED") return "ARCHIVED";
    if (raw === "DELETED") return "DELETED";
    if (raw === "ACTIVE") return "ACTIVE";
    // Back-compat: if missing/unknown, treat as ACTIVE.
    return "ACTIVE";
  }, []);

  const filteredAll = (mealPlans as MealPlanRow[]).filter((p) =>
    String(p?.name ?? "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const activePlans = React.useMemo(() => {
    return filteredAll.filter(
      (p) => normalizeMealPlanStatus((p as any)?.status) !== "ARCHIVED"
    );
  }, [filteredAll, normalizeMealPlanStatus]);

  const archivedPlans = React.useMemo(() => {
    return filteredAll.filter(
      (p) => normalizeMealPlanStatus((p as any)?.status) === "ARCHIVED"
    );
  }, [filteredAll, normalizeMealPlanStatus]);

  const sortPlans = React.useCallback(
    (rows: MealPlanRow[]) => {
      if (!sortConfig) return rows;

      const collator = new Intl.Collator(["he", "en"], {
        sensitivity: "base",
        numeric: true,
      });

      return [...rows].sort((a, b) => {
        const direction = sortConfig.direction === "asc" ? 1 : -1;

        const aRaw =
          sortConfig.key === "name" ? a.name : (a as any)[sortConfig.key];
        const bRaw =
          sortConfig.key === "name" ? b.name : (b as any)[sortConfig.key];

        const aValue = String(aRaw ?? "").trim();
        const bValue = String(bRaw ?? "").trim();

        const aEmpty = aValue.length === 0;
        const bEmpty = bValue.length === 0;
        if (aEmpty && !bEmpty) return 1;
        if (!aEmpty && bEmpty) return -1;

        const cmp = collator.compare(aValue, bValue);
        if (cmp !== 0) return cmp * direction;
        return String(a.id ?? "").localeCompare(String(b.id ?? ""));
      });
    },
    [sortConfig]
  );

  const sortedActive = React.useMemo(
    () => sortPlans(activePlans),
    [activePlans, sortPlans]
  );

  const sortedArchived = React.useMemo(
    () => sortPlans(archivedPlans),
    [archivedPlans, sortPlans]
  );

  const handleSort = (key: keyof MealPlanRow) => {
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

  React.useEffect(() => {
    setPage(1);
  }, [search, sortConfig?.key, sortConfig?.direction, pageSize]);

  const paginate = React.useCallback(
    (rows: MealPlanRow[], currentPage: number) => {
      const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
      const safePage = Math.min(Math.max(1, currentPage), totalPages);
      const start = (safePage - 1) * pageSize;
      const pagedRows = rows.slice(start, start + pageSize);
      return {
        pagedRows,
        totalPages,
        page: safePage,
        totalCount: rows.length,
      };
    },
    [pageSize]
  );

  const paging = React.useMemo(
    () => paginate(sortedActive, page),
    [paginate, sortedActive, page]
  );

  return (
    <div className="p-8 bg-[#F5F6F8] dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Meal Plans</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create and manage nutrition programs
          </p>
        </div>

        <Button
          onClick={handleCreatePlan}
          className="min-w-[120px] bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Plus className="w-5 h-5 mr-2" />
          Meal Plan
        </Button>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="max-w-md relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search meal plans"
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

      {isLoading ? (
        <div className="py-12 text-center text-gray-500">Loading</div>
      ) : sortedActive.length === 0 && sortedArchived.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UtensilsCrossed className="w-12 h-12 text-indigo-500 dark:text-indigo-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {search
                ? "No meal plans found"
                : "No meal plans yet. Create your first one!"}
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
                      onClick={() => handleSort("dailyCalories")}
                    >
                      <div className="flex items-center gap-2">
                        Calories
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => handleSort("dailyProtein")}
                    >
                      <div className="flex items-center gap-2">
                        Protein
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => handleSort("dailyCarbs")}
                    >
                      <div className="flex items-center gap-2">
                        Carbs
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => handleSort("dailyFat")}
                    >
                      <div className="flex items-center gap-2">
                        Fat
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
                  </tr>
                </thead>
                <tbody>
                  {paging.pagedRows.map((plan) => (
                    <tr
                      key={plan.id}
                      className="border-t hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer transition-colors"
                      onClick={() => handleOpenDetails(plan)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium">
                          {String(plan.name ?? "-")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {String(plan.dailyCalories ?? "").trim() || "-"} kcal
                      </td>
                      <td className="px-4 py-3">
                        {String(plan.dailyProtein ?? "").trim() || "-"} g
                      </td>
                      <td className="px-4 py-3">
                        {String(plan.dailyCarbs ?? "").trim() || "-"} g
                      </td>
                      <td className="px-4 py-3">
                        {String(plan.dailyFat ?? "").trim() || "-"} g
                      </td>
                      <td className="px-4 py-3">
                        {String(plan.goal ?? "").trim() || "-"}
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
                  Archived Meal Plans
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
                      <th className="px-4 py-3 text-left font-medium">Calories</th>
                      <th className="px-4 py-3 text-left font-medium">Protein</th>
                      <th className="px-4 py-3 text-left font-medium">Carbs</th>
                      <th className="px-4 py-3 text-left font-medium">Fat</th>
                      <th className="px-4 py-3 text-left font-medium">Goal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedArchived.map((plan) => (
                      <tr
                        key={plan.id}
                        className="border-t hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer transition-colors"
                        onClick={() => handleOpenDetails(plan)}
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium">
                            {String(plan.name ?? "-")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {String(plan.dailyCalories ?? "").trim() || "-"} kcal
                        </td>
                        <td className="px-4 py-3">
                          {String(plan.dailyProtein ?? "").trim() || "-"} g
                        </td>
                        <td className="px-4 py-3">
                          {String(plan.dailyCarbs ?? "").trim() || "-"} g
                        </td>
                        <td className="px-4 py-3">
                          {String(plan.dailyFat ?? "").trim() || "-"} g
                        </td>
                        <td className="px-4 py-3">
                          {String(plan.goal ?? "").trim() || "-"}
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

      <MealPlanPanel
        open={detailsOpen}
        onOpenChange={handleCloseDetails}
        planId={detailsPlanId}
      />
    </div>
  );
}
