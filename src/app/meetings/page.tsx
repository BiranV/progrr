"use client";

import React from "react";
import { db } from "@/lib/db";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Calendar as CalendarIcon,
  Video,
  Phone,
  MapPin,
  User,
  Clock,
  History,
} from "lucide-react";
import MeetingPanel from "@/components/panels/MeetingPanel";
import { format } from "date-fns";
import { Meeting, Client } from "@/types";
import { useRefetchOnVisible } from "@/hooks/use-refetch-on-visible";
import { EntityPageLayout } from "@/components/ui/entity/EntityPageLayout";
import { EntityToolbar } from "@/components/ui/entity/EntityToolbar";
import { EntityTableSection } from "@/components/ui/entity/EntityTableSection";
import { GenericDetailsPanel } from "@/components/ui/entity/GenericDetailsPanel";

const OTHER_CLIENT_ID = "__PROSPECT__";
const OTHER_CLIENT_LABEL = "Other (not a client)";
const OTHER_CLIENT_NAME_FIELD = "otherClientName";

export default function MeetingsPage() {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [detailsMeetingId, setDetailsMeetingId] = React.useState<string | null>(
    null
  );
  const queryClient = useQueryClient();

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["meetings"],
    queryFn: () => db.entities.Meeting.list("-scheduledAt"),
  });

  useRefetchOnVisible(() => {
    queryClient.invalidateQueries({ queryKey: ["meetings"] });
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => db.entities.Client.list(),
  });

  const getClientName = (meeting: Meeting) => {
    const clientId = String((meeting as any)?.clientId ?? "").trim();
    if (!clientId) return "-";
    if (clientId === OTHER_CLIENT_ID) {
      const name = String((meeting as any)?.[OTHER_CLIENT_NAME_FIELD] ?? "").trim();
      return name || OTHER_CLIENT_LABEL;
    }
    const client = clients.find((c: Client) => c.id === clientId);
    return client?.name || "Unknown";
  };

  const getMeetingIcon = (type: string) => {
    switch (type) {
      case "zoom":
        return <Video className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case "call":
        return <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    }
  };

  const normalizeType = (type: string) =>
    String(type ?? "")
      .trim()
      .toLowerCase();

  const getLinkHref = (raw: string): string | null => {
    const s = String(raw ?? "").trim();
    if (!s) return null;

    if (s.startsWith("http://") || s.startsWith("https://")) return s;

    // Handle common cases where the admin pastes without protocol.
    if (s.startsWith("www.")) return `https://${s}`;

    const looksLikeDomain = /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(s);
    if (looksLikeDomain) return `https://${s}`;

    return null;
  };

  const getTypeSpecificMeta = (meeting: Meeting) => {
    const type = normalizeType((meeting as any)?.type);
    const rawLocation = String((meeting as any).location ?? "").trim();
    const locationLower = rawLocation.toLowerCase();

    // Avoid duplicate "Zoom"/"Phone" when type already conveys it.
    const redundant =
      !rawLocation ||
      (type === "zoom" && locationLower === "zoom") ||
      (type === "call" && locationLower === "phone") ||
      locationLower === type;

    if (redundant) return null;

    const typeBasedKind: "link" | "location" | "phone" =
      type === "call" ? "phone" : type === "zoom" ? "link" : "location";

    const href = typeBasedKind === "link" ? getLinkHref(rawLocation) : null;
    return { rawLocation, href };
  };

  const now = new Date();
  const isForcedPastStatus = (status: unknown) => {
    const s = String(status ?? "").trim().toLowerCase();
    return s === "completed" || s === "cancelled";
  };
  const isPastMeeting = (m: Meeting) => {
    if (isForcedPastStatus((m as any)?.status)) return true;
    return new Date(m.scheduledAt) < now;
  };

  const upcoming = meetings.filter((m: Meeting) => !isPastMeeting(m));
  const past = meetings.filter((m: Meeting) => isPastMeeting(m));

  const handleDetails = (meeting: Meeting) => {
    setDetailsMeetingId(String((meeting as any).id ?? "").trim() || null);
    setDetailsOpen(true);
  };

  const handleCloseDetails = (open: boolean) => {
    setDetailsOpen(open);
    if (!open) {
      setTimeout(() => setDetailsMeetingId(null), 200);
    }
  };

  const handleCreate = () => {
    setDetailsMeetingId(null);
    setDetailsOpen(true);
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

  return (
    <EntityPageLayout
      title="Meetings"
      subtitle="Schedule and manage appointments"
      primaryAction={{ label: "Schedule Meeting", onClick: handleCreate }}
    >
      <EntityToolbar showSearch={false} showPageSize={false} />

      {isLoading ? (
        <div className="py-12 text-center text-gray-500">Loading…</div>
      ) : (
        <div className="space-y-8">
          <EntityTableSection
            title="Upcoming Meetings"
            totalCount={upcoming.length}
            emptyState={{
              icon: CalendarIcon,
              title: "No upcoming meetings",
              description: "Schedule your first one.",
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcoming.map((meeting: Meeting) => (
                <Card
                  key={meeting.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleDetails(meeting)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleDetails(meeting);
                    }
                  }}
                  className="hover:shadow-lg cursor-pointer transition-shadow duration-200 flex flex-col h-full dark:bg-gray-800 dark:border-gray-700"
                >
                  <CardHeader className="flex flex-row items-start justify-between pb-2">
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-xl font-semibold truncate">
                        {meeting.title}
                      </CardTitle>
                      <CardDescription className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {format(new Date(meeting.scheduledAt), "PPP p")}
                      </CardDescription>
                    </div>
                  </CardHeader>

                  <CardContent className="px-5 py-2 flex flex-col flex-1">
                    <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2 truncate col-span-2">
                          <span className="shrink-0">
                            {getMeetingIcon(meeting.type)}
                          </span>
                          <span className="truncate capitalize">
                            Type:{" "}
                            {String(meeting.type ?? "-").replace(/[-_]/g, " ")}
                          </span>
                          {(() => {
                            const meta = getTypeSpecificMeta(meeting);
                            if (!meta) return null;

                            return (
                              <>
                                <span className="mx-2 h-4 w-px bg-gray-200 dark:bg-gray-700 shrink-0" />
                                <span className="truncate">
                                  {meta.href ? (
                                    <a
                                      href={meta.href}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="underline underline-offset-2 hover:text-indigo-600 dark:hover:text-indigo-300"
                                      onClick={(e) => e.stopPropagation()}
                                      onMouseDown={(e) => e.stopPropagation()}
                                    >
                                      {meta.rawLocation}
                                    </a>
                                  ) : (
                                    meta.rawLocation
                                  )}
                                </span>
                              </>
                            );
                          })()}
                        </div>

                        <div className="flex items-center gap-2 truncate col-span-2">
                          <User className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                          <span className="truncate">With: {getClientName(meeting)}</span>
                        </div>

                        <div className="flex items-center gap-2 truncate col-span-2">
                          <Clock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                          <span className="truncate">
                            Duration:{" "}
                            {Number.isFinite(Number((meeting as any).durationMinutes))
                              ? `${Number((meeting as any).durationMinutes)} min`
                              : "-"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto pt-3 flex justify-end">
                      <span
                        className={`inline-flex items-center h-7 px-3 rounded-md text-xs font-medium capitalize ${statusChipClasses(
                          meeting.status
                        )}`}
                      >
                        {meeting.status?.replace(/[-_]/g, " ") || "unknown"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </EntityTableSection>

          <EntityTableSection
            title="Past Meetings"
            totalCount={past.length}
            emptyState={{
              icon: History,
              title: "No past meetings",
            }}
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Meeting</th>
                      <th className="px-4 py-3 text-left font-medium">Date</th>
                      <th className="px-4 py-3 text-left font-medium">Type</th>
                      <th className="px-4 py-3 text-left font-medium">Client</th>
                      <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">
                        Duration
                      </th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {past.map((meeting: Meeting) => {
                      const scheduledAt = meeting?.scheduledAt
                        ? new Date(meeting.scheduledAt)
                        : null;
                      const typeText = String((meeting as any).type ?? "-").replace(
                        /[-_]/g,
                        " "
                      );
                      const meta = getTypeSpecificMeta(meeting);

                      return (
                        <tr
                          key={meeting.id}
                          className="border-t hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer transition-colors"
                          onClick={() => handleDetails(meeting)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleDetails(meeting);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {String((meeting as any).title ?? "").trim() || "-"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">
                            {scheduledAt && !Number.isNaN(scheduledAt.getTime())
                              ? format(scheduledAt, "PPP p")
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="shrink-0">
                                {getMeetingIcon(String((meeting as any).type ?? ""))}
                              </span>
                              <span className="truncate">{typeText}</span>
                            </div>
                            {meta ? (
                              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                                {meta.href ? (
                                  <a
                                    href={meta.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline underline-offset-2 hover:text-indigo-600 dark:hover:text-indigo-300"
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                  >
                                    {meta.rawLocation}
                                  </a>
                                ) : (
                                  meta.rawLocation
                                )}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                            {getClientName(meeting)}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-200 hidden lg:table-cell whitespace-nowrap">
                            {Number.isFinite(Number((meeting as any).durationMinutes))
                              ? `${Number((meeting as any).durationMinutes)} min`
                              : "-"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center h-7 px-3 rounded-md text-xs font-medium capitalize ${statusChipClasses(
                                meeting.status
                              )}`}
                            >
                              {meeting.status?.replace(/[-_]/g, " ") || "unknown"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </EntityTableSection>
        </div>
      )}

      <GenericDetailsPanel
        open={detailsOpen}
        onOpenChange={handleCloseDetails}
        defaultTitle="Meeting Details"
        widthClassName="w-full sm:w-[520px]"
      >
        <MeetingPanel meetingId={detailsMeetingId} clients={clients} />
      </GenericDetailsPanel>
    </EntityPageLayout>
  );
}
