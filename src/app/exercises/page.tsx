"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Dumbbell,
  FileDown,
  FileText,
  Copy,
  Video,
} from "lucide-react";
import ExerciseLibraryDialog from "@/components/ExerciseLibraryDialog";
import { toast } from "sonner";
import {
  copyTextToClipboard,
  downloadPdfFile,
  downloadTextFile,
} from "@/lib/plan-export";
import { extractYouTubeVideoId } from "@/lib/youtube";

export default function ExercisesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingExercise, setEditingExercise] = React.useState<any | null>(
    null
  );

  const formatExerciseExportText = (exercise: any) => {
    const lines: string[] = [];
    const name = String(exercise?.name ?? "").trim() || "-";
    lines.push(`Exercise: ${name}`);

    const guidelines = String(exercise?.guidelines ?? "").trim();
    if (guidelines) {
      lines.push("");
      lines.push("Guidelines:");
      lines.push(guidelines);
    }

    const videoKind = String(exercise?.videoKind ?? "").trim();
    const videoUrl = String(exercise?.videoUrl ?? "").trim();

    const youtubeWatchUrl = (() => {
      if (videoKind !== "youtube" || !videoUrl) return "";
      const id = extractYouTubeVideoId(videoUrl);
      return id ? `https://www.youtube.com/watch?v=${id}` : "";
    })();

    if (youtubeWatchUrl) {
      lines.push("");
      lines.push(`YouTube: ${youtubeWatchUrl}`);
    } else if (videoKind === "upload" && videoUrl) {
      lines.push("");
      lines.push(`Video: ${videoUrl}`);
    }

    return lines.join("\n");
  };

  const exportExercise = async (
    exercise: any,
    kind: "pdf" | "txt" | "copy"
  ) => {
    try {
      const name = String(exercise?.name ?? "").trim();
      const id = String(exercise?.id ?? "").trim();
      const filenameBase = `Exercise - ${name || id || "exercise"}`;
      const text = formatExerciseExportText(exercise);

      if (kind === "pdf") {
        downloadPdfFile(filenameBase, `Exercise: ${name || ""}`.trim(), text);
      } else if (kind === "txt") {
        downloadTextFile(filenameBase, text);
      } else {
        await copyTextToClipboard(text);
        toast.success("Copied to clipboard");
      }
    } catch (err: any) {
      toast.error(String(err?.message ?? "Failed to export"));
    }
  };

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ["exerciseLibrary"],
    queryFn: () => db.entities.ExerciseLibrary.list("-created_date"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Best-effort delete uploaded video file too
      try {
        await fetch(`/api/admin/exercise-library/${id}/video`, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deleteFile: true }),
        });
      } catch {
        // ignore
      }

      await db.entities.ExerciseLibrary.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exerciseLibrary"] });
    },
    onError: (err: any) => {
      toast.error(String(err?.message ?? "Failed to delete"));
    },
  });

  const filtered = (exercises as any[]).filter((e) =>
    String(e?.name ?? "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const handleEdit = (exercise: any) => {
    setEditingExercise(exercise);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingExercise(null);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this exercise from the library?")) {
      deleteMutation.mutate(id);
    }
  };

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

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exercises"
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          Loading exercises...
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Dumbbell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {search
                ? "No exercises found"
                : "No exercises yet. Create your first one!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((e: any) => (
            <Card
              key={e.id}
              className="h-[220px] hover:shadow-lg transition-shadow dark:bg-gray-800 dark:border-gray-700"
            >
              <CardContent className="px-5 flex flex-col h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold truncate">
                      {e.name || "-"}
                    </h3>
                    {String(e.videoKind ?? "").trim() ||
                    String(e.guidelines ?? "").trim() ? (
                      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {String(e.videoKind ?? "").trim() ? (
                          <div className="flex items-center gap-2 truncate">
                            <Video className="w-4 h-4 shrink-0" />
                            <span className="truncate">Video</span>
                          </div>
                        ) : null}

                        {String(e.guidelines ?? "").trim() ? (
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="w-4 h-4 shrink-0" />
                            <span className="truncate">Guideline</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(e)}
                      className="p-2 text-gray-600 dark:text-gray-400
                        hover:text-indigo-600
                        hover:bg-indigo-50 dark:hover:bg-indigo-900
                        rounded-lg"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(e.id)}
                      className="p-2 text-gray-600 dark:text-gray-400
                        hover:text-red-600
                        hover:bg-red-50 dark:hover:bg-red-900
                        rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex-1" />

                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end">
                  <div className="flex items-center justify-end gap-2 w-full">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-rose-600 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200"
                        title="Download PDF"
                        aria-label="Download PDF"
                        onClick={() => exportExercise(e, "pdf")}
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
                        onClick={() => exportExercise(e, "txt")}
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-200"
                        title="Copy to clipboard"
                        aria-label="Copy to clipboard"
                        onClick={() => exportExercise(e, "copy")}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>

                    <Button
                      size="sm"
                      className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-200 dark:hover:bg-indigo-900/45"
                      onClick={() => handleEdit(e)}
                    >
                      Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ExerciseLibraryDialog
        exercise={editingExercise}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingExercise(null);
        }}
      />
    </div>
  );
}
