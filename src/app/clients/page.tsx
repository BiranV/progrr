"use client";

import React from "react";
import { db } from "@/lib/db";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Mail,
  Phone,
  Mars,
  Venus,
  VenusAndMars,
  Ban,
  Trash2,
  Users,
} from "lucide-react";
import ClientPanel from "@/components/panels/ClientPanel";
import ClientAvatar from "@/components/ClientAvatar";
import { Client } from "@/types";
import { getCookie, setCookie } from "@/lib/client-cookies";
import { type DataTableColumn } from "@/components/ui/table/DataTable";
import { EntityPageLayout } from "@/components/ui/entity/EntityPageLayout";
import { EntityToolbar } from "@/components/ui/entity/EntityToolbar";
import { EntityTableSection } from "@/components/ui/entity/EntityTableSection";
import { GenericDetailsPanel } from "@/components/ui/entity/GenericDetailsPanel";
import { useEntityTableState } from "@/hooks/useEntityTableState";
import { usePlanGuards } from "@/hooks/use-plan-guards";
import { LIMIT_REACHED_REASON } from "@/config/plans";

type ClientEntityRow = Client & {
  __entityStatus: "ACTIVE" | "ARCHIVED";
};

export default function ClientsPage() {
  const [search, setSearch] = React.useState("");

  // Unified Details/Create/Edit Panel State
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [detailsClientId, setDetailsClientId] = React.useState<string | null>(
    null
  );

  const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const;

  const [pageSize, setPageSize] = React.useState(() => {
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

  const queryClient = useQueryClient();

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

  const filteredClients = (clients as Client[]).filter((c: Client) => {
    const q = search.toLowerCase();
    return (
      String(c.name ?? "")
        .toLowerCase()
        .includes(q) ||
      String(c.email ?? "")
        .toLowerCase()
        .includes(q) ||
      String(c.phone ?? "")
        .toLowerCase()
        .includes(q)
    );
  });

  const handleOpenDetails = (client: Client) => {
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
      v === "PENDING_LIMIT" ||
      v === "INACTIVE" ||
      v === "BLOCKED" ||
      v === "ARCHIVED" ||
      v === "DELETED"
      ? v
      : "";
  };

  const statusConfig: Record<string, string> = {
    ACTIVE:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
    PENDING:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/25 dark:text-yellow-200",
    PENDING_LIMIT:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/25 dark:text-indigo-200",
    INACTIVE:
      "bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-200",
    BLOCKED: "bg-red-100 text-red-800 dark:bg-red-900/25 dark:text-red-200",
    ARCHIVED:
      "bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
    DELETED:
      "bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-800",
  };

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

  const toEntityStatus = React.useCallback(
    (value: unknown): ClientEntityRow["__entityStatus"] => {
      const s = normalizeStatus(value);
      if (s === "INACTIVE" || s === "BLOCKED" || s === "DELETED" || s === "ARCHIVED") {
        return "ARCHIVED";
      }
      return "ACTIVE";
    },
    []
  );

  const entityRows = React.useMemo<ClientEntityRow[]>(() => {
    return filteredClients.map((client) => ({
      ...client,
      __entityStatus: toEntityStatus(client.status) as ClientEntityRow["__entityStatus"],
    }));
  }, [filteredClients, toEntityStatus]);

  const table = useEntityTableState<ClientEntityRow, "__entityStatus">({
    rows: entityRows,
    statusKey: "__entityStatus",
    pageSize,
  });

  const getAssignedNames = React.useCallback(
    (client: Client) => {
      const rawPlanIds = (client as any).assignedPlanIds;
      const rawMealPlanIds = (client as any).assignedMealPlanIds;

      const assignedPlanIds: string[] = Array.isArray(rawPlanIds)
        ? rawPlanIds.map((v: any) => String(v ?? "").trim())
        : [];
      const assignedMealPlanIds: string[] = Array.isArray(rawMealPlanIds)
        ? rawMealPlanIds.map((v: any) => String(v ?? "").trim())
        : [];

      const legacyPlanId = String((client as any).assignedPlanId ?? "").trim();
      const legacyMealPlanId = String((client as any).assignedMealPlanId ?? "").trim();

      const normalizedPlanIds = Array.from(
        new Set(
          [...assignedPlanIds, ...(legacyPlanId ? [legacyPlanId] : [])]
            .map((v) => String(v).trim())
            .filter((v) => v && v !== "none")
        )
      );
      const normalizedMealPlanIds = Array.from(
        new Set(
          [...assignedMealPlanIds, ...(legacyMealPlanId ? [legacyMealPlanId] : [])]
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

      return { assignedPlanName, assignedMealName };
    },
    [mealPlanNameById, workoutPlanNameById]
  );

  const columns = React.useMemo(() => {
    const cols: Array<DataTableColumn<ClientEntityRow>> = [
      {
        key: "name",
        header: "Client",
        sortable: true,
        renderCell: (client) => {
          const normalizedStatus = normalizeStatus(client.status);
          const status = normalizedStatus || "ACTIVE";
          const gender = String(client.gender ?? "")
            .trim()
            .toLowerCase();

          return (
            <div className="flex items-start justify-start gap-3 min-w-0">
              <ClientAvatar
                name={client.name}
                src={(client as any)?.avatarDataUrl}
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
                    {String(client.name ?? "")}
                  </span>

                  {status === "BLOCKED" ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex shrink-0" aria-label="Blocked">
                          <Ban className="w-4 h-4 text-red-600 dark:text-red-300" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>
                        {String((client as any).blockReason ?? "").trim() || "Blocked"}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}

                  {status === "DELETED" ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex shrink-0" aria-label="Deleted">
                          <Trash2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>Account Deleted</TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
                  <Mail className="w-3 h-3" />
                  {String(client.email ?? "")}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
                  <Phone className="w-3 h-3" />
                  {String(client.phone ?? "")}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        key: "status",
        header: "Status",
        sortable: false,
        renderCell: (client) => {
          const normalizedStatus = normalizeStatus(client.status);
          const status = normalizedStatus || "ACTIVE";

          if (status === "BLOCKED") {
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={`inline-flex items-center justify-center w-20 h-7 px-3 rounded-md text-xs font-medium ${statusConfig[status]
                      }`}
                  >
                    {status}
                  </span>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  {String((client as any).blockReason ?? "").trim() || "Blocked"}
                </TooltipContent>
              </Tooltip>
            );
          }

          return (
            <span
              className={`inline-flex items-center justify-center w-20 h-7 px-3 rounded-md text-xs font-medium ${statusConfig[status]
                }`}
            >
              {status}
            </span>
          );
        },
      },
      {
        key: "goal",
        header: "Goal",
        sortable: true,
        renderCell: (client) => {
          return (
            <span className="capitalize">
              {String((client as any)?.goal ?? "")
                .replace("_", " ")
                .trim() || "-"}
            </span>
          );
        },
      },
      {
        key: "activityLevel",
        header: "Activity",
        sortable: true,
        renderCell: (client) => {
          return (
            <span className="capitalize">
              {String((client as any)?.activityLevel ?? "").trim() || "-"}
            </span>
          );
        },
      },
      {
        key: "assignedPlanIds",
        header: "Assigned Plan",
        sortable: false,
        renderCell: (client) => {
          const { assignedPlanName } = getAssignedNames(client as Client);
          return <div className="truncate max-w-[220px]">{assignedPlanName}</div>;
        },
      },
      {
        key: "assignedMealPlanIds",
        header: "Assigned Meal",
        sortable: false,
        renderCell: (client) => {
          const { assignedMealName } = getAssignedNames(client as Client);
          return <div className="truncate max-w-[220px]">{assignedMealName}</div>;
        },
      },
    ];

    return cols;
  }, [getAssignedNames, statusConfig]);

  const selectedClient = React.useMemo(() => {
    const id = String(detailsClientId ?? "").trim();
    if (!id) return null;
    return (clients as any[]).find((c: any) => String(c?.id ?? "") === id) ?? null;
  }, [clients, detailsClientId]);

  const { data: planGuards } = usePlanGuards(true);
  const canCreateClient = planGuards?.guards?.canCreateClient?.allowed ?? true;
  const createClientReason =
    planGuards?.guards?.canCreateClient?.reason || LIMIT_REACHED_REASON;

  return (
    <EntityPageLayout
      title="Clients"
      subtitle="Manage your client roster"
      primaryAction={{
        label: "Add Client",
        onClick: handleCreateClient,
        disabled: !canCreateClient,
        disabledReason: !canCreateClient ? createClientReason : undefined,
        disabledCta: !canCreateClient
          ? { label: "Upgrade Plan", href: "/pricing" }
          : undefined,
      }}
    >
      <EntityToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search clients"
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />

      {isLoading ? (
        <div className="py-12 text-center text-gray-500">Loading…</div>
      ) : (
        <div className="space-y-8">
          <EntityTableSection
            totalCount={table.active.rows.length}
            rows={table.active.paging.pagedRows}
            columns={columns}
            getRowId={(r) => String((r as any)?.id)}
            onRowClick={(r) => handleOpenDetails(r)}
            sortConfig={table.sortConfig}
            onSort={table.onSort}
            pagination={{
              page: table.active.paging.page,
              totalPages: table.active.paging.totalPages,
              onPageChange: table.active.setPage,
            }}
            emptyState={{
              icon: Users,
              title:
                table.visibleRows.length === 0
                  ? search
                    ? "No clients found"
                    : "No clients yet"
                  : search
                    ? "No active clients match your search"
                    : "No active clients",
              description:
                table.visibleRows.length === 0
                  ? search
                    ? "Try searching for a different client."
                    : "Create your first one."
                  : undefined,
            }}
          />

          {table.archived.rows.length ? (
            <EntityTableSection
              title="Archived Clients"
              variant="archived"
              totalCount={table.archived.rows.length}
              rows={table.archived.paging.pagedRows}
              columns={columns}
              getRowId={(r) => String((r as any)?.id)}
              onRowClick={(r) => handleOpenDetails(r)}
              sortConfig={table.sortConfig}
              onSort={table.onSort}
              pagination={{
                page: table.archived.paging.page,
                totalPages: table.archived.paging.totalPages,
                onPageChange: table.archived.setPage,
              }}
              emptyState={{
                icon: Users,
                title: "No archived clients",
              }}
            />
          ) : null}
        </div>
      )}

      <GenericDetailsPanel
        open={detailsOpen}
        onOpenChange={handleCloseDetails}
        defaultTitle="Client Details"
        widthClassName="w-full sm:w-[540px] lg:w-[600px]"
      >
        <ClientPanel
          client={selectedClient}
          workoutPlanNameById={workoutPlanNameById}
          mealPlanNameById={mealPlanNameById}
          onClientUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["clients"] });
            queryClient.invalidateQueries({ queryKey: ["planGuards"] });
          }}
        />
      </GenericDetailsPanel>
    </EntityPageLayout>
  );
}
