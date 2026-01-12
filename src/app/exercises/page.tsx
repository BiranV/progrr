"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dumbbell, FileText, Lock, Plus, Video, X } from "lucide-react";
import { ExerciseDetailsContent } from "@/components/panels/ExercisePanel";
import { Checkbox } from "@/components/ui/checkbox";
import { getCookie, setCookie } from "@/lib/client-cookies";
import { toast } from "sonner";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/ui/table/DataTable";
import { EntityPageLayout } from "@/components/ui/entity/EntityPageLayout";
import { EntityToolbar } from "@/components/ui/entity/EntityToolbar";
import { EntityTableSection } from "@/components/ui/entity/EntityTableSection";
import { GenericDetailsPanel } from "@/components/ui/entity/GenericDetailsPanel";
import { useEntityTableState } from "@/hooks/useEntityTableState";
import { useCatalogSearch } from "@/hooks/use-catalog-search";
import { usePlanGuards } from "@/hooks/use-plan-guards";

type CatalogRow = {
  externalId: string;
  name: string;
  bodyPart?: string;
  targetMuscle?: string;
  equipment?: string;
  gifUrl?: string;
};

type ExerciseRow = {
  id: string;
  name?: string;
  guidelines?: string;
  videoKind?: string | null;
  videoUrl?: string | null;
  bodyPart?: string;
  targetMuscle?: string;
  equipment?: string;
  status?: string;
};

