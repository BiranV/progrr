"use client";

import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Apple, ArrowUpDown, Plus, Search, X } from "lucide-react";
import FoodPanel from "@/components/panels/FoodPanel";
import { getCookie, setCookie } from "@/lib/client-cookies";
import { toast } from "sonner";

type CatalogRow = {
  fdcId: number;
  description: string;
  brandName?: string;
  brandOwner?: string;
  dataType?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: any[];
};

type FoodRow = {
  id: string;
  name?: string;
  calories?: string | number;
  protein?: string | number;
  carbs?: string | number;
  fat?: string | number;
};

export default function FoodsPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");

  // Unified Details/Create/Edit Panel State (mirror of CLIENTS)
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [detailsFoodId, setDetailsFoodId] = React.useState<string | null>(null);

  const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const;
  const [pageSize, setPageSize] = React.useState(() => {
    if (typeof window === "undefined") return 10;
    const raw = getCookie("progrr_foods_rows_per_page");
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
    key: keyof FoodRow;
    direction: "asc" | "desc";
  } | null>(null);

  // Persist page size
  React.useEffect(() => {
    setCookie("progrr_foods_rows_per_page", String(pageSize), {
      maxAgeSeconds: 60 * 60 * 24 * 365,
    });
  }, [pageSize]);

  const { data: foods = [], isLoading } = useQuery({
    queryKey: ["foodLibrary"],
    queryFn: () => db.entities.FoodLibrary.list("-created_date"),
  });

  const filteredFoods = (foods as FoodRow[]).filter((f) =>
    String(f?.name ?? "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const sortedFoods = React.useMemo(() => {
    if (!sortConfig) return filteredFoods;

    const collator = new Intl.Collator(["he", "en"], {
      sensitivity: "base",
      numeric: true,
    });

    return [...filteredFoods].sort((a, b) => {
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
  }, [filteredFoods, sortConfig]);

  const handleSort = (key: keyof FoodRow) => {
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

  const handleOpenDetails = (food: FoodRow) => {
    setDetailsFoodId(food.id);
    setDetailsOpen(true);
  };

  const handleCloseDetails = (open: boolean) => {
    setDetailsOpen(open);
    if (!open) {
      setTimeout(() => setDetailsFoodId(null), 200);
    }
  };

  const handleCreateFood = () => {
    setDetailsFoodId(null);
    setDetailsOpen(true);
  };

  // USDA Food Catalog (bulk add)
  const [catalogOpen, setCatalogOpen] = React.useState(false);
  const [catalogQuery, setCatalogQuery] = React.useState("");
  const [catalogLoading, setCatalogLoading] = React.useState(false);
  const [catalogError, setCatalogError] = React.useState<string | null>(null);
  const [catalogResults, setCatalogResults] = React.useState<CatalogRow[]>([]);
  const [selectedCatalogIds, setSelectedCatalogIds] = React.useState<Set<number>>(
    () => new Set()
  );

  const runCatalogSearch = async () => {
    const q = String(catalogQuery ?? "").trim();
    if (!q) return;

    setCatalogError(null);
    setCatalogLoading(true);
    try {
      const res = await fetch(
        `/api/foods/catalog/search?q=${encodeURIComponent(q)}`,
        {
          method: "GET",
          credentials: "include",
        }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `Request failed (${res.status})`);
      }
      const results = Array.isArray(payload?.results) ? payload.results : [];
      setCatalogResults(results);
      setSelectedCatalogIds(new Set());
      // Reset the search box after searching, but keep results visible.
      setCatalogQuery("");
    } catch (err: any) {
      setCatalogError(err?.message || "Failed to search USDA catalog");
    } finally {
      setCatalogLoading(false);
    }
  };

  const toggleCatalogId = (id: number, checked: boolean) => {
    setSelectedCatalogIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectedCatalogItems = React.useMemo(() => {
    if (!selectedCatalogIds.size) return [] as CatalogRow[];
    return catalogResults.filter((r) => selectedCatalogIds.has(Number(r.fdcId)));
  }, [catalogResults, selectedCatalogIds]);

  const addSelectedFromCatalog = async () => {
    if (!selectedCatalogItems.length) return;

    setCatalogError(null);
    setCatalogLoading(true);
    try {
      const res = await fetch("/api/foods/catalog/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items: selectedCatalogItems }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `Request failed (${res.status})`);
      }

      const inserted = Number(payload?.inserted ?? 0);
      const skipped = Number(payload?.skippedExisting ?? 0);
      toast.success(
        inserted
          ? `Added ${inserted} food${inserted === 1 ? "" : "s"}`
          : skipped
            ? "All selected foods already exist"
            : "No foods added"
      );

      await queryClient.invalidateQueries({ queryKey: ["foodLibrary"] });

      setSelectedCatalogIds(new Set());
      // Reset catalog state after importing to start fresh.
      setCatalogQuery("");
      setCatalogResults([]);
    } catch (err: any) {
      setCatalogError(err?.message || "Failed to import foods");
    } finally {
      setCatalogLoading(false);
    }
  };

  // Reset pagination on search/sort/page size change
  React.useEffect(() => {
    setPage(1);
  }, [search, sortConfig?.key, sortConfig?.direction, pageSize]);

  const paginate = React.useCallback(
    (rows: FoodRow[], currentPage: number) => {
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
    () => paginate(sortedFoods, page),
    [paginate, sortedFoods, page]
  );

  const selectedFood =
    (detailsFoodId &&
      (foods as FoodRow[]).find((f: any) => f.id === detailsFoodId)) ||
    null;

  return (
    <div className="p-8 bg-[#F5F6F8] dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Foods</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create reusable foods for meal plans
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setCatalogOpen((v) => {
                const next = !v;
                if (next) {
                  setCatalogQuery("");
                  setCatalogError(null);
                  setCatalogResults([]);
                  setSelectedCatalogIds(new Set());
                }
                return next;
              })
            }
          >
            {catalogOpen ? (
              <X className="w-5 h-5 mr-2" />
            ) : (
              <Plus className="w-5 h-5 mr-2" />
            )}
            {catalogOpen ? "Close Catalog" : "Add from Food Catalog"}
          </Button>

          <Button
            type="button"
            onClick={handleCreateFood}
            className="min-w-[140px] bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Food
          </Button>
        </div>
      </div>

      {/* Search + Pagination settings */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="max-w-md relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search foods"
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

      {catalogOpen ? (
        <div className="mb-6 rounded-lg border bg-white dark:bg-gray-800 p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="text-sm font-medium">Food Catalog (USDA)</div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setCatalogOpen(false)}
              aria-label="Close catalog"
              title="Close catalog"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <Input
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder="Search USDA foods (e.g. banana, chicken breast, rice)"
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  runCatalogSearch();
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={runCatalogSearch} disabled={catalogLoading}>
                {catalogLoading ? "Searching..." : "Search"}
              </Button>
              <Button
                type="button"
                onClick={addSelectedFromCatalog}
                disabled={catalogLoading || selectedCatalogItems.length === 0}
              >
                Add selected{selectedCatalogItems.length ? ` (${selectedCatalogItems.length})` : ""}
              </Button>
            </div>
          </div>

          {catalogError ? (
            <div className="mt-3 text-sm text-red-600 dark:text-red-400">
              {catalogError}
            </div>
          ) : null}

          <div className="mt-4 rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium w-[44px]">
                      <Checkbox
                        checked={
                          catalogResults.length > 0 &&
                          selectedCatalogIds.size === catalogResults.length
                        }
                        onCheckedChange={(v) => {
                          const checked = Boolean(v);
                          setSelectedCatalogIds(() => {
                            if (!checked) return new Set();
                            return new Set(catalogResults.map((r) => Number(r.fdcId)));
                          });
                        }}
                        disabled={catalogResults.length === 0}
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Food</th>
                    <th className="px-4 py-3 text-left font-medium">Brand</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">Serving</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogResults.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-sm text-gray-500" colSpan={5}>
                        Search to see USDA results.
                      </td>
                    </tr>
                  ) : (
                    catalogResults.map((r) => {
                      const id = Number(r.fdcId);
                      const checked = selectedCatalogIds.has(id);
                      return (
                        <tr key={id} className="border-t hover:bg-gray-50 dark:hover:bg-gray-700/40">
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => toggleCatalogId(id, Boolean(v))}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{String(r.description ?? "-")}</div>
                            <div className="text-xs text-gray-500">FDC ID: {id}</div>
                          </td>
                          <td className="px-4 py-3">
                            {String(r.brandName ?? r.brandOwner ?? "").trim() || "-"}
                          </td>
                          <td className="px-4 py-3">{String(r.dataType ?? "-")}</td>
                          <td className="px-4 py-3">
                            {typeof r.servingSize === "number" && r.servingSize ? (
                              <>
                                {r.servingSize} {String(r.servingSizeUnit ?? "").trim()}
                              </>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* Content */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-500">Loading…</div>
      ) : sortedFoods.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Apple className="w-12 h-12 text-indigo-500 dark:text-indigo-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {search
                ? "No foods found"
                : "No foods yet. Create your first one!"}
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
                      Food
                      <ArrowUpDown className="w-4 h-4" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort("calories")}
                  >
                    <div className="flex items-center gap-2">
                      Calories
                      <ArrowUpDown className="w-4 h-4" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort("protein")}
                  >
                    <div className="flex items-center gap-2">
                      Protein
                      <ArrowUpDown className="w-4 h-4" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort("carbs")}
                  >
                    <div className="flex items-center gap-2">
                      Carbs
                      <ArrowUpDown className="w-4 h-4" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort("fat")}
                  >
                    <div className="flex items-center gap-2">
                      Fat
                      <ArrowUpDown className="w-4 h-4" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paging.pagedRows.map((food) => (
                  <tr
                    key={food.id}
                    className="border-t hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer transition-colors"
                    onClick={() => handleOpenDetails(food)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium">
                        {String(food.name ?? "-")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {String(food.calories ?? "").trim() || "-"} kcal
                    </td>
                    <td className="px-4 py-3">
                      {String(food.protein ?? "").trim() || "-"} g
                    </td>
                    <td className="px-4 py-3">
                      {String(food.carbs ?? "").trim() || "-"} g
                    </td>
                    <td className="px-4 py-3">
                      {String(food.fat ?? "").trim() || "-"} g
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

      {/* Unified Food Details Panel */}
      <FoodPanel
        food={selectedFood}
        open={detailsOpen}
        onOpenChange={handleCloseDetails}
        createNew={detailsOpen && !detailsFoodId}
        onFoodUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ["foodLibrary"] });
          queryClient.invalidateQueries({ queryKey: ["mealPlans"] });
          queryClient.invalidateQueries({ queryKey: ["meals"] });
        }}
      />
    </div>
  );
}

