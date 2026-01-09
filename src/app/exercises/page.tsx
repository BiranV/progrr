"use client";

import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpDown, Dumbbell, FileText, Plus, Search, Video, X } from "lucide-react";
import ExercisePanel from "@/components/panels/ExercisePanel";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCookie, setCookie } from "@/lib/client-cookies";
import { toast } from "sonner";

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
};

export default function ExercisesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [detailsExerciseId, setDetailsExerciseId] = React.useState<string | null>(
    null
  );

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

  const [page, setPage] = React.useState(1);
  const [sortConfig, setSortConfig] = React.useState<{
    key: keyof ExerciseRow;
    direction: "asc" | "desc";
  } | null>(null);

  React.useEffect(() => {
    setCookie("progrr_exercises_rows_per_page", String(pageSize), {
      maxAgeSeconds: 60 * 60 * 24 * 365,
    });
  }, [pageSize]);

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ["exerciseLibrary"],
    queryFn: () => db.entities.ExerciseLibrary.list("-created_date"),
  });

  const filtered = (exercises as ExerciseRow[]).filter((e) =>
    String(e?.name ?? "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const sorted = React.useMemo(() => {
    if (!sortConfig) return filtered;

    const collator = new Intl.Collator(["he", "en"], {
      sensitivity: "base",
      numeric: true,
    });

    return [...filtered].sort((a, b) => {
      const direction = sortConfig.direction === "asc" ? 1 : -1;
      const aRaw = (a as any)[sortConfig.key];
      const bRaw = (b as any)[sortConfig.key];

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
  }, [filtered, sortConfig]);

  const handleSort = (key: keyof ExerciseRow) => {
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
  const [catalogLoading, setCatalogLoading] = React.useState(false);
  const [catalogError, setCatalogError] = React.useState<string | null>(null);
  const [catalogResults, setCatalogResults] = React.useState<CatalogRow[]>([]);
  const [selectedCatalogIds, setSelectedCatalogIds] = React.useState<Set<string>>(
    () => new Set()
  );

  const runCatalogSearch = async () => {
    const q = String(catalogQuery ?? "").trim();
    if (!q) return;

    setCatalogError(null);
    setCatalogLoading(true);
    try {
      const res = await fetch(`/api/exercises/catalog/search?q=${encodeURIComponent(q)}`,
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
      // Reset search box after searching, keep results visible.
      setCatalogQuery("");
    } catch (err: any) {
      setCatalogError(err?.message || "Failed to search exercise catalog");
    } finally {
      setCatalogLoading(false);
    }
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
    return catalogResults.filter((r) => selectedCatalogIds.has(String(r.externalId)));
  }, [catalogResults, selectedCatalogIds]);

  const addSelectedFromCatalog = async () => {
    if (!selectedCatalogItems.length) return;

    setCatalogError(null);
    setCatalogLoading(true);
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
      setCatalogResults([]);
    } catch (err: any) {
      setCatalogError(err?.message || "Failed to import exercises");
    } finally {
      setCatalogLoading(false);
    }
  };

  React.useEffect(() => {
    setPage(1);
  }, [search, sortConfig?.key, sortConfig?.direction, pageSize]);

  const paginate = React.useCallback(
    (rows: ExerciseRow[], currentPage: number) => {
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
    () => paginate(sorted, page),
    [paginate, sorted, page]
  );

  const selectedExercise =
    (detailsExerciseId &&
      (exercises as ExerciseRow[]).find(
        (e) => String((e as any)?.id) === String(detailsExerciseId)
      )) ||
    null;

  return (
    <div className="p-8 bg-[#F5F6F8] dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Exercises
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create reusable exercises with videos and guidelines
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
            {catalogOpen ? "Close Catalog" : "Add from Exercise Catalog"}
          </Button>

          <Button
            type="button"
            onClick={handleCreate}
            className="min-w-[120px] bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="w-5 h-5 mr-2" />
            Exercise
          </Button>
        </div>
      </div>

      {catalogOpen ? (
        <div className="mb-6 rounded-lg border bg-white dark:bg-gray-800 p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="text-sm font-medium">Exercise Catalog (ExerciseDB)</div>
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
                disabled={catalogLoading}
              >
                {catalogLoading ? "Searching..." : "Search"}
              </Button>
              <Button
                type="button"
                onClick={addSelectedFromCatalog}
                disabled={catalogLoading || selectedCatalogItems.length === 0}
              >
                Add selected
                {selectedCatalogItems.length ? ` (${selectedCatalogItems.length})` : ""}
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
                            return new Set(catalogResults.map((r) => String(r.externalId)));
                          });
                        }}
                        disabled={catalogResults.length === 0}
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Exercise</th>
                    <th className="px-4 py-3 text-left font-medium">Target</th>
                    <th className="px-4 py-3 text-left font-medium">Body Part</th>
                    <th className="px-4 py-3 text-left font-medium">Equipment</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogResults.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-sm text-gray-500" colSpan={5}>
                        Search to see ExerciseDB results.
                      </td>
                    </tr>
                  ) : (
                    catalogResults.map((r) => {
                      const id = String(r.externalId);
                      const checked = selectedCatalogIds.has(id);
                      return (
                        <tr
                          key={id}
                          className="border-t hover:bg-gray-50 dark:hover:bg-gray-700/40"
                        >
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => toggleCatalogId(id, Boolean(v))}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{String(r.name ?? "-")}</div>
                            <div className="text-xs text-gray-500">ID: {id}</div>
                          </td>
                          <td className="px-4 py-3">{String(r.targetMuscle ?? "-")}</td>
                          <td className="px-4 py-3">{String(r.bodyPart ?? "-")}</td>
                          <td className="px-4 py-3">{String(r.equipment ?? "-")}</td>
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

      <div className="mb-6 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exercises"
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
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          Loading exercises...
        </div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Dumbbell className="w-12 h-12 text-indigo-500 dark:text-indigo-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {search
                ? "No exercises found"
                : "No exercises yet. Create your first one!"}
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
                      Exercise
                      <ArrowUpDown className="w-4 h-4" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort("targetMuscle")}
                  >
                    <div className="flex items-center gap-2">
                      Target
                      <ArrowUpDown className="w-4 h-4" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort("bodyPart")}
                  >
                    <div className="flex items-center gap-2">
                      Body Part
                      <ArrowUpDown className="w-4 h-4" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort("equipment")}
                  >
                    <div className="flex items-center gap-2">
                      Equipment
                      <ArrowUpDown className="w-4 h-4" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Media</th>
                </tr>
              </thead>
              <tbody>
                {paging.pagedRows.map((e) => {
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
                  const targetMuscle = String(e?.targetMuscle ?? "").trim();
                  const bodyPart = String(e?.bodyPart ?? "").trim();
                  const equipment = String(e?.equipment ?? "").trim();

                  return (
                    <tr
                      key={String(e.id)}
                      className="border-t hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer transition-colors"
                      onClick={() => handleOpenDetails(e)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium">{String(e.name ?? "-")}</span>
                      </td>
                      <td className="px-4 py-3">{targetMuscle || "-"}</td>
                      <td className="px-4 py-3">{bodyPart || "-"}</td>
                      <td className="px-4 py-3">{equipment || "-"}</td>
                      <td className="px-4 py-3">
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
                      </td>
                    </tr>
                  );
                })}
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
                onClick={() => setPage((p) => Math.min(paging.totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      <ExercisePanel
        exercise={selectedExercise}
        open={detailsOpen}
        onOpenChange={handleCloseDetails}
        onExerciseUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ["exerciseLibrary"] });
        }}
      />
    </div>
  );
}