export default function ExercisesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [detailsExerciseId, setDetailsExerciseId] = React.useState<
    string | null
  >(null);

  const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const;
  const [pageSize, setPageSize] = React.useState(() => {
    if (typeof window === "undefined") return 10;
    const raw = getCookie("progrr_exercises_rows_per_page");
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
    setCookie("progrr_exercises_rows_per_page", String(pageSize), {
      maxAgeSeconds: 60 * 60 * 24 * 365,
    });
  }, [pageSize]);

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ["exerciseLibrary"],
    queryFn: () => db.entities.ExerciseLibrary.list("-created_date"),
  });

  const { data: planGuards } = usePlanGuards(true);
  const canUseExerciseCatalog =
    planGuards?.guards?.canUseExternalCatalogApi?.allowed ?? false;
  const isAdvancedCatalogTier =
    String(planGuards?.plan ?? "") === "professional" ||
    String(planGuards?.plan ?? "") === "advanced";

  const filteredExercises = (exercises as ExerciseRow[]).filter((e) =>
    String(e?.name ?? "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const table = useEntityTableState<ExerciseRow, "status">({
    rows: filteredExercises,
    statusKey: "status",
    pageSize,
  });

  const handleOpenDetails = (exercise: ExerciseRow) => {
    setDetailsExerciseId(String(exercise.id));
    setDetailsOpen(true);
  };

  const handleCloseDetails = (open: boolean) => {
    setDetailsOpen(open);
    if (!open) {
      setTimeout(() => setDetailsExerciseId(null), 200);
    }
  };

  const handleCreate = () => {
    setDetailsExerciseId(null);
    setDetailsOpen(true);
  };

  // Exercise Catalog (RapidAPI - ExerciseDB) bulk add
  const [catalogOpen, setCatalogOpen] = React.useState(false);
  const [catalogQuery, setCatalogQuery] = React.useState("");
  const [catalogSearchMessage, setCatalogSearchMessage] = React.useState<
    string | null
  >(null);
  const {
    search: triggerCatalogSearch,
    results: catalogResults,
    isLoading: catalogLoading,
    error: catalogError,
    reset: resetSearch,
  } = useCatalogSearch<CatalogRow>("exercise");
  // Local state for the import operation (separate from search loading)
  const [importing, setImporting] = React.useState(false);
  const [selectedCatalogIds, setSelectedCatalogIds] = React.useState<
    Set<string>
  >(() => new Set());

  const runCatalogSearch = () => {
    if (!canUseExerciseCatalog) return;
    const q = String(catalogQuery ?? "").trim();
    if (!q) return;

    if (q.length < 3) {
      setCatalogSearchMessage("Please enter at least 3 characters to search.");
      return;
    }

    setCatalogSearchMessage(null);
    triggerCatalogSearch(q);
    setSelectedCatalogIds(new Set());
    // Reset search box after searching, keep results visible.
    setCatalogQuery("");
  };

  const toggleCatalogId = (id: string, checked: boolean) => {
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
      selectedCatalogIds.has(String(r.externalId))
    );
  }, [catalogResults, selectedCatalogIds]);

  const addSelectedFromCatalog = async () => {
    if (!canUseExerciseCatalog) return;
    if (!selectedCatalogItems.length) return;

    setImporting(true);
    try {
      const res = await fetch("/api/exercises/catalog/import", {
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
          ? `Added ${inserted} exercise${inserted === 1 ? "" : "s"}`
          : skipped
            ? "All selected exercises already exist"
            : "No exercises added"
      );

      await queryClient.invalidateQueries({ queryKey: ["exerciseLibrary"] });

      setSelectedCatalogIds(new Set());
      // Reset catalog state after importing to start fresh.
      setCatalogQuery("");
      resetSearch();
    } catch (err: any) {
      toast.error(err?.message || "Failed to import exercises");
    } finally {
      setImporting(false);
    }
  };

  const columns = React.useMemo(() => {
    const cols: Array<DataTableColumn<ExerciseRow>> = [
      {
        key: "name",
        header: "Exercise",
        sortable: true,
        renderCell: (exercise) => (
          <span className="font-medium">{String(exercise.name ?? "-")}</span>
        ),
      },
      {
        key: "targetMuscle",
        header: "Target",
        sortable: true,
        renderCell: (exercise) =>
          String(exercise.targetMuscle ?? "").trim() || "-",
      },
      {
        key: "bodyPart",
        header: "Body Part",
        sortable: true,
        renderCell: (exercise) => String(exercise.bodyPart ?? "").trim() || "-",
      },
      {
        key: "equipment",
        header: "Equipment",
        sortable: true,
        renderCell: (exercise) =>
          String(exercise.equipment ?? "").trim() || "-",
      },
      {
        key: "media",
        header: "Media",
        renderCell: (e) => {
          const videoKind = String(e?.videoKind ?? "").trim();
          const videoUrl = String(e?.videoUrl ?? "").trim();
          const hasVideo =
            !!videoKind &&
            (videoKind !== "youtube" || !!videoUrl) &&
            (videoKind !== "upload" || !!videoUrl);
          const videoLabel =
            videoKind === "youtube"
              ? "YouTube"
              : videoKind === "upload"
                ? "Upload"
                : "-";
          const hasGuidelines = !!String(e?.guidelines ?? "").trim();

          return (
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
              {hasVideo ? (
                <span
                  className="inline-flex items-center"
                  title={`Video: ${videoLabel}`}
                  aria-label={`Video: ${videoLabel}`}
                >
                  <Video className="h-4 w-4" />
                </span>
              ) : null}
              {hasGuidelines ? (
                <span
                  className="inline-flex items-center"
                  title="Guidelines available"
                  aria-label="Guidelines available"
                >
                  <FileText className="h-4 w-4" />
                </span>
              ) : null}
              {!hasVideo && !hasGuidelines ? <span>-</span> : null}
            </div>
          );
        },
      },
    ];

    return cols;
  }, []);

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
                return new Set(catalogResults.map((r) => String(r.externalId)));
              });
            }}
            disabled={catalogResults.length === 0}
          />
        ),
        headerClassName: "w-[44px]",
        renderCell: (r) => {
          const id = String(r.externalId);
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
        key: "name",
        header: "Exercise",
        renderCell: (r) => (
          <div>
            <div className="font-medium">{String(r.name ?? "-")}</div>
            <div className="text-xs text-gray-500">
              ID: {String(r.externalId)}
            </div>
          </div>
        ),
      },
      {
        key: "targetMuscle",
        header: "Target",
        renderCell: (r) => String(r.targetMuscle ?? "-"),
      },
      {
        key: "bodyPart",
        header: "Body Part",
        renderCell: (r) => String(r.bodyPart ?? "-"),
      },
      {
        key: "equipment",
        header: "Equipment",
        renderCell: (r) => String(r.equipment ?? "-"),
      },
    ];
  }, [catalogResults, selectedCatalogIds, toggleCatalogId]);

  const selectedExercise =
    (detailsExerciseId &&
      (exercises as ExerciseRow[]).find(
        (e) => String((e as any)?.id) === String(detailsExerciseId)
      )) ||
    null;

  React.useEffect(() => {
    if (!canUseExerciseCatalog && catalogOpen) {
      setCatalogOpen(false);
    }
  }, [canUseExerciseCatalog, catalogOpen]);

  return (
    <EntityPageLayout
      title="Exercises"
      subtitle="Create reusable exercises for workout plans"
      secondaryActions={
        <Button
          type="button"
          variant="outline"
          disabled={!canUseExerciseCatalog}
          title={!canUseExerciseCatalog ? "Available on Professional and above" : undefined}
          onClick={() => {
            if (!canUseExerciseCatalog) return;
            setCatalogOpen((v) => {
              const next = !v;
              if (next) {
                setCatalogQuery("");
                setCatalogSearchMessage(null);
                resetSearch();
                setSelectedCatalogIds(new Set());
              }
              return next;
            });
          }}
        >
          {!canUseExerciseCatalog ? (
            <Lock className="w-5 h-5 mr-2" />
          ) : catalogOpen ? (
            <X className="w-5 h-5 mr-2" />
          ) : (
            <Plus className="w-5 h-5 mr-2" />
          )}
          {catalogOpen
            ? "Close Catalog"
            : isAdvancedCatalogTier
              ? "Advanced Catalog"
              : "Catalog"}
        </Button>
      }
      primaryAction={{ label: "Add Exercise", onClick: handleCreate }}
    >
      <EntityToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search exercises"
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />

      {!canUseExerciseCatalog ? (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700">
              <Lock className="h-4 w-4 text-gray-600 dark:text-gray-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                Exercise catalog
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Available on Professional and above
              </div>
              <Button
                type="button"
                size="sm"
                className="mt-3"
                onClick={() => router.push("/pricing")}
              >
                Upgrade Plan
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {catalogOpen && canUseExerciseCatalog ? (
        <div className="mb-6 rounded-lg border bg-white dark:bg-gray-800 p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="text-sm font-medium">
              Advanced Catalog (ExerciseDB)
            </div>
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
                onChange={(e) => {
                  const next = e.target.value;
                  setCatalogQuery(next);
                  if (catalogSearchMessage && String(next ?? "").trim().length >= 3) {
                    setCatalogSearchMessage(null);
                  }
                }}
                placeholder="Search exercises (e.g. push up, squat, bench press)"
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

          {catalogSearchMessage ? (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200">
              {catalogSearchMessage}
            </div>
          ) : null}

          {catalogError ? (
            <div className="mt-3 text-sm text-red-600 dark:text-red-400">
              {catalogError}
            </div>
          ) : null}

          <div className="mt-4 rounded-lg border overflow-hidden">
            <DataTable
              rows={catalogResults}
              columns={catalogColumns}
              getRowId={(r) => String((r as any)?.externalId ?? "")}
              emptyMessage="Search to see ExerciseDB results."
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
              icon: Dumbbell,
              title:
                table.visibleRows.length === 0
                  ? search
                    ? "No exercises found"
                    : "No exercises yet"
                  : search
                    ? "No active exercises match your search"
                    : "No active exercises",
              description:
                table.visibleRows.length === 0
                  ? search
                    ? "Try searching for a different exercise."
                    : "Create your first one."
                  : undefined,
            }}
          />

          {table.archived.rows.length ? (
            <EntityTableSection
              title="Archived Exercises"
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
                icon: Dumbbell,
                title: "No archived exercises",
              }}
            />
          ) : null}
        </div>
      )}

      {/* Unified Exercise Details Panel */}
      <GenericDetailsPanel
        open={detailsOpen}
        onOpenChange={handleCloseDetails}
        defaultTitle="Exercise Details"
        widthClassName="w-full sm:w-[520px] lg:w-[720px]"
      >
        <ExerciseDetailsContent
          exercise={selectedExercise}
          createNew={detailsOpen && !detailsExerciseId}
          onExerciseUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["exerciseLibrary"] });
          }}
        />
      </GenericDetailsPanel>
    </EntityPageLayout>
  );
}
