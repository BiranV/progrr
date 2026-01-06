"use client";

import React from "react";
import { db } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";
import SidePanel from "@/components/ui/side-panel";
import { Button } from "@/components/ui/button";
import { Copy as CopyIcon, FileDown, FileText } from "lucide-react";
import {
  copyTextToClipboard,
  downloadPdfFile,
  downloadTextFile,
  formatWorkoutPlanText,
} from "@/lib/plan-export";
import { toast } from "sonner";
import { WorkoutPlan, Exercise, PlanExercise } from "@/types";
import { extractYouTubeVideoId, toYouTubeEmbedUrl } from "@/lib/youtube";

interface WorkoutPlanDetailsDialogProps {
  plan: WorkoutPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WorkoutPlanDetailsDialog({
  plan,
  open,
  onOpenChange,
}: WorkoutPlanDetailsDialogProps) {
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

  const formatRest = (restSeconds: any) => {
    const raw = Number(restSeconds);
    if (!Number.isFinite(raw)) return "";
    const seconds = Math.max(0, Math.floor(raw));
    if (!seconds) return "";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m && s) return `${m}m ${s}s`;
    if (m) return `${m}m`;
    return `${s}s`;
  };

  const { data: exercises = [] } = useQuery({
    queryKey: ["workoutPlanExercises", plan?.id, "details"],
    queryFn: async () => {
      if (!plan?.id) return [];

      const planExerciseRows = await db.entities.PlanExercise.filter({
        workoutPlanId: plan.id,
      });

      const sortedPlanExercises = [...planExerciseRows].sort(
        (a: PlanExercise, b: PlanExercise) => (a.order || 0) - (b.order || 0)
      );

      if (sortedPlanExercises.length) {
        const ids = Array.from(
          new Set(
            sortedPlanExercises
              .map((r: any) => String(r.exerciseLibraryId ?? "").trim())
              .filter(Boolean)
          )
        );

        const libs = await Promise.all(
          ids.map(async (id) => {
            try {
              return await db.entities.ExerciseLibrary.get(id);
            } catch {
              return null;
            }
          })
        );
        const libById = new Map(
          libs.filter(Boolean).map((l: any) => [String(l.id), l])
        );

        return sortedPlanExercises.map((row: any) => {
          const lib = libById.get(String(row.exerciseLibraryId ?? "").trim());
          return {
            id: row.id,
            name: lib?.name ?? "-",
            guidelines: lib?.guidelines ?? "",
            videoKind: lib?.videoKind ?? null,
            videoUrl: lib?.videoUrl ?? null,
            sets: row?.sets,
            reps: row?.reps,
            restSeconds: row?.restSeconds,
          };
        });
      }

      // Legacy fallback
      const rows = await db.entities.Exercise.filter({
        workoutPlanId: plan.id,
      });
      return [...rows].sort(
        (a: Exercise, b: Exercise) => (a.order || 0) - (b.order || 0)
      );
    },
    enabled: !!plan && open,
  });

  const exportText = React.useMemo(() => {
    if (!plan) return "";
    return formatWorkoutPlanText(plan, exercises as any);
  }, [plan, exercises]);

  const exportFilenameBase = React.useMemo(() => {
    const name = String(plan?.name ?? "").trim();
    const id = String((plan as any)?.id ?? "").trim();
    return `workout-plan-${name || id || "plan"}`;
  }, [plan]);

  const handleCopy = async () => {
    if (!plan) return;
    try {
      await copyTextToClipboard(exportText);
      toast.success("Copied to clipboard");
    } catch (err) {
      console.error("Failed to copy workout plan", err);
      toast.error("Failed to copy");
    }
  };

  const handleDownloadText = () => {
    if (!plan) return;
    try {
      downloadTextFile(exportFilenameBase, exportText);
    } catch (err) {
      console.error("Failed to download workout plan text", err);
      toast.error("Failed to download text");
    }
  };

