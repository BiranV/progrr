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
  Apple,
  Flame,
  Beef,
  Wheat,
  Droplets,
  FileDown,
  FileText,
  Copy,
} from "lucide-react";
import FoodLibraryDialog from "@/components/FoodLibraryDialog";
import FoodLibraryDetailsDialog from "@/components/FoodLibraryDetailsDialog";
import { toast } from "sonner";
import {
  copyTextToClipboard,
  downloadPdfFile,
  downloadTextFile,
} from "@/lib/plan-export";

export default function FoodsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingFood, setEditingFood] = React.useState<any | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [detailsFood, setDetailsFood] = React.useState<any | null>(null);

  const { data: foods = [], isLoading } = useQuery({
    queryKey: ["foodLibrary"],
    queryFn: () => db.entities.FoodLibrary.list("-created_date"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await db.entities.FoodLibrary.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foodLibrary"] });
    },
    onError: (err: any) => {
      toast.error(String(err?.message ?? "Failed to delete"));
    },
  });

  const filtered = (foods as any[]).filter((f) =>
    String(f?.name ?? "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const handleEdit = (food: any) => {
    setEditingFood(food);
    setDialogOpen(true);
  };

  const handleDetails = (food: any) => {
    setDetailsFood(food);
    setDetailsOpen(true);
  };

  const handleCreate = () => {
    setEditingFood(null);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this food from the library?")) {
      deleteMutation.mutate(id);
    }
  };

  const exportFood = async (food: any, kind: "pdf" | "txt" | "copy") => {
    const name = String(food?.name ?? "").trim() || "Food";
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
    const text = lines.join("\n");

    const filenameBase = `Food - ${name}`;

    try {
      if (kind === "pdf") {
        downloadPdfFile(filenameBase, `Food: ${name}`, text);
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

  return (
    <div className="p-8 bg-[#F5F6F8] dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Foods
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create reusable foods for meal plans
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="min-w-[120px] bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Plus className="w-5 h-5 mr-2" />
          Food
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search foods"
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          Loading foods...
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Apple className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {search
                ? "No foods found"
                : "No foods yet. Create your first one!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((f: any) => (
            <Card
              key={f.id}
              className="h-[220px] hover:shadow-lg transition-shadow dark:bg-gray-800 dark:border-gray-700"
            >
              <CardContent className="px-5 flex flex-col h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold truncate">
                      {String(f.name ?? "-")}
                    </h3>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      per 100g
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(f)}
                      className="p-2 text-gray-600 dark:text-gray-400
                        hover:text-indigo-600
                        hover:bg-indigo-50 dark:hover:bg-indigo-900
                        rounded-lg"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(f.id)}
                      className="p-2 text-gray-600 dark:text-gray-400
                        hover:text-red-600
                        hover:bg-red-50 dark:hover:bg-red-900
                        rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-500" />
                      <span>{String(f.calories ?? "").trim() || "-"} kcal</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Beef className="w-4 h-4 text-blue-500" />
                      <span>{String(f.protein ?? "").trim() || "-"} g</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wheat className="w-4 h-4 text-yellow-500" />
                      <span>{String(f.carbs ?? "").trim() || "-"} g</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-purple-500" />
                      <span>{String(f.fat ?? "").trim() || "-"} g</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1" />

                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-rose-600 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200"
                      title="Download PDF"
                      aria-label="Download PDF"
                      onClick={() => exportFood(f, "pdf")}
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
                      onClick={() => exportFood(f, "txt")}
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
                      onClick={() => exportFood(f, "copy")}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-200 dark:hover:bg-indigo-900/45"
                      onClick={() => handleDetails(f)}
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

      <FoodLibraryDialog
        food={editingFood}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingFood(null);
        }}
      />

      <FoodLibraryDetailsDialog
        food={detailsFood}
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setDetailsFood(null);
        }}
      />
    </div>
  );
}
