"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy as CopyIcon, FileDown, FileText, Video } from "lucide-react";
import {
  copyTextToClipboard,
  downloadPdfFile,
  downloadTextFile,
} from "@/lib/plan-export";
import { toast } from "sonner";
import { extractYouTubeVideoId, toYouTubeEmbedUrl } from "@/lib/youtube";

interface ExerciseLibraryDetailsDialogProps {
  exercise: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ExerciseLibraryDetailsDialog({
  exercise,
  open,
  onOpenChange,
}: ExerciseLibraryDetailsDialogProps) {
  const exportText = React.useMemo(() => {
    if (!exercise) return "";

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

  const videoLabel =
    videoKind === "youtube"
      ? "YouTube"
      : videoKind === "upload"
      ? "Upload"
      : "-";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto dark:bg-gray-800">
        <DialogHeader>
          <DialogTitle>Exercise Details</DialogTitle>
        </DialogHeader>

        {!exercise ? (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            No exercise selected
          </div>
        ) : (
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
                  className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-200"
                  title="Copy to clipboard"
                  aria-label="Copy to clipboard"
                  onClick={handleCopy}
                >
                  <CopyIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Video className="w-4 h-4" />
                  <span>Video</span>
                </div>
                <div className="mt-1 font-medium text-gray-900 dark:text-white">
                  {videoLabel}
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
