"use client";

import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Apple, Plus, X } from "lucide-react";
import { FoodDetailsContent } from "@/components/panels/FoodPanel";
import { getCookie, setCookie } from "@/lib/client-cookies";
import { toast } from "sonner";
import { type DataTableColumn } from "@/components/ui/table/DataTable";
import { DataTable } from "@/components/ui/table/DataTable";
import { EntityPageLayout } from "@/components/ui/entity/EntityPageLayout";
import { EntityToolbar } from "@/components/ui/entity/EntityToolbar";
import { EntityTableSection } from "@/components/ui/entity/EntityTableSection";
import { GenericDetailsPanel } from "@/components/ui/entity/GenericDetailsPanel";
import { useEntityTableState } from "@/hooks/useEntityTableState";
import { useCatalogSearch } from "@/hooks/use-catalog-search";

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
  status?: string;
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

  const table = useEntityTableState<FoodRow, "status">({
    rows: filteredFoods,
    statusKey: "status",
    pageSize,
  });

  const columns = React.useMemo(() => {
    const cols: Array<DataTableColumn<FoodRow>> = [
      {
        key: "name",
        header: "Food",
        sortable: true,
        renderCell: (food) => (
          <span className="font-medium">{String(food.name ?? "-")}</span>
        ),
      },
      {
        key: "calories",
        header: "Calories",
        sortable: true,
        renderCell: (food) => (
          <>{String(food.calories ?? "").trim() || "-"} kcal</>
        ),
      },
      {
        key: "protein",
        header: "Protein",
        sortable: true,
        renderCell: (food) => <>{String(food.protein ?? "").trim() || "-"} g</>,
      },
      {
        key: "carbs",
        header: "Carbs",
        sortable: true,
        renderCell: (food) => <>{String(food.carbs ?? "").trim() || "-"} g</>,
      },
      {
        key: "fat",
        header: "Fat",
        sortable: true,
        renderCell: (food) => <>{String(food.fat ?? "").trim() || "-"} g</>,
      },
    ];
    return cols;
  }, []);

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
  const {
    search: triggerCatalogSearch,
    results: catalogResults,
    isLoading: catalogLoading,
    error: catalogError,
    reset: resetSearch,
  } = useCatalogSearch<CatalogRow>("food");
  // Local state for the import operation (separate from search loading)
  const [importing, setImporting] = React.useState(false);
  const [selectedCatalogIds, setSelectedCatalogIds] = React.useState<
    Set<number>
  >(() => new Set());

  const runCatalogSearch = () => {
    const q = String(catalogQuery ?? "").trim();
    if (!q) return;

    triggerCatalogSearch(q);
    setSelectedCatalogIds(new Set());
    // Reset the search box after searching, but keep results visible.
    setCatalogQuery("");
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
    return catalogResults.filter((r) =>
      selectedCatalogIds.has(Number(r.fdcId))
    );
  }, [catalogResults, selectedCatalogIds]);

  const addSelectedFromCatalog = async () => {
    if (!selectedCatalogItems.length) return;

    setImporting(true);
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
      resetSearch();
    } catch (err: any) {
      toast.error(err?.message || "Failed to import foods");
    } finally {
      setImporting(false);
    }
  };

  const catalogColumns = React.useMemo((): Array<
    DataTableColumn<CatalogRow>
  > => {
    return [
      {
        key: "select",
        header: (
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
        ),
        headerClassName: "w-[44px]",
        renderCell: (r) => {
          const id = Number(r.fdcId);
          const checked = selectedCatalogIds.has(id);
          return (
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => toggleCatalogId(id, Boolean(v))}
              onClick={(e) => e.stopPropagation()}
            />
          );
        },
      },
      {
        key: "food",
        header: "Food",
        renderCell: (r) => (
          <div>
            <div className="font-medium">{String(r.description ?? "-")}</div>
            <div className="text-xs text-gray-500">
              FDC ID: {Number(r.fdcId)}
            </div>
          </div>
        ),
      },
      {
        key: "brand",
        header: "Brand",
        renderCell: (r) =>
          String(r.brandName ?? r.brandOwner ?? "").trim() || "-",
      },
      {
        key: "type",
        header: "Type",
        renderCell: (r) => String(r.dataType ?? "-"),
      },
      {
        key: "serving",
        header: "Serving",
        renderCell: (r) =>
          typeof r.servingSize === "number" && r.servingSize ? (
            <>
              {r.servingSize} {String(r.servingSizeUnit ?? "").trim()}
            </>
          ) : (
            "-"
          ),
      },
    ];
  }, [catalogResults, selectedCatalogIds, toggleCatalogId]);

  const selectedFood =
    (detailsFoodId &&
      (foods as FoodRow[]).find((f: any) => f.id === detailsFoodId)) ||
    null;

  return (
    <EntityPageLayout
      title="Foods"
      subtitle="Create reusable foods for meal plans"
      secondaryActions={
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setCatalogOpen((v) => {
              const next = !v;
              if (next) {
                setCatalogQuery("");
                resetSearch();
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
      }
      primaryAction={{ label: "Add Food", onClick: handleCreateFood }}
    >
      <EntityToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search foods"
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />

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
              <Button
                type="button"
                variant="outline"
                onClick={runCatalogSearch}
                disabled={catalogLoading || importing}
              >
                {catalogLoading ? "Searching..." : "Search"}
              </Button>
              <Button
                type="button"
                onClick={addSelectedFromCatalog}
                disabled={
                  catalogLoading ||
                  importing ||
                  selectedCatalogItems.length === 0
                }
              >
                Add selected
                {selectedCatalogItems.length
                  ? ` (${selectedCatalogItems.length})`
                  : ""}
              </Button>
            </div>
          </div>

          {catalogError ? (
            <div className="mt-3 text-sm text-red-600 dark:text-red-400">
              {catalogError}
            </div>
          ) : null}

          <div className="mt-4 rounded-lg border overflow-hidden">
            <DataTable
              rows={catalogResults}
              columns={catalogColumns}
              getRowId={(r) => String(Number((r as any)?.fdcId ?? 0))}
              emptyMessage="Search to see USDA results."
            />
          </div>
        </div>
      ) : null}

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
              icon: Apple,
              title:
                table.visibleRows.length === 0
                  ? search
                    ? "No foods found"
                    : "No foods yet"
                  : search
                  ? "No active foods match your search"
                  : "No active foods",
              description:
                table.visibleRows.length === 0
                  ? search
                    ? "Try searching for a different food."
                    : "Create your first one."
                  : undefined,
            }}
          />

          {table.archived.rows.length ? (
            <EntityTableSection
              title="Archived Foods"
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
                icon: Apple,
                title: "No archived foods",
              }}
            />
          ) : null}
        </div>
      )}

      {/* Unified Food Details Panel */}
      <GenericDetailsPanel
        open={detailsOpen}
        onOpenChange={handleCloseDetails}
        defaultTitle="Food Details"
        widthClassName="w-full sm:w-[540px] lg:w-[600px]"
      >
        <FoodDetailsContent
          food={selectedFood}
          createNew={detailsOpen && !detailsFoodId}
          onFoodUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["foodLibrary"] });
            queryClient.invalidateQueries({ queryKey: ["mealPlans"] });
            queryClient.invalidateQueries({ queryKey: ["meals"] });
          }}
        />
      </GenericDetailsPanel>
    </EntityPageLayout>
  );
}
