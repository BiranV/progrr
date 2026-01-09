"use client";

import React from "react";
import { db } from "@/lib/db";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import SidePanel from "@/components/ui/side-panel";
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
import { toast } from "sonner";
import { useRouter } from "next/navigation";
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

interface ClientDetailsDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Optional props for view mode optimization, though we fetch lists internally for edit mode
  workoutPlanNameById?: Map<string, string>;
  mealPlanNameById?: Map<string, string>;
  onClientUpdate?: () => void;
}

const REQUIRED_FIELDS: Array<keyof Client> = ["name", "email", "phone"];

export default function ClientDetailsDialog({
  client,
  open,
  onOpenChange,
  onClientUpdate,
}: ClientDetailsDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // State
  const [isEditing, setIsEditing] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(
    null
  );
  const [removeImageOpen, setRemoveImageOpen] = React.useState(false);
  const [statusUpdating, setStatusUpdating] = React.useState<string | null>(
    null
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");

  // Reset editing state when dialog opens/closes or client changes
  React.useEffect(() => {
    if (open) {
      if (!client) {
        // Create mode
        setIsEditing(true);
        resetForm(null);
      } else {
        // View mode
        setIsEditing(false);
        resetForm(client);
      }
      // Reset delete confirmation state
      setShowDeleteConfirm(false);
      setDeleteConfirmText("");
    }
  }, [open, client]);

  // Data
  const { data: workoutPlans = [] } = useQuery({
    queryKey: ["workoutPlans"],
    queryFn: () => db.entities.WorkoutPlan.list(),
  });

  const { data: mealPlans = [] } = useQuery({
    queryKey: ["mealPlans"],
    queryFn: () => db.entities.MealPlan.list(),
  });

  // Form State
  const [formData, setFormData] = React.useState<any>({});

  const resetForm = (c: Client | null) => {
    setValidationError(null);
    if (c) {
      // Load existing client data
      const data: any = (c as any).data || {};
      const source = Object.keys(data).length > 0 ? data : c;

      setFormData({
        name: String(source.name ?? ""),
        email: String(source.email ?? ""),
        phone: String(source.phone ?? ""),
        avatarDataUrl: (c as any).avatarDataUrl ?? null,
        birthDate: String(source.birthDate ?? ""),
        gender: normalizeGender(source.gender),
        height: String(source.height ?? ""),
        weight: String(source.weight ?? ""),
        goal: normalizeGoal(source.goal),
        activityLevel: normalizeActivityLevel(source.activityLevel),
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
        onOpenChange(false); // Close on create
      } else {
        setIsEditing(false); // Return to view mode on edit
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
      router.refresh();
      if (
        targetStatus === "DELETED" ||
        targetStatus === "BLOCKED" ||
        targetStatus === "INACTIVE"
      ) {
        onOpenChange(false);
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

    return (
      <div className="space-y-8">
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
                {status === "DELETED" && (
                  <span className="text-xs font-normal px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
                    Deleted
                  </span>
                )}
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
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg border bg-white dark:bg-gray-800">
            <div className="text-xs text-gray-400 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> Birth Date
            </div>
            <div className="font-medium">
              {(client as any)?.birthDate || "-"}
            </div>
          </div>
          <div className="p-3 rounded-lg border bg-white dark:bg-gray-800">
            <div className="text-xs text-gray-400 mb-1 flex items-center gap-1.5">
              <Users className="w-3 h-3" /> Gender
            </div>
            <div className="font-medium capitalize">
              {(client as any)?.gender || "-"}
            </div>
          </div>
          <div className="p-3 rounded-lg border bg-white dark:bg-gray-800">
            <div className="text-xs text-gray-400 mb-1 flex items-center gap-1.5">
              <Ruler className="w-3 h-3" /> Height
            </div>
            <div className="font-medium">
              {(client as any)?.height ? `${(client as any)?.height} cm` : "-"}
            </div>
          </div>
          <div className="p-3 rounded-lg border bg-white dark:bg-gray-800">
            <div className="text-xs text-gray-400 mb-1 flex items-center gap-1.5">
              <Weight className="w-3 h-3" /> Weight
            </div>
            <div className="font-medium">
              {(client as any)?.weight ? `${(client as any)?.weight} kg` : "-"}
            </div>
          </div>
        </div>

        {/* Goals & Plans */}
        <div className="space-y-4">
          <div className="p-4 rounded-lg border bg-white dark:bg-gray-800">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-500" /> Goals & Activity
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

          {(client as any)?.notes && (
            <div className="p-4 rounded-lg border bg-white dark:bg-gray-800">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-amber-500" /> Notes
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                {(client as any)?.notes}
              </p>
            </div>
          )}
        </div>

        {/* Status Banner */}
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Current Status
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${status === "ACTIVE"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : ""
                }
                    ${status === "INACTIVE"
                  ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                  : ""
                }
                    ${status === "BLOCKED"
                  ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  : ""
                }
                    ${status === "DELETED"
                  ? "bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-500"
                  : ""
                }
                `}
            >
              {toTitleCase(status)}
            </span>
          </div>

          {/* Lifecycle Actions */}
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
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    <span>Permanently Delete</span>
                  </Button>
                </div>

                {showDeleteConfirm && (
                  <div className="p-4 border border-red-200 bg-red-50 dark:bg-red-900/10 rounded-lg space-y-3 mt-4">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-red-900 dark:text-red-100 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" />
                        Danger Zone: Permanent Deletion
                      </div>
                      <div className="text-xs text-red-800 dark:text-red-200 leading-relaxed font-medium">
                        This action CANNOT be undone. All data will be
                        physically removed from the database.
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase text-red-600 dark:text-red-400">
                        Type DELETE to confirm
                      </label>
                      <Input
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="DELETE"
                        className="bg-white dark:bg-black/20"
                      />
                    </div>

                    <div className="flex gap-2 justify-end pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteConfirmText("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={
                          deleteConfirmText !== "DELETE" ||
                          statusUpdating !== null
                        }
                        onClick={() =>
                          handleStatusAction(
                            permanentlyDeleteClientAction,
                            "permanently deleted",
                            "DELETED",
                            "permanent_delete"
                          )
                        }
                      >
                        {statusUpdating === "permanent_delete" ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 mr-2" />
                        )}
                        Confirm Permanent Delete
                      </Button>
                    </div>
                  </div>
                )}

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

                {showDeleteConfirm ? (
                  <div className="p-4 border border-orange-200 bg-orange-50 dark:bg-orange-900/10 rounded-lg space-y-3 col-span-1 sm:col-span-2">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-orange-900 dark:text-orange-100 flex items-center gap-2">
                        <Archive className="w-4 h-4" />
                        Remove from active use?
                      </div>
                      <div className="text-xs text-orange-800 dark:text-orange-200 leading-relaxed">
                        This client will be moved to the Deleted list. You can
                        restore them later if needed.
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteConfirmText("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="default"
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                        size="sm"
                        disabled={statusUpdating !== null}
                        onClick={() =>
                          handleStatusAction(
                            deleteClientAction,
                            "archived",
                            "DELETED",
                            "soft_delete"
                          )
                        }
                      >
                        {statusUpdating === "soft_delete" ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Archive className="w-4 h-4 mr-2" />
                        )}
                        Archive Client
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="justify-start h-auto py-2.5 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 cursor-pointer"
                    disabled={statusUpdating !== null}
                    onClick={() => setShowDeleteConfirm(true)}
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
              value={formData.goal}
              onValueChange={(v) =>
                setFormData((p: any) => ({ ...p, goal: v }))
              }
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
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Activity Level</label>
            <Select
              value={formData.activityLevel}
              onValueChange={(v) =>
                setFormData((p: any) => ({ ...p, activityLevel: v }))
              }
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
              </SelectContent>
            </Select>
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
                  {workoutPlans.map((plan: any) => (
                    <label
                      key={plan.id}
                      className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer"
                    >
                      <Checkbox
                        checked={formData.assignedPlanIds?.includes(
                          String(plan.id)
                        )}
                        onCheckedChange={() =>
                          toggleAssignedId("assignedPlanIds", String(plan.id))
                        }
                      />
                      <span className="text-sm">{plan.name}</span>
                    </label>
                  ))}
                  {workoutPlans.length === 0 && (
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
                  {mealPlans.map((plan: any) => (
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
                  {mealPlans.length === 0 && (
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
              placeholder="Additional notes..."
            />
          </div>
        </div>
      </form>
    );
  };

  return (
    <>
      <SidePanel
        open={open}
        onOpenChange={onOpenChange}
        title={
          isEditing ? (client ? "Edit Client" : "New Client") : "Client Details"
        }
        description={
          isEditing
            ? client
              ? "Update client text information"
              : "Add a new client to your roster"
            : `View details for ${client?.name}`
        }
        widthClassName="w-full sm:w-[540px] lg:w-[600px]"
        footer={
          isEditing ? (
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                type="button"
                onClick={() =>
                  client ? setIsEditing(false) : onOpenChange(false)
                }
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="client-form"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending
                  ? "Saving..."
                  : client
                    ? "Save Changes"
                    : "Create Client"}
              </Button>
            </div>
          ) : (
            <div className="flex justify-start">
              {/* View mode footer usually empty or status actions only if we moved them here */}
            </div>
          )
        }
      >
        {isEditing ? renderEditMode() : renderViewMode()}
      </SidePanel>

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
  const raw = String(value || "")
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  if (raw.includes("sedentary")) return "sedentary";
  if (raw.includes("light")) return "light";
  if (raw.includes("moderate")) return "moderate";
  if (raw.includes("very")) return "very";
  if (raw.includes("extra")) return "extra";
  if (raw.includes("active")) return "active";
  return "";
}

function normalizeGoal(value: unknown): string {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("loss")) return "weight_loss";
  if (raw.includes("muscle")) return "muscle_gain";
  if (raw.includes("maint")) return "maintenance";
  if (raw.includes("strength")) return "strength";
  if (raw.includes("endur")) return "endurance";
  if (raw.includes("recomp")) return "recomposition";
  if (raw.includes("habit")) return "better_habits";
  return "";
}

function formatGoalLabel(value: any) {
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
  return map[v] || toTitleCase(value);
}

function formatActivityLabel(value: any) {
  const v = normalizeActivityLevel(value);
  const map: Record<string, string> = {
    sedentary: "Sedentary",
    light: "Light Active",
    moderate: "Moderately Active",
    active: "Active",
    very: "Very Active",
    extra: "Extra Active",
  };
  return map[v] || toTitleCase(value);
}

function normalizeIdArray(value: any, singleFallback: any): string[] {
  const list = Array.isArray(value) ? value : [];
  if (singleFallback && !list.includes(singleFallback))
    list.push(singleFallback);
  return list.map(String).filter((x) => x && x !== "none");
}
