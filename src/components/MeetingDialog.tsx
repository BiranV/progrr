"use client";

import React from "react";
import { db } from "@/lib/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { XCircle } from "lucide-react";
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
import SidePanel from "@/components/ui/side-panel";
import { Meeting, Client } from "@/types";
import { toast } from "sonner";

const OTHER_CLIENT_ID = "__PROSPECT__";
const OTHER_CLIENT_LABEL = "Other (not a client)";
const OTHER_CLIENT_NAME_FIELD = "otherClientName";

interface MeetingDialogProps {
  meeting: Meeting | null;
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

export default function MeetingDialog({
  meeting,
  clients,
  open,
  onOpenChange,
}: MeetingDialogProps) {
  const queryClient = useQueryClient();
  const [validationError, setValidationError] = React.useState<string | null>(
    null
  );
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

  const [locationByType, setLocationByType] = React.useState<
    Record<"zoom" | "call" | "in-person", string>
  >({
    zoom: "",
    call: "",
    "in-person": "",
  });

  React.useEffect(() => {
    setValidationError(null);
    if (meeting) {
      const normalizedType = normalizeMeetingType((meeting as any)?.type);
      const normalizedLocation = String((meeting as any).location ?? "");

      setFormData({
        title: meeting.title || "",
        type: meeting.type || "zoom",
        status: meeting.status || "scheduled",
        scheduledAt: meeting.scheduledAt
          ? isoToLocalDateTimeInputValue(meeting.scheduledAt)
          : "",
        durationMinutes: meeting.durationMinutes || 60,
        location: meeting.location || "",
        clientId: meeting.clientId || "",
        [OTHER_CLIENT_NAME_FIELD]:
          String((meeting as any)?.[OTHER_CLIENT_NAME_FIELD] ?? "").trim() ||
          String((meeting as any)?.prospectName ?? "").trim() ||
          String((meeting as any)?.guestName ?? "").trim() ||
          "",
        notes: meeting.notes || "",
      });

      setLocationByType((prev) => ({
        ...prev,
        [normalizedType]: normalizedLocation,
      }));
    } else {
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

      setLocationByType({ zoom: "", call: "", "in-person": "" });
    }
  }, [meeting, open]);

  const minDateTimeLocal = React.useMemo(() => {
    return toLocalDateTimeInputValue(ceilToNextMinute(new Date()));
  }, [open]);

  const shouldEnforceMinDateTime = React.useMemo(() => {
    if (!meeting) return true;
    const existing = meeting?.scheduledAt
      ? new Date(meeting.scheduledAt)
      : null;
    if (!existing || Number.isNaN(existing.getTime())) return true;
    return existing.getTime() >= Date.now();
  }, [meeting]);

  const canChooseNoShow = React.useMemo(() => {
    // Allow selecting No Show only for meetings that belong in the Past section.
    // (i.e., an existing meeting whose scheduled date has already passed)
    if (shouldEnforceMinDateTime) return false;

    const scheduledAt = String(formData.scheduledAt ?? "").trim();
    const d = scheduledAt ? new Date(scheduledAt) : null;
    if (!d || Number.isNaN(d.getTime())) return false;
    return d.getTime() < Date.now();
  }, [formData.scheduledAt, shouldEnforceMinDateTime]);

  React.useEffect(() => {
    const status = String(formData.status ?? "");
    if ((status === "no-show" || status === "no_show") && !canChooseNoShow) {
      setFormData((prev) => ({ ...prev, status: "scheduled" }));
    }
  }, [canChooseNoShow]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Meeting>) => {
      // IMPORTANT: datetime-local input drops seconds/ms.
      // If we always convert to ISO, editing a past meeting can unintentionally
      // change `scheduledAt` (e.g. :34:56Z -> :34:00Z), and the API rejects
      // changing meetings into the past. So only send `scheduledAt` when it
      // actually changed.
      const payload: any = { ...data };

      if (String(payload.clientId ?? "").trim() === OTHER_CLIENT_ID) {
        payload[OTHER_CLIENT_NAME_FIELD] = String(
          (data as any)?.[OTHER_CLIENT_NAME_FIELD] ?? ""
        ).trim();
      } else {
        delete payload[OTHER_CLIENT_NAME_FIELD];
      }

      const scheduledAtLocal = String(data.scheduledAt ?? "").trim();

      if (meeting) {
        const originalLocal = meeting.scheduledAt
          ? isoToLocalDateTimeInputValue(meeting.scheduledAt)
          : "";

        const scheduledAtUnchanged =
          !!scheduledAtLocal &&
          !!originalLocal &&
          scheduledAtLocal === originalLocal;

        if (scheduledAtUnchanged) {
          delete payload.scheduledAt;
        } else if (scheduledAtLocal) {
          payload.scheduledAt = new Date(scheduledAtLocal).toISOString();
        } else {
          delete payload.scheduledAt;
        }

        return db.entities.Meeting.update(meeting.id, payload);
      }

      payload.scheduledAt = scheduledAtLocal
        ? new Date(scheduledAtLocal).toISOString()
        : new Date().toISOString();

      return db.entities.Meeting.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      onOpenChange(false);
      toast.success(meeting ? "Meeting updated" : "Meeting scheduled");
    },
    onError: (error: any) => {
      const msg = error?.message || "Failed to save meeting";
      setValidationError(msg);
      toast.error(String(msg));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const title = String(formData.title ?? "").trim();
    if (!title) {
      setValidationError("Title is required");
      return;
    }

    const clientId = String((formData as any).clientId ?? "").trim();
    if (!clientId) {
      setValidationError("Client is required");
      return;
    }

    if (shouldEnforceMinDateTime) {
      const scheduledAt = String(formData.scheduledAt ?? "").trim();
      const d = scheduledAt ? new Date(scheduledAt) : null;
      if (!d || Number.isNaN(d.getTime())) {
        setValidationError("Please select a valid meeting date & time");
        return;
      }
      if (d.getTime() < Date.now()) {
        setValidationError("Meeting date & time cannot be in the past");
        return;
      }
    }

    const otherClientName = String(
      (formData as any)?.[OTHER_CLIENT_NAME_FIELD] ?? ""
    ).trim();
    if (clientId === OTHER_CLIENT_ID && !otherClientName) {
      setValidationError("Please enter a name for the 'Other' client");
      return;
    }

    saveMutation.mutate(formData);
  };

  const clientSelectValue = React.useMemo(() => {
    const fromForm = String((formData as any).clientId ?? "").trim();
    if (fromForm) return fromForm;
    const fromMeeting = String((meeting as any)?.clientId ?? "").trim();
    return fromMeeting;
  }, [formData, meeting]);

  const hasClientOption = React.useMemo(() => {
    if (!clientSelectValue) return true; // placeholder
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

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title={meeting ? "Edit Meeting" : "Schedule Meeting"}
      widthClassName="w-full sm:w-[560px]"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={saveMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="meeting-form"
            className="w-full sm:w-auto"
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      }
    >
      <form
        id="meeting-form"
        onSubmit={handleSubmit}
        noValidate
        className="space-y-4"
      >
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
            value={formData.title}
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
              value={formData.type}
              onValueChange={(v) => {
                if (validationError) setValidationError(null);

                const nextRaw = String(v ?? "zoom");
                const currentType = normalizeMeetingType((formData as any).type);
                const nextType = normalizeMeetingType(nextRaw);
                const currentLocation = String((formData as any).location ?? "");

                setLocationByType((prev) => {
                  const updated = { ...prev, [currentType]: currentLocation };
                  setFormData({
                    ...formData,
                    type: nextRaw,
                    location: updated[nextType] ?? "",
                  });
                  return updated;
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
              value={formData.location}
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
                    : "https://..."
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
              value={formData.status}
              onValueChange={(v) => setFormData({ ...formData, status: v })}
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
              value={formData.scheduledAt}
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
            value={formData.durationMinutes ?? ""}
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
            Notes
          </label>
          <Textarea
            value={String(formData.notes ?? "")}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            rows={3}
          />
        </div>

        <div className="h-2" />
      </form>
    </SidePanel>
  );
}
