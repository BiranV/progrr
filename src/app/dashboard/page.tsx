"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import {
  Users,
  Dumbbell,
  Calendar,
  MessageSquare,
  Mail,
  Phone,
  Bell,
  Send,
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function DashboardPage() {
  const { user, isLoadingAuth } = useAuth();
  const router = useRouter();

  const shouldRedirect = !isLoadingAuth && !user;

  useEffect(() => {
    if (shouldRedirect) {
      router.replace("/");
    }
  }, [router, shouldRedirect]);

  if (isLoadingAuth) {
    return (
      <div className="p-8 flex justify-center">
        <div className="text-center text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 flex justify-center">
        <div className="text-center text-gray-600">Redirecting...</div>
      </div>
    );
  }

  return user.role === "admin" ? (
    <AdminDashboard user={user} />
  ) : (
    <ClientDashboard user={user} />
  );
}

function AdminDashboard({ user }: { user: any }) {
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => db.entities.Client.list(),
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["workoutPlans"],
    queryFn: () => db.entities.WorkoutPlan.list(),
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["meetings"],
    queryFn: () => db.entities.Meeting.list(),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["messages"],
    queryFn: () => db.entities.Message.list(),
  });

  const activeClients = clients.filter(
    (c: any) => c.status === "active"
  ).length;
  const unreadMessages = messages.filter(
    (m: any) => m.senderRole === "client" && !m.readByAdmin
  ).length;
  const upcomingMeetings = meetings.filter((m: any) => {
    const meetingDate = new Date(m.scheduledAt);
    const now = new Date();
    return meetingDate > now && m.status === "scheduled";
  }).length;

  const stats = [
    {
      label: "Active Clients",
      value: activeClients,
      total: clients.length,
      icon: Users,
      color: "bg-blue-500",
    },
    {
      label: "Workout Plans",
      value: plans.length,
      icon: Dumbbell,
      color: "bg-indigo-500",
    },
    {
      label: "Upcoming Meetings",
      value: upcomingMeetings,
      icon: Calendar,
      color: "bg-green-500",
    },
    {
      label: "Unread Messages",
      value: unreadMessages,
      icon: MessageSquare,
      color: "bg-orange-500",
    },
  ];

  const statusConfig: Record<string, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
    pending:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
    inactive: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user.full_name}!
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Here's what's happening with your coaching business
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {stat.label}
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {stat.value}
                      {stat.total !== undefined && (
                        <span className="text-lg text-gray-400 ml-1">
                          / {stat.total}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <CardTitle>Recent Clients</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  No clients yet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {clients.slice(0, 5).map((client: any) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate text-gray-900 dark:text-white">
                        {client.name}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
                        <Mail className="w-3 h-3" />
                        {client.email}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
                        <Phone className="w-3 h-3" />
                        {client.phone}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center justify-center w-20 h-7 px-3 rounded-md text-xs font-medium capitalize ${
                        statusConfig[client.status || "active"]
                      }`}
                    >
                      {client.status || "active"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <CardTitle>Upcoming Meetings</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {meetings.filter((m: any) => new Date(m.scheduledAt) > new Date())
              .length === 0 ? (
              <div className="py-12 text-center">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  No upcoming meetings
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {meetings
                  .filter(
                    (m: any) =>
                      new Date(m.scheduledAt) > new Date() &&
                      m.status === "scheduled"
                  )
                  .slice(0, 5)
                  .map((meeting: any) => (
                    <div
                      key={meeting.id}
                      className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <p className="font-medium text-gray-900 dark:text-white">
                        {meeting.title}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {format(new Date(meeting.scheduledAt), "PPP p")}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ClientDashboard({ user }: { user: any }) {
  const queryClient = useQueryClient();
  const [messagesOpen, setMessagesOpen] = React.useState(false);
  const [newMessage, setNewMessage] = React.useState("");

  const { data: clients = [] } = useQuery({
    queryKey: ["myClient"],
    queryFn: async () => {
      const allClients = await db.entities.Client.list();
      return allClients.filter((c: any) => c.userId === user.id);
    },
  });

  const myClient = clients[0];

  const { data: assignedPlan } = useQuery({
    queryKey: ["assignedPlan", myClient?.assignedPlanId],
    queryFn: () => db.entities.WorkoutPlan.get(myClient.assignedPlanId),
    enabled: !!myClient?.assignedPlanId,
  });

  const { data: assignedMealPlan } = useQuery({
    queryKey: ["assignedMealPlan", myClient?.assignedMealPlanId],
    queryFn: () => db.entities.MealPlan.get(myClient.assignedMealPlanId),
    enabled: !!myClient?.assignedMealPlanId,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["myMessages", myClient?.id],
    queryFn: () => db.entities.Message.filter({ clientId: myClient.id }),
    enabled: !!myClient,
  });

  const unreadCount = messages.filter(
    (m: any) => m.senderRole === "admin" && !m.readByClient
  ).length;

  const sendMutation = useMutation({
    mutationFn: (text: string) =>
      db.entities.Message.create({
        clientId: myClient.id,
        text,
        senderRole: "client",
        readByAdmin: false,
        readByClient: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myMessages", myClient?.id] });
      setNewMessage("");
    },
  });

  React.useEffect(() => {
    if (!messagesOpen || !myClient) return;
    const markRead = async () => {
      const unread = messages.filter(
        (m: any) => m.senderRole === "admin" && !m.readByClient
      );
      for (const msg of unread) {
        await db.entities.Message.update(msg.id, { readByClient: true });
      }
      if (unread.length > 0) {
        queryClient.invalidateQueries({
          queryKey: ["myMessages", myClient.id],
        });
      }
    };
    void markRead();
  }, [messagesOpen, myClient, messages, queryClient]);

  const sortedMessages = [...messages].sort(
    (a: any, b: any) =>
      new Date(a.created_date || 0).getTime() -
      new Date(b.created_date || 0).getTime()
  );

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text || !myClient) return;
    await sendMutation.mutateAsync(text);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user.full_name}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Track your progress and stay connected with your coach
          </p>
        </div>

        <div className="flex items-center justify-start">
          <Dialog open={messagesOpen} onOpenChange={setMessagesOpen}>
            <DialogTrigger asChild>
              <button
                className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Messages"
              >
                <Bell className="w-6 h-6 text-gray-700 dark:text-gray-200" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            </DialogTrigger>

            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Messages</DialogTitle>
              </DialogHeader>

              {!myClient ? (
                <div className="py-10 text-center text-gray-500">
                  No client profile found
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="h-80 overflow-y-auto border rounded-lg p-3 bg-white dark:bg-gray-900">
                    {sortedMessages.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-gray-500">
                        No messages yet
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {sortedMessages.map((m: any) => {
                          const fromMe = m.senderRole === "client";
                          return (
                            <div
                              key={m.id}
                              className={`flex ${
                                fromMe ? "justify-end" : "justify-start"
                              }`}
                            >
                              <div
                                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm border ${
                                  fromMe
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700"
                                }`}
                              >
                                <div>{m.text}</div>
                                <div
                                  className={`mt-1 text-[11px] ${
                                    fromMe ? "text-indigo-100" : "text-gray-500"
                                  }`}
                                >
                                  {m.created_date
                                    ? format(new Date(m.created_date), "PPP p")
                                    : ""}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleSend();
                        }
                      }}
                    />
                    <Button
                      onClick={() => void handleSend()}
                      disabled={sendMutation.isPending || !newMessage.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mb-8">{/* Intentionally minimal client view */}</div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle>My Workout Plan</CardTitle>
          </CardHeader>
          <CardContent>
            {assignedPlan ? (
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {assignedPlan.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  {assignedPlan.notes}
                </p>
                <div className="mt-4 flex gap-4 text-sm">
                  {assignedPlan.difficulty && (
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-full">
                      {assignedPlan.difficulty}
                    </span>
                  )}
                  {assignedPlan.duration && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                      {assignedPlan.duration}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">
                No workout plan assigned yet
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle>My Meal Plan</CardTitle>
          </CardHeader>
          <CardContent>
            {assignedMealPlan ? (
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {assignedMealPlan.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  {assignedMealPlan.notes}
                </p>
                {assignedMealPlan.dailyCalories && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Daily Target: {assignedMealPlan.dailyCalories} calories
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">
                No meal plan assigned yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
