"use client";

import React from "react";
import { db } from "@/lib/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  Calendar as CalendarIcon,
  Video,
  Phone,
  MapPin,
  Edit,
  Trash2,
  Clock,
  History,
} from "lucide-react";
import MeetingDialog from "@/components/MeetingDialog";
import { format } from "date-fns";
import { Meeting, Client } from "@/types";

export default function MeetingsPage() {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingMeeting, setEditingMeeting] = React.useState<Meeting | null>(
    null
  );
  const queryClient = useQueryClient();

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["meetings"],
    queryFn: () => db.entities.Meeting.list("-scheduledAt"),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => db.entities.Client.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => db.entities.Meeting.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meetings"] }),
  });

  const getClientName = (clientId: string) => {
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

  const upcoming = meetings.filter(
    (m: Meeting) => new Date(m.scheduledAt) >= new Date()
  );
  const past = meetings.filter(
    (m: Meeting) => new Date(m.scheduledAt) < new Date()
  );

  const handleEdit = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this meeting?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingMeeting(null);
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
          onClick={() => setDialogOpen(true)}
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
                  <CalendarIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
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
                    className="h-[240px] hover:shadow-lg transition-shadow dark:bg-gray-800 dark:border-gray-700"
                  >
                    <CardContent className="px-5 py-2 flex flex-col h-full">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg text-indigo-600 dark:text-indigo-300">
                            {getMeetingIcon(meeting.type)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold truncate">
                              {meeting.title}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                              {format(new Date(meeting.scheduledAt), "PPP p")}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(meeting)}
                            className="p-2 text-gray-600 dark:text-gray-400
                                       hover:text-indigo-600
                                       hover:bg-indigo-50 dark:hover:bg-indigo-900
                                       rounded-lg"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(meeting.id)}
                            className="p-2 text-gray-600 dark:text-gray-400
                                       hover:text-red-600
                                       hover:bg-red-50 dark:hover:bg-red-900
                                       rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Body */}
                      <div className="flex-1 text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-11">
                        {meeting.clientId && (
                          <p className="truncate">
                            With: {getClientName(meeting.clientId)}
                          </p>
                        )}
                        {meeting.location && (
                          <p className="truncate">{meeting.location}</p>
                        )}
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
                    className="dark:bg-gray-800 dark:border-gray-700"
                  >
                    <CardContent className="p-4">
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
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span
                            className={`inline-flex items-center h-7 px-3 rounded-md text-xs font-medium capitalize
              ${statusChipClasses(meeting.status)}`}
                          >
                            {meeting.status?.replace(/[-_]/g, " ") || "unknown"}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(meeting)}
                              className="p-2 text-gray-600 dark:text-gray-400
                                       hover:text-indigo-600
                                       hover:bg-indigo-50 dark:hover:bg-indigo-900
                                       rounded-lg"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(meeting.id)}
                              className="p-2 text-gray-600 dark:text-gray-400
                                       hover:text-red-600
                                       hover:bg-red-50 dark:hover:bg-red-900
                                       rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <MeetingDialog
        meeting={editingMeeting}
        clients={clients}
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
      />
    </div>
  );
}
