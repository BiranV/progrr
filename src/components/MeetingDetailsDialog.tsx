"use client";

import React from "react";
import SidePanel from "@/components/ui/side-panel";
import { Button } from "@/components/ui/button";
import {
  Calendar as CalendarIcon,
  Clock,
  History,
  Link as LinkIcon,
  MapPin,
  Phone,
  User,
  Video,
} from "lucide-react";
import { format } from "date-fns";
import { Client, Meeting } from "@/types";

const PROSPECT_CLIENT_ID = "__PROSPECT__";
const PROSPECT_CLIENT_LABEL = "Prospect (Process / Payment questions)";

interface MeetingDetailsDialogProps {
  meeting: Meeting | null;
  clients: Client[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MeetingDetailsDialog({
  meeting,
  clients,
  open,
  onOpenChange,
}: MeetingDetailsDialogProps) {
  const getClientName = (clientId: string) => {
    if (clientId === PROSPECT_CLIENT_ID) return PROSPECT_CLIENT_LABEL;
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

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Meeting Details"
      widthClassName="w-full sm:w-[520px]"
    >
      {!meeting ? (
        <div className="text-sm text-gray-600 dark:text-gray-300">
          No meeting selected
        </div>
      ) : (
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
                Notes
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                {meeting.notes}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </SidePanel>
  );
}
