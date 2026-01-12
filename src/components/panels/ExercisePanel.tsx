"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EntityEditFooter } from "@/components/ui/entity/EntityEditFooter";
import { EntityDeleteConfirm } from "@/components/ui/entity/EntityDeleteConfirm";
import { EntityStatusChip } from "@/components/ui/entity/EntityStatusChip";
import { EntityInfoGrid } from "@/components/ui/entity/EntityInfoGrid";
import { ReadonlyInfoCard } from "@/components/ui/entity/ReadonlyInfoCard";
import { useEntityPanelState } from "@/components/ui/entity/useEntityPanelState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Copy as CopyIcon,
  Edit2,
  FileDown,
  FileText,
  Loader2,
  Lock,
  RotateCcw,
  Trash2,
  Video,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { extractYouTubeVideoId, toYouTubeEmbedUrl } from "@/lib/youtube";
import {
  copyTextToClipboard,
  downloadPdfFile,
  downloadTextFile,
} from "@/lib/plan-export";
import {
  useGenericDetailsPanel,
} from "@/components/ui/entity/GenericDetailsPanel";
import { usePlanGuards } from "@/hooks/use-plan-guards";
import { featureAvailableOnPlanOrAboveMessage } from "@/config/plans";

type VideoKind = "upload" | "youtube" | null;

