"use client";

import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpDown, Dumbbell, Plus, Search } from "lucide-react";
import ExercisePanel from "@/components/panels/ExercisePanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCookie, setCookie } from "@/lib/client-cookies";

type ExerciseRow = {
  id: string;
  name?: string;
  guidelines?: string;
  videoKind?: string | null;
  videoUrl?: string | null;
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
        <Button
          onClick={handleCreate}
          className="min-w-[120px] bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Plus className="w-5 h-5 mr-2" />
          Exercise
        </Button>
      </div>

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
                    onClick={() => handleSort("videoKind")}
                  >
                    <div className="flex items-center gap-2">
                      Video
                      <ArrowUpDown className="w-4 h-4" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort("guidelines")}
                  >
                    <div className="flex items-center gap-2">
                      Guidelines
                      <ArrowUpDown className="w-4 h-4" />
                    </div>
                  </th>
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

                  return (
                    <tr
                      key={String(e.id)}
                      className="border-t hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer transition-colors"
                      onClick={() => handleOpenDetails(e)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium">{String(e.name ?? "-")}</span>
                      </td>
                      <td className="px-4 py-3">{hasVideo ? videoLabel : "-"}</td>
                      <td className="px-4 py-3">{hasGuidelines ? "Available" : "-"}</td>
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
