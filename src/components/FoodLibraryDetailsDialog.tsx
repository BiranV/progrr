"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Copy as CopyIcon,
  FileDown,
  FileText,
  Flame,
  Beef,
  Wheat,
  Droplets,
} from "lucide-react";
import {
  copyTextToClipboard,
  downloadPdfFile,
  downloadTextFile,
} from "@/lib/plan-export";
import { toast } from "sonner";

interface FoodLibraryDetailsDialogProps {
  food: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FoodLibraryDetailsDialog({
  food,
  open,
  onOpenChange,
}: FoodLibraryDetailsDialogProps) {
  const exportText = React.useMemo(() => {
    if (!food) return "";
    const name = String(food?.name ?? "").trim() || "-";
    const calories = String(food?.calories ?? "").trim();
    const protein = String(food?.protein ?? "").trim();
    const carbs = String(food?.carbs ?? "").trim();
    const fat = String(food?.fat ?? "").trim();

    const lines: string[] = [];
    lines.push(`Food: ${name}`);
    lines.push("Values per 100g:");
    lines.push(`- Calories: ${calories || "-"} kcal`);
    lines.push(`- Protein: ${protein || "-"} g`);
    lines.push(`- Carbs: ${carbs || "-"} g`);
    lines.push(`- Fat: ${fat || "-"} g`);
    return lines.join("\n");
  }, [food]);

  const exportFilenameBase = React.useMemo(() => {
    const name = String(food?.name ?? "").trim();
    const id = String(food?.id ?? "").trim();
    return `food-${name || id || "item"}`;
  }, [food]);

  const handleCopy = async () => {
    if (!food) return;
    try {
      await copyTextToClipboard(exportText);
      toast.success("Copied to clipboard");
    } catch (err) {
      console.error("Failed to copy food", err);
      toast.error("Failed to copy");
    }
  };

  const handleDownloadText = () => {
    if (!food) return;
    try {
      downloadTextFile(exportFilenameBase, exportText);
    } catch (err) {
      console.error("Failed to download food text", err);
      toast.error("Failed to download text");
    }
  };

  const handleDownloadPdf = () => {
    if (!food) return;
    try {
      const title = String(food?.name ?? "Food").trim() || "Food";
      downloadPdfFile(exportFilenameBase, `Food: ${title}`, exportText);
    } catch (err) {
      console.error("Failed to download food PDF", err);
      toast.error("Failed to download PDF");
    }
  };

  const calories = String(food?.calories ?? "").trim() || "-";
  const protein = String(food?.protein ?? "").trim() || "-";
  const carbs = String(food?.carbs ?? "").trim() || "-";
  const fat = String(food?.fat ?? "").trim() || "-";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-gray-800">
        <DialogHeader>
          <DialogTitle>Food Details</DialogTitle>
        </DialogHeader>

        {!food ? (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            No food selected
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xl font-semibold text-gray-900 dark:text-white truncate">
                  {String(food?.name ?? "-")}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Values per 100g
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
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span>Calories</span>
                </div>
                <div className="mt-1 font-medium text-gray-900 dark:text-white">
                  {calories} kcal
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Beef className="w-4 h-4 text-blue-500" />
                  <span>Protein</span>
                </div>
                <div className="mt-1 font-medium text-gray-900 dark:text-white">
                  {protein} g
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Wheat className="w-4 h-4 text-yellow-500" />
                  <span>Carbs</span>
                </div>
                <div className="mt-1 font-medium text-gray-900 dark:text-white">
                  {carbs} g
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Droplets className="w-4 h-4 text-purple-500" />
                  <span>Fat</span>
                </div>
                <div className="mt-1 font-medium text-gray-900 dark:text-white">
                  {fat} g
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