  const handleDownloadPdf = () => {
    if (!plan) return;
    try {
      downloadPdfFile(
        exportFilenameBase,
        String(plan.name ?? "Workout Plan").trim() || "Workout Plan",
        exportText
      );
    } catch (err) {
      console.error("Failed to download workout plan PDF", err);
      toast.error("Failed to download PDF");
    }
  };

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Workout Plan Details"
      description={plan ? String(plan?.name ?? "").trim() : undefined}
      widthClassName="w-full sm:w-[560px] lg:w-[720px]"
    >
      {!plan ? (
        <div className="text-sm text-gray-600 dark:text-gray-300">
          No plan selected
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="text-xl font-semibold text-gray-900 dark:text-white truncate">
                {plan.name}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {plan.difficulty ? (
                  <span className="capitalize">
                    {String(plan.difficulty).replace(/[_-]/g, " ")}
                  </span>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">
                    Difficulty: -
                  </span>
                )}
                {plan.duration ? (
                  <span> · {formatDurationWeeks(plan.duration)}</span>
                ) : null}
                {plan.goal ? <span> · {plan.goal}</span> : null}
              </div>
            </div>

            <div className="shrink-0 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-rose-600 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200"
                title="Download PDF"
                aria-label="Download PDF"
                onClick={handleDownloadPdf}
              >
                <FileDown className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                title="Download Text"
                aria-label="Download Text"
                onClick={handleDownloadText}
              >
                <FileText className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-green-600 hover:text-green-700 dark:text-green-300 dark:hover:text-green-200"
                title="Copy to clipboard"
                aria-label="Copy to clipboard"
                onClick={handleCopy}
              >
                <CopyIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {plan.notes ? (
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                Notes
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                {plan.notes}
              </div>
            </div>
          ) : null}

          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Exercises
            </div>
            {exercises.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                No exercises
              </div>
            ) : (
              <div className="space-y-2">
                {exercises.map((e: any, idx: number) => {
                  const restText = formatRest(e.restSeconds);
                  return (
                    <div
                      key={e.id || idx}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2"
                    >
                      <div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">
                            {e.name || "-"}
                          </div>

                          {String(e.guidelines ?? "").trim() ? (
                            <div className="mt-1 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                              {String(e.guidelines)}
                            </div>
                          ) : null}

                          {String(e.sets ?? "").trim() ||
                          String(e.reps ?? "").trim() ||
                          restText ? (
                            <div className="mt-2 text-sm text-gray-700 dark:text-gray-200 leading-5">
                              {String(e.sets ?? "").trim() ? (
                                <div>{String(e.sets).trim()} Sets</div>
                              ) : null}
                              {String(e.reps ?? "").trim() ? (
                                <div>{String(e.reps).trim()} Reps</div>
                              ) : null}
                              {restText ? <div>{restText} Rest</div> : null}
                            </div>
                          ) : null}

                          {String(e.videoKind ?? "") === "youtube" &&
                          String(e.videoUrl ?? "").trim() ? (
                            (() => {
                              const embed = toYouTubeEmbedUrl(
                                String(e.videoUrl ?? "")
                              );
                              if (!embed) return null;

                              const id = extractYouTubeVideoId(
                                String(e.videoUrl ?? "")
                              );
                              const watchUrl = id
                                ? `https://www.youtube.com/watch?v=${id}`
                                : null;

                              return (
                                <div className="mt-2">
                                  <div
                                    className="relative w-full overflow-hidden rounded-lg bg-black"
                                    style={{ paddingTop: "56.25%" }}
                                  >
                                    {watchUrl ? (
                                      <a
                                        href={watchUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="absolute inset-0 z-10 cursor-pointer"
                                        title="Open video"
                                        aria-label="Open video"
                                      />
                                    ) : null}
                                    <iframe
                                      src={embed}
                                      title="Exercise video"
                                      className="absolute inset-0 h-full w-full"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                    />
                                  </div>
                                </div>
                              );
                            })()
                          ) : String(e.videoKind ?? "") === "upload" &&
                            String(e.videoUrl ?? "").trim() ? (
                            <div className="mt-2">
                              <div
                                className="relative w-full overflow-hidden rounded-lg bg-black"
                                style={{ paddingTop: "56.25%" }}
                              >
                                <video
                                  className="absolute inset-0 h-full w-full object-contain"
                                  controls
                                  preload="metadata"
                                  src={String(e.videoUrl ?? "").trim()}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </SidePanel>
  );
}