export function ExerciseDetailsContent({
  exercise,
  onExerciseUpdate,
  createNew,
}: {
  exercise: any | null;
  onExerciseUpdate?: () => void;
  createNew?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);

  const panel = useGenericDetailsPanel();
  const open = panel.open;

  const panelState = useEntityPanelState();

  const { data: planGuards } = usePlanGuards(true);
  const canUploadCustomVideo =
    planGuards?.guards?.canUploadCustomVideo?.allowed ?? true;
  const customVideoReason =
    planGuards?.guards?.canUploadCustomVideo?.reason ||
    featureAvailableOnPlanOrAboveMessage({
      feature: "Custom video uploads",
      requiredPlan: "Professional",
    });

  const exerciseId = String(exercise?.id ?? "").trim();

  const [validationError, setValidationError] = React.useState<string | null>(
    null
  );
  const [deleteInfoMessage, setDeleteInfoMessage] = React.useState<string | null>(
    null
  );
  const [showRemoveVideoConfirm, setShowRemoveVideoConfirm] =
    React.useState(false);

  const exportText = React.useMemo(() => {
    if (!exercise) return "";

    const lines: string[] = [];

    const name = String(exercise?.name ?? "").trim() || "-";
    lines.push("Exercise");
    lines.push(`Name: ${name}`);

    const guidelines = String(exercise?.guidelines ?? "").trim();
    if (guidelines) {
      lines.push("");
      lines.push("Guidelines");
      lines.push(guidelines);
    }

    const infoLines: string[] = [];
    const bodyPart = String(exercise?.bodyPart ?? "").trim();
    if (bodyPart) infoLines.push(`Body part: ${bodyPart}`);
    const targetMuscle = String(exercise?.targetMuscle ?? "").trim();
    if (targetMuscle) infoLines.push(`Target: ${targetMuscle}`);
    const equipment = String(exercise?.equipment ?? "").trim();
    if (equipment) infoLines.push(`Equipment: ${equipment}`);
    const gifUrl = String(exercise?.gifUrl ?? "").trim();
    if (gifUrl) infoLines.push(`GIF URL: ${gifUrl}`);
    const source = String(exercise?.source ?? "").trim();
    if (source) infoLines.push(`Source: ${source}`);
    const externalId = String(exercise?.externalId ?? "").trim();
    if (externalId) infoLines.push(`External ID: ${externalId}`);

    const videoKind = String(exercise?.videoKind ?? "").trim();
    const videoUrl = String(exercise?.videoUrl ?? "").trim();
    if (videoKind) infoLines.push(`Video kind: ${videoKind}`);
    if (videoUrl) infoLines.push(`Video URL: ${videoUrl}`);

    if (infoLines.length) {
      lines.push("");
      lines.push("Info");
      lines.push(...infoLines);
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

  const [metadataLoading, setMetadataLoading] = React.useState(false);
  const [metadataError, setMetadataError] = React.useState<string | null>(null);
  const [metadata, setMetadata] = React.useState<{
    bodyParts: string[];
    targets: string[];
    equipment: string[];
  } | null>(null);

  const resetForm = (current: any | null) => {
    setValidationError(null);
    if (current) {
      setFormData({
        name: String(current?.name ?? ""),
        guidelines: String(current?.guidelines ?? ""),
        bodyPart: String(current?.bodyPart ?? ""),
        targetMuscle: String(current?.targetMuscle ?? ""),
        equipment: String(current?.equipment ?? ""),
        gifUrl: String(current?.gifUrl ?? ""),
        source: String(current?.source ?? ""),
        externalId: String(current?.externalId ?? ""),
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
        bodyPart: "",
        targetMuscle: "",
        equipment: "",
        gifUrl: "",
        source: "MANUAL",
        externalId: "",
        youtubeUrl: "",
        uploadFile: null as File | null,
      });
    }
  };

  React.useEffect(() => {
    if (!open) return;
    panelState.cancelDelete();
    setShowRemoveVideoConfirm(false);
    setDeleteInfoMessage(null);

    if (!exercise || createNew) {
      panelState.startEdit();
      resetForm(null);
      return;
    }

    panelState.cancelEdit();
    resetForm(exercise);
  }, [
    open,
    exerciseId,
    createNew,
    panelState.cancelDelete,
    panelState.startEdit,
    panelState.cancelEdit,
  ]);

  const unarchiveMutation = useMutation({
    mutationFn: async () => {
      const id = String(exercise?.id ?? "").trim();
      if (!id) return null;
      return db.entities.ExerciseLibrary.update(id, { status: "ACTIVE" } as any);
    },
    onSuccess: () => {
      setDeleteInfoMessage(null);
      queryClient.invalidateQueries({ queryKey: ["exerciseLibrary"] });
      onExerciseUpdate?.();
      toast.success("Exercise restored to active");
    },
    onError: (err: any) => {
      toast.error(String(err?.message ?? "Failed to restore"));
    },
  });

  React.useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const load = async () => {
      setMetadataError(null);
      setMetadataLoading(true);
      try {
        const res = await fetch("/api/exercises/catalog/metadata", {
          method: "GET",
          credentials: "include",
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload?.error || `Request failed (${res.status})`);
        }

        const bodyParts = Array.isArray(payload?.bodyParts) ? payload.bodyParts : [];
        const targets = Array.isArray(payload?.targets) ? payload.targets : [];
        const equipment = Array.isArray(payload?.equipment) ? payload.equipment : [];

        if (!cancelled) {
          setMetadata({
            bodyParts: bodyParts.map((x: any) => String(x)).filter(Boolean),
            targets: targets.map((x: any) => String(x)).filter(Boolean),
            equipment: equipment.map((x: any) => String(x)).filter(Boolean),
          });
        }
      } catch (err: any) {
        if (!cancelled) {
          setMetadataError(err?.message || "Failed to load metadata");
          setMetadata(null);
        }
      } finally {
        if (!cancelled) setMetadataLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open]);

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

      const yt = String(formData.youtubeUrl ?? "").trim();
      const uploadFile = (formData.uploadFile as File | null) ?? null;
      if (yt && uploadFile) {
        throw new Error(
          "Choose either a YouTube video or a custom upload (not both)."
        );
      }

      const payload: any = {
        name,
        guidelines: String(formData.guidelines ?? "").trim() || "",
        bodyPart: String(formData.bodyPart ?? "").trim() || undefined,
        targetMuscle: String(formData.targetMuscle ?? "").trim() || undefined,
        equipment: String(formData.equipment ?? "").trim() || undefined,
        gifUrl: String(formData.gifUrl ?? "").trim() || undefined,
      };

      // Preserve import metadata (editable only via DB/admin decisions)
      const source = String(exercise?.source ?? formData.source ?? "").trim();
      const externalId = String(exercise?.externalId ?? formData.externalId ?? "").trim();
      if (source) payload.source = source;
      if (externalId) payload.externalId = externalId;

      if (yt) {
        // If switching away from an existing uploaded video, delete the old file
        // before updating to YouTube to avoid leaving two videos behind.
        if (
          exercise?.id &&
          String(exercise?.videoKind ?? "") === "upload" &&
          String(exercise?.videoUrl ?? "").trim()
        ) {
          try {
            await removeVideo(String(exercise.id));
          } catch {
            // best-effort; don't block switching
          }
        }
        payload.videoKind = "youtube";
        payload.videoUrl = yt;
      } else if (exercise?.id && String(exercise?.videoKind ?? "") === "youtube") {
        payload.videoKind = null;
        payload.videoUrl = null;
      } else if (!uploadFile) {
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

      if (uploadFile) {
        if (!canUploadCustomVideo) {
          throw new Error(customVideoReason);
        }
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
        panel.close();
      } else {
        panelState.cancelEdit();
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

      const result = await db.entities.ExerciseLibrary.delete(id);

      const status = String((result as any)?.status ?? "").trim().toUpperCase();
      if (status === "DELETED") {
        // Only remove the video if the exercise actually got deleted.
        try {
          await removeVideo(id);
          await db.entities.ExerciseLibrary.update(id, {
            videoKind: null,
            videoUrl: null,
          });
        } catch {
          // ignore best-effort
        }
      }

      return result;
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["exerciseLibrary"] });
      onExerciseUpdate?.();
      const status = String(result?.status ?? "").trim().toUpperCase();
      if (status === "ARCHIVED") {
        setDeleteInfoMessage(
          "This exercise is currently used inside one or more active workout plans, so it cannot be deleted. It has been archived instead. Remove it from active plans if you want to delete it."
        );
        panelState.cancelDelete();
        return;
      }

      toast.success("Exercise deleted");
      panelState.cancelDelete();
      panel.close();
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

    const bodyPart = String(exercise?.bodyPart ?? "").trim();
    const targetMuscle = String(exercise?.targetMuscle ?? "").trim();
    const equipment = String(exercise?.equipment ?? "").trim();
    const gifUrl = String(exercise?.gifUrl ?? "").trim();
    const source = String(exercise?.source ?? "").trim();
    const externalId = String(exercise?.externalId ?? "").trim();

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
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-xl font-semibold text-gray-900 dark:text-white truncate">
                {name}
              </div>
              {String((exercise as any)?.status ?? "").trim().toUpperCase() ===
                "ARCHIVED" ? (
                <EntityStatusChip
                  status={String((exercise as any)?.status ?? "")}
                  size="sm"
                  className="shrink-0"
                />
              ) : null}
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

            {String((exercise as any)?.status ?? "").trim().toUpperCase() ===
              "ARCHIVED" && !panelState.isEditing ? (
              <Button
                variant="outline"
                size="sm"
                disabled={unarchiveMutation.isPending}
                onClick={() => unarchiveMutation.mutate()}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {unarchiveMutation.isPending
                  ? "Restoring..."
                  : "Return to active"}
              </Button>
            ) : null}

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetForm(exercise);
                panelState.startEdit();
              }}
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        <EntityInfoGrid>
          <ReadonlyInfoCard
            icon={Video}
            label="Video"
            value={hasVideo ? videoLabel : "-"}
          />
          <ReadonlyInfoCard
            icon={FileText}
            label="Guidelines"
            value={guidelines ? "Available" : "-"}
          />
        </EntityInfoGrid>

        {(bodyPart || targetMuscle || equipment || gifUrl || source || externalId) ? (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20">
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                Details
              </div>
            </div>
            <div className="px-3">
              {bodyPart ? (
                <div className="flex items-center justify-between gap-4 py-2 border-b border-gray-100 dark:border-gray-800">
                  <div className="text-sm text-gray-600 dark:text-gray-300">Body part</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{bodyPart}</div>
                </div>
              ) : null}
              {targetMuscle ? (
                <div className="flex items-center justify-between gap-4 py-2 border-b border-gray-100 dark:border-gray-800">
                  <div className="text-sm text-gray-600 dark:text-gray-300">Target muscle</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{targetMuscle}</div>
                </div>
              ) : null}
              {equipment ? (
                <div className="flex items-center justify-between gap-4 py-2 border-b border-gray-100 dark:border-gray-800">
                  <div className="text-sm text-gray-600 dark:text-gray-300">Equipment</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{equipment}</div>
                </div>
              ) : null}
              {gifUrl ? (
                <div className="flex items-center justify-between gap-4 py-2 border-b border-gray-100 dark:border-gray-800">
                  <div className="text-sm text-gray-600 dark:text-gray-300">GIF</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    <a
                      href={gifUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-300 underline"
                    >
                      Open
                    </a>
                  </div>
                </div>
              ) : null}
              {source ? (
                <div className="flex items-center justify-between gap-4 py-2 border-b border-gray-100 dark:border-gray-800">
                  <div className="text-sm text-gray-600 dark:text-gray-300">Source</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{source}</div>
                </div>
              ) : null}
              {externalId ? (
                <div className="flex items-center justify-between gap-4 py-2">
                  <div className="text-sm text-gray-600 dark:text-gray-300">External ID</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{externalId}</div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

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
          {!panelState.showDeleteConfirm ? (
            <Button
              type="button"
              variant="destructive"
              onClick={panelState.requestDelete}
              disabled={!exercise?.id}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Exercise
            </Button>
          ) : (
            <EntityDeleteConfirm
              title="Delete exercise?"
              description={
                <>
                  This will remove <strong>{String(exercise?.name ?? "this exercise")}</strong> from
                  the library. This cannot be undone.
                </>
              }
              confirmLabel={deleteMutation.isPending ? "Deleting..." : "Delete"}
              disabled={!exercise?.id || deleteMutation.isPending}
              onCancel={panelState.cancelDelete}
              onConfirm={async () => await deleteMutation.mutateAsync()}
            />
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

    const currentYoutubeEmbedUrl =
      currentVideoKind === "youtube" && currentVideoUrl
        ? toYouTubeEmbedUrl(currentVideoUrl)
        : "";
    const currentYoutubeWatchUrl = (() => {
      if (currentVideoKind !== "youtube" || !currentVideoUrl) return "";
      const id = extractYouTubeVideoId(currentVideoUrl);
      return id ? `https://www.youtube.com/watch?v=${id}` : "";
    })();

    const hasPendingVideo =
      hasVideo ||
      !!String(formData.youtubeUrl ?? "").trim() ||
      !!(formData.uploadFile as File | null);

    return (
      <form id="exercise-form" className="space-y-6" onSubmit={handleSubmit}>
        {validationError ? (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-50 dark:bg-slate-900/60 px-4 min-h-12 py-2">
            <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300">
              <XCircle className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm text-slate-700 dark:text-slate-200 break-words">
                {validationError}
              </div>
            </div>
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

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3">
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            Details (optional)
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            These fields help catalog/import alignment.
          </div>

          {metadataError ? (
            <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              {metadataError}
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Body part
              </label>
              {metadata?.bodyParts?.length ? (
                <Select
                  value={String(formData.bodyPart ?? "").trim() || "__none__"}
                  onValueChange={(v) => {
                    if (validationError) setValidationError(null);
                    setFormData((prev: any) => ({
                      ...prev,
                      bodyPart: v === "__none__" ? "" : v,
                    }));
                  }}
                >
                  <SelectTrigger className="w-full" disabled={metadataLoading}>
                    <SelectValue placeholder={metadataLoading ? "Loading…" : "Select"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {metadata.bodyParts.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={String(formData.bodyPart ?? "")}
                  onChange={(e) => {
                    if (validationError) setValidationError(null);
                    setFormData((prev: any) => ({ ...prev, bodyPart: e.target.value }));
                  }}
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target muscle
              </label>
              {metadata?.targets?.length ? (
                <Select
                  value={String(formData.targetMuscle ?? "").trim() || "__none__"}
                  onValueChange={(v) => {
                    if (validationError) setValidationError(null);
                    setFormData((prev: any) => ({
                      ...prev,
                      targetMuscle: v === "__none__" ? "" : v,
                    }));
                  }}
                >
                  <SelectTrigger className="w-full" disabled={metadataLoading}>
                    <SelectValue placeholder={metadataLoading ? "Loading…" : "Select"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {metadata.targets.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={String(formData.targetMuscle ?? "")}
                  onChange={(e) => {
                    if (validationError) setValidationError(null);
                    setFormData((prev: any) => ({ ...prev, targetMuscle: e.target.value }));
                  }}
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Equipment
              </label>
              {metadata?.equipment?.length ? (
                <Select
                  value={String(formData.equipment ?? "").trim() || "__none__"}
                  onValueChange={(v) => {
                    if (validationError) setValidationError(null);
                    setFormData((prev: any) => ({
                      ...prev,
                      equipment: v === "__none__" ? "" : v,
                    }));
                  }}
                >
                  <SelectTrigger className="w-full" disabled={metadataLoading}>
                    <SelectValue placeholder={metadataLoading ? "Loading…" : "Select"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {metadata.equipment.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={String(formData.equipment ?? "")}
                  onChange={(e) => {
                    if (validationError) setValidationError(null);
                    setFormData((prev: any) => ({ ...prev, equipment: e.target.value }));
                  }}
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                GIF URL
              </label>
              <Input
                value={String(formData.gifUrl ?? "")}
                onChange={(e) => {
                  if (validationError) setValidationError(null);
                  setFormData((prev: any) => ({ ...prev, gifUrl: e.target.value }));
                }}
                placeholder="https://..."
              />
            </div>
          </div>
        </div>

        {(String(exercise?.source ?? formData.source ?? "").trim() ||
          String(exercise?.externalId ?? formData.externalId ?? "").trim()) ? (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">Import metadata</div>
            <div className="mt-1 text-sm text-gray-700 dark:text-gray-200">
              {String(exercise?.source ?? formData.source ?? "").trim()
                ? `Source: ${String(exercise?.source ?? formData.source ?? "").trim()}`
                : ""}
              {String(exercise?.externalId ?? formData.externalId ?? "").trim()
                ? `${String(exercise?.source ?? formData.source ?? "").trim() ? " · " : ""}External ID: ${String(
                  exercise?.externalId ?? formData.externalId ?? ""
                ).trim()}`
                : ""}
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">
            Video
          </div>

          {/* Current video */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/30">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Current video
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {hasVideo
                    ? currentVideoKind === "youtube"
                      ? "Source: YouTube"
                      : "Source: Uploaded"
                    : "No video attached"}
                </div>
              </div>

              {hasVideo ? (
                !showRemoveVideoConfirm ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRemoveVideoConfirm(true)}
                    disabled={removeVideoMutation.isPending}
                  >
                    Remove video
                  </Button>
                ) : null
              ) : null}
            </div>

            {hasVideo ? (
              <div className="mt-3">
                {currentYoutubeEmbedUrl ? (
                  <div
                    className="relative w-full overflow-hidden rounded-lg bg-black"
                    style={{ paddingTop: "56.25%" }}
                  >
                    {currentYoutubeWatchUrl ? (
                      <a
                        href={currentYoutubeWatchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 z-10 cursor-pointer"
                        title="Open video"
                        aria-label="Open video"
                      />
                    ) : null}
                    <iframe
                      src={currentYoutubeEmbedUrl}
                      title="Exercise video"
                      className="absolute inset-0 h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : currentVideoKind === "upload" && currentVideoUrl ? (
                  <div
                    className="relative w-full overflow-hidden rounded-lg bg-black"
                    style={{ paddingTop: "56.25%" }}
                  >
                    <video
                      className="absolute inset-0 h-full w-full object-contain"
                      controls
                      preload="metadata"
                      src={currentVideoUrl}
                    />
                  </div>
                ) : null}

                {showRemoveVideoConfirm ? (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                    <div className="text-xs text-gray-700 dark:text-gray-200">
                      Remove the video from this exercise?
                    </div>
                    <div className="mt-2 flex gap-2 justify-end">
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
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Add video via YouTube (always available) */}
          <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              Add video via YouTube
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Paste a YouTube URL. This works on all plans.
            </div>
            <Input
              value={String(formData.youtubeUrl ?? "")}
              onChange={(e) => {
                if (validationError) setValidationError(null);
                const next = e.target.value;
                setFormData((prev: any) => ({
                  ...prev,
                  youtubeUrl: next,
                  uploadFile: String(next).trim() ? null : prev.uploadFile,
                }));
              }}
              placeholder="YouTube URL (optional)"
              className="mt-3"
            />
          </div>

          {/* Custom video upload (plan gated) */}
          <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              Custom video upload
            </div>

            {canUploadCustomVideo ? (
              <>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Upload a video file to host it on Progrr.
                </div>

                <input
                  ref={uploadInputRef}
                  className="hidden"
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const input = e.target as HTMLInputElement;
                    const file = input.files?.[0] ?? null;
                    input.value = "";
                    setFormData((prev: any) => ({
                      ...prev,
                      uploadFile: file,
                      youtubeUrl: file ? "" : prev.youtubeUrl,
                    }));
                  }}
                />

                <div className="mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => uploadInputRef.current?.click()}
                  >
                    <Video className="w-4 h-4 mr-2" />
                    Upload video
                  </Button>
                </div>

                {formData.uploadFile ? (
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-200">
                    <div className="min-w-0 truncate">
                      Selected: {(formData.uploadFile as File).name}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setFormData((prev: any) => ({ ...prev, uploadFile: null }))
                      }
                    >
                      Clear
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="mt-3 w-full rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/30">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700">
                    <Lock className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      Custom video upload
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Available on Professional & Advanced
                    </div>
                  </div>
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
            )}
          </div>
        </div>

        <div className="h-2" />
      </form>
    );
  };

  React.useEffect(() => {
    if (!open) return;

    panel.setTitle(
      panelState.isEditing
        ? exercise
          ? "Edit Exercise"
          : "New Exercise"
        : "Exercise Details"
    );
    panel.setDescription(
      panelState.isEditing
        ? exercise
          ? "Update exercise"
          : "Add a new exercise to your library"
        : `View details for ${String(exercise?.name ?? "Exercise")}`
    );

    panel.setFooter(
      panelState.isEditing ? (
        <EntityEditFooter
          isNew={!exercise}
          isLoading={saveMutation.isPending}
          formId="exercise-form"
          onCancel={() => (exercise ? panelState.cancelEdit() : panel.close())}
          createLabel="Create Exercise"
          creatingLabel="Saving..."
          savingLabel="Saving..."
        />
      ) : undefined
    );
  }, [open, panel, panelState, exercise, saveMutation.isPending]);

  return (
    <>
      {deleteInfoMessage ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 px-3 py-2 mb-4">
          <div className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Archived (not deleted)
          </div>
          <div className="text-xs text-amber-800 dark:text-amber-200 mt-1 leading-relaxed">
            {deleteInfoMessage}
          </div>
        </div>
      ) : null}

      {!exercise && !panelState.isEditing ? (
        <div className="text-sm text-gray-600 dark:text-gray-300">
          No exercise selected
        </div>
      ) : panelState.isEditing ? (
        renderEditMode()
      ) : (
        renderViewMode()
      )}
    </>
  );
}
