"use client";

import React from "react";
import SidePanel from "@/components/ui/side-panel";
import ClientAvatar from "@/components/ClientAvatar";
import { Ban, Mars, Venus, VenusAndMars } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Client } from "@/types";

interface ClientDetailsDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workoutPlanNameById?: Map<string, string>;
  mealPlanNameById?: Map<string, string>;
}

function toTitleCase(value: any) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

function formatGoalLabel(value: any) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const v = raw
    .toLowerCase()
    .trim()
    .replace(/[-\s]+/g, "_")
    .replace(/_+/g, "_");

  if (v === "weight_loss") return "Fat Loss";
  if (v === "muscle_gain") return "Muscle Gain";
  if (v === "maintenance") return "Maintenance";
  if (v === "strength") return "Strength";
  if (v === "endurance") return "Endurance";
  if (v === "recomposition") return "Recomposition";
  if (v === "better_habits") return "Better Habits";

  return toTitleCase(raw);
}

function formatActivityLabel(value: any) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const deCamel = raw.replace(/([a-z])([A-Z])/g, "$1 $2");
  const v = deCamel
    .toLowerCase()
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

  if (v === "sedentary") return "Sedentary";
  if (v === "light") return "Light";
  if (v === "moderate") return "Moderate";
  if (v === "active") return "Active";
  if (v === "very" || v === "very active" || v === "veryactive")
    return "Very Active";
  if (v === "extra" || v === "extra active" || v === "extraactive")
    return "Extra Active";

  return toTitleCase(raw);
}

function normalizeIdList(value: any, fallbackSingle?: any): string[] {
  const arr = Array.isArray(value) ? value : [];
  const fallback = String(fallbackSingle ?? "").trim();
  const merged = [
    ...arr.map((v: any) => String(v ?? "").trim()),
    ...(fallback ? [fallback] : []),
  ]
    .map((v) => String(v).trim())
    .filter((v) => v && v !== "none");

  return Array.from(new Set(merged));
}

export default function ClientDetailsDialog({
  client,
  open,
  onOpenChange,
  workoutPlanNameById,
  mealPlanNameById,
}: ClientDetailsDialogProps) {
  const isBlocked =
    String((client as any)?.status ?? "")
      .trim()
      .toUpperCase() === "BLOCKED";
  const gender = String((client as any)?.gender ?? "")
    .trim()
    .toLowerCase();
  const workoutIds = normalizeIdList(
    (client as any)?.assignedPlanIds,
    (client as any)?.assignedPlanId
  );
  const mealIds = normalizeIdList(
    (client as any)?.assignedMealPlanIds,
    (client as any)?.assignedMealPlanId
  );

  const workoutNames = workoutIds.map((id) =>
    workoutPlanNameById?.get(id) ? String(workoutPlanNameById.get(id)) : id
  );
  const mealNames = mealIds.map((id) =>
    mealPlanNameById?.get(id) ? String(mealPlanNameById.get(id)) : id
  );

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Client Details"
      description={client ? client.name : undefined}
      widthClassName="w-full sm:w-[520px] lg:w-[640px]"
    >
      {!client ? (
        <div className="text-sm text-gray-600 dark:text-gray-300">
          No client selected
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <ClientAvatar
                name={client.name || ""}
                src={(client as any).avatarDataUrl}
                size={44}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white min-w-0">
                  {gender === "female" ? (
                    <Venus className="w-5 h-5 text-pink-500 shrink-0" />
                  ) : gender === "male" ? (
                    <Mars className="w-5 h-5 text-blue-500 shrink-0" />
                  ) : gender === "other" ? (
                    <VenusAndMars className="w-5 h-5 text-purple-500 shrink-0" />
                  ) : null}
                  <span className="truncate">{client.name || "-"}</span>
                  {isBlocked ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="inline-flex shrink-0"
                          aria-label="Blocked"
                        >
                          <Ban className="w-4 h-4 text-red-600 dark:text-red-300" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>
                        {String((client as any).blockReason ?? "").trim() ||
                          "Blocked"}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 truncate">
                  {client.email ? <span>{client.email}</span> : <span>-</span>}
                  {client.phone ? <span> · {client.phone}</span> : null}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
              <div className="text-gray-500 dark:text-gray-400">Status</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {toTitleCase((client as any)?.status) || "-"}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
              <div className="text-gray-500 dark:text-gray-400">Goal</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {formatGoalLabel((client as any)?.goal) || "-"}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
              <div className="text-gray-500 dark:text-gray-400">
                Activity Level
              </div>
              <div className="font-medium text-gray-900 dark:text-white">
                {formatActivityLabel((client as any)?.activityLevel) || "-"}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
              <div className="text-gray-500 dark:text-gray-400">Birth Date</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {String((client as any)?.birthDate ?? "").trim() || "-"}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
              <div className="text-gray-500 dark:text-gray-400">Height</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {String((client as any)?.height ?? "").trim() || "-"}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
              <div className="text-gray-500 dark:text-gray-400">Weight</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {String((client as any)?.weight ?? "").trim() || "-"}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
              <div className="text-gray-500 dark:text-gray-400">
                Assigned Workout Plans
              </div>
              <div className="font-medium text-gray-900 dark:text-white">
                {workoutNames.length ? workoutNames.join(", ") : "-"}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
              <div className="text-gray-500 dark:text-gray-400">
                Assigned Meal Plans
              </div>
              <div className="font-medium text-gray-900 dark:text-white">
                {mealNames.length ? mealNames.join(", ") : "-"}
              </div>
            </div>

            {String((client as any)?.notes ?? "").trim() ? (
              <div className="sm:col-span-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
                <div className="text-gray-500 dark:text-gray-400">Notes</div>
                <div className="mt-1 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                  {String((client as any)?.notes ?? "").trim()}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </SidePanel>
  );
}
