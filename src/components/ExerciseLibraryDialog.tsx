"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import SidePanel from "@/components/ui/side-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import ConfirmModal from "@/components/ui/confirm-modal";

type VideoKind = "upload" | "youtube" | null;

interface ExerciseLibraryDialogProps {
  exercise: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ExerciseLibraryDialog({
  exercise,
  open,
  onOpenChange,
}: ExerciseLibraryDialogProps) {
  const queryClient = useQueryClient();

  const [name, setName] = React.useState("");
  const [guidelines, setGuidelines] = React.useState("");
  const [youtubeUrl, setYoutubeUrl] = React.useState("");
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [isRemovingVideo, setIsRemovingVideo] = React.useState(false);
  const [removeVideoConfirmOpen, setRemoveVideoConfirmOpen] =
    React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(String(exercise?.name ?? ""));
    setGuidelines(String(exercise?.guidelines ?? ""));
    setYoutubeUrl(
      String(exercise?.videoKind ?? "") === "youtube"
        ? String(exercise?.videoUrl ?? "")
        : ""
    );
    setUploadFile(null);
  }, [exercise, open]);

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
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Exercise name is required");

      const data: any = {
        name: trimmedName,
        guidelines: guidelines.trim() || "",
      };

      // If YouTube URL provided, store it on the entity.
      const yt = youtubeUrl.trim();
      if (yt) {
        data.videoKind = "youtube";
        data.videoUrl = yt;
      } else if (!uploadFile) {
        // Don't overwrite upload video unless explicitly removing.
        if (!exercise) {
          data.videoKind = null;
          data.videoUrl = null;
        }
      }

      let saved: any;
      if (exercise?.id) {
        saved = await db.entities.ExerciseLibrary.update(exercise.id, data);
      } else {
        saved = await db.entities.ExerciseLibrary.create(data);
      }

      const id = String(saved?.id ?? exercise?.id ?? "").trim();
      if (!id) return;

      if (uploadFile) {
        const r = await uploadVideo(id, uploadFile);
        await db.entities.ExerciseLibrary.update(id, {
          videoKind: "upload",
          videoUrl: r.videoUrl,
        });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["exerciseLibrary"] });
      onOpenChange(false);
      toast.success(exercise ? "Exercise updated" : "Exercise created");
    },
    onError: (err: any) => {
      toast.error(String(err?.message ?? "Failed to save"));
    },
  });

  const handleRemoveVideo = async () => {
    if (!exercise?.id) {
      setYoutubeUrl("");
      setUploadFile(null);
      return;
    }

    setIsRemovingVideo(true);
    try {
      await removeVideo(exercise.id);
      await db.entities.ExerciseLibrary.update(exercise.id, {
        videoKind: null,
        videoUrl: null,
      });
      await queryClient.invalidateQueries({ queryKey: ["exerciseLibrary"] });
      setYoutubeUrl("");
      setUploadFile(null);
      toast.success("Video removed");
    } catch (err: any) {
      toast.error(String(err?.message ?? "Failed to remove video"));
    } finally {
      setIsRemovingVideo(false);
    }
  };

  return (
    <>
      <SidePanel
        open={open}
        onOpenChange={onOpenChange}
        title={exercise ? "Edit Exercise" : "Create Exercise"}
        description={exercise ? String(exercise?.name ?? "").trim() : undefined}
        widthClassName="w-full sm:w-[520px] lg:w-[640px]"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="exercise-library-form"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending
                ? "Saving..."
                : exercise
                ? "Update Exercise"
                : "Create Exercise"}
            </Button>
          </div>
        }
      >
        <form
          id="exercise-library-form"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="space-y-6"
        >
          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Exercise Name *
              </label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Guidelines (how to do it well)
              </label>
              <Textarea
                value={guidelines}
                onChange={(e) => setGuidelines(e.target.value)}
                rows={5}
                placeholder="Write coaching cues, form tips, common mistakes, tempo, etc."
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Tip: keep it short and actionable (setup → execution →
                mistakes).
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              Video
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Add a YouTube link or upload a file. Recommended: landscape, good
              lighting, stable camera, clear full body view.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              <Input
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="YouTube URL (optional)"
                className="sm:col-span-2"
              />
              <div className="flex items-center sm:justify-end gap-2">
                <Input
                  className="w-full"
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const input = e.target as HTMLInputElement;
                    const file = input.files?.[0] ?? null;
                    input.value = "";
                    setUploadFile(file);
                  }}
                />
              </div>
            </div>

            {exercise?.videoUrl || youtubeUrl || uploadFile ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRemoveVideoConfirmOpen(true)}
                  disabled={isRemovingVideo}
                >
                  {isRemovingVideo ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Removing...
                    </>
                  ) : (
                    "Remove Video"
                  )}
                </Button>
              </div>
            ) : null}
          </div>
        </form>
      </SidePanel>

      <ConfirmModal
        open={removeVideoConfirmOpen}
        onOpenChange={setRemoveVideoConfirmOpen}
        title="Remove video?"
        description="This will remove the video from this exercise."
        confirmText="Remove"
        cancelText="Cancel"
        confirmVariant="destructive"
        loading={isRemovingVideo}
        onConfirm={handleRemoveVideo}
      />
    </>
  );
}
