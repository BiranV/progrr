"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { db } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import {
  Users,
  Dumbbell,
  UtensilsCrossed,
  Calendar,
  CalendarDays,
  Check,
  Activity,
  Repeat,
  MessageSquare,
  Mail,
  Phone,
  Video,
  MapPin,
  Bell,
  Send,
  Settings,
  Sun,
  Moon,
  LogOut,
  UserX,
  FileDown,
  FileText,
  Copy as CopyIcon,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  RotateCcw,
  Flame,
  Beef,
  Wheat,
  Droplets,
  User,
  Clock,
  History,
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ClientAvatar from "@/components/ClientAvatar";
import { extractYouTubeVideoId, toYouTubeEmbedUrl } from "@/lib/youtube";
import { getCookie, setCookie } from "@/lib/client-cookies";
import {
  copyTextToClipboard,
  downloadPdfFile,
  downloadTextFile,
  formatMealPlanText,
  formatWorkoutPlanText,
} from "@/lib/plan-export";
import { useRefetchOnVisible } from "@/hooks/use-refetch-on-visible";
import { toast } from "sonner";

const normalizeStatus = (raw: any) => {
  const v = String(raw ?? "").trim().toUpperCase();
  if (v === "PENDING" || v === "INACTIVE" || v === "ACTIVE") return v;
  return v || "ACTIVE";
};

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
  const router = useRouter();
  const PROSPECT_CLIENT_ID = "__PROSPECT__";
  const PROSPECT_CLIENT_LABEL = "Prospect (Process / Payment questions)";

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => db.entities.Client.list(),
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["workoutPlans"],
    queryFn: () => db.entities.WorkoutPlan.list("-created_date"),
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["meetings"],
    queryFn: () => db.entities.Meeting.list("-scheduledAt"),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["messages"],
    queryFn: () => db.entities.Message.list("-created_date"),
  });

  const clientNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clients as any[]) {
      if (c?.id) map.set(String(c.id), String(c.name ?? "").trim());
    }
    return map;
  }, [clients]);

  const getMeetingClientLabel = (clientId: any) => {
    const id = String(clientId ?? "").trim();
    if (!id) return "";
    if (id === PROSPECT_CLIENT_ID) return PROSPECT_CLIENT_LABEL;
    return clientNameById.get(id) || "Unknown";
  };

  const getMeetingTypeIcon = (rawType: any) => {
    const t = String(rawType ?? "")
      .trim()
      .toLowerCase();
    if (t === "zoom") return <Video className="w-4 h-4" />;
    if (t === "call") return <Phone className="w-4 h-4" />;
    if (t === "in-person" || t === "meeting")
      return <MapPin className="w-4 h-4" />;
    return <MapPin className="w-4 h-4" />;
  };

  const activeClients = clients.filter(
    (c: any) => normalizeStatus(c.status) === "ACTIVE"
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
      href: "/clients",
    },
    {
      label: "Workout Plans",
      value: plans.length,
      icon: Dumbbell,
      color: "bg-indigo-500",
      href: "/plans",
    },
    {
      label: "Upcoming Meetings",
      value: upcomingMeetings,
      icon: Calendar,
      color: "bg-green-500",
      href: "/meetings",
    },
    {
      label: "Unread Messages",
      value: unreadMessages,
      icon: MessageSquare,
      color: "bg-orange-500",
      href: "/messages",
    },
  ];

  const statusConfig: Record<string, string> = {
    ACTIVE:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
    PENDING:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/25 dark:text-yellow-200",
    INACTIVE:
      "bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-200",
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
            <Card
              key={index}
              className="dark:bg-gray-800 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors"
              onClick={() => router.push(stat.href)}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(stat.href);
                }
              }}
            >
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
                <Users className="w-12 h-12 text-indigo-500 dark:text-indigo-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  No clients yet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {clients.slice(0, 5).map((client: any) =>
                  (() => {
                    const status = normalizeStatus(client.status) || "ACTIVE";
                    return (
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
                          className={`inline-flex items-center justify-center w-20 h-7 px-3 rounded-md text-xs font-medium ${statusConfig[status]}`}
                        >
                          {status}
                        </span>
                      </div>
                    );
                  })()
                )}
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
                <Calendar className="w-12 h-12 text-indigo-500 dark:text-indigo-400 mx-auto mb-4" />
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
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {meeting.title}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {format(new Date(meeting.scheduledAt), "PPP p")}
                          </p>
                        </div>

                        {meeting.type ? (
                          <span className="shrink-0 inline-flex items-center justify-center h-7 w-7 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200 rounded-full">
                            {getMeetingTypeIcon(meeting.type)}
                          </span>
                        ) : null}
                      </div>

                      {meeting.clientId ? (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 truncate">
                          With: {getMeetingClientLabel(meeting.clientId)}
                        </p>
                      ) : null}

                      {meeting.location ? (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                          {meeting.location}
                        </p>
                      ) : null}
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
  const { logout, refreshUser } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = React.useState<
    "menu" | "profile" | "steps" | "meetings" | "workouts" | "meals" | "weekly"
  >("menu");

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");
  const [deletePending, setDeletePending] = React.useState(false);
  const [messagesOpen, setMessagesOpen] = React.useState(false);
  const [newMessage, setNewMessage] = React.useState("");
  const avatarInputRef = React.useRef<HTMLInputElement | null>(null);
  const [avatarError, setAvatarError] = React.useState<string | null>(null);
  const [expandedWorkoutPlanIds, setExpandedWorkoutPlanIds] = React.useState<
    Record<string, boolean>
  >({});
  const [expandedMealPlanIds, setExpandedMealPlanIds] = React.useState<
    Record<string, boolean>
  >({});

  const { data: coachMenuData } = useQuery({
    queryKey: ["clientCoaches"],
    enabled: !!user?.canSwitchCoach,
    queryFn: async () => {
      const res = await fetch("/api/auth/client/coaches", {
        method: "GET",
        credentials: "include",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load coaches");
      }
      return payload as {
        ok: boolean;
        coaches?: { adminId: string; label: string }[];
      };
    },
  });

  const coaches = Array.isArray(coachMenuData?.coaches)
    ? coachMenuData.coaches
    : [];

  const { data: appSettings = [] } = useQuery({
    queryKey: ["appSettings", "client", String(user?.adminId ?? "")],
    queryFn: () => db.entities.AppSettings.list(),
  });

  const coachLogoUrl =
    appSettings.length > 0 &&
      typeof (appSettings[0] as any)?.logoUrl === "string"
      ? String((appSettings[0] as any).logoUrl).trim()
      : "";

  const coachBusinessName =
    appSettings.length > 0 &&
      typeof (appSettings[0] as any)?.businessName === "string" &&
      String((appSettings[0] as any).businessName).trim()
      ? String((appSettings[0] as any).businessName).trim()
      : "";

  const coachLogoShape =
    appSettings.length > 0 && (appSettings[0] as any)?.logoShape === "circle"
      ? "circle"
      : "square";

  const switchCoachMutation = useMutation({
    mutationFn: async (adminId: string) => {
      const res = await fetch("/api/auth/client/select-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ adminId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `Request failed (${res.status})`);
      }
      return payload;
    },
    onSuccess: async () => {
      // Refresh auth state (cookie includes the selected adminId).
      await refreshUser({ force: true });

      // One-shot refetch of coach-scoped resources.
      await queryClient.invalidateQueries({
        queryKey: ["appSettings", "client"],
      });
      await queryClient.invalidateQueries({ queryKey: ["myClient"] });
      await queryClient.invalidateQueries({ queryKey: ["assignedPlans"] });
      await queryClient.invalidateQueries({ queryKey: ["assignedMealPlans"] });
      await queryClient.invalidateQueries({ queryKey: ["myMeetings"] });
      await queryClient.invalidateQueries({ queryKey: ["myMessages"] });
      await queryClient.invalidateQueries({
        queryKey: ["clientWeeklySchedule"],
      });

      toast.success("Coach updated");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to switch coach");
    },
  });

  const toTitleCase = (value: any) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const cleaned = raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    return cleaned
      .split(" ")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(" ");
  };

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

    // Prefer unambiguous year-first or year-last parsing.
    if (String(p1).length === 4) {
      year = n1;
      month = n2;
      day = n3;
    } else if (String(p3).length === 4) {
      day = n1;
      month = n2;
      year = n3;
    } else {
      // Fallback: treat as DD-MM-YY(YY) style where possible.
      day = n1;
      month = n2;
      year = n3;
    }

    if (year < 1900 || year > 2200) return raw;
    if (month < 1 || month > 12) return raw;
    if (day < 1 || day > 31) return raw;

    // Validate date via UTC to avoid timezone shifting day.
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
    if (age < 0 || age > 130) return `${String(day).padStart(2, "0")}-${String(
      month
    ).padStart(2, "0")}-${String(year)}`;

    const formatted = `${String(day).padStart(2, "0")}-${String(month).padStart(
      2,
      "0"
    )}-${String(year)}`;
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

  const formatDuration = (duration: any) => {
    const raw = String(duration ?? "").trim();
    if (!raw) return "";
    const numericOnly = raw.match(/^\d+$/);
    if (numericOnly) {
      const weeks = Number(raw);
      return `${weeks} week${weeks === 1 ? "" : "s"}`;
    }

    const weekMatch = raw.match(/^(\d+)\s*weeks?$/i);
    if (weekMatch) {
      const weeks = Number(weekMatch[1]);
      return `${weeks} week${weeks === 1 ? "" : "s"}`;
    }

    return toTitleCase(raw);
  };

  const formatRest = (restSeconds: any) => {
    const raw = Number(restSeconds);
    if (!Number.isFinite(raw)) return "";
    const seconds = Math.max(0, Math.floor(raw));
    if (!seconds) return "";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m && s) return `${m}m ${s}s`;
    if (m) return `${m}m`;
    return `${s}s`;
  };

  const normalizeMeetingType = (type: any) =>
    String(type ?? "")
      .trim()
      .toLowerCase();

  const getLinkHref = (raw: string): string | null => {
    const s = String(raw ?? "").trim();
    if (!s) return null;

    if (s.startsWith("http://") || s.startsWith("https://")) return s;
    if (s.startsWith("www.")) return `https://${s}`;

    const looksLikeDomain = /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(s);
    if (looksLikeDomain) return `https://${s}`;

    return null;
  };

  const getTypeSpecificMeta = (meeting: any) => {
    const type = normalizeMeetingType(meeting?.type);
    const rawLocation = String(meeting?.location ?? "").trim();
    const locationLower = rawLocation.toLowerCase();

    const redundant =
      !rawLocation ||
      (type === "zoom" && locationLower === "zoom") ||
      (type === "call" && locationLower === "phone") ||
      locationLower === type;

    if (redundant) return null;

    const kind: "link" | "location" | "phone" =
      type === "call" ? "phone" : type === "zoom" ? "link" : "location";

    const href = kind === "link" ? getLinkHref(rawLocation) : null;
    return { rawLocation, href };
  };

  const getMeetingIcon = (rawType: any) => {
    const type = normalizeMeetingType(rawType);
    if (type === "zoom")
      return (
        <Video className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      );
    if (type === "call")
      return (
        <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      );
    return <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
  };

  const statusChipClasses = (status?: any) => {
    const s = String(status ?? "").trim().toLowerCase();
    switch (s) {
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

  const { data: clients = [] } = useQuery({
    queryKey: ["myClient", String(user?.adminId ?? "")],
    queryFn: async () => {
      const allClients = await db.entities.Client.list();

      const normalizePhone = (phone: any) =>
        String(phone ?? "")
          .trim()
          .replace(/\s+/g, "");

      const userPhone = normalizePhone(user.phone);
      return allClients.filter((c: any) => {
        if (c.userId && c.userId === user.id) return true;
        if (c.clientAuthId && c.clientAuthId === user.id) return true;
        const clientPhone = normalizePhone(c.phone);
        if (clientPhone && userPhone && clientPhone === userPhone) return true;
        return false;
      });
    },
  });

  const myClient = clients[0];

  const stepsEnabledByCoach = (myClient as any)?.stepsEnabledByAdmin !== false;
  const stepsSharingEnabled = (myClient as any)?.stepsSharingEnabled === true;

  const [todaySteps, setTodaySteps] = React.useState<string>("");

  const { data: stepsRecent } = useQuery({
    queryKey: ["stepsRecent", "client", String(user?.adminId ?? "")],
    enabled: Boolean(user && user.role === "client" && stepsEnabledByCoach),
    queryFn: async () => {
      const res = await fetch(`/api/steps/recent?days=7`, {
        method: "GET",
        credentials: "include",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `Request failed (${res.status})`);
      }
      return payload as { ok: true; days: { date: string; steps: number }[] };
    },
  });

  const stepsConsentMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch("/api/steps/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `Request failed (${res.status})`);
      }
      return payload as { ok: true; enabled: boolean };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["myClient", String(user?.adminId ?? "")],
      });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update steps sharing");
    },
  });

  const stepsSyncMutation = useMutation({
    mutationFn: async (steps: number) => {
      const today = new Date();
      const ymd = today.toISOString().slice(0, 10);
      const res = await fetch("/api/steps/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ days: [{ date: ymd, steps }], source: "manual" }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `Request failed (${res.status})`);
      }
      return payload as { ok: true; upserted: number };
    },
    onSuccess: async () => {
      setTodaySteps("");
      await queryClient.invalidateQueries({
        queryKey: ["stepsRecent", "client", String(user?.adminId ?? "")],
      });
      toast.success("Steps saved");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save steps");
    },
  });

  const canSaveTodaySteps =
    stepsSharingEnabled &&
    !stepsSyncMutation.isPending &&
    Boolean(String(todaySteps ?? "").trim());

  const saveTodaySteps = () => {
    if (!canSaveTodaySteps) return;

    const raw = String(todaySteps ?? "").trim();
    if (!raw) return;

    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Enter a valid steps number");
      return;
    }

    stepsSyncMutation.mutate(Math.floor(n));
  };

  // Refetch coach-scoped data only when tab becomes visible.
  useRefetchOnVisible(
    async () => {
      const adminId = String(user?.adminId ?? "").trim();
      if (!adminId) return;

      // Always refresh client profile + branding on tab return.
      await queryClient.invalidateQueries({
        queryKey: ["appSettings", "client", adminId],
      });
      await queryClient.invalidateQueries({ queryKey: ["myClient", adminId] });

      const clientId = String(myClient?.id ?? "").trim();
      if (clientId) {
        await queryClient.invalidateQueries({
          queryKey: ["myMeetings", clientId],
        });
        await queryClient.invalidateQueries({
          queryKey: ["myMessages", clientId],
        });
        await queryClient.invalidateQueries({
          queryKey: ["clientWeeklySchedule", clientId],
        });
      }

      if (activeSection === "workouts") {
        await queryClient.invalidateQueries({ queryKey: ["assignedPlans"] });
        await queryClient.invalidateQueries({
          queryKey: ["planExercisesByPlanId"],
        });
      }

      if (activeSection === "meals") {
        await queryClient.invalidateQueries({
          queryKey: ["assignedMealPlans"],
        });
        await queryClient.invalidateQueries({
          queryKey: ["mealPlanMealsByPlanId"],
        });
      }

      await queryClient.invalidateQueries({
        queryKey: ["stepsRecent", "client", adminId],
      });
    },
    { enabled: Boolean(user) }
  );

  const uploadAvatarMutation = useMutation({
    mutationFn: async (dataUrl: string | null) => {
      const res = await fetch("/api/me/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dataUrl }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof payload?.error === "string" && payload.error
            ? payload.error
            : "Failed to update avatar";
        throw new Error(msg);
      }

      return payload;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["myClient"] });
      setAvatarError(null);
    },
  });

  const fileToSquareDataUrl = async (file: File, size = 256) => {
    if (!file.type.startsWith("image/")) {
      throw new Error("Please select an image file");
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Image is too large (max 5MB)");
    }

    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });

    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to load image"));
      image.src = dataUrl;
    });

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) {
      throw new Error("Invalid image");
    }

    const cropSize = Math.min(width, height);
    const sx = Math.floor((width - cropSize) / 2);
    const sy = Math.floor((height - cropSize) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported");

    ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, size, size);

    // Prefer webp when available; fallback to jpeg
    const webp = canvas.toDataURL("image/webp", 0.9);
    if (webp.startsWith("data:image/webp")) return webp;
    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const handleAvatarFile = async (file: File | null | undefined) => {
    if (!file) return;
    try {
      setAvatarError(null);
      const square = await fileToSquareDataUrl(file, 256);
      await uploadAvatarMutation.mutateAsync(square);
    } catch (err: any) {
      setAvatarError(String(err?.message ?? "Failed to update avatar"));
    } finally {
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleClientDeleteAccount = async () => {
    if (deletePending) return;
    if (deleteConfirmText !== "DELETE") {
      toast.error("Type DELETE to confirm.");
      return;
    }

    setDeletePending(true);
    try {
      const res = await fetch("/api/me/delete-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirm: deleteConfirmText }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `Request failed (${res.status})`);
      }

      window.location.href = "/goodbye";
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete account");
    } finally {
      setDeletePending(false);
    }
  };

  const assignedPlanIds = React.useMemo(() => {
    const ids = Array.isArray((myClient as any)?.assignedPlanIds)
      ? ((myClient as any).assignedPlanIds as any[])
        .map((v) => String(v ?? "").trim())
        .filter((v) => v && v !== "none")
      : [];
    const legacy = String((myClient as any)?.assignedPlanId ?? "").trim();
    const all = [...ids, ...(legacy && legacy !== "none" ? [legacy] : [])];
    return Array.from(new Set(all));
  }, [myClient]);

  const assignedMealPlanIds = React.useMemo(() => {
    const ids = Array.isArray((myClient as any)?.assignedMealPlanIds)
      ? ((myClient as any).assignedMealPlanIds as any[])
        .map((v) => String(v ?? "").trim())
        .filter((v) => v && v !== "none")
      : [];
    const legacy = String((myClient as any)?.assignedMealPlanId ?? "").trim();
    const all = [...ids, ...(legacy && legacy !== "none" ? [legacy] : [])];
    return Array.from(new Set(all));
  }, [myClient]);

  const { data: assignedPlans = [], isLoading: assignedPlansLoading } =
    useQuery({
      queryKey: ["assignedPlans", assignedPlanIds.join("|")],
      queryFn: async () => {
        if (!assignedPlanIds.length) return [];
        const plans = await Promise.all(
          assignedPlanIds.map(async (id) => {
            try {
              return await db.entities.WorkoutPlan.get(id);
            } catch {
              return null;
            }
          })
        );
        return plans.filter(Boolean);
      },
      enabled:
        (activeSection === "workouts" ||
          activeSection === "weekly" ||
          activeSection === "profile") &&
        assignedPlanIds.length > 0,
    });

  const {
    data: planExercisesByPlanId = {},
    isLoading: planExercisesByPlanIdLoading,
  } = useQuery({
    queryKey: [
      "planExercisesByPlanId",
      assignedPlans.map((p: any) => String(p?.id ?? "")).join("|"),
    ],
    queryFn: async () => {
      const result = {};
      const plans = (assignedPlans as any[]).filter(Boolean);
      for (const plan of plans) {
        const planId = String(plan?.id ?? "").trim();
        if (!planId) continue;

        const planExerciseRows = await db.entities.PlanExercise.filter({
          workoutPlanId: planId,
        });
        const sortedPlanExercises = [...planExerciseRows].sort(
          (a: any, b: any) => (a.order || 0) - (b.order || 0)
        );

        if (sortedPlanExercises.length) {
          const ids = Array.from(
            new Set(
              sortedPlanExercises
                .map((r: any) => String(r.exerciseLibraryId ?? "").trim())
                .filter(Boolean)
            )
          );

          const libs = await Promise.all(
            ids.map(async (id) => {
              try {
                return await db.entities.ExerciseLibrary.get(id);
              } catch {
                return null;
              }
            })
          );
          const libById = new Map(
            libs.filter(Boolean).map((l: any) => [String(l.id), l])
          );

          (result as any)[planId] = sortedPlanExercises.map((row: any) => {
            const lib = libById.get(String(row.exerciseLibraryId ?? "").trim());
            return {
              id: row.id,
              name: lib?.name ?? "-",
              guidelines: lib?.guidelines ?? "",
              videoKind: lib?.videoKind ?? null,
              videoUrl: lib?.videoUrl ?? null,
              sets: row?.sets,
              reps: row?.reps,
              restSeconds: row?.restSeconds,
              order: row?.order,
            };
          });
          continue;
        }

        // Legacy fallback
        const exercises = await db.entities.Exercise.filter({
          workoutPlanId: planId,
        });
        (result as any)[planId] = [...exercises].sort(
          (a: any, b: any) => (a.order || 0) - (b.order || 0)
        );
      }
      return result;
    },
    enabled: activeSection === "workouts" && assignedPlans.length > 0,
  });

  const { data: assignedMealPlans = [], isLoading: assignedMealPlansLoading } =
    useQuery({
      queryKey: ["assignedMealPlans", assignedMealPlanIds.join("|")],
      queryFn: async () => {
        if (!assignedMealPlanIds.length) return [];
        const plans = await Promise.all(
          assignedMealPlanIds.map(async (id) => {
            try {
              return await db.entities.MealPlan.get(id);
            } catch {
              return null;
            }
          })
        );
        return plans.filter(Boolean);
      },
      enabled:
        (activeSection === "meals" || activeSection === "profile") &&
        assignedMealPlanIds.length > 0,
    });

  type DaySchedule = {
    workoutPlanId?: string;
    workoutTime?: string;
    workoutCompleted?: boolean;
    mealsCompleted?: boolean;
    notes?: string;
  };

  const [weeklyAnchorDate, setWeeklyAnchorDate] = React.useState<Date>(
    () => new Date()
  );

  const [weeklySchedule, setWeeklySchedule] = React.useState<
    Record<string, DaySchedule>
  >({});

  const { data: weeklyScheduleDocs = [] } = useQuery({
    queryKey: ["clientWeeklySchedule", myClient?.id ?? ""],
    queryFn: async () => {
      const clientId = String(myClient?.id ?? "").trim();
      if (!clientId) return [];
      return db.entities.ClientWeeklySchedule.filter({ clientId });
    },
    enabled: activeSection === "weekly" && !!String(myClient?.id ?? "").trim(),
  });

  const weeklyScheduleDoc = (weeklyScheduleDocs as any[])?.[0] ?? null;
  const weeklyScheduleDocId = String(weeklyScheduleDoc?.id ?? "").trim();

  const didInitWeeklyScheduleRef = React.useRef(false);
  const lastSavedWeeklyScheduleJsonRef = React.useRef<string>("");
  const saveWeeklyScheduleTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    didInitWeeklyScheduleRef.current = false;
    lastSavedWeeklyScheduleJsonRef.current = "";
  }, [myClient?.id]);

  React.useEffect(() => {
    if (activeSection !== "weekly") return;
    if (didInitWeeklyScheduleRef.current) return;

    const days = (weeklyScheduleDoc?.days ?? {}) as Record<string, DaySchedule>;
    if (days && typeof days === "object") {
      setWeeklySchedule(days);
      lastSavedWeeklyScheduleJsonRef.current = JSON.stringify(days);
    } else {
      setWeeklySchedule({});
      lastSavedWeeklyScheduleJsonRef.current = "{ }";
    }

    didInitWeeklyScheduleRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, weeklyScheduleDocId]);

  const saveWeeklyScheduleMutation = useMutation({
    mutationFn: async (days: Record<string, DaySchedule>) => {
      const clientId = String(myClient?.id ?? "").trim();
      if (!clientId) throw new Error("Client profile not found");

      const payload = { clientId, days };
      if (weeklyScheduleDocId) {
        return db.entities.ClientWeeklySchedule.update(
          weeklyScheduleDocId,
          payload
        );
      }
      return db.entities.ClientWeeklySchedule.create(payload);
    },
    onSuccess: () => {
      const clientId = String(myClient?.id ?? "").trim();
      queryClient.invalidateQueries({
        queryKey: ["clientWeeklySchedule", clientId],
      });
    },
  });

  React.useEffect(() => {
    if (activeSection !== "weekly") return;
    if (!didInitWeeklyScheduleRef.current) return;
    if (!String(myClient?.id ?? "").trim()) return;

    const nextJson = JSON.stringify(weeklySchedule ?? {});
    if (nextJson === lastSavedWeeklyScheduleJsonRef.current) return;

    if (saveWeeklyScheduleTimerRef.current) {
      window.clearTimeout(saveWeeklyScheduleTimerRef.current);
    }

    saveWeeklyScheduleTimerRef.current = window.setTimeout(() => {
      saveWeeklyScheduleMutation.mutate(weeklySchedule ?? {});
      lastSavedWeeklyScheduleJsonRef.current = nextJson;
    }, 500);

    return () => {
      if (saveWeeklyScheduleTimerRef.current) {
        window.clearTimeout(saveWeeklyScheduleTimerRef.current);
        saveWeeklyScheduleTimerRef.current = null;
      }
    };
  }, [activeSection, myClient?.id, weeklySchedule, saveWeeklyScheduleMutation]);

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const toLocalDateKey = (d: Date) => {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };
  const startOfDay = (d: Date) => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const weekStartDate = React.useMemo(
    () => startOfDay(weeklyAnchorDate),
    [weeklyAnchorDate]
  );
  const weekDays = React.useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStartDate);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekStartDate]);

  const shiftWeeklyAnchorDays = (deltaDays: number) => {
    setWeeklyAnchorDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + deltaDays);
      return next;
    });
  };

  const updateDaySchedule = (dateKey: string, patch: Partial<DaySchedule>) => {
    setWeeklySchedule((prev) => {
      const current = prev?.[dateKey] ?? {};
      return { ...prev, [dateKey]: { ...current, ...patch } };
    });
  };

  const {
    data: mealPlanMealsByPlanId = {},
    isLoading: mealPlanMealsByPlanIdLoading,
  } = useQuery({
    queryKey: [
      "mealPlanMealsByPlanId",
      assignedMealPlans.map((p: any) => String(p?.id ?? "")).join("|"),
    ],
    queryFn: async () => {
      const result = {};
      const plans = (assignedMealPlans as any[]).filter(Boolean);

      for (const plan of plans) {
        const mealPlanId = String(plan?.id ?? "").trim();
        if (!mealPlanId) continue;

        const meals = await db.entities.Meal.filter({ mealPlanId });

        const mealsWithFoods = await Promise.all(
          meals.map(async (meal: any) => {
            const planFoodRows = await db.entities.PlanFood.filter({
              mealId: meal.id,
            });

            const sortedPlanFoods = [...planFoodRows].sort(
              (a: any, b: any) => (a.order || 0) - (b.order || 0)
            );

            if (sortedPlanFoods.length) {
              const ids = Array.from(
                new Set(
                  sortedPlanFoods
                    .map((r: any) => String(r.foodLibraryId ?? "").trim())
                    .filter(Boolean)
                )
              );

              const libs = await Promise.all(
                ids.map(async (id) => {
                  try {
                    return await db.entities.FoodLibrary.get(id);
                  } catch {
                    return null;
                  }
                })
              );
              const libById = new Map(
                libs.filter(Boolean).map((l: any) => [String(l.id), l])
              );

              const foods = sortedPlanFoods.map((row: any) => {
                const lib = libById.get(String(row.foodLibraryId ?? "").trim());
                return {
                  id: row.id,
                  name: lib?.name ?? "-",
                  amount: row?.amount ?? "",
                  protein: lib?.protein ?? "",
                  carbs: lib?.carbs ?? "",
                  fat: lib?.fat ?? "",
                  calories: lib?.calories ?? "",
                };
              });

              return { ...meal, foods };
            }

            // Legacy fallback
            const foods = await db.entities.Food.filter({ mealId: meal.id });
            return {
              ...meal,
              foods: [...foods].sort(
                (a: any, b: any) => (a.order || 0) - (b.order || 0)
              ),
            };
          })
        );

        (result as any)[mealPlanId] = [...mealsWithFoods].sort(
          (a: any, b: any) => (a.order || 0) - (b.order || 0)
        );
      }

      return result;
    },
    enabled: activeSection === "meals" && assignedMealPlans.length > 0,
  });

  const workoutPlanExportTextById = React.useMemo(() => {
    const out = {};
    for (const plan of assignedPlans as any[]) {
      const planId = String(plan?.id ?? "").trim();
      if (!planId) continue;
      const exercises = (planExercisesByPlanId as any)[planId] || [];
      (out as any)[planId] = formatWorkoutPlanText(
        plan as any,
        exercises as any
      );
    }
    return out as Record<string, string>;
  }, [assignedPlans, planExercisesByPlanId]);

  const mealPlanExportTextById = React.useMemo(() => {
    const out = {};
    for (const plan of assignedMealPlans as any[]) {
      const planId = String(plan?.id ?? "").trim();
      if (!planId) continue;
      const meals = (mealPlanMealsByPlanId as any)[planId] || [];
      (out as any)[planId] = formatMealPlanText(plan as any, meals as any);
    }
    return out as Record<string, string>;
  }, [assignedMealPlans, mealPlanMealsByPlanId]);

  const getWorkoutPlanFilenameBase = (plan: any) => {
    const name = String(plan?.name ?? "").trim();
    const id = String(plan?.id ?? "").trim();
    return `workout-plan-${name || id || "plan"}`;
  };

  const getMealPlanFilenameBase = (plan: any) => {
    const name = String(plan?.name ?? "").trim();
    const id = String(plan?.id ?? "").trim();
    return `meal-plan-${name || id || "plan"}`;
  };

  const copyWorkoutPlan = async (plan: any) => {
    if (!plan?.id) return;
    try {
      const text = workoutPlanExportTextById[String(plan.id)] || "";
      await copyTextToClipboard(text);
      toast.success("Copied to clipboard");
    } catch (err) {
      console.error("Failed to copy workout plan", err);
      toast.error("Failed to copy");
    }
  };

  const downloadWorkoutPlanText = (plan: any) => {
    if (!plan?.id) return;
    try {
      const text = workoutPlanExportTextById[String(plan.id)] || "";
      downloadTextFile(getWorkoutPlanFilenameBase(plan), text);
    } catch (err) {
      console.error("Failed to download workout plan text", err);
      toast.error("Failed to download text");
    }
  };

  const downloadWorkoutPlanPdf = (plan: any) => {
    if (!plan?.id) return;
    try {
      const text = workoutPlanExportTextById[String(plan.id)] || "";
      downloadPdfFile(
        getWorkoutPlanFilenameBase(plan),
        String(plan?.name ?? "Workout Plan").trim() || "Workout Plan",
        text
      );
    } catch (err) {
      console.error("Failed to download workout plan PDF", err);
      toast.error("Failed to download PDF");
    }
  };

  const copyMealPlan = async (plan: any) => {
    if (!plan?.id) return;
    try {
      const text = mealPlanExportTextById[String(plan.id)] || "";
      await copyTextToClipboard(text);
      toast.success("Copied to clipboard");
    } catch (err) {
      console.error("Failed to copy meal plan", err);
      toast.error("Failed to copy");
    }
  };

  const downloadMealPlanText = (plan: any) => {
    if (!plan?.id) return;
    try {
      const text = mealPlanExportTextById[String(plan.id)] || "";
      downloadTextFile(getMealPlanFilenameBase(plan), text);
    } catch (err) {
      console.error("Failed to download meal plan text", err);
      toast.error("Failed to download text");
    }
  };

  const downloadMealPlanPdf = (plan: any) => {
    if (!plan?.id) return;
    try {
      const text = mealPlanExportTextById[String(plan.id)] || "";
      downloadPdfFile(
        getMealPlanFilenameBase(plan),
        String((plan as any)?.name ?? "Meal Plan").trim() || "Meal Plan",
        text
      );
    } catch (err) {
      console.error("Failed to download meal plan PDF", err);
      toast.error("Failed to download PDF");
    }
  };

  const { data: messages = [] } = useQuery({
    queryKey: ["myMessages", myClient?.id],
    queryFn: () => db.entities.Message.filter({ clientId: myClient.id }),
    enabled: !!myClient,
    staleTime: 0,
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["myMeetings", myClient?.id],
    queryFn: () => db.entities.Meeting.filter({ clientId: myClient.id }),
    enabled: !!myClient,
  });

  const now = new Date();
  const isForcedPastMeetingStatus = (status: unknown) => {
    const s = String(status ?? "").trim().toLowerCase();
    return s === "completed" || s === "cancelled";
  };
  const isPastMeeting = (m: any) => {
    if (isForcedPastMeetingStatus(m?.status)) return true;
    const d = new Date(m?.scheduledAt || 0);
    return d.getTime() < now.getTime();
  };
  const sortedMeetings = [...meetings].sort((a: any, b: any) => {
    const at = new Date(a.scheduledAt || 0).getTime();
    const bt = new Date(b.scheduledAt || 0).getTime();
    return at - bt;
  });
  const upcomingMeetings = sortedMeetings.filter((m: any) => !isPastMeeting(m));
  const pastMeetings = sortedMeetings.filter((m: any) => isPastMeeting(m)).reverse();

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
    <div className="p-8 bg-[#F5F6F8] dark:bg-gray-900 min-h-screen">
      {coachLogoUrl || coachBusinessName ? (
        <div className="mb-6">
          <div className="flex flex-col items-center justify-center gap-2 min-w-0 px-24 md:px-0 text-center">
            {coachLogoUrl ? (
              <img
                src={coachLogoUrl}
                alt="Coach logo"
                className={`h-14 w-14 object-contain shrink-0 ${coachLogoShape === "circle" ? "rounded-full" : "rounded-none"
                  }`}
              />
            ) : null}
            {coachBusinessName ? (
              <div className="min-w-0 truncate text-base font-semibold text-gray-900 dark:text-gray-100 text-center">
                {coachBusinessName}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="fixed top-4 left-4 right-4 z-50 flex items-center justify-between gap-2">
        <div className="min-w-0">
          {activeSection !== "menu" ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="cursor-pointer"
              onClick={() => setActiveSection("menu")}
              aria-label="Back"
            >
              <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-gray-200" />
            </Button>
          ) : (
            <div />
          )}
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={messagesOpen} onOpenChange={setMessagesOpen}>
            <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-xl">
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
                              className={`flex ${fromMe ? "justify-end" : "justify-start"
                                }`}
                            >
                              <div
                                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm border ${fromMe
                                  ? "bg-indigo-600 text-white border-indigo-600"
                                  : "bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700"
                                  }`}
                              >
                                <div>{m.text}</div>
                                <div
                                  className={`mt-1 text-[11px] ${fromMe ? "text-indigo-100" : "text-gray-500"
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                aria-label="Settings"
                title="Settings"
              >
                <Settings className="w-6 h-6 text-gray-700 dark:text-gray-200" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-[260px] p-2 flex flex-col gap-2"
            >
              <DropdownMenuItem
                onSelect={() => setMessagesOpen(true)}
                className="cursor-pointer text-base py-2"
              >
                <div className="flex w-full items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span>Messages</span>
                  </div>
                  {unreadCount > 0 ? (
                    <span className="h-5 min-w-5 px-1 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">
                      {unreadCount}
                    </span>
                  ) : null}
                </div>
              </DropdownMenuItem>

              {user?.canSwitchCoach ? (
                <>
                  {coaches.length ? (
                    coaches.map((c) => {
                      const isActive =
                        typeof user?.adminId === "string" &&
                        user.adminId === c.adminId;
                      return (
                        <DropdownMenuItem
                          key={c.adminId}
                          onSelect={() => {
                            if (isActive) return;
                            switchCoachMutation.mutate(c.adminId);
                          }}
                          className={
                            isActive
                              ? "cursor-pointer bg-accent text-accent-foreground text-base py-2"
                              : "cursor-pointer text-base py-2"
                          }
                        >
                          <span className="inline-flex items-center gap-2">
                            <Repeat className="h-4 w-4" />
                            {c.label}
                          </span>
                        </DropdownMenuItem>
                      );
                    })
                  ) : (
                    <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
                  )}
                </>
              ) : null}
              <DropdownMenuItem
                onSelect={() => toggleDarkMode()}
                className="cursor-pointer text-base py-2"
              >
                <span className="inline-flex items-center gap-2">
                  {darkMode ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                  {darkMode ? "Light mode" : "Dark mode"}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setDeleteConfirmText("");
                  setDeleteOpen(true);
                }}
                className="cursor-pointer text-base py-2"
              >
                <span className="inline-flex items-center gap-2">
                  <UserX className="h-4 w-4" />
                  Archive / Delete
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => logout(true)}
                className="cursor-pointer text-base py-2"
              >
                <span className="inline-flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  Logout
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent showCloseButton={!deletePending}>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Your account will be deactivated and you will lose access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="p-4 border border-orange-200 bg-orange-50 dark:bg-orange-900/10 rounded-lg space-y-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                  Deactivate account?
                </div>
                <div className="text-xs text-orange-800 dark:text-orange-200 leading-relaxed">
                  Your data will be preserved but you will lose access
                  essentially immediately. You can contact your coach to
                  restore your account later.
                </div>
                <div className="text-xs text-orange-800 dark:text-orange-200 leading-relaxed pt-1">
                  If you would like to permanently delete your data, please
                  contact your admin.
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium block mb-1 select-none"
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                onContextMenu={(e) => e.preventDefault()}
              >
                Type DELETE to confirm
              </label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                onPaste={(e) => e.preventDefault()}
                onDrop={(e) => e.preventDefault()}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="DELETE"
                disabled={deletePending}
              />
              <p className="text-xs text-muted-foreground">
                For security, deletion requires recent authentication. If
                needed, log out and log back in, then retry within 10 minutes.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deletePending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleClientDeleteAccount}
              disabled={deletePending || deleteConfirmText !== "DELETE"}
            >
              {deletePending ? "Deleting..." : "Delete account permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeSection === "menu" ? (
        <>
          <div className="mb-6 flex justify-center">
            <div className="min-w-0 px-24 md:px-0 text-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Hi, {user.full_name}!
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card
              className="h-32 md:h-36 dark:bg-gray-800 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60"
              onClick={() => setActiveSection("profile")}
            >
              <CardHeader className="h-full flex flex-col items-center justify-center text-center gap-2">
                <Users className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                <div className="h-10 flex items-center justify-center">
                  <CardTitle className="text-base leading-tight">Profile</CardTitle>
                </div>
              </CardHeader>
            </Card>

            <Card
              className="h-32 md:h-36 dark:bg-gray-800 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60"
              onClick={() => setActiveSection("meetings")}
            >
              <CardHeader className="h-full flex flex-col items-center justify-center text-center gap-2">
                <Calendar className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                <div className="h-10 flex items-center justify-center">
                  <CardTitle className="text-base leading-tight">Meetings</CardTitle>
                </div>
              </CardHeader>
            </Card>

            <Card
              className="h-32 md:h-36 dark:bg-gray-800 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60"
              onClick={() => setActiveSection("workouts")}
            >
              <CardHeader className="h-full flex flex-col items-center justify-center text-center gap-2">
                <Dumbbell className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                <div className="h-10 flex items-center justify-center">
                  <CardTitle className="text-base leading-tight">Workouts</CardTitle>
                </div>
              </CardHeader>
            </Card>

            <Card
              className="h-32 md:h-36 dark:bg-gray-800 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60"
              onClick={() => setActiveSection("steps")}
            >
              <CardHeader className="h-full flex flex-col items-center justify-center text-center gap-2">
                <Activity className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                <div className="h-10 flex items-center justify-center">
                  <CardTitle className="text-base leading-tight">Steps</CardTitle>
                </div>
              </CardHeader>
            </Card>

            <Card
              className="h-32 md:h-36 dark:bg-gray-800 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60"
              onClick={() => setActiveSection("meals")}
            >
              <CardHeader className="h-full flex flex-col items-center justify-center text-center gap-2">
                <UtensilsCrossed className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                <div className="h-10 flex items-center justify-center">
                  <CardTitle className="text-base leading-tight">Meals</CardTitle>
                </div>
              </CardHeader>
            </Card>

            <Card
              className="h-32 md:h-36 dark:bg-gray-800 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60"
              onClick={() => setActiveSection("weekly")}
            >
              <CardHeader className="h-full flex flex-col items-center justify-center text-center gap-2">
                <CalendarDays className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                <div className="h-10 flex items-center justify-center">
                  <CardTitle className="text-base leading-tight">Calendar</CardTitle>
                </div>
              </CardHeader>
            </Card>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            {activeSection === "profile" ? (
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            ) : activeSection === "steps" ? (
              <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            ) : activeSection === "meetings" ? (
              <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            ) : activeSection === "workouts" ? (
              <Dumbbell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            ) : activeSection === "meals" ? (
              <UtensilsCrossed className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            ) : (
              <CalendarDays className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            )}

            <span>
              {activeSection === "profile"
                ? "Profile"
                : activeSection === "steps"
                  ? "Steps"
                  : activeSection === "meetings"
                    ? "Meetings"
                    : activeSection === "workouts"
                      ? "Workouts"
                      : activeSection === "meals"
                        ? "Meals"
                        : "Calendar"}
            </span>
          </div>

          {activeSection === "profile" ? (
            <div>
              {!myClient ? (
                <div className="py-10 text-center text-gray-500 dark:text-gray-400">
                  No client profile found
                </div>
              ) : (
                <div className="space-y-3">
                  {avatarError ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
                      {avatarError}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-start gap-3">
                    <ClientAvatar
                      name={String(
                        myClient.name || user.full_name || ""
                      ).trim()}
                      src={(myClient as any).avatarDataUrl}
                      size={56}
                    />
                    <div className="flex flex-col gap-2">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleAvatarFile(e.target.files?.[0] ?? null)
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9"
                        disabled={uploadAvatarMutation.isPending}
                        onClick={() => avatarInputRef.current?.click()}
                      >
                        {uploadAvatarMutation.isPending
                          ? "Uploading..."
                          : "Upload photo"}
                      </Button>

                      {(myClient as any).avatarDataUrl ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9"
                          disabled={uploadAvatarMutation.isPending}
                          onClick={async () => {
                            if (confirm("Remove your photo?")) {
                              try {
                                setAvatarError(null);
                                await uploadAvatarMutation.mutateAsync(null);
                              } catch (err: any) {
                                setAvatarError(
                                  String(
                                    err?.message ?? "Failed to remove avatar"
                                  )
                                );
                              }
                            }
                          }}
                        >
                          Remove photo
                        </Button>
                      ) : null}

                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Auto-cropped to a square avatar
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Full name
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {toTitleCase(myClient.name || user.full_name || "")}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Phone
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {myClient.phone || user.phone || ""}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Email
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {myClient.email || user.email || ""}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Gender
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {toTitleCase(String((myClient as any).gender ?? "")) ||
                          "-"}
                      </div>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Goal
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {toTitleCase(String((myClient as any).goal ?? "")) ||
                          "-"}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Activity level
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {toTitleCase(
                          String((myClient as any).activityLevel ?? "")
                        ) || "-"}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Birth date
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {formatBirthDateWithAge((myClient as any).birthDate)}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Height
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {String((myClient as any).height ?? "").trim() || "-"}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                        <Activity className="w-3 h-3" /> Assigned workout plans
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {assignedPlansLoading
                          ? "Loading…"
                          : assignedPlans.length
                            ? (assignedPlans as any[])
                              .map(
                                (p) => String((p as any)?.name ?? "-") || "-"
                              )
                              .join(", ")
                            : "-"}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                        <Activity className="w-3 h-3" /> Assigned meal plans
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {assignedMealPlansLoading
                          ? "Loading…"
                          : assignedMealPlans.length
                            ? (assignedMealPlans as any[])
                              .map(
                                (p) => String((p as any)?.name ?? "-") || "-"
                              )
                              .join(", ")
                            : "-"}
                      </div>
                    </div>
                  </div>

                  <Card className="dark:bg-gray-800 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle>Coach</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Name
                        </div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {toTitleCase(
                            String(
                              (user as any)?.admin?.full_name ??
                              (user as any)?.admin?.email ??
                              ""
                            )
                          ) || "-"}
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Email
                        </div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {String((user as any)?.admin?.email ?? "").trim() ||
                            "-"}
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Phone
                        </div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {String((user as any)?.admin?.phone ?? "").trim() ||
                            "-"}
                        </div>
                      </div>

                      {String((appSettings?.[0] as any)?.facebookUrl ?? "").trim() ? (
                        <a
                          href={String((appSettings?.[0] as any)?.facebookUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
                        >
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Facebook
                          </div>
                          <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate">
                            {String((appSettings?.[0] as any)?.facebookUrl)}
                          </div>
                        </a>
                      ) : null}

                      {String((appSettings?.[0] as any)?.instagramUrl ?? "").trim() ? (
                        <a
                          href={String((appSettings?.[0] as any)?.instagramUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
                        >
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Instagram
                          </div>
                          <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate">
                            {String((appSettings?.[0] as any)?.instagramUrl)}
                          </div>
                        </a>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          ) : null}

          {activeSection === "steps" ? (
            <div>
              {!myClient ? (
                <div className="py-10 text-center text-gray-500 dark:text-gray-400">
                  No client profile found
                </div>
              ) : (
                <Card className="dark:bg-gray-800 dark:border-gray-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Steps</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!stepsEnabledByCoach ? (
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        Steps tracking is disabled by your coach.
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium">
                              Share step summaries with coach
                            </div>
                            <div className="text-xs text-gray-500">
                              You control whether your coach can view your steps.
                            </div>
                          </div>
                          <Switch
                            className="disabled:cursor-default"
                            checked={stepsSharingEnabled}
                            onCheckedChange={(v) =>
                              stepsConsentMutation.mutate(Boolean(v))
                            }
                            disabled={stepsConsentMutation.isPending}
                          />
                        </div>

                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <div className="text-sm font-medium mb-1">
                              Today's steps
                            </div>
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              autoComplete="off"
                              value={todaySteps}
                              onChange={(e) => {
                                const next = String(e.target.value ?? "");
                                const digitsOnly = next.replace(/\D+/g, "");
                                setTodaySteps(digitsOnly);
                              }}
                              onKeyDown={(e) => {
                                if (e.key !== "Enter") return;
                                e.preventDefault();
                                saveTodaySteps();
                              }}
                              onPaste={(e) => {
                                e.preventDefault();
                                const pasted = e.clipboardData?.getData("text") ?? "";
                                const digitsOnly = String(pasted).replace(/\D+/g, "");
                                setTodaySteps(digitsOnly);
                              }}
                              placeholder="e.g. 8000"
                              disabled={!stepsSharingEnabled}
                            />
                            {!stepsSharingEnabled ? (
                              <div className="text-xs text-gray-500 mt-1">
                                Enable sharing to save steps.
                              </div>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            onClick={saveTodaySteps}
                            disabled={!canSaveTodaySteps}
                          >
                            Save
                          </Button>
                        </div>

                        {Array.isArray((stepsRecent as any)?.days) &&
                          (stepsRecent as any).days.length > 0 ? (
                          <StepsProgressGraph days={(stepsRecent as any).days} />
                        ) : null}

                        {Array.isArray((stepsRecent as any)?.days) &&
                          (stepsRecent as any).days.length > 0 ? (
                          <div className="rounded-md border overflow-hidden">
                            <div className="grid grid-cols-2 text-xs font-medium bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
                              <div>Date</div>
                              <div className="text-right">Steps</div>
                            </div>
                            {(stepsRecent as any).days.map((d: any, idx: number) => (
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
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}

          {activeSection === "meetings" ? (
            <div>
              {meetings.length === 0 ? (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                  No meetings yet
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      <span>Upcoming</span>
                    </div>
                    {upcomingMeetings.length === 0 ? (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        No upcoming meetings
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {upcomingMeetings.map((m: any) => (
                          <Card
                            key={m.id}
                            className="dark:bg-gray-800 dark:border-gray-700"
                          >
                            <CardContent className="px-5 py-2">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 min-w-0">
                                  <div className="min-w-0 space-y-1">
                                    <div className="font-medium text-gray-900 dark:text-white truncate">
                                      {String(m.title ?? "")}
                                    </div>
                                    {String(m.notes ?? "").trim() ? (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {String(m.notes)}
                                      </div>
                                    ) : null}
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                      {m.scheduledAt
                                        ? format(
                                          new Date(m.scheduledAt),
                                          "PPP p"
                                        )
                                        : ""}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                      {(() => {
                                        const typeText = String(
                                          m.type ?? "-"
                                        ).replace(/[-_]/g, " ");
                                        const typeLabel = toTitleCase(typeText);
                                        const meta = getTypeSpecificMeta(m);
                                        return (
                                          <div className="flex items-center gap-2 min-w-0">
                                            <span className="shrink-0">
                                              {getMeetingIcon(m.type)}
                                            </span>
                                            <span className="truncate">
                                              {typeLabel}
                                            </span>
                                            {meta ? (
                                              <>
                                                <span className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700 shrink-0" />
                                                <span className="truncate">
                                                  {meta.href ? (
                                                    <a
                                                      href={meta.href}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      className="underline underline-offset-2 hover:text-indigo-600 dark:hover:text-indigo-300"
                                                      onClick={(e) =>
                                                        e.stopPropagation()
                                                      }
                                                      onMouseDown={(e) =>
                                                        e.stopPropagation()
                                                      }
                                                    >
                                                      {meta.rawLocation}
                                                    </a>
                                                  ) : (
                                                    meta.rawLocation
                                                  )}
                                                </span>
                                              </>
                                            ) : null}
                                          </div>
                                        );
                                      })()}
                                    </div>

                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 truncate">
                                      <User className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                                      <span className="truncate">
                                        With: {coachBusinessName || "Coach"}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 truncate">
                                      <Clock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                      <span className="truncate">
                                        Duration:{" "}
                                        {Number.isFinite(
                                          Number(m?.durationMinutes)
                                        )
                                          ? `${Number(m.durationMinutes)} min`
                                          : "-"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-2 flex justify-end">
                                <span
                                  className={`inline-flex items-center h-6 px-2.5 rounded-md text-xs font-medium capitalize ${statusChipClasses(
                                    m.status
                                  )}`}
                                >
                                  {String(m.status ?? "unknown").replace(
                                    /[-_]/g,
                                    " "
                                  )}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      <span>Past</span>
                    </div>
                    {pastMeetings.length === 0 ? (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        No past meetings
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-gray-800 rounded-lg border">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                              <tr>
                                <th className="px-4 py-3 text-left font-medium">Meeting</th>
                                <th className="px-4 py-3 text-left font-medium">Date</th>
                                <th className="px-4 py-3 text-left font-medium">Type</th>
                                <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">
                                  With
                                </th>
                                <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">
                                  Duration
                                </th>
                                <th className="px-4 py-3 text-left font-medium">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pastMeetings.map((m: any) => {
                                const scheduledAt = m?.scheduledAt
                                  ? new Date(m.scheduledAt)
                                  : null;
                                const typeText = String(m.type ?? "-").replace(
                                  /[-_]/g,
                                  " "
                                );
                                const typeLabel = toTitleCase(typeText);
                                const meta = getTypeSpecificMeta(m);

                                return (
                                  <tr
                                    key={m.id}
                                    className="border-t hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                                  >
                                    <td className="px-4 py-3">
                                      <div className="min-w-0">
                                        <div className="font-medium text-gray-900 dark:text-white">
                                          {String(m.title ?? "").trim() || "-"}
                                        </div>
                                        {String(m.notes ?? "").trim() ? (
                                          <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
                                            {String(m.notes)}
                                          </div>
                                        ) : null}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">
                                      {scheduledAt && !Number.isNaN(scheduledAt.getTime())
                                        ? format(scheduledAt, "PPP p")
                                        : "-"}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="shrink-0">
                                          {getMeetingIcon(m.type)}
                                        </span>
                                        <span className="truncate">{typeLabel}</span>
                                      </div>
                                      {meta ? (
                                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                                          {meta.href ? (
                                            <a
                                              href={meta.href}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="underline underline-offset-2 hover:text-indigo-600 dark:hover:text-indigo-300"
                                              onMouseDown={(e) => e.stopPropagation()}
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              {meta.rawLocation}
                                            </a>
                                          ) : (
                                            meta.rawLocation
                                          )}
                                        </div>
                                      ) : null}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200 hidden lg:table-cell">
                                      {coachBusinessName || "Coach"}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200 hidden lg:table-cell whitespace-nowrap">
                                      {Number.isFinite(Number(m?.durationMinutes))
                                        ? `${Number(m.durationMinutes)} min`
                                        : "-"}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span
                                        className={`inline-flex items-center h-6 px-2.5 rounded-md text-xs font-medium capitalize ${statusChipClasses(
                                          m.status
                                        )}`}
                                      >
                                        {String(m.status ?? "unknown").replace(
                                          /[-_]/g,
                                          " "
                                        )}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {activeSection === "weekly" ? (
            <div className="space-y-4">
              {!myClient ? (
                <div className="py-10 text-center text-gray-500 dark:text-gray-400">
                  No client profile found
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => shiftWeeklyAnchorDays(-7)}
                      aria-label="Previous week"
                      title="Previous week"
                      className="text-gray-900 dark:text-gray-100"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-700 dark:text-gray-200" />
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 text-gray-900 dark:text-gray-100"
                    >
                      <Calendar className="w-4 h-4 text-gray-700 dark:text-gray-200" />
                      {format(weekStartDate, "MMM d")} –{" "}
                      {format(
                        new Date(
                          new Date(weekStartDate).setDate(
                            weekStartDate.getDate() + 6
                          )
                        ),
                        "MMM d"
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => shiftWeeklyAnchorDays(7)}
                      aria-label="Next week"
                      title="Next week"
                      className="text-gray-900 dark:text-gray-100"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-700 dark:text-gray-200" />
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setWeeklyAnchorDate(new Date())}
                      aria-label="Go to current week"
                      title="Go to current week"
                      className="text-gray-900 dark:text-gray-100"
                    >
                      <RotateCcw className="w-4 h-4 text-gray-700 dark:text-gray-200" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {weekDays.map((d) => {
                      const key = toLocalDateKey(d);
                      const daySchedule = weeklySchedule?.[key] ?? {};
                      const isToday = key === toLocalDateKey(new Date());

                      return (
                        <div
                          key={key}
                          className={`rounded-xl border p-3 dark:border-gray-700 bg-white dark:bg-gray-900/30 flex flex-col ${isToday
                            ? "border-indigo-200 dark:border-indigo-800"
                            : "border-gray-200"
                            }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-semibold text-gray-900 dark:text-white">
                                  {format(d, "EEE")}
                                  {isToday ? (
                                    <span className="ml-2 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                                      Today
                                    </span>
                                  ) : null}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {format(d, "PPP")}
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className={`h-8 px-2 text-xs justify-start gap-1.5 ${daySchedule.workoutCompleted
                                  ? "border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300"
                                  : "text-gray-700 dark:text-gray-200"
                                  }`}
                                onClick={() =>
                                  updateDaySchedule(key, {
                                    workoutCompleted:
                                      !daySchedule.workoutCompleted,
                                  })
                                }
                                aria-pressed={!!daySchedule.workoutCompleted}
                                aria-label="Mark workout completed"
                              >
                                <span className="w-4 h-4 inline-flex items-center justify-center">
                                  {daySchedule.workoutCompleted ? (
                                    <Check className="w-4 h-4" />
                                  ) : null}
                                </span>
                                Workout
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                className={`h-8 px-2 text-xs justify-start gap-1.5 ${daySchedule.mealsCompleted
                                  ? "border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300"
                                  : "text-gray-700 dark:text-gray-200"
                                  }`}
                                onClick={() =>
                                  updateDaySchedule(key, {
                                    mealsCompleted: !daySchedule.mealsCompleted,
                                  })
                                }
                                aria-pressed={!!daySchedule.mealsCompleted}
                                aria-label="Mark meals completed"
                              >
                                <span className="w-4 h-4 inline-flex items-center justify-center">
                                  {daySchedule.mealsCompleted ? (
                                    <Check className="w-4 h-4" />
                                  ) : null}
                                </span>
                                Meals
                              </Button>
                            </div>

                            <div className="mt-3 space-y-3">
                              <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                                Workout
                              </div>

                              {assignedPlansLoading ? (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Loading workout plans...
                                </div>
                              ) : assignedPlans.length === 0 ? (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  No workout plans assigned
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 gap-2">
                                  <Select
                                    value={String(
                                      daySchedule.workoutPlanId ?? ""
                                    )}
                                    onValueChange={(v) =>
                                      updateDaySchedule(key, {
                                        workoutPlanId: v,
                                      })
                                    }
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Plan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {assignedPlans.map((p: any) => (
                                        <SelectItem
                                          key={String(p.id)}
                                          value={String(p.id)}
                                        >
                                          {String(
                                            p.name ?? "Workout Plan"
                                          ).trim() || "Workout Plan"}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>

                                  <Input
                                    type="time"
                                    value={String(
                                      daySchedule.workoutTime ?? ""
                                    )}
                                    onChange={(e) =>
                                      updateDaySchedule(key, {
                                        workoutTime: e.target.value,
                                      })
                                    }
                                    placeholder="Time"
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 space-y-2">
                            <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                              Notes
                            </div>
                            <Input
                              type="text"
                              value={String(daySchedule.notes ?? "")}
                              onChange={(e) =>
                                updateDaySchedule(key, {
                                  notes: e.target.value,
                                })
                              }
                              placeholder="Notes"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Saved on this device for your account.
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {activeSection === "workouts" ? (
            <div className="space-y-4">
              {assignedPlanIds.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">
                  No workout plan assigned yet
                </p>
              ) : assignedPlansLoading ? (
                <p className="text-gray-500 dark:text-gray-400">Loading...</p>
              ) : assignedPlans.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">
                  No workout plan assigned yet
                </p>
              ) : (
                assignedPlans.map((plan: any) => {
                  const planId = String(plan?.id ?? "").trim();
                  const expanded = !!expandedWorkoutPlanIds[planId];
                  const planExercises =
                    ((planExercisesByPlanId as any)[planId] as any[]) || [];

                  return (
                    <Card
                      key={planId}
                      className="dark:bg-gray-800 dark:border-gray-700"
                    >
                      <CardHeader>
                        <div
                          className="flex items-start justify-between gap-3 cursor-pointer"
                          onClick={() => {
                            setExpandedWorkoutPlanIds((m) => ({
                              ...m,
                              [planId]: !m[planId],
                            }));
                          }}
                        >
                          <div className="min-w-0">
                            <CardTitle className="truncate">
                              {plan.name}
                            </CardTitle>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedWorkoutPlanIds((m) => ({
                                ...m,
                                [planId]: !m[planId],
                              }));
                            }}
                            aria-label={expanded ? "Collapse" : "Expand"}
                          >
                            {expanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </CardHeader>

                      {expanded ? (
                        <CardContent>
                          <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="text-rose-600 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200"
                                title="Download PDF"
                                aria-label="Download PDF"
                                onClick={() => downloadWorkoutPlanPdf(plan)}
                              >
                                <FileDown className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                                title="Download Text"
                                aria-label="Download Text"
                                onClick={() => downloadWorkoutPlanText(plan)}
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="text-green-600 hover:text-green-700 dark:text-green-300 dark:hover:text-green-200"
                                title="Copy to clipboard"
                                aria-label="Copy to clipboard"
                                onClick={() => void copyWorkoutPlan(plan)}
                              >
                                <CopyIcon className="w-4 h-4" />
                              </Button>
                            </div>

                            <div className="text-sm text-gray-600 dark:text-gray-300">
                              {plan.difficulty ? (
                                <span className="capitalize">
                                  {String(plan.difficulty).replace(
                                    /[_-]/g,
                                    " "
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-500 dark:text-gray-400">
                                  Difficulty: -
                                </span>
                              )}
                              {plan.duration ? (
                                <span> · {formatDuration(plan.duration)}</span>
                              ) : null}
                              {plan.goal ? <span> · {plan.goal}</span> : null}
                            </div>

                            {plan.notes ? (
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                                  Notes
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                                  {plan.notes}
                                </div>
                              </div>
                            ) : null}

                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                                Exercises
                              </div>
                              {planExercisesByPlanIdLoading ? (
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  Loading...
                                </div>
                              ) : planExercises.length === 0 ? (
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  No exercises
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {planExercises.map((ex: any, idx: number) => {
                                    const videoKind = String(
                                      ex.videoKind ?? ""
                                    ).trim();
                                    const videoUrlRaw = String(
                                      ex.videoUrl ?? ""
                                    ).trim();
                                    const restText = formatRest(ex.restSeconds);

                                    return (
                                      <div
                                        key={ex.id || `${planId}-${idx}`}
                                        className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2"
                                      >
                                        <div>
                                          <div className="min-w-0">
                                            <div className="font-medium text-gray-900 dark:text-white truncate">
                                              {ex.name || "-"}
                                            </div>

                                            {String(
                                              ex.guidelines ?? ""
                                            ).trim() ? (
                                              <div className="mt-1 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                                                {String(ex.guidelines)}
                                              </div>
                                            ) : null}

                                            {String(ex.sets ?? "").trim() ||
                                              String(ex.reps ?? "").trim() ||
                                              restText ? (
                                              <div className="mt-2 text-sm text-gray-700 dark:text-gray-200 leading-5">
                                                {String(
                                                  ex.sets ?? ""
                                                ).trim() ? (
                                                  <div>
                                                    {String(ex.sets).trim()}{" "}
                                                    Sets
                                                  </div>
                                                ) : null}
                                                {String(
                                                  ex.reps ?? ""
                                                ).trim() ? (
                                                  <div>
                                                    {String(ex.reps).trim()}{" "}
                                                    Reps
                                                  </div>
                                                ) : null}
                                                {restText ? (
                                                  <div>{restText} Rest</div>
                                                ) : null}
                                              </div>
                                            ) : null}

                                            {String(videoKind) === "youtube" &&
                                              String(videoUrlRaw).trim() ? (
                                              (() => {
                                                const embed = toYouTubeEmbedUrl(
                                                  String(videoUrlRaw)
                                                );
                                                if (!embed) return null;

                                                const id =
                                                  extractYouTubeVideoId(
                                                    String(videoUrlRaw)
                                                  );
                                                const watchUrl = id
                                                  ? `https://www.youtube.com/watch?v=${id}`
                                                  : null;

                                                return (
                                                  <div className="mt-2">
                                                    <div
                                                      className="relative w-full overflow-hidden rounded-lg bg-black"
                                                      style={{
                                                        paddingTop: "56.25%",
                                                      }}
                                                    >
                                                      {watchUrl ? (
                                                        <a
                                                          href={watchUrl}
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                          className="absolute inset-0 z-10 cursor-pointer"
                                                          title="Open video"
                                                          aria-label="Open video"
                                                        />
                                                      ) : null}
                                                      <iframe
                                                        src={embed}
                                                        title="Exercise video"
                                                        className="absolute inset-0 h-full w-full"
                                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                        allowFullScreen
                                                      />
                                                    </div>
                                                  </div>
                                                );
                                              })()
                                            ) : String(videoKind) ===
                                              "upload" &&
                                              String(videoUrlRaw).trim() ? (
                                              <div className="mt-2">
                                                <div
                                                  className="relative w-full overflow-hidden rounded-lg bg-black"
                                                  style={{
                                                    paddingTop: "56.25%",
                                                  }}
                                                >
                                                  <video
                                                    className="absolute inset-0 h-full w-full object-contain"
                                                    controls
                                                    preload="metadata"
                                                    src={String(
                                                      videoUrlRaw
                                                    ).trim()}
                                                  />
                                                </div>
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      ) : null}
                    </Card>
                  );
                })
              )}
            </div>
          ) : null}

          {activeSection === "meals" ? (
            <div className="space-y-4">
              {assignedMealPlanIds.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">
                  No meal plan assigned yet
                </p>
              ) : assignedMealPlansLoading ? (
                <p className="text-gray-500 dark:text-gray-400">Loading...</p>
              ) : assignedMealPlans.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">
                  No meal plan assigned yet
                </p>
              ) : (
                assignedMealPlans.map((plan: any) => {
                  const planId = String(plan?.id ?? "").trim();
                  const expanded = !!expandedMealPlanIds[planId];
                  const planMeals =
                    ((mealPlanMealsByPlanId as any)[planId] as any[]) || [];

                  return (
                    <Card
                      key={planId}
                      className="dark:bg-gray-800 dark:border-gray-700"
                    >
                      <CardHeader>
                        <div
                          className="flex items-start justify-between gap-3 cursor-pointer"
                          onClick={() => {
                            setExpandedMealPlanIds((m) => ({
                              ...m,
                              [planId]: !m[planId],
                            }));
                          }}
                        >
                          <div className="min-w-0">
                            <CardTitle className="truncate">
                              {plan.name}
                            </CardTitle>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedMealPlanIds((m) => ({
                                ...m,
                                [planId]: !m[planId],
                              }));
                            }}
                            aria-label={expanded ? "Collapse" : "Expand"}
                          >
                            {expanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </CardHeader>

                      {expanded ? (
                        <CardContent>
                          <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="text-rose-600 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200"
                                title="Download PDF"
                                aria-label="Download PDF"
                                onClick={() => downloadMealPlanPdf(plan)}
                              >
                                <FileDown className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                                title="Download Text"
                                aria-label="Download Text"
                                onClick={() => downloadMealPlanText(plan)}
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="text-green-600 hover:text-green-700 dark:text-green-300 dark:hover:text-green-200"
                                title="Copy to clipboard"
                                aria-label="Copy to clipboard"
                                onClick={() => void copyMealPlan(plan)}
                              >
                                <CopyIcon className="w-4 h-4" />
                              </Button>
                            </div>

                            {plan.goal ? (
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Goal: {toTitleCase(plan.goal)}
                              </div>
                            ) : null}

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                  <Flame className="w-4 h-4 text-orange-500" />
                                  <span>Calories</span>
                                </div>
                                <div className="mt-1 font-medium text-gray-900 dark:text-white">
                                  {(() => {
                                    const raw = String(
                                      plan.dailyCalories ?? ""
                                    ).trim();
                                    if (!raw) return "-";
                                    return /kcal/i.test(raw)
                                      ? raw
                                      : `${raw} kcal`;
                                  })()}
                                </div>
                              </div>

                              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                  <Beef className="w-4 h-4 text-blue-500" />
                                  <span>Protein</span>
                                </div>
                                <div className="mt-1 font-medium text-gray-900 dark:text-white">
                                  {(() => {
                                    const raw = String(
                                      plan.dailyProtein ?? ""
                                    ).trim();
                                    if (!raw) return "-";
                                    return /\bg\b/i.test(raw)
                                      ? raw
                                      : `${raw} g`;
                                  })()}
                                </div>
                              </div>

                              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                  <Wheat className="w-4 h-4 text-yellow-500" />
                                  <span>Carbs</span>
                                </div>
                                <div className="mt-1 font-medium text-gray-900 dark:text-white">
                                  {(() => {
                                    const raw = String(
                                      plan.dailyCarbs ?? ""
                                    ).trim();
                                    if (!raw) return "-";
                                    return /\bg\b/i.test(raw)
                                      ? raw
                                      : `${raw} g`;
                                  })()}
                                </div>
                              </div>

                              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2">
                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                  <Droplets className="w-4 h-4 text-purple-500" />
                                  <span>Fat</span>
                                </div>
                                <div className="mt-1 font-medium text-gray-900 dark:text-white">
                                  {(() => {
                                    const raw = String(
                                      plan.dailyFat ?? ""
                                    ).trim();
                                    if (!raw) return "-";
                                    return /\bg\b/i.test(raw)
                                      ? raw
                                      : `${raw} g`;
                                  })()}
                                </div>
                              </div>
                            </div>

                            {plan.notes ? (
                              <p className="text-gray-600 dark:text-gray-400">
                                {plan.notes}
                              </p>
                            ) : null}

                            <div>
                              <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                Meals
                              </div>

                              {mealPlanMealsByPlanIdLoading ? (
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  Loading...
                                </div>
                              ) : planMeals.length === 0 ? (
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  No meals added to this plan yet
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {planMeals.map(
                                    (meal: any, mealIdx: number) => (
                                      <div
                                        key={meal.id || `${mealIdx}`}
                                        className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2"
                                      >
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="min-w-0">
                                            {String(meal.name ?? "").trim() ? (
                                              <>
                                                <div className="font-medium text-gray-900 dark:text-white truncate">
                                                  {String(
                                                    meal.name ?? ""
                                                  ).trim()}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                  {toTitleCase(meal.type) ||
                                                    "Meal"}
                                                </div>
                                              </>
                                            ) : (
                                              <div className="font-medium text-gray-900 dark:text-white truncate">
                                                {toTitleCase(meal.type) ||
                                                  "Meal"}
                                              </div>
                                            )}
                                          </div>
                                          <div className="shrink-0 text-xs text-gray-600 dark:text-gray-300">
                                            per 100g
                                          </div>
                                        </div>

                                        {Array.isArray(meal.foods) &&
                                          meal.foods.length > 0 ? (
                                          <div className="mt-2 space-y-1">
                                            {meal.foods.map(
                                              (food: any, foodIdx: number) => (
                                                <div
                                                  key={food.id || `${foodIdx}`}
                                                  className="flex items-center justify-between gap-3 text-xs text-gray-600 dark:text-gray-300"
                                                >
                                                  <div className="min-w-0 truncate">
                                                    {food.name || "-"}
                                                    {food.amount ? (
                                                      <span className="text-gray-500 dark:text-gray-400">
                                                        {" "}
                                                        · {food.amount}
                                                      </span>
                                                    ) : null}
                                                  </div>
                                                  <div className="shrink-0 text-gray-500 dark:text-gray-400">
                                                    {[
                                                      food.protein
                                                        ? `P ${food.protein}`
                                                        : "",
                                                      food.carbs
                                                        ? `C ${food.carbs}`
                                                        : "",
                                                      food.fat
                                                        ? `F ${food.fat}`
                                                        : "",
                                                    ]
                                                      .filter(
                                                        (v): v is string =>
                                                          Boolean(v)
                                                      )
                                                      .join(" · ")}
                                                  </div>
                                                </div>
                                              )
                                            )}
                                          </div>
                                        ) : (
                                          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                            No foods
                                          </div>
                                        )}
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      ) : null}
                    </Card>
                  );
                })
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
