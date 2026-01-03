"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Dumbbell,
  FileText,
  Video,
} from "lucide-react";
import ExerciseLibraryDialog from "@/components/ExerciseLibraryDialog";
import ExerciseLibraryDetailsDialog from "@/components/ExerciseLibraryDetailsDialog";
import { toast } from "sonner";

export default function ExercisesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingExercise, setEditingExercise] = React.useState<any | null>(
    null
  );

  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [detailsExercise, setDetailsExercise] = React.useState<any | null>(
    null
  );

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

  const handleDetails = (exercise: any) => {
    setDetailsExercise(exercise);
    setDetailsOpen(true);
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
          {filtered.map((e: any) =>
            (() => {
              const videoKind = String(e?.videoKind ?? "").trim();
              const videoUrl = String(e?.videoUrl ?? "").trim();
              const hasVideo =
                !!videoKind &&
                (videoKind !== "youtube" || !!videoUrl) &&
                (videoKind !== "upload" || !!videoUrl);
              const hasGuidelines = !!String(e?.guidelines ?? "").trim();

              const subtitle =
                hasVideo && hasGuidelines
                  ? "Video & guidelines"
                  : hasVideo
                  ? "Video"
                  : hasGuidelines
                  ? "Guidelines"
                  : "";

              const videoLabel =
                videoKind === "youtube"
                  ? "YouTube"
                  : videoKind === "upload"
                  ? "Upload"
                  : videoKind || "";

              return (
                <Card
                  key={e.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleDetails(e)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      handleDetails(e);
                    }
                  }}
                  className="hover:shadow-lg cursor-pointer transition-shadow duration-200 flex flex-col h-full dark:bg-gray-800 dark:border-gray-700"
                >
                  <CardHeader className="flex flex-row items-start justify-between pb-2">
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-xl font-semibold truncate">
                        {e.name || "-"}
                      </CardTitle>
                      {subtitle ? (
                        <CardDescription className="text-xs text-gray-500 dark:text-gray-400">
                          {subtitle}
                        </CardDescription>
                      ) : null}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          handleEdit(e);
                        }}
                        className="p-2 text-gray-600 dark:text-gray-400
                        hover:text-indigo-600
                        hover:bg-indigo-50 dark:hover:bg-indigo-900
                        rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          handleDelete(e.id);
                        }}
                        className="p-2 text-gray-600 dark:text-gray-400
                        hover:text-red-600
                        hover:bg-red-50 dark:hover:bg-red-900
                        rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </CardHeader>

                  <CardContent className="px-5 py-2">
                    {hasVideo || hasGuidelines ? (
                      <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                        <div className="grid grid-cols-2 gap-4">
                          {hasVideo ? (
                            <div className="flex items-center gap-2">
                              <Video className="w-4 h-4" />
                              <span>Video: {videoLabel || "-"}</span>
                            </div>
                          ) : null}
                          {hasGuidelines ? (
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              <span>Guidelines</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })()
          )}
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

      <ExerciseLibraryDetailsDialog
        exercise={detailsExercise}
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setDetailsExercise(null);
        }}
      />
    </div>
  );
}
