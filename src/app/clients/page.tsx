"use client";

import React from "react";
import { db } from "@/lib/db";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Mail,
  Phone,
  Mars,
  Venus,
  VenusAndMars,
  Ban,
  Trash2,
  ArrowUpDown,
  Users,
} from "lucide-react";
import ClientDetailsDialog from "@/components/ClientDetailsDialog";
import ClientAvatar from "@/components/ClientAvatar";
import { Client } from "@/types";
import { getCookie, setCookie } from "@/lib/client-cookies";

export default function ClientsPage() {
  const [search, setSearch] = React.useState("");

  // Unified Details/Create/Edit Panel State
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [detailsClientId, setDetailsClientId] = React.useState<string | null>(
    null
  );

  const [pageSize, setPageSize] = React.useState(() => {
    const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const;
    if (typeof window === "undefined") return 10;
    const raw = getCookie("progrr_clients_rows_per_page");
    const parsed = raw ? Number(raw) : NaN;
    if (
      Number.isFinite(parsed) &&
      (PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed)
    ) {
      return parsed;
    }
    return 10;
  });

  const [primaryPage, setPrimaryPage] = React.useState(1);
  const [inactivePage, setInactivePage] = React.useState(1);
  const [deletedPage, setDeletedPage] = React.useState(1);
  const [sortConfig, setSortConfig] = React.useState<{
    key: keyof Client;
    direction: "asc" | "desc";
  } | null>(null);

  const queryClient = useQueryClient();

  const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const;

  // Persist page size
  React.useEffect(() => {
    setCookie("progrr_clients_rows_per_page", String(pageSize), {
      maxAgeSeconds: 60 * 60 * 24 * 365,
    });
  }, [pageSize]);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => db.entities.Client.list("-created_date"),
  });

  const { data: workoutPlans = [] } = useQuery({
    queryKey: ["workoutPlans"],
    queryFn: () => db.entities.WorkoutPlan.list(),
  });

  const { data: mealPlans = [] } = useQuery({
    queryKey: ["mealPlans"],
    queryFn: () => db.entities.MealPlan.list(),
  });

  const filteredClients = clients.filter(
    (c: Client) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.toLowerCase().includes(search.toLowerCase())
  );

  const sortedClients = React.useMemo(() => {
    if (!sortConfig) return filteredClients;

    const collator = new Intl.Collator(["he", "en"], {
      sensitivity: "base",
      numeric: true,
    });

    return [...filteredClients].sort((a, b) => {
      const direction = sortConfig.direction === "asc" ? 1 : -1;

      const aRaw =
        sortConfig.key === "name" ? a.name : (a[sortConfig.key] as any);
      const bRaw =
        sortConfig.key === "name" ? b.name : (b[sortConfig.key] as any);

      const aValue = String(aRaw ?? "").trim();
      const bValue = String(bRaw ?? "").trim();

      const aEmpty = aValue.length === 0;
      const bEmpty = bValue.length === 0;
      if (aEmpty && !bEmpty) return 1;
      if (!aEmpty && bEmpty) return -1;

      const cmp = collator.compare(aValue, bValue);
      if (cmp !== 0) return cmp * direction;

      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    });
  }, [filteredClients, sortConfig]);

  const handleSort = (key: keyof Client) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  };

  const handleOpenDetails = (client: Client) => {
    console.log("Opening details for:", client.id); // Debug
    setDetailsClientId(client.id);
    setDetailsOpen(true);
  };

  const handleCloseDetails = (open: boolean) => {
    setDetailsOpen(open);
    if (!open) {
      // Small timeout to prevent flickering if switching modes
      setTimeout(() => setDetailsClientId(null), 200);
    }
  };

  const handleCreateClient = () => {
    setDetailsClientId(null);
    setDetailsOpen(true);
  };

  const normalizeStatus = (value: unknown) => {
    const v = String(value ?? "")
      .trim()
      .toUpperCase();
    return v === "ACTIVE" ||
      v === "PENDING" ||
      v === "INACTIVE" ||
      v === "BLOCKED" ||
      v === "DELETED"
      ? v
      : "";
  };

  const statusConfig: Record<string, string> = {
    ACTIVE:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
    PENDING:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/25 dark:text-yellow-200",
    INACTIVE:
      "bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-200",
    BLOCKED: "bg-red-100 text-red-800 dark:bg-red-900/25 dark:text-red-200",
    DELETED:
      "bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-800",
  };

  const inactiveClients = sortedClients.filter(
    (c: Client) => normalizeStatus(c.status) === "INACTIVE"
  );
  const deletedClients = sortedClients.filter(
    (c: Client) => normalizeStatus(c.status) === "DELETED"
  );
  const primaryClients = sortedClients.filter((c: Client) => {
    const s = normalizeStatus(c.status);
    return s !== "INACTIVE" && s !== "DELETED";
  });

  // Reset pagination on search
  React.useEffect(() => {
    setPrimaryPage(1);
    setInactivePage(1);
    setDeletedPage(1);
  }, [search, sortConfig?.key, sortConfig?.direction, pageSize]);

  // Ensure page is valid
  React.useEffect(() => {
    const totalPrimary = Math.max(
      1,
      Math.ceil(primaryClients.length / pageSize)
    );
    if (primaryPage > totalPrimary) setPrimaryPage(totalPrimary);
  }, [primaryClients.length, pageSize, primaryPage]);

  React.useEffect(() => {
    const totalInactive = Math.max(
      1,
      Math.ceil(inactiveClients.length / pageSize)
    );
    if (inactivePage > totalInactive) setInactivePage(totalInactive);
  }, [inactiveClients.length, pageSize, inactivePage]);

  React.useEffect(() => {
    const totalDeleted = Math.max(
      1,
      Math.ceil(deletedClients.length / pageSize)
    );
    if (deletedPage > totalDeleted) setDeletedPage(totalDeleted);
  }, [deletedClients.length, pageSize, deletedPage]);

  const paginate = React.useCallback(
    (rows: Client[], page: number) => {
      const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
      const safePage = Math.min(Math.max(1, page), totalPages);
      const start = (safePage - 1) * pageSize;
      const pagedRows = rows.slice(start, start + pageSize);
      return { pagedRows, totalPages, page: safePage, totalCount: rows.length };
    },
    [pageSize]
  );

  const primaryPaging = React.useMemo(
    () => paginate(primaryClients, primaryPage),
    [paginate, primaryClients, primaryPage]
  );
  const inactivePaging = React.useMemo(
    () => paginate(inactiveClients, inactivePage),
    [paginate, inactiveClients, inactivePage]
  );
  const deletedPaging = React.useMemo(
    () => paginate(deletedClients, deletedPage),
    [paginate, deletedClients, deletedPage]
  );

  const workoutPlanNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of workoutPlans as any[]) {
      if (p?.id) map.set(String(p.id), String(p.name ?? ""));
    }
    return map;
  }, [workoutPlans]);

  const mealPlanNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of mealPlans as any[]) {
      if (p?.id) map.set(String(p.id), String(p.name ?? ""));
    }
    return map;
  }, [mealPlans]);

  const renderClientsTable = (
    rows: Client[],
    pagination: {
      page: number;
      totalPages: number;
      totalCount: number;
      onPrev: () => void;
      onNext: () => void;
    }
  ) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th
                className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-2">
                  Client
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center gap-2">
                  Status
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort("goal")}
              >
                <div className="flex items-center gap-2">
                  Goal
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort("activityLevel")}
              >
                <div className="flex items-center gap-2">
                  Activity
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </th>
              <th className="px-4 py-3 text-left font-medium">Assigned Plan</th>
              <th className="px-4 py-3 text-left font-medium">Assigned Meal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((client: Client) => {
              const status = normalizeStatus(client.status) || "ACTIVE";
              const gender = String(client.gender ?? "")
                .trim()
                .toLowerCase();

              const rawPlanIds = (client as any).assignedPlanIds;
              const rawMealPlanIds = (client as any).assignedMealPlanIds;

              const assignedPlanIds: string[] = Array.isArray(rawPlanIds)
                ? rawPlanIds.map((v: any) => String(v ?? "").trim())
                : [];
              const assignedMealPlanIds: string[] = Array.isArray(
                rawMealPlanIds
              )
                ? rawMealPlanIds.map((v: any) => String(v ?? "").trim())
                : [];

              const legacyPlanId = String(
                (client as any).assignedPlanId ?? ""
              ).trim();
              const legacyMealPlanId = String(
                (client as any).assignedMealPlanId ?? ""
              ).trim();

              const normalizedPlanIds = Array.from(
                new Set(
                  [...assignedPlanIds, ...(legacyPlanId ? [legacyPlanId] : [])]
                    .map((v) => String(v).trim())
                    .filter((v) => v && v !== "none")
                )
              );
              const normalizedMealPlanIds = Array.from(
                new Set(
                  [
                    ...assignedMealPlanIds,
                    ...(legacyMealPlanId ? [legacyMealPlanId] : []),
                  ]
                    .map((v) => String(v).trim())
                    .filter((v) => v && v !== "none")
                )
              );

              const assignedPlanName = normalizedPlanIds.length
                ? normalizedPlanIds
                    .map((id) => workoutPlanNameById.get(id) || "-")
                    .join(", ")
                : "-";
              const assignedMealName = normalizedMealPlanIds.length
                ? normalizedMealPlanIds
                    .map((id) => mealPlanNameById.get(id) || "-")
                    .join(", ")
                : "-";

              return (
                <tr
                  key={client.id}
                  className="border-t hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer transition-colors"
                  onClick={() => handleOpenDetails(client)}
                >
                  {/* CLIENT COLUMN */}
                  <td className="px-4 py-3">
                    <div className="flex items-start justify-start gap-3 min-w-0">
                      <ClientAvatar
                        name={client.name}
                        src={(client as any).avatarDataUrl}
                        size={36}
                        className="mt-0.5"
                      />

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          {gender === "female" ? (
                            <Venus className="w-4 h-4 text-pink-500 shrink-0" />
                          ) : gender === "male" ? (
                            <Mars className="w-4 h-4 text-blue-500 shrink-0" />
                          ) : gender === "other" ? (
                            <VenusAndMars className="w-4 h-4 text-purple-500 shrink-0" />
                          ) : null}
                          <span className="font-medium truncate">
                            {client.name}
                          </span>
                          {status === "BLOCKED" ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className="inline-flex shrink-0"
                                  aria-label="Blocked"
                                >
                                  <Ban className="w-4 h-4 text-red-600 dark:text-red-300" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent sideOffset={6}>
                                {String(
                                  (client as any).blockReason ?? ""
                                ).trim() || "Blocked"}
                              </TooltipContent>
                            </Tooltip>
                          ) : null}
                          {status === "DELETED" ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className="inline-flex shrink-0"
                                  aria-label="Deleted"
                                >
                                  <Trash2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent sideOffset={6}>
                                Account Deleted
                              </TooltipContent>
                            </Tooltip>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
                          <Mail className="w-3 h-3" />
                          {client.email}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
                          <Phone className="w-3 h-3" />
                          {client.phone}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {status === "BLOCKED" ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={`inline-flex items-center justify-center w-20 h-7 px-3 rounded-md text-xs font-medium ${statusConfig[status]}`}
                          >
                            {status}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>
                          {String((client as any).blockReason ?? "").trim() ||
                            "Blocked"}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span
                        className={`inline-flex items-center justify-center w-20 h-7 px-3 rounded-md text-xs font-medium ${statusConfig[status]}`}
                      >
                        {status}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 capitalize">
                    {client.goal?.replace("_", " ") || "-"}
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {client.activityLevel || "-"}
                  </td>

                  <td className="px-4 py-3">
                    <div className="truncate max-w-[220px]">
                      {assignedPlanName}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="truncate max-w-[220px]">
                      {assignedMealName}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t bg-gray-50/60 dark:bg-gray-700/40">
        <div className="text-xs text-gray-600 dark:text-gray-300">
          Page {pagination.page} of {pagination.totalPages}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={pagination.onPrev}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={pagination.onNext}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-8 bg-[#F5F6F8] dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Clients</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your client roster
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleCreateClient}
            className="min-w-[120px] bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="w-5 h-5 mr-2" />
            Client
          </Button>
        </div>
      </div>

      {/* Search + Pagination settings */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="max-w-md relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients"
            className="pl-10"
          />
        </div>

        <div className="w-[180px]">
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              const next = Number(v);
              if (!Number.isFinite(next)) return;
              setPageSize(next);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Rows per page" />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} rows
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-500">Loading…</div>
      ) : sortedClients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 text-indigo-500 dark:text-indigo-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {search
                ? "No clients found"
                : "No clients yet. Create your first one!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {primaryClients.length > 0
            ? renderClientsTable(primaryPaging.pagedRows, {
                page: primaryPaging.page,
                totalPages: primaryPaging.totalPages,
                totalCount: primaryPaging.totalCount,
                onPrev: () => setPrimaryPage((p) => Math.max(1, p - 1)),
                onNext: () =>
                  setPrimaryPage((p) =>
                    Math.min(primaryPaging.totalPages, p + 1)
                  ),
              })
            : null}

          {inactiveClients.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                Inactive Clients
              </div>
              {renderClientsTable(inactivePaging.pagedRows, {
                page: inactivePaging.page,
                totalPages: inactivePaging.totalPages,
                totalCount: inactivePaging.totalCount,
                onPrev: () => setInactivePage((p) => Math.max(1, p - 1)),
                onNext: () =>
                  setInactivePage((p) =>
                    Math.min(inactivePaging.totalPages, p + 1)
                  ),
              })}
            </div>
          ) : null}

          {deletedClients.length > 0 ? (
            <div className="space-y-3 mt-8">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                Deleted Clients
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-red-100 dark:border-red-900/30 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-red-50/50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/30">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                          Client
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                          Deletion Info
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                          Deleted Date
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {deletedPaging.pagedRows.map((client: Client) => {
                        const deletedBy =
                          (client as any).deletedBy === "ADMIN"
                            ? "Admin"
                            : (client as any).deletedBy === "CLIENT"
                            ? "Client"
                            : "Unknown";

                        const deletedAtRaw = (client as any).deletedAt;
                        const deletedAt = deletedAtRaw
                          ? new Date(deletedAtRaw).toLocaleDateString()
                          : "-";

                        return (
                          <tr
                            key={client.id}
                            className="border-t hover:bg-gray-50 dark:hover:bg-gray-700/40"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <ClientAvatar
                                  name={client.name}
                                  src={(client as any).avatarDataUrl}
                                  size={32}
                                  className="opacity-60 grayscale"
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium text-gray-500 line-through decoration-red-500/30">
                                    {client.name}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    {client.email}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-medium ${statusConfig.DELETED}`}
                              >
                                DELETED
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
                                <Users className="w-3 h-3" />
                                Deleted by {deletedBy}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {deletedAt}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs border border-dashed border-gray-300 hover:border-gray-400 dark:border-gray-700"
                                onClick={() => handleOpenDetails(client)}
                              >
                                View Details
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {deletedPaging.totalPages > 1 && (
                  <div className="flex items-center justify-between gap-3 px-4 py-3 border-t bg-gray-50/60 dark:bg-gray-700/40">
                    <div className="text-xs text-gray-600 dark:text-gray-300">
                      Page {deletedPaging.page} of {deletedPaging.totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={deletedPaging.page <= 1}
                        onClick={() =>
                          setDeletedPage((p) => Math.max(1, p - 1))
                        }
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          deletedPaging.page >= deletedPaging.totalPages
                        }
                        onClick={() =>
                          setDeletedPage((p) =>
                            Math.min(deletedPaging.totalPages, p + 1)
                          )
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Unified Client Details Panel */}
      <ClientDetailsDialog
        client={
          (detailsClientId &&
            clients.find((c: any) => c.id === detailsClientId)) ||
          null
        }
        open={detailsOpen}
        onOpenChange={handleCloseDetails}
        workoutPlanNameById={workoutPlanNameById}
        mealPlanNameById={mealPlanNameById}
        onClientUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ["clients"] });
        }}
      />
    </div>
  );
}
