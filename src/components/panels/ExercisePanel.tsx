"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import SidePanel from "@/components/ui/side-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Copy as CopyIcon,
  Edit2,
  FileDown,
  FileText,
  Loader2,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { extractYouTubeVideoId, toYouTubeEmbedUrl } from "@/lib/youtube";
import {
  copyTextToClipboard,
  downloadPdfFile,
  downloadTextFile,
} from "@/lib/plan-export";

type VideoKind = "upload" | "youtube" | null;

interface ExercisePanelProps {
  exercise: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExerciseUpdate?: () => void;
}

export default function ExercisePanel({
  exercise,
  open,
  onOpenChange,
  onExerciseUpdate,
}: ExercisePanelProps) {
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(
    null
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [showRemoveVideoConfirm, setShowRemoveVideoConfirm] =
    React.useState(false);

  const exportText = React.useMemo(() => {
    if (!exercise) return "";

    const name = String(exercise?.name ?? "").trim() || "-";
    const guidelines = String(exercise?.guidelines ?? "").trim();
    const videoKind = String(exercise?.videoKind ?? "").trim();
    const videoUrl = String(exercise?.videoUrl ?? "").trim();

    const lines: string[] = [];
    lines.push(`Exercise: ${name}`);
    if (videoKind || videoUrl) {
      lines.push(`Video: ${videoKind || "-"}${videoUrl ? ` (${videoUrl})` : ""}`);
    }
    if (guidelines) {
      lines.push("");
      lines.push("Guidelines:");
      lines.push(guidelines);
    }
    return lines.join("\n");
  }, [exercise]);

  const exportFilenameBase = React.useMemo(() => {
    const name = String(exercise?.name ?? "").trim();
    const id = String(exercise?.id ?? "").trim();
    return `exercise-${name || id || "item"}`;
  }, [exercise]);

  const handleCopy = async () => {
    if (!exercise) return;
    try {
      await copyTextToClipboard(exportText);
      toast.success("Copied to clipboard");
    } catch (err) {
      console.error("Failed to copy exercise", err);
      toast.error("Failed to copy");
    }
  };

  const handleDownloadText = () => {
    if (!exercise) return;
    try {
      downloadTextFile(exportFilenameBase, exportText);
    } catch (err) {
      console.error("Failed to download exercise text", err);
      toast.error("Failed to download text");
    }
  };

  const handleDownloadPdf = () => {
    if (!exercise) return;
    try {
      const title = String(exercise?.name ?? "Exercise").trim() || "Exercise";
      downloadPdfFile(exportFilenameBase, `Exercise: ${title}`, exportText);
    } catch (err) {
      console.error("Failed to download exercise PDF", err);
      toast.error("Failed to download PDF");
    }
  };

  const [formData, setFormData] = React.useState<any>({});

  const resetForm = (current: any | null) => {
    setValidationError(null);
    if (current) {
      setFormData({
        name: String(current?.name ?? ""),
        guidelines: String(current?.guidelines ?? ""),
        youtubeUrl:
          String(current?.videoKind ?? "") === "youtube"
            ? String(current?.videoUrl ?? "")
            : "",
        uploadFile: null as File | null,
      });
    } else {
      setFormData({
        name: "",
        guidelines: "",
        youtubeUrl: "",
        uploadFile: null as File | null,
      });
    }
  };

  React.useEffect(() => {
    if (!open) return;
    setShowDeleteConfirm(false);
    setShowRemoveVideoConfirm(false);

    if (!exercise) {
      setIsEditing(true);
      resetForm(null);
      return;
    }

    setIsEditing(false);
    resetForm(exercise);
  }, [open, exercise]);

  const uploadVideo = async (exerciseId: string, file: File) => {
    const form = new FormData();
    form.set("video", file);

    const res = await fetch(`/api/admin/exercise-library/${exerciseId}/video`, {
      method: "POST",
      credentials: "include",
      body: form,
    });

    if (!res.ok) {
      let msg = `Upload failed (${res.status})`;
      try {
        const body = await res.json();
        if (body?.error) msg = body.error;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    return (await res.json()) as { videoKind: VideoKind; videoUrl: string };
  };

  const removeVideo = async (exerciseId: string) => {
    const res = await fetch(`/api/admin/exercise-library/${exerciseId}/video`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleteFile: true }),
    });

    if (!res.ok) {
      let msg = `Remove failed (${res.status})`;
      try {
        const body = await res.json();
        if (body?.error) msg = body.error;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const name = String(formData.name ?? "").trim();
      if (!name) throw new Error("Exercise name is required");

      const payload: any = {
        name,
        guidelines: String(formData.guidelines ?? "").trim() || "",
      };

      const yt = String(formData.youtubeUrl ?? "").trim();
      if (yt) {
        payload.videoKind = "youtube";
        payload.videoUrl = yt;
      } else if (exercise?.id && String(exercise?.videoKind ?? "") === "youtube") {
        payload.videoKind = null;
        payload.videoUrl = null;
      } else if (!formData.uploadFile) {
        if (!exercise) {
          payload.videoKind = null;
          payload.videoUrl = null;
        }
      }

      let saved: any;
      if (exercise?.id) {
        saved = await db.entities.ExerciseLibrary.update(exercise.id, payload);
      } else {
        saved = await db.entities.ExerciseLibrary.create(payload);
      }

      const id = String(saved?.id ?? exercise?.id ?? "").trim();
      if (!id) return;

      const uploadFile = formData.uploadFile as File | null;
      if (uploadFile) {
        const r = await uploadVideo(id, uploadFile);
        await db.entities.ExerciseLibrary.update(id, {
          videoKind: "upload",
          videoUrl: r.videoUrl,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exerciseLibrary"] });
      onExerciseUpdate?.();
      toast.success(exercise ? "Exercise updated" : "Exercise created");
      if (!exercise) {
        onOpenChange(false);
      } else {
        setIsEditing(false);
      }
    },
    onError: (err: any) => {
      setValidationError(String(err?.message ?? "Failed to save"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!exercise?.id) return;
      const id = String(exercise.id);

      try {
        await removeVideo(id);
      } catch {
        // ignore best-effort
      }

      await db.entities.ExerciseLibrary.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exerciseLibrary"] });
      onExerciseUpdate?.();
      toast.success("Exercise deleted");
      setShowDeleteConfirm(false);
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(String(err?.message ?? "Failed to delete"));
    },
  });

  const removeVideoMutation = useMutation({
    mutationFn: async () => {
      if (!exercise?.id) {
        setFormData((prev: any) => ({ ...prev, youtubeUrl: "", uploadFile: null }));
        return;
      }

      const id = String(exercise.id);
      await removeVideo(id);
      await db.entities.ExerciseLibrary.update(id, {
        videoKind: null,
        videoUrl: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exerciseLibrary"] });
      onExerciseUpdate?.();
      setShowRemoveVideoConfirm(false);
      setFormData((prev: any) => ({ ...prev, youtubeUrl: "", uploadFile: null }));
      toast.success("Video removed");
    },
    onError: (err: any) => {
      toast.error(String(err?.message ?? "Failed to remove video"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    saveMutation.mutate();
  };

  const renderViewMode = () => {
    const name = String(exercise?.name ?? "-");
    const guidelines = String(exercise?.guidelines ?? "").trim();
    const videoKind = String(exercise?.videoKind ?? "").trim();
    const videoUrl = String(exercise?.videoUrl ?? "").trim();

    const youtubeEmbedUrl =
      videoKind === "youtube" && videoUrl ? toYouTubeEmbedUrl(videoUrl) : "";

    const youtubeWatchUrl = (() => {
      if (videoKind !== "youtube" || !videoUrl) return "";
      const id = extractYouTubeVideoId(videoUrl);
      return id ? `https://www.youtube.com/watch?v=${id}` : "";
    })();

    const hasVideo =
      !!videoKind &&
      (videoKind !== "youtube" || !!videoUrl) &&
      (videoKind !== "upload" || !!videoUrl);

    const videoLabel =
      videoKind === "youtube" ? "YouTube" : videoKind === "upload" ? "Upload" : "-";

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xl font-semibold text-gray-900 dark:text-white truncate">
              {name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Exercise library
            </div>
          </div>

          <div className="shrink-0 flex flex-wrap gap-2 items-center">
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
              className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-200"
              title="Copy to clipboard"
              aria-label="Copy to clipboard"
              onClick={handleCopy}
            >
              <CopyIcon className="w-4 h-4" />
            </Button>

            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <Video className="w-4 h-4" />
              <span>Video</span>
            </div>
            <div className="mt-1 font-medium text-gray-900 dark:text-white">
              {hasVideo ? videoLabel : "-"}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <FileText className="w-4 h-4" />
              <span>Guidelines</span>
            </div>
            <div className="mt-1 font-medium text-gray-900 dark:text-white">
              {guidelines ? "Available" : "-"}
            </div>
          </div>
        </div>

        {youtubeEmbedUrl ? (
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Video
            </div>
            <div
              className="relative w-full overflow-hidden rounded-lg bg-black"
              style={{ paddingTop: "56.25%" }}
            >
              {youtubeWatchUrl ? (
                <a
                  href={youtubeWatchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 z-10 cursor-pointer"
                  title="Open video"
                  aria-label="Open video"
                />
              ) : null}
              <iframe
                src={youtubeEmbedUrl}
                title="Exercise video"
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        ) : videoKind === "upload" && videoUrl ? (
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Video
            </div>
            <div
              className="relative w-full overflow-hidden rounded-lg bg-black"
              style={{ paddingTop: "56.25%" }}
            >
              <video
                className="absolute inset-0 h-full w-full object-contain"
                controls
                preload="metadata"
                src={videoUrl}
              />
            </div>
          </div>
        ) : null}

        {guidelines ? (
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
              Guidelines
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
              {guidelines}
            </div>
          </div>
        ) : null}

        <div className="pt-2">
          {!showDeleteConfirm ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={!exercise?.id}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Exercise
            </Button>
          ) : (
            <div className="p-4 border border-red-200 bg-red-50 dark:bg-red-900/10 rounded-lg space-y-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-red-900 dark:text-red-100">
                  Delete exercise?
                </div>
                <div className="text-xs text-red-800 dark:text-red-200 leading-relaxed font-medium">
                  This will remove <strong>{String(exercise?.name ?? "this exercise")}</strong> from the
                  library. This cannot be undone.
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  type="button"
                  disabled={!exercise?.id || deleteMutation.isPending}
                  onClick={async () => await deleteMutation.mutateAsync()}
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEditMode = () => {
    const currentVideoKind = String(exercise?.videoKind ?? "").trim();
    const currentVideoUrl = String(exercise?.videoUrl ?? "").trim();
    const hasVideo =
      !!currentVideoKind &&
      (currentVideoKind !== "youtube" || !!currentVideoUrl) &&
      (currentVideoKind !== "upload" || !!currentVideoUrl);

    const hasPendingVideo =
      hasVideo ||
      !!String(formData.youtubeUrl ?? "").trim() ||
      !!(formData.uploadFile as File | null);

    return (
      <form id="exercise-form" className="space-y-6" onSubmit={handleSubmit}>
        {validationError ? (
          <div className="text-sm text-red-600 dark:text-red-400">
            {validationError}
          </div>
        ) : null}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Exercise Name *
          </label>
          <Input
            value={String(formData.name ?? "")}
            onChange={(e) => {
              if (validationError) setValidationError(null);
              setFormData((prev: any) => ({ ...prev, name: e.target.value }));
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Guidelines (how to do it well)
          </label>
          <Textarea
            value={String(formData.guidelines ?? "")}
            onChange={(e) => {
              if (validationError) setValidationError(null);
              setFormData((prev: any) => ({ ...prev, guidelines: e.target.value }));
            }}
            rows={5}
            placeholder="Write coaching cues, form tips, common mistakes, tempo, etc."
          />
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Tip: keep it short and actionable (setup → execution → mistakes).
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">
            Video
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Add a YouTube link or upload a file.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
            <Input
              value={String(formData.youtubeUrl ?? "")}
              onChange={(e) => {
                if (validationError) setValidationError(null);
                setFormData((prev: any) => ({ ...prev, youtubeUrl: e.target.value }));
              }}
              placeholder="YouTube URL (optional)"
              className="sm:col-span-2"
            />
            <div className="flex items-center sm:justify-end gap-2">
              <Input
                className="w-full text-gray-900 dark:text-gray-100 file:text-gray-900 dark:file:text-gray-100 file:mr-3 file:rounded-md file:px-3 file:hover:opacity-90"
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const input = e.target as HTMLInputElement;
                  const file = input.files?.[0] ?? null;
                  input.value = "";
                  setFormData((prev: any) => ({ ...prev, uploadFile: file }));
                }}
              />
            </div>
          </div>

          {hasPendingVideo ? (
            <div className="flex justify-end">
              {!showRemoveVideoConfirm ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRemoveVideoConfirm(true)}
                  disabled={removeVideoMutation.isPending}
                >
                  Remove Video
                </Button>
              ) : (
                <div className="p-3 border border-orange-200 bg-orange-50 dark:bg-orange-900/10 rounded-lg space-y-2 w-full">
                  <div className="text-xs text-orange-800 dark:text-orange-200">
                    Remove the video from this exercise?
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={removeVideoMutation.isPending}
                      onClick={() => setShowRemoveVideoConfirm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={removeVideoMutation.isPending}
                      onClick={async () => await removeVideoMutation.mutateAsync()}
                    >
                      {removeVideoMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Removing...
                        </>
                      ) : (
                        "Remove"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="h-2" />
      </form>
    );
  };

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? (exercise ? "Edit Exercise" : "New Exercise") : "Exercise Details"}
      description={
        isEditing
          ? exercise
            ? "Update exercise"
            : "Add a new exercise to your library"
          : `View details for ${String(exercise?.name ?? "Exercise")}`
      }
      widthClassName="w-full sm:w-[520px] lg:w-[720px]"
      footer={
        isEditing ? (
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              type="button"
              onClick={() => (exercise ? setIsEditing(false) : onOpenChange(false))}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" form="exercise-form" disabled={saveMutation.isPending}>
              {saveMutation.isPending
                ? "Saving..."
                : exercise
                  ? "Save Changes"
                  : "Create Exercise"}
            </Button>
          </div>
        ) : (
          <div className="flex justify-start" />
        )
      }
    >
      {!exercise && !isEditing ? (
        <div className="text-sm text-gray-600 dark:text-gray-300">
          No exercise selected
        </div>
      ) : isEditing ? (
        renderEditMode()
      ) : (
        renderViewMode()
      )}
    </SidePanel>
  );
}
