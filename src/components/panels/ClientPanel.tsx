"use client";

import React from "react";
import { db } from "@/lib/db";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useGenericDetailsPanel } from "@/components/ui/entity/GenericDetailsPanel";
import ClientAvatar from "@/components/ClientAvatar";
import {
  Ban,
  Mars,
  Venus,
  VenusAndMars,
  CheckCircle,
  XCircle,
  Trash2,
  ShieldAlert,
  Archive,
  Loader2,
  PauseCircle,
  Edit2,
  Mail,
  Phone,
  Calendar,
  Ruler,
  Weight,
  Target,
  Activity,
  StickyNote,
  Users,
  RotateCcw,
  Send,
} from "lucide-react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  createClientAction,
  updateClientAction,
  activateClientAction,
  deactivateClientAction,
  blockClientAction,
  unblockClientAction,
  deleteClientAction,
  resendClientInviteAction,
  restoreClientAction,
  permanentlyDeleteClientAction,
  ClientFormData,
} from "@/app/actions/client-management";
import { Client } from "@/types";
import ConfirmModal from "@/components/ui/confirm-modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DailyComplianceCalendar } from "@/components/tracking/DailyComplianceCalendar";

interface ClientPanelProps {
  client: Client | null;
  // Optional props for view mode optimization, though we fetch lists internally for edit mode
  workoutPlanNameById?: Map<string, string>;
  mealPlanNameById?: Map<string, string>;
  onClientUpdate?: () => void;
}

const REQUIRED_FIELDS: Array<keyof Client> = ["name", "email", "phone"];

