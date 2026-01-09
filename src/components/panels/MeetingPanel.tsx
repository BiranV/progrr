"use client";

import React from "react";
import { db } from "@/lib/db";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import SidePanel from "@/components/ui/side-panel";
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
  Calendar as CalendarIcon,
  Clock,
  Edit2,
  History,
  Link as LinkIcon,
  MapPin,
  Phone,
  Trash2,
  User,
  Video,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { Client, Meeting } from "@/types";
import { toast } from "sonner";

const OTHER_CLIENT_ID = "__PROSPECT__";
const OTHER_CLIENT_LABEL = "Other (not a client)";
const OTHER_CLIENT_NAME_FIELD = "otherClientName";

interface MeetingPanelProps {
  meetingId: string | null;
  clients: Client[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function ceilToNextMinute(date: Date): Date {
  const d = new Date(date);
  const shouldCeil = d.getSeconds() > 0 || d.getMilliseconds() > 0;
  d.setSeconds(0, 0);
  if (shouldCeil) d.setMinutes(d.getMinutes() + 1);
  return d;
}

function isoToLocalDateTimeInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return toLocalDateTimeInputValue(d);
}

function normalizeMeetingType(type: unknown): "zoom" | "call" | "in-person" {
  const t = String(type ?? "")
    .trim()
    .toLowerCase();
  if (t === "call") return "call";
  if (t === "in-person" || t === "in_person" || t === "inperson")
    return "in-person";
  return "zoom";
}

function normalizeMeetingStatus(
  status: unknown
): "scheduled" | "completed" | "cancelled" | "no-show" {
  const s = String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");

  if (s === "completed") return "completed";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "no-show" || s === "no show") return "no-show";
  return "scheduled";
}

