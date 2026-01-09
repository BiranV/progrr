"use client";

import React from "react";
import { db } from "@/lib/db";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Plus,
  Calendar as CalendarIcon,
  Video,
  Phone,
  Link as LinkIcon,
  MapPin,
  User,
  Clock,
  History,
} from "lucide-react";
import MeetingPanel from "@/components/panels/MeetingPanel";
import { format } from "date-fns";
import { Meeting, Client } from "@/types";
import { useRefetchOnVisible } from "@/hooks/use-refetch-on-visible";

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

  const upcoming = meetings.filter(
    (m: Meeting) => new Date(m.scheduledAt) >= new Date()
  );
  const past = meetings.filter(
    (m: Meeting) => new Date(m.scheduledAt) < new Date()
  );

  const handleDetails = (meeting: Meeting) => {
    setDetailsMeetingId(String((meeting as any).id ?? "").trim() || null);
    setDetailsOpen(true);
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
    <div className="p-8 bg-[#F5F6F8] dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Meetings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Schedule and manage appointments
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="min-w-[180px] bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Plus className="w-5 h-5 mr-2" />
          Schedule Meeting
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          Loading...
        </div>
      ) : (
        <div className="space-y-10">
          {/* UPCOMING – CARDS */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Upcoming
              </h2>
            </div>

            {upcoming.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CalendarIcon className="w-12 h-12 mx-auto text-indigo-500 dark:text-indigo-400 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    No upcoming meetings. Schedule your first one!
                  </p>
                </CardContent>
              </Card>
            ) : (
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
                              {String(meeting.type ?? "-").replace(
                                /[-_]/g,
                                " "
                              )}
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
            )}
          </div>

          {/* PAST – ROWS */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Past
              </h2>
            </div>

            {past.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">
                No past meetings
              </p>
            ) : (
              <div className="grid gap-4">
                {past.map((meeting: Meeting) => (
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
                    className="cursor-pointer hover:shadow-lg transition-shadow dark:bg-gray-800 dark:border-gray-700"
                  >
                    <CardContent className="p-4 flex flex-col">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400">
                            {getMeetingIcon(meeting.type)}
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">
                              {meeting.title}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {format(new Date(meeting.scheduledAt), "PPP p")}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                              {(() => {
                                const typeText = String(meeting.type ?? "-").replace(
                                  /[-_]/g,
                                  " "
                                );
                                const meta = getTypeSpecificMeta(meeting);

                                return (
                                  <>
                                    Type: {typeText}
                                    {meta ? (
                                      <>
                                        <span className="mx-2 inline-block h-3 w-px bg-gray-200 dark:bg-gray-700 align-middle" />
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
                                      </>
                                    ) : null}
                                  </>
                                );
                              })()}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              With: {getClientName(meeting)}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Duration:{" "}
                              {Number.isFinite(Number((meeting as any).durationMinutes))
                                ? `${Number((meeting as any).durationMinutes)} min`
                                : "-"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <span
                          className={`inline-flex items-center h-7 px-3 rounded-md text-xs font-medium capitalize
              ${statusChipClasses(meeting.status)}`}
                        >
                          {meeting.status?.replace(/[-_]/g, " ") || "unknown"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <MeetingPanel
        meetingId={detailsMeetingId}
        clients={clients}
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setDetailsMeetingId(null);
        }}
      />
    </div>
  );
}