export default function ClientPanel({
  client,
  onClientUpdate,
}: ClientPanelProps) {
  const panel = useGenericDetailsPanel();
  const queryClient = useQueryClient();
  const panelState = useEntityPanelState();

  const { data: stepsRecent } = useQuery({
    queryKey: ["stepsRecent", "admin", String(client?.id ?? "")],
    enabled: Boolean(panel.open && client?.id),
    queryFn: async () => {
      const clientId = String(client?.id ?? "").trim();
      if (!clientId) return { ok: true, days: [] as any[] };

      const res = await fetch(
        `/api/steps/recent?clientId=${encodeURIComponent(
          clientId
        )}&days=7`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `Request failed (${res.status})`);
      }
      return payload as { ok: true; days: { date: string; steps: number }[] };
    },
  });

  const toggleStepsEnabledMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!client?.id) return;
      await db.entities.Client.update(client.id, {
        stepsEnabledByAdmin: enabled,
      } as any);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      await queryClient.invalidateQueries({
        queryKey: ["stepsRecent", "admin", String(client?.id ?? "")],
      });
      onClientUpdate?.();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update steps settings");
    },
  });

  const formatBirthDateWithAge = (birthDate: unknown) => {
    const raw = String(birthDate ?? "").trim();
    if (!raw) return "-";

    const parts = raw.split(/\D+/).filter(Boolean);
    if (parts.length !== 3) return raw;

    const [p1, p2, p3] = parts;
    const n1 = Number(p1);
    const n2 = Number(p2);
    const n3 = Number(p3);
    if (![n1, n2, n3].every((n) => Number.isFinite(n))) return raw;

    let year: number;
    let month: number;
    let day: number;

    if (String(p1).length === 4) {
      year = n1;
      month = n2;
      day = n3;
    } else if (String(p3).length === 4) {
      day = n1;
      month = n2;
      year = n3;
    } else {
      day = n1;
      month = n2;
      year = n3;
    }

    if (year < 1900 || year > 2200) return raw;
    if (month < 1 || month > 12) return raw;
    if (day < 1 || day > 31) return raw;

    const birthUtc = new Date(Date.UTC(year, month - 1, day));
    if (
      birthUtc.getUTCFullYear() !== year ||
      birthUtc.getUTCMonth() !== month - 1 ||
      birthUtc.getUTCDate() !== day
    ) {
      return raw;
    }

    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth() + 1;
    const nowDay = now.getDate();

    let age = nowYear - year;
    const birthdayNotYetThisYear =
      nowMonth < month || (nowMonth === month && nowDay < day);
    if (birthdayNotYetThisYear) age -= 1;

    const formatted = `${String(day).padStart(2, "0")}-${String(month).padStart(
      2,
      "0"
    )}-${String(year)}`;

    if (!Number.isFinite(age) || age < 0 || age > 130) return formatted;
    return `${formatted} (${age})`;
  };

  const formatDateDDMMYYYY = (value: unknown) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "-";

    const parts = raw.split(/\D+/).filter(Boolean);
    if (parts.length !== 3) return raw;

    const [p1, p2, p3] = parts;
    const n1 = Number(p1);
    const n2 = Number(p2);
    const n3 = Number(p3);
    if (![n1, n2, n3].every((n) => Number.isFinite(n))) return raw;

    let year: number;
    let month: number;
    let day: number;

    if (String(p1).length === 4) {
      year = n1;
      month = n2;
      day = n3;
    } else if (String(p3).length === 4) {
      day = n1;
      month = n2;
      year = n3;
    } else {
      day = n1;
      month = n2;
      year = n3;
    }

    if (year < 1900 || year > 2200) return raw;
    if (month < 1 || month > 12) return raw;
    if (day < 1 || day > 31) return raw;

    const dUtc = new Date(Date.UTC(year, month - 1, day));
    if (
      dUtc.getUTCFullYear() !== year ||
      dUtc.getUTCMonth() !== month - 1 ||
      dUtc.getUTCDate() !== day
    ) {
      return raw;
    }

    return `${String(day).padStart(2, "0")}-${String(month).padStart(
      2,
      "0"
    )}-${String(year)}`;
  };

  const getDateSortKey = (value: unknown) => {
    const raw = String(value ?? "").trim();
    if (!raw) return Number.NaN;

    const parts = raw.split(/\D+/).filter(Boolean);
    if (parts.length !== 3) return Number.NaN;

    const [p1, p2, p3] = parts;
    const n1 = Number(p1);
    const n2 = Number(p2);
    const n3 = Number(p3);
    if (![n1, n2, n3].every((n) => Number.isFinite(n))) return Number.NaN;

    let year: number;
    let month: number;
    let day: number;

    if (String(p1).length === 4) {
      year = n1;
      month = n2;
      day = n3;
    } else if (String(p3).length === 4) {
      day = n1;
      month = n2;
      year = n3;
    } else {
      day = n1;
      month = n2;
      year = n3;
    }

    if (year < 1900 || year > 2200) return Number.NaN;
    if (month < 1 || month > 12) return Number.NaN;
    if (day < 1 || day > 31) return Number.NaN;

    const dUtc = new Date(Date.UTC(year, month - 1, day));
    if (
      dUtc.getUTCFullYear() !== year ||
      dUtc.getUTCMonth() !== month - 1 ||
      dUtc.getUTCDate() !== day
    ) {
      return Number.NaN;
    }

    return dUtc.getTime();
  };

  const StepsProgressGraph = ({
    days,
  }: {
    days: { date: string; steps: number }[];
  }) => {
    const series = React.useMemo(() => {
      const sorted = [...(days ?? [])]
        .map((d) => ({
          date: String((d as any)?.date ?? ""),
          steps: Number((d as any)?.steps ?? 0),
          key: getDateSortKey((d as any)?.date),
        }))
        .filter((d) => Number.isFinite(d.steps))
        .sort((a, b) => {
          const ak = Number.isFinite(a.key) ? a.key : Number.POSITIVE_INFINITY;
          const bk = Number.isFinite(b.key) ? b.key : Number.POSITIVE_INFINITY;
          return ak - bk;
        });

      return sorted;
    }, [days]);

    if (!series.length) return null;

    const values = series.map((d) => d.steps);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const n = series.length;

    const width = 100;
    const height = 40;
    const padX = 4;
    const padY = 4;

    const toX = (i: number) => {
      if (n <= 1) return width / 2;
      return padX + (i * (width - padX * 2)) / (n - 1);
    };

    const toY = (v: number) => {
      if (!Number.isFinite(v)) return height / 2;
      if (max === min) return height / 2;
      const t = (v - min) / (max - min);
      return padY + (1 - t) * (height - padY * 2);
    };

    const points = series
      .map((d, i) => `${toX(i).toFixed(2)},${toY(d.steps).toFixed(2)}`)
      .join(" ");

    const first = series[0]?.steps ?? 0;
    const last = series[n - 1]?.steps ?? 0;
    const prev = series[n - 2]?.steps;
    const netChange = last - first;
    const lastDelta = typeof prev === "number" ? last - prev : 0;

    const netLabel =
      netChange > 0
        ? `+${netChange.toLocaleString()}`
        : netChange < 0
          ? netChange.toLocaleString()
          : "0";

    return (
      <div className="rounded-md border bg-white dark:bg-gray-800 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">Progress (last 7 days)</div>
            <div className="text-xs text-gray-500">
              Net change: <span className="font-medium">{netLabel}</span>
              {typeof prev === "number" ? (
                <>
                  {" "}
                  • Last day: {lastDelta >= 0 ? "+" : ""}
                  {lastDelta.toLocaleString()}
                </>
              ) : null}
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {min.toLocaleString()} – {max.toLocaleString()}
          </div>
        </div>

        <div className="mt-2">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-16 w-full"
            preserveAspectRatio="none"
          >
            <polyline
              fill="none"
              className="stroke-muted-foreground"
              strokeWidth="1.5"
              points={points}
            />
            {series.map((d, i) => {
              const prevSteps = i > 0 ? series[i - 1]?.steps : undefined;
              const delta =
                typeof prevSteps === "number" ? d.steps - prevSteps : 0;

              const dotClass =
                i === 0
                  ? "fill-muted-foreground"
                  : delta > 0
                    ? "fill-emerald-500"
                    : delta < 0
                      ? "fill-red-500"
                      : "fill-muted-foreground";

              return (
                <circle
                  key={`${d.date}-${i}`}
                  cx={toX(i)}
                  cy={toY(d.steps)}
                  r={2.3}
                  className={dotClass}
                >
                  <title>
                    {`${formatDateDDMMYYYY(d.date)}: ${Number(
                      d.steps
                    ).toLocaleString()} steps`}
                  </title>
                </circle>
              );
            })}
          </svg>
        </div>

        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
          <div className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Increase
          </div>
          <div className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            Decrease
          </div>
          <div className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground" />
            No change
          </div>
        </div>
      </div>
    );
  };

  // State
  const [validationError, setValidationError] = React.useState<string | null>(
    null
  );
  const [removeImageOpen, setRemoveImageOpen] = React.useState(false);
  const [statusUpdating, setStatusUpdating] = React.useState<string | null>(
    null
  );
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");

  // Reset editing state when dialog opens/closes or client changes
  React.useEffect(() => {
    if (!panel.open) return;
    panelState.cancelDelete();
    setDeleteConfirmText("");

    if (!client) {
      // Create mode
      panelState.startEdit();
      resetForm(null);
      return;
    }

    // View mode
    panelState.cancelEdit();
    resetForm(client);
  }, [
    panel.open,
    client?.id,
    panelState.cancelDelete,
    panelState.startEdit,
    panelState.cancelEdit,
  ]);

  // Data
  const { data: workoutPlans = [] } = useQuery({
    queryKey: ["workoutPlans"],
    queryFn: () => db.entities.WorkoutPlan.list(),
  });

  const workoutPlansById = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const plan of workoutPlans as any[]) {
      map.set(String((plan as any)?.id), plan);
    }
    return map;
  }, [workoutPlans]);

  const activeWorkoutPlans = React.useMemo(() => {
    return (workoutPlans as any[]).filter((plan: any) => {
      const status = String(plan?.status ?? "ACTIVE").trim().toUpperCase();
      return status !== "ARCHIVED" && status !== "DELETED";
    });
  }, [workoutPlans]);

  const { data: mealPlans = [] } = useQuery({
    queryKey: ["mealPlans"],
    queryFn: () => db.entities.MealPlan.list(),
  });

  const mealPlansById = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const plan of mealPlans as any[]) {
      map.set(String((plan as any)?.id), plan);
    }
    return map;
  }, [mealPlans]);

  const activeMealPlans = React.useMemo(() => {
    return (mealPlans as any[]).filter((plan: any) => {
      const status = String(plan?.status ?? "ACTIVE").trim().toUpperCase();
      return status !== "ARCHIVED" && status !== "DELETED";
    });
  }, [mealPlans]);

  // Form State
  const [formData, setFormData] = React.useState<any>({});
  const [goalMode, setGoalMode] = React.useState<"select" | "custom">(
    "select"
  );
  const [activityMode, setActivityMode] = React.useState<"select" | "custom">(
    "select"
  );

  const GOAL_PRESET_VALUES = React.useMemo(
    () => [
      "weight_loss",
      "muscle_gain",
      "maintenance",
      "strength",
      "endurance",
      "recomposition",
      "better_habits",
    ],
    []
  );
  const ACTIVITY_PRESET_VALUES = React.useMemo(
    () => ["sedentary", "light", "moderate", "active", "very", "extra"],
    []
  );
  const CUSTOM_SELECT_VALUE = "__custom__";

  const resetForm = (c: Client | null) => {
    setValidationError(null);
    if (c) {
      // Load existing client data
      const data: any = (c as any).data || {};
      const source = Object.keys(data).length > 0 ? data : c;

      const normalizedGoal = normalizeGoal(source.goal);
      const normalizedActivity = normalizeActivityLevel(source.activityLevel);

      setFormData({
        name: String(source.name ?? ""),
        email: String(source.email ?? ""),
        phone: String(source.phone ?? ""),
        avatarDataUrl: (c as any).avatarDataUrl ?? null,
        birthDate: String(source.birthDate ?? ""),
        gender: normalizeGender(source.gender),
        height: String(source.height ?? ""),
        weight: String(source.weight ?? ""),
        goal: normalizedGoal,
        activityLevel: normalizedActivity,
        status: normalizeStatus(c.status),
        notes: String(source.notes ?? ""),
        assignedPlanIds: normalizeIdArray(
          source.assignedPlanIds,
          source.assignedPlanId
        ),
        assignedMealPlanIds: normalizeIdArray(
          source.assignedMealPlanIds,
          source.assignedMealPlanId
        ),
        // Legacy
        assignedPlanId: "",
        assignedMealPlanId: "",
      });

      setGoalMode(
        normalizedGoal && !GOAL_PRESET_VALUES.includes(String(normalizedGoal))
          ? "custom"
          : "select"
      );
      setActivityMode(
        normalizedActivity &&
          !ACTIVITY_PRESET_VALUES.includes(String(normalizedActivity))
          ? "custom"
          : "select"
      );
    } else {
      // Empty form
      setFormData({
        name: "",
        email: "",
        phone: "",
        avatarDataUrl: null,
        birthDate: "",
        gender: "",
        height: "",
        weight: "",
        goal: "",
        activityLevel: "",
        status: "PENDING",
        notes: "",
        assignedPlanIds: [],
        assignedMealPlanIds: [],
        assignedPlanId: "",
        assignedMealPlanId: "",
      });

      setGoalMode("select");
      setActivityMode("select");
    }
  };

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Client>) => {
      const payload = data as ClientFormData;
      if (client) {
        return updateClientAction(client.id, payload);
      }
      return createClientAction(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success(
        client ? "Client updated successfully" : "Client created successfully"
      );
      onClientUpdate?.();
      if (!client) {
        panel.close(); // Close on create
      } else {
        panelState.cancelEdit(); // Return to view mode on edit
      }
    },
    onError: (error) => {
      setValidationError(error?.message || "Failed to save client");
    },
  });

  const removeAvatarMutation = useMutation({
    mutationFn: async () => {
      if (!client) return;
      await db.entities.Client.update(client.id, {
        avatarDataUrl: null,
      } as any);
    },
    onSuccess: () => {
      setFormData((prev: any) => ({ ...prev, avatarDataUrl: null }));
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client image removed");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to remove image");
    },
  });

  // Handlers
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Basic validation
    if (!formData.name) return setValidationError("Full name is required");
    if (!formData.email) return setValidationError("Email is required");
    if (!formData.phone) return setValidationError("Phone is required");

    const payload = {
      ...formData,
      // Ensure sync between array and legacy single ID
      assignedPlanId: formData.assignedPlanIds[0] ?? "",
      assignedMealPlanId: formData.assignedMealPlanIds[0] ?? "",
    };
    delete payload.status; // Status is managed separately

    saveMutation.mutate(payload);
  };

  const toggleAssignedId = (field: string, id: string) => {
    setFormData((prev: any) => {
      const current = prev[field] || [];
      const next = current.includes(id)
        ? current.filter((x: string) => x !== id)
        : [...current, id];
      return { ...prev, [field]: next };
    });
  };

  // Status Actions
  const handleStatusAction = async (
    action: (id: string) => Promise<any>,
    label: string,
    targetStatus: string,
    actionKey: string,
    confirmMsg?: string
  ) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setStatusUpdating(actionKey);
    try {
      await action(client!.id);
      toast.success(`Client ${label} successfully`);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      onClientUpdate?.();
      if (
        targetStatus === "DELETED" ||
        targetStatus === "BLOCKED" ||
        targetStatus === "INACTIVE"
      ) {
        panel.close();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setStatusUpdating(null);
    }
  };

  // Render Helpers
  const getInputProps = (field: string) => ({
    value: formData[field] || "",
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      if (validationError) setValidationError(null);
      setFormData((prev: any) => ({ ...prev, [field]: e.target.value }));
    },
  });

  // View Mode Render
  const renderViewMode = () => {
    const status = normalizeStatus(client?.status);
    const deletedBy =
      (client as any)?.deletedBy === "ADMIN"
        ? "Admin"
        : (client as any)?.deletedBy === "CLIENT"
          ? "Client"
          : null;

    // Get plan names
    const getPlanNames = (ids: string[], plans: any[]) => {
      if (!ids || ids.length === 0) return "None";
      return ids
        .map((id) => plans.find((p) => String(p.id) === id)?.name)
        .filter(Boolean)
        .join(", ");
    };

    const currentPlanIds = normalizeIdArray(
      (client as any)?.assignedPlanIds,
      (client as any)?.assignedPlanId
    );
    const currentMealIds = normalizeIdArray(
      (client as any)?.assignedMealPlanIds,
      (client as any)?.assignedMealPlanId
    );

    const stepsEnabledByAdmin = (client as any)?.stepsEnabledByAdmin !== false;
    const stepsSharingEnabled = (client as any)?.stepsSharingEnabled === true;
    const recentDays = Array.isArray((stepsRecent as any)?.days)
      ? ((stepsRecent as any).days as any[])
      : [];

    const assignedWorkoutPlans = currentPlanIds
      .map((id) => workoutPlansById.get(String(id)))
      .filter(Boolean)
      .map((p: any) => ({ id: String(p.id), name: String(p.name ?? "") }))
      .filter((p: any) => p.id && p.name);

    const assignedMealPlans = currentMealIds
      .map((id) => mealPlansById.get(String(id)))
      .filter(Boolean)
      .map((p: any) => ({ id: String(p.id), name: String(p.name ?? "") }))
      .filter((p: any) => p.id && p.name);

    return (
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <ClientAvatar
              name={client?.name || ""}
              src={(client as any)?.avatarDataUrl}
              size={64}
              className={status === "DELETED" ? "grayscale opacity-70" : ""}
            />
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                {client?.name}
                {status === "DELETED" ? (
                  <EntityStatusChip status="DELETED" size="sm" />
                ) : null}
              </h3>
              <div className="flex flex-col text-sm text-gray-500 dark:text-gray-400 mt-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" />
                  {client?.email}
                </div>
                {client?.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5" />
                    {client?.phone}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {status !== "DELETED" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => panelState.startEdit()}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1">
            <TabsTrigger className="w-full" value="overview">
              Overview
            </TabsTrigger>
            <TabsTrigger className="w-full" value="activity">
              Activity Log
            </TabsTrigger>
            <TabsTrigger className="w-full" value="actions">
              Actions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-4">
              <EntityInfoGrid>
                <ReadonlyInfoCard
                  icon={Calendar}
                  label="Birth Date"
                  value={formatBirthDateWithAge((client as any)?.birthDate)}
                />
                <ReadonlyInfoCard
                  icon={Users}
                  label="Gender"
                  value={String((client as any)?.gender ?? "-")}
                />
                <ReadonlyInfoCard
                  icon={Ruler}
                  label="Height"
                  value={
                    (client as any)?.height
                      ? `${String((client as any)?.height)} cm`
                      : "-"
                  }
                />
                <ReadonlyInfoCard
                  icon={Weight}
                  label="Weight"
                  value={
                    (client as any)?.weight
                      ? `${String((client as any)?.weight)} kg`
                      : "-"
                  }
                />
              </EntityInfoGrid>

              <div className="p-4 rounded-lg border bg-white dark:bg-gray-800">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-indigo-500" /> Goals &amp; Activity
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Goal</div>
                    <div className="text-sm font-medium">
                      {formatGoalLabel((client as any)?.goal)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Activity Level</div>
                    <div className="text-sm font-medium">
                      {formatActivityLabel(client?.activityLevel)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg border bg-white dark:bg-gray-800">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500" /> Assigned Plans
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Workout Plans</div>
                    <div className="text-sm font-medium">
                      {getPlanNames(currentPlanIds, workoutPlans)}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 mb-1">Meal Plans</div>
                    <div className="text-sm font-medium">
                      {getPlanNames(currentMealIds, mealPlans)}
                    </div>
                  </div>
                </div>
              </div>

              {(client as any)?.notes ? (
                <div className="p-4 rounded-lg border bg-white dark:bg-gray-800">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <StickyNote className="w-4 h-4 text-amber-500" /> Notes
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                    {(client as any)?.notes}
                  </p>
                </div>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="activity">
            <div className="space-y-6">
              <div className="p-4 rounded-lg border bg-white dark:bg-gray-800">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Daily Compliance
                </h4>
                <DailyComplianceCalendar
                  clientId={String(client?.id ?? "")}
                  readOnly
                  assignedWorkoutPlans={assignedWorkoutPlans}
                  assignedMealPlans={assignedMealPlans}
                />
              </div>

              <div className="p-4 rounded-lg border bg-white dark:bg-gray-800">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500" /> Steps
                </h4>

                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Enable steps tracking</div>
                    <div className="text-xs text-gray-500">
                      Client sharing is currently{" "}
                      <span className="font-medium">
                        {stepsSharingEnabled ? "ON" : "OFF"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={stepsEnabledByAdmin}
                      onCheckedChange={(next) => {
                        if (!client?.id) return;
                        if (toggleStepsEnabledMutation.isPending) return;
                        if (next === stepsEnabledByAdmin) return;
                        toggleStepsEnabledMutation.mutate(next);
                      }}
                      disabled={!client?.id || toggleStepsEnabledMutation.isPending}
                      className="disabled:cursor-default"
                    />
                  </div>
                </div>

                {recentDays.length > 0 ? (
                  <div className="mb-3">
                    <StepsProgressGraph days={recentDays} />
                  </div>
                ) : null}

                {recentDays.length > 0 ? (
                  <div className="rounded-md border overflow-hidden">
                    <div className="grid grid-cols-2 text-xs font-medium bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
                      <div>Date</div>
                      <div className="text-right">Steps</div>
                    </div>
                    {recentDays.map((d, idx) => (
                      <div
                        key={`${String(d?.date ?? idx)}-${idx}`}
                        className="grid grid-cols-2 px-3 py-2 text-sm border-t bg-white dark:bg-gray-800"
                      >
                        <div className="text-gray-700 dark:text-gray-200">
                          {formatDateDDMMYYYY(d?.date)}
                        </div>
                        <div className="text-right font-medium">
                          {Number(d?.steps ?? 0).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No recent steps</div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="actions">
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Current Status
                </span>
                <EntityStatusChip status={String(status || "PENDING")} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {status === "DELETED" ? (
                  <div className="col-span-1 sm:col-span-2 space-y-3">
                    <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-start gap-3">
                      <Archive className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          Client Archived
                        </p>
                        <p className="mt-1">
                          This client is currently in the deleted list (soft
                          delete). Data is preserved.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        className="justify-start h-auto py-2.5 cursor-pointer"
                        disabled={statusUpdating !== null}
                        onClick={() =>
                          handleStatusAction(
                            restoreClientAction,
                            "restored",
                            "PENDING",
                            "restore"
                          )
                        }
                      >
                        {statusUpdating === "restore" ? (
                          <Loader2 className="w-4 h-4 mr-2 text-green-600 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4 mr-2 text-green-600" />
                        )}
                        <span>Restore Client</span>
                      </Button>

                      <Button
                        variant="destructive"
                        className="justify-start h-auto py-2.5 cursor-pointer bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20"
                        disabled={statusUpdating !== null}
                        onClick={() => panelState.requestDelete()}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        <span>Permanently Delete</span>
                      </Button>
                    </div>

                    {panelState.showDeleteConfirm ? (
                      <EntityDeleteConfirm
                        title="Danger Zone: Permanent Deletion"
                        description={
                          <div className="space-y-3">
                            <div className="text-xs leading-relaxed font-medium">
                              This action CANNOT be undone. All data will be
                              physically removed from the database.
                            </div>
                            <div className="space-y-2">
                              <label
                                className="text-xs font-semibold uppercase text-red-600 dark:text-red-400 block mb-1 select-none"
                                onCopy={(e) => e.preventDefault()}
                                onCut={(e) => e.preventDefault()}
                                onContextMenu={(e) => e.preventDefault()}
                              >
                                Type DELETE to confirm
                              </label>
                              <Input
                                value={deleteConfirmText}
                                onChange={(e) =>
                                  setDeleteConfirmText(e.target.value)
                                }
                                onPaste={(e) => e.preventDefault()}
                                onDrop={(e) => e.preventDefault()}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                placeholder="DELETE"
                                className="bg-white dark:bg-black/20"
                              />
                            </div>
                          </div>
                        }
                        confirmLabel="Confirm Permanent Delete"
                        onCancel={() => {
                          panelState.cancelDelete();
                          setDeleteConfirmText("");
                        }}
                        onConfirm={() =>
                          handleStatusAction(
                            permanentlyDeleteClientAction,
                            "permanently deleted",
                            "DELETED",
                            "permanent_delete"
                          )
                        }
                        cancelDisabled={statusUpdating !== null}
                        confirmDisabled={
                          deleteConfirmText !== "DELETE" || statusUpdating !== null
                        }
                      />
                    ) : null}

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Restoring will set status to Pending.
                    </p>
                  </div>
                ) : (
                  <>
                    {status === "PENDING" ? (
                      <>
                        <div className="col-span-1 sm:col-span-2 p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-lg flex items-start gap-3">
                          <Mail className="w-5 h-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                          <div className="text-sm text-yellow-800 dark:text-yellow-200">
                            <p className="font-medium">Invitation Sent</p>
                            <p className="mt-1 opacity-90">
                              Client must accept the invitation and set up their
                              account before you can change their status.
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          className="col-span-1 sm:col-span-2 justify-start h-auto py-2.5 cursor-pointer"
                          disabled={statusUpdating !== null}
                          onClick={() =>
                            handleStatusAction(
                              resendClientInviteAction,
                              "Invite sent",
                              "PENDING",
                              "resend_invite"
                            )
                          }
                        >
                          {statusUpdating === "resend_invite" ? (
                            <Loader2 className="w-4 h-4 mr-2 text-blue-500 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4 mr-2 text-blue-500" />
                          )}
                          <span>Resend Invite</span>
                        </Button>
                      </>
                    ) : (
                      <>
                        {status !== "ACTIVE" && (
                          <Button
                            variant="outline"
                            className="justify-start h-auto py-2.5 cursor-pointer"
                            disabled={statusUpdating !== null}
                            onClick={() =>
                              handleStatusAction(
                                activateClientAction,
                                "activated",
                                "ACTIVE",
                                "activate"
                              )
                            }
                          >
                            {statusUpdating === "activate" ? (
                              <Loader2 className="w-4 h-4 mr-2 text-green-600 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                            )}
                            <span>Activate Access</span>
                          </Button>
                        )}
                        {status === "ACTIVE" && (
                          <Button
                            variant="outline"
                            className="justify-start h-auto py-2.5 cursor-pointer"
                            disabled={statusUpdating !== null}
                            onClick={() =>
                              handleStatusAction(
                                deactivateClientAction,
                                "deactivated",
                                "INACTIVE",
                                "deactivate"
                              )
                            }
                          >
                            {statusUpdating === "deactivate" ? (
                              <Loader2 className="w-4 h-4 mr-2 text-orange-500 animate-spin" />
                            ) : (
                              <PauseCircle className="w-4 h-4 mr-2 text-orange-500" />
                            )}
                            <span>Deactivate</span>
                          </Button>
                        )}
                        {status === "BLOCKED" ? (
                          <Button
                            variant="outline"
                            className="justify-start h-auto py-2.5 cursor-pointer"
                            disabled={statusUpdating !== null}
                            onClick={() =>
                              handleStatusAction(
                                unblockClientAction,
                                "unblocked",
                                "ACTIVE",
                                "unblock"
                              )
                            }
                          >
                            {statusUpdating === "unblock" ? (
                              <Loader2 className="w-4 h-4 mr-2 text-amber-500 animate-spin" />
                            ) : (
                              <ShieldAlert className="w-4 h-4 mr-2 text-amber-500" />
                            )}
                            <span>Unblock</span>
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            className="justify-start h-auto py-2.5 cursor-pointer"
                            disabled={statusUpdating !== null}
                            onClick={() =>
                              handleStatusAction(
                                blockClientAction,
                                "blocked",
                                "BLOCKED",
                                "block"
                              )
                            }
                          >
                            {statusUpdating === "block" ? (
                              <Loader2 className="w-4 h-4 mr-2 text-red-500 animate-spin" />
                            ) : (
                              <Ban className="w-4 h-4 mr-2 text-red-500" />
                            )}
                            <span>Block Access</span>
                          </Button>
                        )}
                      </>
                    )}

                    {panelState.showDeleteConfirm ? (
                      <div className="col-span-1 sm:col-span-2">
                        <EntityDeleteConfirm
                          title="Archive Client?"
                          description={
                            "This client will be moved to the Deleted list. You can restore them later if needed."
                          }
                          confirmLabel="Archive"
                          onCancel={() => {
                            panelState.cancelDelete();
                            setDeleteConfirmText("");
                          }}
                          onConfirm={() =>
                            handleStatusAction(
                              deleteClientAction,
                              "archived",
                              "DELETED",
                              "soft_delete"
                            )
                          }
                          cancelDisabled={statusUpdating !== null}
                          confirmDisabled={statusUpdating !== null}
                        />
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="justify-start h-auto py-2.5 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 cursor-pointer"
                        disabled={statusUpdating !== null}
                        onClick={() => panelState.requestDelete()}
                      >
                        <Archive className="w-4 h-4 mr-2" />
                        <span>Archive / Delete</span>
                      </Button>
                    )}
                  </>
                )}
              </div>

              {status === "DELETED" && deletedBy && (
                <div className="text-sm text-gray-500 flex items-center gap-2 mt-2">
                  <Users className="w-4 h-4" />
                  Deleted by {deletedBy} on{" "}
                  {new Date((client as any).deletedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  // Edit Mode Render
  const renderEditMode = () => {
    return (
      <form id="client-form" onSubmit={handleSubmit} className="space-y-6">
        {validationError && (
          <div className="p-3 rounded-md bg-red-50 text-red-600 text-sm border border-red-100 flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            {validationError}
          </div>
        )}

        <div className="flex items-center gap-4">
          <ClientAvatar
            name={formData.name || ""}
            src={formData.avatarDataUrl}
            size={64}
          />
          {client && formData.avatarDataUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRemoveImageOpen(true)}
            >
              Remove Image
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2">
            <label className="text-sm font-medium">Full Name *</label>
            <Input {...getInputProps("name")} placeholder="John Doe" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Email *</label>
            <Input
              type="email"
              {...getInputProps("email")}
              placeholder="john@example.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Phone *</label>
            <Input
              type="tel"
              {...getInputProps("phone")}
              placeholder="+1234567890"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Birth Date</label>
            <Input type="date" {...getInputProps("birthDate")} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Gender</label>
            <Select
              value={formData.gender}
              onValueChange={(v) =>
                setFormData((p: any) => ({ ...p, gender: v }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Height (cm)</label>
            <Input type="number" {...getInputProps("height")} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Weight (kg)</label>
            <Input type="number" {...getInputProps("weight")} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Goal</label>
            <Select
              value={
                goalMode === "custom"
                  ? CUSTOM_SELECT_VALUE
                  : String((formData as any)?.goal ?? "")
              }
              onValueChange={(v) => {
                if (v === CUSTOM_SELECT_VALUE) {
                  setGoalMode("custom");
                  setFormData((p: any) => {
                    const prev = String(p.goal ?? "").trim();
                    const prevIsPreset = GOAL_PRESET_VALUES.includes(prev);
                    return { ...p, goal: prevIsPreset ? "" : prev };
                  });
                  return;
                }

                setGoalMode("select");
                setFormData((p: any) => ({ ...p, goal: v }));
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select goal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weight_loss">Fat Loss</SelectItem>
                <SelectItem value="muscle_gain">Muscle Gain</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="strength">Strength</SelectItem>
                <SelectItem value="endurance">Endurance</SelectItem>
                <SelectItem value="recomposition">Recomposition</SelectItem>
                <SelectItem value="better_habits">Better Habits</SelectItem>
                <SelectItem value={CUSTOM_SELECT_VALUE}>Custom…</SelectItem>
              </SelectContent>
            </Select>

            {goalMode === "custom" && (
              <Input
                placeholder="Custom goal"
                value={String((formData as any)?.goal ?? "")}
                onChange={(e) =>
                  setFormData((p: any) => ({ ...p, goal: e.target.value }))
                }
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Activity Level</label>
            <Select
              value={
                activityMode === "custom"
                  ? CUSTOM_SELECT_VALUE
                  : String((formData as any)?.activityLevel ?? "")
              }
              onValueChange={(v) => {
                if (v === CUSTOM_SELECT_VALUE) {
                  setActivityMode("custom");
                  setFormData((p: any) => {
                    const prev = String(p.activityLevel ?? "").trim();
                    const prevIsPreset = ACTIVITY_PRESET_VALUES.includes(prev);
                    return { ...p, activityLevel: prevIsPreset ? "" : prev };
                  });
                  return;
                }

                setActivityMode("select");
                setFormData((p: any) => ({ ...p, activityLevel: v }));
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select activity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentary">Sedentary</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="very">Very Active</SelectItem>
                <SelectItem value="extra">Extra Active</SelectItem>
                <SelectItem value={CUSTOM_SELECT_VALUE}>Custom…</SelectItem>
              </SelectContent>
            </Select>

            {activityMode === "custom" && (
              <Input
                placeholder="Custom activity level"
                value={String((formData as any)?.activityLevel ?? "")}
                onChange={(e) =>
                  setFormData((p: any) => ({
                    ...p,
                    activityLevel: e.target.value,
                  }))
                }
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Assigned Workout Plan</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between font-normal"
                >
                  {formData.assignedPlanIds?.length
                    ? `${formData.assignedPlanIds.length} selected`
                    : "None"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-2">
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {(() => {
                    const assignedIds: string[] = Array.isArray(
                      formData.assignedPlanIds
                    )
                      ? (formData.assignedPlanIds as string[])
                      : [];

                    const archivedAssigned = assignedIds
                      .map((id) => ({ id, plan: workoutPlansById.get(String(id)) }))
                      .filter(({ plan }) => {
                        const status = String(plan?.status ?? "").trim().toUpperCase();
                        return status === "ARCHIVED";
                      });

                    return (
                      <>
                        {archivedAssigned.length > 0 ? (
                          <div className="p-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800">
                            <div className="text-xs font-medium text-amber-900 dark:text-amber-100">
                              Archived workout plans (already assigned)
                            </div>
                            <div className="mt-1 space-y-1">
                              {archivedAssigned.map(({ id, plan }) => (
                                <div
                                  key={id}
                                  className="flex items-center justify-between gap-2 rounded px-2 py-1 bg-white/60 dark:bg-black/20"
                                >
                                  <div className="min-w-0">
                                    <div className="text-xs font-medium text-amber-900 dark:text-amber-100 truncate">
                                      {String(plan?.name ?? "(Unknown plan)")}
                                    </div>
                                    <div className="text-[11px] text-amber-800 dark:text-amber-200 truncate">
                                      Cannot be assigned while archived
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-rose-700 hover:text-rose-800 dark:text-rose-300 dark:hover:text-rose-200"
                                    onClick={() =>
                                      toggleAssignedId(
                                        "assignedPlanIds",
                                        String(id)
                                      )
                                    }
                                  >
                                    Remove
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {activeWorkoutPlans.map((plan: any) => (
                          <label
                            key={plan.id}
                            className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer"
                          >
                            <Checkbox
                              checked={formData.assignedPlanIds?.includes(
                                String(plan.id)
                              )}
                              onCheckedChange={() =>
                                toggleAssignedId(
                                  "assignedPlanIds",
                                  String(plan.id)
                                )
                              }
                            />
                            <span className="text-sm">{plan.name}</span>
                          </label>
                        ))}
                      </>
                    );
                  })()}

                  {activeWorkoutPlans.length === 0 && (
                    <div className="text-sm text-gray-500 p-2">
                      No plans available
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Assigned Meal Plan</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between font-normal"
                >
                  {formData.assignedMealPlanIds?.length
                    ? `${formData.assignedMealPlanIds.length} selected`
                    : "None"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-2">
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {(() => {
                    const assignedIds: string[] = Array.isArray(
                      formData.assignedMealPlanIds
                    )
                      ? (formData.assignedMealPlanIds as string[])
                      : [];

                    const archivedAssigned = assignedIds
                      .map((id) => ({ id, plan: mealPlansById.get(String(id)) }))
                      .filter(({ plan }) => {
                        const status = String(plan?.status ?? "").trim().toUpperCase();
                        return status === "ARCHIVED";
                      });

                    return (
                      <>
                        {archivedAssigned.length > 0 ? (
                          <div className="p-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800">
                            <div className="text-xs font-medium text-amber-900 dark:text-amber-100">
                              Archived meal plans (already assigned)
                            </div>
                            <div className="mt-1 space-y-1">
                              {archivedAssigned.map(({ id, plan }) => (
                                <div
                                  key={id}
                                  className="flex items-center justify-between gap-2 rounded px-2 py-1 bg-white/60 dark:bg-black/20"
                                >
                                  <div className="min-w-0">
                                    <div className="text-xs font-medium text-amber-900 dark:text-amber-100 truncate">
                                      {String(plan?.name ?? "(Unknown plan)")}
                                    </div>
                                    <div className="text-[11px] text-amber-800 dark:text-amber-200 truncate">
                                      Cannot be assigned while archived
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-rose-700 hover:text-rose-800 dark:text-rose-300 dark:hover:text-rose-200"
                                    onClick={() =>
                                      toggleAssignedId(
                                        "assignedMealPlanIds",
                                        String(id)
                                      )
                                    }
                                  >
                                    Remove
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {activeMealPlans.map((plan: any) => (
                          <label
                            key={plan.id}
                            className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer"
                          >
                            <Checkbox
                              checked={formData.assignedMealPlanIds?.includes(
                                String(plan.id)
                              )}
                              onCheckedChange={() =>
                                toggleAssignedId(
                                  "assignedMealPlanIds",
                                  String(plan.id)
                                )
                              }
                            />
                            <span className="text-sm">{plan.name}</span>
                          </label>
                        ))}
                      </>
                    );
                  })()}

                  {activeMealPlans.length === 0 && (
                    <div className="text-sm text-gray-500 p-2">
                      No plans available
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="col-span-2 space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              {...getInputProps("notes")}
              placeholder="Internal notes (private — not shared with the client)"
            />
          </div>
        </div>
      </form>
    );
  };

  React.useEffect(() => {
    panel.setTitle(
      panelState.isEditing
        ? client
          ? "Edit Client"
          : "New Client"
        : "Client Details"
    );
    panel.setDescription(
      panelState.isEditing
        ? client
          ? "Update client text information"
          : "Add a new client to your roster"
        : `View details for ${client?.name}`
    );

    panel.setFooter(
      panelState.isEditing ? (
        <EntityEditFooter
          isNew={!client}
          isLoading={saveMutation.isPending}
          formId="client-form"
          onCancel={() => (client ? panelState.cancelEdit() : panel.close())}
          createLabel="Create Client"
          creatingLabel="Saving..."
          savingLabel="Saving..."
        />
      ) : undefined
    );
  }, [
    panel,
    panelState,
    client,
    client?.name,
    saveMutation.isPending,
  ]);

  return (
    <>
      {panelState.isEditing ? renderEditMode() : renderViewMode()}

      <ConfirmModal
        open={removeImageOpen}
        onOpenChange={setRemoveImageOpen}
        title="Remove client image?"
        description="This cannot be undone."
        confirmText="Remove"
        cancelText="Cancel"
        confirmVariant="destructive"
        loading={removeAvatarMutation.isPending}
        onConfirm={async () => await removeAvatarMutation.mutateAsync()}
      />
    </>
  );
}

// Helpers same as before...
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

function normalizeStatus(value: unknown) {
  const v = String(value ?? "")
    .trim()
    .toUpperCase();
  return ["ACTIVE", "PENDING", "INACTIVE", "BLOCKED", "DELETED"].includes(v)
    ? v
    : "PENDING";
}

function normalizeGender(value: unknown): string {
  const raw = String(value || "")
    .toLowerCase()
    .trim();
  if (["male", "m", "man"].includes(raw)) return "male";
  if (["female", "f", "woman"].includes(raw)) return "female";
  if (["other", "nonbinary"].includes(raw)) return "other";
  return "";
}

function normalizeActivityLevel(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const known = ["sedentary", "light", "moderate", "active", "very", "extra"];
  if (known.includes(raw)) return raw;

  // Canonicalize common label spellings, but avoid fuzzy matching so custom values are preserved.
  const deCamel = raw.replace(/([a-z])([A-Z])/g, "$1 $2");
  const v = deCamel
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (v === "sedentary") return "sedentary";
  if (v === "light") return "light";
  if (v === "moderate") return "moderate";
  if (v === "active") return "active";
  if (v === "very" || v === "very active" || v === "veryactive") return "very";
  if (v === "extra" || v === "extra active" || v === "extraactive") return "extra";

  return raw;
}

function normalizeGoal(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const known = [
    "weight_loss",
    "muscle_gain",
    "maintenance",
    "strength",
    "endurance",
    "recomposition",
    "better_habits",
  ];
  if (known.includes(raw)) return raw;

  if (raw === "Fat Loss") return "weight_loss";
  if (raw === "Muscle Gain") return "muscle_gain";
  if (raw === "Maintenance") return "maintenance";
  if (raw === "Strength") return "strength";
  if (raw === "Endurance") return "endurance";
  if (raw === "Recomposition") return "recomposition";
  if (raw === "Better Habits") return "better_habits";

  const v = raw
    .toLowerCase()
    .trim()
    .replace(/[-\s]+/g, "_")
    .replace(/_+/g, "_");
  if (known.includes(v)) return v;

  return raw;
}

function formatGoalLabel(value: any) {
  const raw = String(value ?? "").trim();
  const v = normalizeGoal(value);
  const map: Record<string, string> = {
    weight_loss: "Fat Loss",
    muscle_gain: "Muscle Gain",
    maintenance: "Maintenance",
    strength: "Strength",
    endurance: "Endurance",
    recomposition: "Recomposition",
    better_habits: "Better Habits",
  };
  return map[v] || raw;
}

function formatActivityLabel(value: any) {
  const raw = String(value ?? "").trim();
  const v = normalizeActivityLevel(value);
  const map: Record<string, string> = {
    sedentary: "Sedentary",
    light: "Light",
    moderate: "Moderate",
    active: "Active",
    very: "Very Active",
    extra: "Extra Active",
  };
  return map[v] || raw;
}

function normalizeIdArray(value: any, singleFallback: any): string[] {
  const list = Array.isArray(value) ? value : [];
  if (singleFallback && !list.includes(singleFallback))
    list.push(singleFallback);
  return list.map(String).filter((x) => x && x !== "none");
}
