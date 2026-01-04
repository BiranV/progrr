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
  MessageSquare,
  Mail,
  Phone,
  Video,
  MapPin,
  Bell,
  Send,
  Sun,
  Moon,
  LogOut,
  FileDown,
  FileText,
  Copy as CopyIcon,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Flame,
  Beef,
  Wheat,
  Droplets,
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
import ClientAvatar from "@/components/ClientAvatar";
import { extractYouTubeVideoId, toYouTubeEmbedUrl } from "@/lib/youtube";
import {
  copyTextToClipboard,
  downloadPdfFile,
  downloadTextFile,
  formatMealPlanText,
  formatWorkoutPlanText,
} from "@/lib/plan-export";
import { toast } from "sonner";

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

  const normalizeStatus = (value: unknown) => {
    const v = String(value ?? "")
      .trim()
      .toUpperCase();
    return v === "ACTIVE" || v === "PENDING" || v === "INACTIVE" ? v : "";
  };

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
  const { logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = React.useState<
    "menu" | "profile" | "meetings" | "workouts" | "meals"
  >("menu");
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

  const toTitleCase = (value: any) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const cleaned = raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    return cleaned
      .split(" ")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(" ");
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

  const { data: clients = [] } = useQuery({
    queryKey: ["myClient"],
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
      enabled: activeSection === "workouts" && assignedPlanIds.length > 0,
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
      enabled: activeSection === "meals" && assignedMealPlanIds.length > 0,
    });

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
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["myMeetings", myClient?.id],
    queryFn: () => db.entities.Meeting.filter({ clientId: myClient.id }),
    enabled: !!myClient,
  });

  const now = new Date();
  const sortedMeetings = [...meetings].sort((a: any, b: any) => {
    const at = new Date(a.scheduledAt || 0).getTime();
    const bt = new Date(b.scheduledAt || 0).getTime();
    return at - bt;
  });
  const upcomingMeetings = sortedMeetings.filter((m: any) => {
    const d = new Date(m.scheduledAt || 0);
    return d.getTime() >= now.getTime();
  });
  const pastMeetings = sortedMeetings
    .filter((m: any) => {
      const d = new Date(m.scheduledAt || 0);
      return d.getTime() < now.getTime();
    })
    .reverse();

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
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
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

        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? (
            <Sun className="w-6 h-6 text-gray-700 dark:text-gray-200" />
          ) : (
            <Moon className="w-6 h-6 text-gray-700 dark:text-gray-200" />
          )}
        </button>

        <button
          onClick={() => logout(true)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Logout"
        >
          <LogOut className="w-6 h-6 text-gray-700 dark:text-gray-200" />
        </button>
      </div>

      <div className="mb-6">
        <div className="min-w-0 pr-24 md:pr-0">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Hi, {user.full_name}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Track your progress and stay connected with your coach
          </p>
        </div>
      </div>

      {activeSection === "menu" ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card
            className="h-32 md:h-36 dark:bg-gray-800 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60"
            onClick={() => setActiveSection("profile")}
          >
            <CardHeader className="h-full flex flex-col items-center justify-center text-center gap-2">
              <Users className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              <CardTitle className="text-base">Profile</CardTitle>
            </CardHeader>
          </Card>

          <Card
            className="h-32 md:h-36 dark:bg-gray-800 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60"
            onClick={() => setActiveSection("meetings")}
          >
            <CardHeader className="h-full flex flex-col items-center justify-center text-center gap-2">
              <Calendar className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              <CardTitle className="text-base">Meetings</CardTitle>
            </CardHeader>
          </Card>

          <Card
            className="h-32 md:h-36 dark:bg-gray-800 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60"
            onClick={() => setActiveSection("workouts")}
          >
            <CardHeader className="h-full flex flex-col items-center justify-center text-center gap-2">
              <Dumbbell className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              <CardTitle className="text-base">Workout Plans</CardTitle>
            </CardHeader>
          </Card>

          <Card
            className="h-32 md:h-36 dark:bg-gray-800 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60"
            onClick={() => setActiveSection("meals")}
          >
            <CardHeader className="h-full flex flex-col items-center justify-center text-center gap-2">
              <UtensilsCrossed className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              <CardTitle className="text-base">Meal Plans</CardTitle>
            </CardHeader>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className="gap-2"
              onClick={() => setActiveSection("menu")}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {activeSection === "profile"
                ? "Profile"
                : activeSection === "meetings"
                ? "Meetings"
                : activeSection === "workouts"
                ? "Workout Plans"
                : "Meal Plans"}
            </div>
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  </div>
                </div>
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
                <div className="space-y-6">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      Upcoming
                    </div>
                    {upcomingMeetings.length === 0 ? (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        No upcoming meetings
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {upcomingMeetings.map((m: any) => (
                          <div
                            key={m.id}
                            className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {toTitleCase(m.title)}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                  {m.scheduledAt
                                    ? format(new Date(m.scheduledAt), "PPP p")
                                    : ""}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 text-xs">
                                {m.type ? (
                                  <span className="px-2 py-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200 rounded-full">
                                    {toTitleCase(m.type)}
                                  </span>
                                ) : null}
                                {m.status ? (
                                  <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 rounded-full">
                                    {toTitleCase(m.status)}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                              {m.durationMinutes ? (
                                <div className="text-gray-700 dark:text-gray-300">
                                  <span className="text-gray-500 dark:text-gray-400">
                                    Duration:{" "}
                                  </span>
                                  {m.durationMinutes} minutes
                                </div>
                              ) : null}
                              {m.location ? (
                                <div className="text-gray-700 dark:text-gray-300">
                                  <span className="text-gray-500 dark:text-gray-400">
                                    Location:{" "}
                                  </span>
                                  {toTitleCase(m.location)}
                                </div>
                              ) : null}
                            </div>

                            {m.notes ? (
                              <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                <span className="text-gray-500 dark:text-gray-400">
                                  Notes:{" "}
                                </span>
                                {m.notes}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      Past
                    </div>
                    {pastMeetings.length === 0 ? (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        No past meetings
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {pastMeetings.map((m: any) => (
                          <div
                            key={m.id}
                            className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {toTitleCase(m.title)}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                  {m.scheduledAt
                                    ? format(new Date(m.scheduledAt), "PPP p")
                                    : ""}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 text-xs">
                                {m.type ? (
                                  <span className="px-2 py-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200 rounded-full">
                                    {toTitleCase(m.type)}
                                  </span>
                                ) : null}
                                {m.status ? (
                                  <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 rounded-full">
                                    {toTitleCase(m.status)}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                              {m.durationMinutes ? (
                                <div className="text-gray-700 dark:text-gray-300">
                                  <span className="text-gray-500 dark:text-gray-400">
                                    Duration:{" "}
                                  </span>
                                  {m.durationMinutes} minutes
                                </div>
                              ) : null}
                              {m.location ? (
                                <div className="text-gray-700 dark:text-gray-300">
                                  <span className="text-gray-500 dark:text-gray-400">
                                    Location:{" "}
                                  </span>
                                  {toTitleCase(m.location)}
                                </div>
                              ) : null}
                            </div>

                            {m.notes ? (
                              <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                <span className="text-gray-500 dark:text-gray-400">
                                  Notes:{" "}
                                </span>
                                {m.notes}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
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
