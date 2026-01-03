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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Meeting, Client } from "@/types";

const PROSPECT_CLIENT_ID = "__PROSPECT__";
const PROSPECT_CLIENT_LABEL = "Prospect (Process / Payment questions)";

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
    notes: "",
  });

  React.useEffect(() => {
    setValidationError(null);
    if (meeting) {
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
        notes: meeting.notes || "",
      });
    } else {
      setFormData({
        title: "",
        type: "zoom",
        status: "scheduled",
        scheduledAt: "",
        durationMinutes: 60,
        location: "",
        clientId: "",
        notes: "",
      });
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
      const payload = {
        ...data,
        scheduledAt: data.scheduledAt
          ? new Date(data.scheduledAt).toISOString()
          : new Date().toISOString(),
      };
      if (meeting) {
        return db.entities.Meeting.update(meeting.id, payload);
      }
      return db.entities.Meeting.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      setValidationError(error?.message || "Failed to save meeting");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const title = String(formData.title ?? "").trim();
    if (!title) {
      setValidationError("Title is required");
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

    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl dark:bg-gray-800">
        <DialogHeader>
          <DialogTitle>
            {meeting ? "Edit Meeting" : "Schedule Meeting"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v })}
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
          </div>

          <div className="grid grid-cols-2 gap-4">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Duration (min)
              </label>
              <Input
                type="number"
                value={formData.durationMinutes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    durationMinutes: parseInt(e.target.value),
                  })
                }
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Client
            </label>
            <Select
              value={formData.clientId}
              onValueChange={(v) => {
                if (validationError) setValidationError(null);
                setFormData({ ...formData, clientId: v });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PROSPECT_CLIENT_ID}>
                  {PROSPECT_CLIENT_LABEL}
                </SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Location/Link
            </label>
            <Input
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              placeholder="Zoom link, phone number, or address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <Textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