export default function MeetingPanel({
  meetingId,
  clients,
  open,
  onOpenChange,
}: MeetingPanelProps) {
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(
    null
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const { data: meeting } = useQuery({
    queryKey: ["meeting", meetingId],
    queryFn: async () => {
      if (!meetingId) return null;
      return (await db.entities.Meeting.get(meetingId)) as Meeting;
    },
    enabled: open && Boolean(meetingId),
  });

  const [formData, setFormData] = React.useState<Partial<Meeting>>({
    title: "",
    type: "zoom",
    status: "scheduled",
    scheduledAt: "",
    durationMinutes: 60,
    location: "",
    clientId: "",
    [OTHER_CLIENT_NAME_FIELD]: "",
    notes: "",
  });

  React.useEffect(() => {
    if (!open) return;

    setValidationError(null);
    setShowDeleteConfirm(false);

    if (!meetingId) {
      setIsEditing(true);
      setFormData({
        title: "",
        type: "zoom",
        status: "scheduled",
        scheduledAt: "",
        durationMinutes: 60,
        location: "",
        clientId: "",
        [OTHER_CLIENT_NAME_FIELD]: "",
        notes: "",
      });
    } else {
      setIsEditing(false);
    }
  }, [open, meetingId]);

  React.useEffect(() => {
    if (!open) return;
    if (!isEditing) return;

    if (meetingId && meeting) {
      setFormData({
        title: meeting.title || "",
        type: normalizeMeetingType((meeting as any).type),
        status: normalizeMeetingStatus((meeting as any).status),
        scheduledAt: meeting.scheduledAt
          ? isoToLocalDateTimeInputValue(meeting.scheduledAt)
          : "",
        durationMinutes: (meeting as any).durationMinutes || 60,
        location: (meeting as any).location || "",
        clientId: String((meeting as any).clientId ?? "").trim(),
        [OTHER_CLIENT_NAME_FIELD]:
          String((meeting as any)?.[OTHER_CLIENT_NAME_FIELD] ?? "").trim() ||
          String((meeting as any)?.prospectName ?? "").trim() ||
          String((meeting as any)?.guestName ?? "").trim() ||
          "",
        notes: meeting.notes || "",
      });
    }
  }, [open, isEditing, meetingId, meeting]);
  const getClientName = (clientId: string) => {
    if (clientId === OTHER_CLIENT_ID) {
      const name = String(
        (meeting as any)?.[OTHER_CLIENT_NAME_FIELD] ?? ""
      ).trim();
      return name || OTHER_CLIENT_LABEL;
    }
    const client = clients.find((c: Client) => c.id === clientId);
    return client?.name || "Unknown";
  };

  const getMeetingIcon = (type: string) => {
    switch (type) {
      case "zoom":
        return <Video className="w-4 h-4" />;
      case "call":
        return <Phone className="w-4 h-4" />;
      default:
        return <MapPin className="w-4 h-4" />;
    }
  };

  const statusChipClasses = (status?: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200";
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200";
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200";
      case "no_show":
      case "no-show":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/25 dark:text-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800/60 dark:text-gray-200";
    }
  };

  const scheduledAt = meeting?.scheduledAt
    ? new Date(meeting.scheduledAt)
    : null;
  const isPast = scheduledAt ? scheduledAt.getTime() < Date.now() : false;

  const minDateTimeLocal = React.useMemo(() => {
    return toLocalDateTimeInputValue(ceilToNextMinute(new Date()));
  }, [open]);

  const shouldEnforceMinDateTime = React.useMemo(() => {
    if (!meeting) return true;
    const existing = meeting?.scheduledAt ? new Date(meeting.scheduledAt) : null;
    if (!existing || Number.isNaN(existing.getTime())) return true;
    return existing.getTime() >= Date.now();
  }, [meeting]);

  const canChooseNoShow = React.useMemo(() => {
    if (shouldEnforceMinDateTime) return false;

    const scheduledAtLocal = String(formData.scheduledAt ?? "").trim();
    const d = scheduledAtLocal ? new Date(scheduledAtLocal) : null;
    if (!d || Number.isNaN(d.getTime())) return false;
    return d.getTime() < Date.now();
  }, [formData.scheduledAt, shouldEnforceMinDateTime]);

  React.useEffect(() => {
    const status = String(formData.status ?? "");
    if ((status === "no-show" || status === "no_show") && !canChooseNoShow) {
      setFormData((prev) => ({ ...prev, status: "scheduled" }));
    }
  }, [canChooseNoShow]);

  const typeBasedKind = React.useMemo<
    "link" | "location" | "phone" | null
  >(() => {
    const t = String((meeting as any)?.type ?? "")
      .trim()
      .toLowerCase();
    if (!t) return null;
    if (t === "call") return "phone";
    if (t === "zoom") return "link";
    return "location";
  }, [meeting]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const title = String(formData.title ?? "").trim();
      if (!title) throw new Error("Title is required");

      const clientId = String((formData as any).clientId ?? "").trim();
      if (!clientId) {
        throw new Error("Client is required");
      }
      if (clientId === OTHER_CLIENT_ID && !otherClientName) {
        throw new Error("Please enter a name for the 'Other' client");
      }

      if (shouldEnforceMinDateTime) {
        const scheduledAtLocal = String(formData.scheduledAt ?? "").trim();
        const d = scheduledAtLocal ? new Date(scheduledAtLocal) : null;
        if (!d || Number.isNaN(d.getTime())) {
          throw new Error("Please select a valid meeting date & time");
        }
        if (d.getTime() < Date.now()) {
          throw new Error("Meeting date & time cannot be in the past");
        }
      }

      const payload: any = { ...formData, title };
      const scheduledAtLocal = String(formData.scheduledAt ?? "").trim();

      payload.type = normalizeMeetingType(payload.type);
      payload.status = normalizeMeetingStatus(payload.status);
      payload.clientId = String(payload.clientId ?? "").trim();

      if (String(payload.clientId ?? "").trim() === OTHER_CLIENT_ID) {
        payload[OTHER_CLIENT_NAME_FIELD] = otherClientName;
      } else {
        delete payload[OTHER_CLIENT_NAME_FIELD];
      }

      if (meetingId && meeting) {
        const originalLocal = meeting.scheduledAt
          ? isoToLocalDateTimeInputValue(meeting.scheduledAt)
          : "";

        const scheduledAtUnchanged =
          !!scheduledAtLocal && !!originalLocal && scheduledAtLocal === originalLocal;

        if (scheduledAtUnchanged) {
          delete payload.scheduledAt;
        } else if (scheduledAtLocal) {
          payload.scheduledAt = new Date(scheduledAtLocal).toISOString();
        } else {
          delete payload.scheduledAt;
        }

        return db.entities.Meeting.update(meetingId, payload);
      }

      payload.scheduledAt = scheduledAtLocal
        ? new Date(scheduledAtLocal).toISOString()
        : new Date().toISOString();

      return db.entities.Meeting.create(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["meetings"] });
      await queryClient.invalidateQueries({ queryKey: ["meeting"] });

      toast.success(meetingId ? "Meeting updated" : "Meeting scheduled");

      if (!meetingId) {
        onOpenChange(false);
      } else {
        setIsEditing(false);
      }
    },
    onError: (error: any) => {
      const msg = error?.message || "Failed to save meeting";
      setValidationError(String(msg));
      toast.error(String(msg));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!meetingId) return;
      await db.entities.Meeting.delete(meetingId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Meeting deleted");
      setShowDeleteConfirm(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(String(error?.message || "Failed to delete meeting"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    saveMutation.mutate();
  };

  const clientSelectValue = React.useMemo(() => {
    const fromForm = String((formData as any).clientId ?? "").trim();
    if (fromForm) return fromForm;
    const fromMeeting = String((meeting as any)?.clientId ?? "").trim();
    return fromMeeting;
  }, [formData, meeting]);

  const hasClientOption = React.useMemo(() => {
    if (!clientSelectValue) return true;
    if (clientSelectValue === OTHER_CLIENT_ID) return true;
    return (clients ?? []).some(
      (c) => String((c as any)?.id ?? "").trim() === clientSelectValue
    );
  }, [clients, clientSelectValue]);

  const selectedClientName = React.useMemo(() => {
    if (!clientSelectValue) return "";
    if (clientSelectValue === OTHER_CLIENT_ID) return OTHER_CLIENT_LABEL;
    const found = (clients ?? []).find(
      (c) => String((c as any)?.id ?? "").trim() === clientSelectValue
    );
    return String((found as any)?.name ?? "").trim();
  }, [clients, clientSelectValue]);

  const otherClientName = String(
    (formData as any)?.[OTHER_CLIENT_NAME_FIELD] ?? ""
  ).trim();

  const renderEditMode = () => (
    <form id="meeting-form" onSubmit={handleSubmit} noValidate className="space-y-4">
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
          Title *
        </label>
        <Input
          value={String(formData.title ?? "")}
          onChange={(e) => {
            if (validationError) setValidationError(null);
            setFormData({ ...formData, title: e.target.value });
          }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Type
          </label>
          <Select
            value={String(formData.type ?? "zoom")}
            onValueChange={(v) => {
              if (validationError) setValidationError(null);

              const nextRaw = String(v ?? "zoom");
              const _nextType = normalizeMeetingType(nextRaw);
              const currentLocation = String((formData as any).location ?? "");
              const normalizedLocation =
                currentLocation.trim() === "https://" ? "" : currentLocation;
              setFormData({
                ...formData,
                type: nextRaw,
                location: normalizedLocation,
              });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zoom">Zoom</SelectItem>
              <SelectItem value="call">Call</SelectItem>
              <SelectItem value="in-person">In-Person</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {String(formData.type ?? "")
              .trim()
              .toLowerCase() === "call"
              ? "Phone"
              : String(formData.type ?? "")
                .trim()
                .toLowerCase() === "in-person"
                ? "Location"
                : "Link"}
          </label>
          <Input
            value={String((formData as any).location ?? "")}
            onChange={(e) =>
              setFormData({ ...formData, location: e.target.value })
            }
            placeholder={
              String(formData.type ?? "")
                .trim()
                .toLowerCase() === "call"
                ? "+1 202 555 0123"
                : String(formData.type ?? "")
                  .trim()
                  .toLowerCase() === "in-person"
                  ? "Address / meeting point"
                  : "https://"
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <Select
            value={normalizeMeetingStatus(formData.status)}
            onValueChange={(v) =>
              setFormData({ ...formData, status: normalizeMeetingStatus(v) })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              {canChooseNoShow ? (
                <SelectItem value="no-show">No Show</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date & Time *
          </label>
          <Input
            type="datetime-local"
            min={shouldEnforceMinDateTime ? minDateTimeLocal : undefined}
            max="9999-12-31T23:59"
            value={String(formData.scheduledAt ?? "")}
            onChange={(e) => {
              if (validationError) setValidationError(null);
              setFormData({ ...formData, scheduledAt: e.target.value });
            }}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Duration (min)
        </label>
        <Input
          type="number"
          value={String((formData as any).durationMinutes ?? "")}
          onChange={(e) => {
            if (validationError) setValidationError(null);
            const parsed = Number.parseInt(e.target.value, 10);
            setFormData({
              ...formData,
              durationMinutes: Number.isFinite(parsed) ? parsed : 0,
            });
          }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Client *
        </label>
        <Select
          value={clientSelectValue}
          onValueChange={(v) => {
            if (validationError) setValidationError(null);
            const next = String(v ?? "").trim();
            setFormData({
              ...formData,
              clientId: next,
              ...(next === OTHER_CLIENT_ID
                ? {}
                : { [OTHER_CLIENT_NAME_FIELD]: "" }),
            });
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select client" />
          </SelectTrigger>
          <SelectContent>
            {clientSelectValue && !hasClientOption ? (
              <SelectItem value={clientSelectValue}>
                {selectedClientName || `Client (${clientSelectValue})`}
              </SelectItem>
            ) : null}
            <SelectItem value={OTHER_CLIENT_ID}>
              {OTHER_CLIENT_LABEL}
            </SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {clientSelectValue === OTHER_CLIENT_ID ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Name *
          </label>
          <Input
            value={String((formData as any)?.[OTHER_CLIENT_NAME_FIELD] ?? "")}
            onChange={(e) => {
              if (validationError) setValidationError(null);
              setFormData({
                ...formData,
                [OTHER_CLIENT_NAME_FIELD]: e.target.value,
              });
            }}
            placeholder="Enter name"
          />
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            This meeting isn’t linked to an existing client.
          </div>
        </div>
      ) : null}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Notes (admin only)
        </label>
        <Textarea
          value={String(formData.notes ?? "")}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Private notes for you only (not visible to the client)"
          rows={3}
        />
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Private — the client cannot see these notes.
        </div>
      </div>

      <div className="h-2" />
    </form>
  );

  const renderViewMode = (meeting: Meeting) => (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xl font-semibold text-gray-900 dark:text-white truncate">
            {meeting.title}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            {scheduledAt && !Number.isNaN(scheduledAt.getTime())
              ? format(scheduledAt, "PPP p")
              : "-"}
          </div>
        </div>

        <span
          className={`inline-flex items-center h-7 px-3 rounded-md text-xs font-medium capitalize ${statusChipClasses(
            meeting.status
          )}`}
        >
          {meeting.status?.replace(/[-_]/g, " ") || "unknown"}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setIsEditing(true);
            setValidationError(null);
            setShowDeleteConfirm(false);
          }}
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Edit
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            {getMeetingIcon(meeting.type)}
            <span>Type</span>
          </div>
          <div className="mt-1 font-medium text-gray-900 dark:text-white capitalize">
            {String(meeting.type ?? "-").replace(/[-_]/g, " ")}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            {isPast ? (
              <History className="w-4 h-4" />
            ) : (
              <CalendarIcon className="w-4 h-4" />
            )}
            <span>When</span>
          </div>
          <div className="mt-1 font-medium text-gray-900 dark:text-white">
            {scheduledAt && !Number.isNaN(scheduledAt.getTime())
              ? format(scheduledAt, "PPP")
              : "-"}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <Clock className="w-4 h-4" />
            <span>Duration</span>
          </div>
          <div className="mt-1 font-medium text-gray-900 dark:text-white">
            {String((meeting as any)?.durationMinutes ?? "").trim()
              ? `${String((meeting as any)?.durationMinutes).trim()} min`
              : "-"}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <User className="w-4 h-4" />
            <span>With</span>
          </div>
          <div className="mt-1 font-medium text-gray-900 dark:text-white truncate">
            {meeting.clientId ? getClientName(meeting.clientId) : "-"}
          </div>
        </div>
      </div>

      {meeting.location ? (
        <div>
          <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            {typeBasedKind === "phone"
              ? "Phone"
              : typeBasedKind === "link"
                ? "Link"
                : "Location"}
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300 break-words">
            {typeBasedKind === "phone" ? (
              <Phone className="w-4 h-4 mt-0.5 shrink-0 text-gray-500 dark:text-gray-400" />
            ) : typeBasedKind === "link" ? (
              <LinkIcon className="w-4 h-4 mt-0.5 shrink-0 text-gray-500 dark:text-gray-400" />
            ) : (
              <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-gray-500 dark:text-gray-400" />
            )}
            <span className="min-w-0">{meeting.location}</span>
          </div>
        </div>
      ) : null}

      {meeting.notes ? (
        <div>
          <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            Notes (admin only)
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
            {meeting.notes}
          </div>
        </div>
      ) : null}

      <div className="pt-2">
        {!showDeleteConfirm ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={!meetingId}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Meeting
          </Button>
        ) : (
          <div className="p-4 border border-red-200 bg-red-50 dark:bg-red-900/10 rounded-lg space-y-3">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-red-900 dark:text-red-100">
                Delete meeting?
              </div>
              <div className="text-xs text-red-800 dark:text-red-200 leading-relaxed font-medium">
                This will delete <strong>{String(meeting?.title ?? "this meeting")}</strong>. This
                cannot be undone.
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
                disabled={!meetingId || deleteMutation.isPending}
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

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? (meetingId ? "Edit Meeting" : "New Meeting") : "Meeting Details"}
      widthClassName="w-full sm:w-[520px]"
      footer={
        isEditing ? (
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              type="button"
              onClick={() => (meetingId ? setIsEditing(false) : onOpenChange(false))}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" form="meeting-form" disabled={saveMutation.isPending}>
              {saveMutation.isPending
                ? "Saving..."
                : meetingId
                  ? "Save Changes"
                  : "Schedule Meeting"}
            </Button>
          </div>
        ) : (
          <div className="flex justify-start" />
        )
      }
    >
      {!meeting && !isEditing ? (
        <div className="text-sm text-gray-600 dark:text-gray-300">
          No meeting selected
        </div>
      ) : isEditing ? (
        renderEditMode()
      ) : (
        renderViewMode(meeting as Meeting)
      )}
    </SidePanel>
  );
}
