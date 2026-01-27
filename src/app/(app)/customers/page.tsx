"use client";

import React from "react";
import { Mail, MoreVertical, Phone, Users } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/i18n/useI18n";
import { useLocale } from "@/context/LocaleContext";
import { CenteredSpinner } from "@/components/CenteredSpinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PhoneLink } from "@/components/PhoneLink";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import SidePanel from "@/components/ui/side-panel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DataTable,
  type DataTableSortConfig,
  type DataTableColumn,
} from "@/components/ui/table/DataTable";
import { toast } from "sonner";
import { formatTimeRange } from "@/lib/utils";

type Customer = {
  _id: string;
  fullName: string;
  phone: string;
  email?: string;
  status?: "ACTIVE" | "BLOCKED";
  activeBookingsCount: number;
  lastAppointmentAt?: string;
};

type Booking = {
  id: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "BOOKED" | "CANCELED" | "COMPLETED";
  cancelledBy?: "BUSINESS" | "CUSTOMER" | string;
};

type CustomerAppointmentsResponse = {
  ok: true;
  bookings: Booking[];
  bookingsPagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalBookingsCount: number;
  };
};

function formatDateForDisplay(date: string): string {
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(date ?? ""));
  if (!match) return date;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export default function CustomersPage() {
  const { t } = useI18n();
  const { dir } = useLocale();
  const queryClient = useQueryClient();

  const customersQuery = useQuery({
    queryKey: ["customers"],
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<Customer[]> => {
      const res = await fetch("/api/customers", {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          json?.error || t("errors.requestFailed", { status: res.status }),
        );
      }
      return Array.isArray(json?.customers)
        ? (json.customers as Customer[])
        : [];
    },
  });

  const loading = customersQuery.isPending;
  const error = customersQuery.isError
    ? (customersQuery.error as any)?.message || t("errors.somethingWentWrong")
    : null;
  const customers = React.useMemo(
    () => customersQuery.data ?? [],
    [customersQuery.data],
  );

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerTab, setDrawerTab] = React.useState<
    "details" | "appointments" | "message"
  >("details");
  const [selectedCustomer, setSelectedCustomer] =
    React.useState<Customer | null>(null);
  const [appointmentsPage, setAppointmentsPage] = React.useState(1);
  const [appointmentsPageSize, setAppointmentsPageSize] = React.useState(10);
  const [appointmentsQueryText, setAppointmentsQueryText] = React.useState("");
  const [appointmentsSortConfig, setAppointmentsSortConfig] =
    React.useState<DataTableSortConfig>({
      key: "details",
      direction: "asc",
    });
  const [updatingCustomerId, setUpdatingCustomerId] = React.useState<
    string | null
  >(null);
  const [optimisticStatusById, setOptimisticStatusById] = React.useState<
    Record<string, "ACTIVE" | "BLOCKED">
  >({});
  const [messageText, setMessageText] = React.useState("");
  const [messageChannel, setMessageChannel] = React.useState<
    "WHATSAPP" | "SMS" | "EMAIL"
  >("EMAIL");
  const [messageSending, setMessageSending] = React.useState(false);

  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(5);
  const [sortConfig, setSortConfig] = React.useState<DataTableSortConfig>({
    key: "client",
    direction: "asc",
  });

  React.useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const fullName = String(c.fullName ?? "").toLowerCase();
      const phone = String(c.phone ?? "").toLowerCase();
      const email = String(c.email ?? "").toLowerCase();
      return fullName.includes(q) || phone.includes(q) || email.includes(q);
    });
  }, [customers, query]);

  const sorted = React.useMemo(() => {
    const rows = [...filtered];
    const dir = sortConfig?.direction === "desc" ? -1 : 1;
    const key = sortConfig?.key ?? "client";

    rows.sort((a, b) => {
      if (key === "status") {
        const av = String(a.status ?? "ACTIVE");
        const bv = String(b.status ?? "ACTIVE");
        return av.localeCompare(bv) * dir;
      }

      const an = String(a.fullName ?? "").trim();
      const bn = String(b.fullName ?? "").trim();
      return an.localeCompare(bn) * dir;
    });

    return rows;
  }, [filtered, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paged = React.useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, safePage, pageSize]);

  React.useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  React.useEffect(() => {
    setMessageText("");
    setMessageChannel("EMAIL");
  }, [selectedCustomer?._id]);

  const columns = React.useMemo(() => {
    const cols: Array<DataTableColumn<Customer>> = [
      {
        key: "client",
        header: t("customers.table.client"),
        sortable: true,
        renderCell: (c) => (
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 dark:text-white truncate">
              {c.fullName || t("customers.table.noName")}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300 leading-tight">
              <PhoneLink phone={c.phone} className="text-xs" showIcon={false} />
            </div>
          </div>
        ),
      },
      {
        key: "status",
        header: t("customers.table.status"),
        sortable: true,
        cellClassName: "w-[1%] whitespace-nowrap",
        renderCell: (c) => {
          const status =
            optimisticStatusById[c._id] ??
            (String(c.status ?? "ACTIVE") as "ACTIVE" | "BLOCKED");
          return (
            <Badge
              variant={"secondary"}
              className={
                "shrink-0 rounded-full px-2 py-0.5 text-xs border backdrop-blur-sm " +
                (status === "BLOCKED"
                  ? "bg-rose-50/80 text-rose-700 border-rose-200/70"
                  : "bg-emerald-50/80 text-emerald-700 border-emerald-200/70")
              }
            >
              {status === "BLOCKED"
                ? t("customers.details.status.blocked")
                : t("customers.details.status.active")}
            </Badge>
          );
        },
      },
      {
        key: "actions",
        header: "",
        headerClassName: "ps-0 pe-3 text-end",
        cellClassName: "w-[1%] whitespace-nowrap text-end ps-0 pe-3",
        renderCell: (c) => {
          const status =
            optimisticStatusById[c._id] ??
            (String(c.status ?? "ACTIVE") as "ACTIVE" | "BLOCKED");
          const isBlocked = status === "BLOCKED";
          const isUpdating = updatingCustomerId === c._id;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-md"
                  aria-label={t("customers.menu.open")}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="
    w-52
    flex flex-col
    rtl:items-start rtl:text-right
    ltr:items-start ltr:text-left
  "
              >
                <DropdownMenuItem
                  className="
  w-full flex items-center gap-2
  rtl:flex-row-reverse rtl:justify-start rtl:text-right
  ltr:flex-row ltr:justify-start ltr:text-left
"
                  onClick={() => {
                    setSelectedCustomer(c);
                    setAppointmentsPage(1);
                    setDrawerTab("details");
                    setDrawerOpen(true);
                  }}
                >
                  {t("customers.menu.viewDetails")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="
  w-full flex items-center gap-2
  rtl:flex-row-reverse rtl:justify-start rtl:text-right
  ltr:flex-row ltr:justify-start ltr:text-left
"
                  onClick={() => {
                    setSelectedCustomer(c);
                    setAppointmentsPage(1);
                    setDrawerTab("appointments");
                    setDrawerOpen(true);
                  }}
                >
                  {t("customers.menu.appointmentsHistory")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="
  w-full flex items-center gap-2
  rtl:flex-row-reverse rtl:justify-start rtl:text-right
  ltr:flex-row ltr:justify-start ltr:text-left
"
                  onClick={() => {
                    setSelectedCustomer(c);
                    setAppointmentsPage(1);
                    setDrawerTab("message");
                    setDrawerOpen(true);
                  }}
                >
                  {t("customers.menu.sendMessage")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={`
  w-full flex items-center gap-2
  rtl:flex-row-reverse rtl:justify-start rtl:text-right
  ltr:flex-row ltr:justify-start ltr:text-left
  ${isBlocked
                      ? ""
                      : "text-red-600 hover:text-red-600 focus:text-red-600 data-[highlighted]:text-red-600"
                    }
`}
                  disabled={isUpdating}
                  onClick={async () => {
                    const nextStatus = isBlocked ? "ACTIVE" : "BLOCKED";
                    const previousStatus = String(c.status ?? "ACTIVE");

                    setUpdatingCustomerId(c._id);
                    setOptimisticStatusById((prev) => ({
                      ...prev,
                      [c._id]: nextStatus,
                    }));
                    queryClient.setQueryData(["customers"], (old: any) => {
                      if (!Array.isArray(old)) return old;
                      return old.map((row: any) =>
                        String(row?._id ?? "") === c._id
                          ? { ...row, status: nextStatus }
                          : row,
                      );
                    });
                    setSelectedCustomer((prev) =>
                      prev && prev._id === c._id
                        ? { ...prev, status: nextStatus as any }
                        : prev,
                    );

                    try {
                      const action = isBlocked ? "unblock" : "block";
                      const res = await fetch(
                        `/api/customers/${encodeURIComponent(c._id)}`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action }),
                        },
                      );
                      const json = await res.json().catch(() => null);
                      if (!res.ok) {
                        throw new Error(
                          json?.error ||
                          t("errors.requestFailed", { status: res.status }),
                        );
                      }
                      toast.success(
                        action === "block"
                          ? t("customers.details.toastBlocked")
                          : t("customers.details.toastUnblocked"),
                      );
                      setOptimisticStatusById((prev) => {
                        if (!prev[c._id]) return prev;
                        const next = { ...prev };
                        delete next[c._id];
                        return next;
                      });
                    } catch (e: any) {
                      queryClient.setQueryData(["customers"], (old: any) => {
                        if (!Array.isArray(old)) return old;
                        return old.map((row: any) =>
                          String(row?._id ?? "") === c._id
                            ? { ...row, status: previousStatus }
                            : row,
                        );
                      });
                      setSelectedCustomer((prev) =>
                        prev && prev._id === c._id
                          ? { ...prev, status: previousStatus as any }
                          : prev,
                      );
                      setOptimisticStatusById((prev) => {
                        if (!prev[c._id]) return prev;
                        const next = { ...prev };
                        delete next[c._id];
                        return next;
                      });
                      toast.error(e?.message || t("errors.failedToSave"));
                    } finally {
                      setUpdatingCustomerId(null);
                    }
                  }}
                >
                  {isBlocked
                    ? t("customers.menu.unblockCustomer")
                    : t("customers.menu.blockCustomer")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ];
    return cols;
  }, [optimisticStatusById, queryClient, t, updatingCustomerId]);

  const onSort = React.useCallback((key: string) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      return {
        key,
        direction: prev.direction === "asc" ? "desc" : "asc",
      };
    });
  }, []);

  const appointmentsQuery = useQuery({
    queryKey: [
      "customerAppointments",
      selectedCustomer?._id,
      appointmentsPage,
      appointmentsPageSize,
    ],
    enabled:
      drawerOpen &&
      drawerTab === "appointments" &&
      Boolean(selectedCustomer?._id),
    queryFn: async (): Promise<CustomerAppointmentsResponse> => {
      const id = String(selectedCustomer?._id ?? "");
      const res = await fetch(
        `/api/customers/${encodeURIComponent(
          id,
        )}/appointments?page=${encodeURIComponent(
          appointmentsPage,
        )}&pageSize=${encodeURIComponent(appointmentsPageSize)}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          json?.error || t("errors.requestFailed", { status: res.status }),
        );
      }
      return json as CustomerAppointmentsResponse;
    },
  });

  const appointments = React.useMemo(
    () => appointmentsQuery.data?.bookings ?? [],
    [appointmentsQuery.data],
  );
  const filteredAppointments = React.useMemo(() => {
    const q = appointmentsQueryText.trim().toLowerCase();
    if (!q) return appointments;
    return appointments.filter((row) => {
      const serviceName = String(row.serviceName ?? "").toLowerCase();
      const date = String(row.date ?? "").toLowerCase();
      const status = String(row.status ?? "").toLowerCase();
      const cancelledBy = String(row.cancelledBy ?? "").toLowerCase();
      return (
        serviceName.includes(q) ||
        date.includes(q) ||
        status.includes(q) ||
        cancelledBy.includes(q)
      );
    });
  }, [appointments, appointmentsQueryText]);
  const sortedAppointments = React.useMemo(() => {
    const rows = [...filteredAppointments];
    const dir = appointmentsSortConfig?.direction === "desc" ? -1 : 1;
    const key = appointmentsSortConfig?.key ?? "details";

    rows.sort((a, b) => {
      if (key === "status") {
        const av = String(a.status ?? "");
        const bv = String(b.status ?? "");
        return av.localeCompare(bv) * dir;
      }

      const an = String(a.serviceName ?? "").trim();
      const bn = String(b.serviceName ?? "").trim();
      return an.localeCompare(bn) * dir;
    });

    return rows;
  }, [appointmentsSortConfig, filteredAppointments]);

  const appointmentsPagination = appointmentsQuery.data?.bookingsPagination;

  React.useEffect(() => {
    setAppointmentsPage(1);
  }, [appointmentsPageSize, appointmentsQueryText, appointmentsSortConfig]);

  const appointmentColumns = React.useMemo(() => {
    const cols: Array<DataTableColumn<Booking>> = [
      {
        key: "details",
        header: t("customers.table.serviceLabel"),
        sortable: true,
        headerClassName:
          "rtl:text-right rtl:[&>div]:flex-row-reverse rtl:[&>div]:justify-start",
        cellClassName: "rtl:text-right",
        renderCell: (row) => (
          <div className="min-w-0 rtl:text-right">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {row.serviceName || t("customers.drawer.appointmentFallback")}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatDateForDisplay(row.date) || t("common.emptyDash")}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              <span dir="ltr">
                {formatTimeRange(row.startTime, row.endTime) ||
                  t("common.emptyDash")}
              </span>
            </div>
            {row.status === "CANCELED" ? (
              <div className="text-xs text-muted-foreground mt-1">
                {String(row.cancelledBy || "").toUpperCase() === "BUSINESS"
                  ? t("customers.details.canceledBy.business")
                  : String(row.cancelledBy || "").toUpperCase() === "CUSTOMER"
                    ? t("customers.details.canceledBy.customer")
                    : t("customers.details.canceledBy.unknown")}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        key: "status",
        header: t("customers.table.status"),
        sortable: true,
        headerClassName:
          "rtl:text-right rtl:[&>div]:flex-row-reverse rtl:[&>div]:justify-start",
        cellClassName: "rtl:text-right",
        renderCell: (row) => {
          const badgeClass =
            "border backdrop-blur-sm " +
            (row.status === "BOOKED"
              ? "bg-emerald-50/80 text-emerald-700 border-emerald-200/70"
              : row.status === "COMPLETED"
                ? "bg-blue-50/80 text-blue-700 border-blue-200/70"
                : "bg-gray-100/80 text-gray-600 border-gray-200/70 dark:bg-gray-800/60 dark:text-gray-200 dark:border-gray-700/60");

          const badgeLabel =
            row.status === "BOOKED"
              ? t("customers.details.status.booked")
              : row.status === "COMPLETED"
                ? t("customers.details.status.completed")
                : t("customers.details.status.canceled");

          return <Badge className={badgeClass}>{badgeLabel}</Badge>;
        },
      },
    ];

    return dir === "rtl" ? [...cols].reverse() : cols;
  }, [dir, t]);

  return (
    <div className="space-y-6 pb-5">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t("customers.title")}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t("customers.subtitle")}
        </p>
      </div>

      {error ? (
        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
      ) : null}

      {loading ? (
        <CenteredSpinner fullPage />
      ) : customers.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="min-h-[52vh] flex flex-col items-center justify-center text-center px-4">
              <Users className="h-7 w-7 text-muted-foreground" />
              <div className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
                {t("customers.emptyTitle")}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {t("customers.emptyDescription")}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div dir={dir} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <Input
                placeholder={t("customers.table.searchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="text-start"
              />
            </div>

            <div className="shrink-0">
              <Select
                value={String(pageSize)}
                onValueChange={(v) => setPageSize(Number(v) || 5)}
              >
                <SelectTrigger size="sm" className="w-[128px] text-start">
                  <SelectValue placeholder={t("customers.table.rows")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">
                    {t("customers.table.rowsCount", { count: 5 })}
                  </SelectItem>
                  <SelectItem value="10">
                    {t("customers.table.rowsCount", { count: 10 })}
                  </SelectItem>
                  <SelectItem value="25">
                    {t("customers.table.rowsCount", { count: 25 })}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DataTable
            rows={paged}
            columns={columns}
            getRowId={(r) => r._id}
            sortConfig={sortConfig}
            onSort={onSort}
            pagination={{
              page: safePage,
              totalPages,
              onPageChange: setPage,
            }}
            paginationLabels={{
              summary: (pageValue, totalPagesValue) =>
                t("customers.table.paginationSummary", {
                  page: pageValue,
                  total: totalPagesValue,
                }),
              previous: t("customers.table.previous"),
              next: t("customers.table.next"),
            }}
            emptyMessage={
              <div className="text-sm text-muted-foreground">
                {t("customers.table.emptyResults")}
              </div>
            }
          />
        </div>
      )}

      <SidePanel
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) {
            setDrawerTab("details");
            setAppointmentsPage(1);
            setMessageText("");
            setMessageChannel("EMAIL");
          }
        }}
        title={
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0 truncate text-base font-semibold">
              {selectedCustomer?.fullName || t("customers.table.noName")}
            </div>
            {selectedCustomer ? (
              <Badge
                variant={"secondary"}
                className={
                  "rounded-full px-2 py-0.5 text-xs border backdrop-blur-sm " +
                  (String(selectedCustomer.status ?? "ACTIVE") === "BLOCKED"
                    ? "bg-rose-50/80 text-rose-700 border-rose-200/70"
                    : "bg-emerald-50/80 text-emerald-700 border-emerald-200/70")
                }
              >
                {String(selectedCustomer.status ?? "ACTIVE") === "BLOCKED"
                  ? t("customers.details.status.blocked")
                  : t("customers.details.status.active")}
              </Badge>
            ) : null}
          </div>
        }
        description={t("customers.drawer.subtitle")}
      >
        <div className="space-y-6">
          <Tabs
            value={drawerTab}
            onValueChange={(value) =>
              setDrawerTab(value as "details" | "appointments" | "message")
            }
            className="w-full"
          >
            <TabsList className="w-full rounded-full bg-muted/40 p-1">
              <TabsTrigger
                value="details"
                className="rounded-full data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                {t("customers.drawer.detailsTab")}
              </TabsTrigger>
              <TabsTrigger
                value="appointments"
                className="rounded-full data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                {t("customers.drawer.appointmentsTab")}
              </TabsTrigger>
              <TabsTrigger
                value="message"
                className="rounded-full data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                {t("customers.drawer.messageTab")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <div className="space-y-1 rtl:text-right">
                <div className="text-xs text-muted-foreground flex items-center gap-2 rtl:flex-row-reverse rtl:justify-end">
                  {t("customers.drawer.phoneLabel")}
                </div>
                <div className="text-sm text-gray-900 dark:text-white rtl:text-right">
                  {selectedCustomer?.phone ? (
                    <PhoneLink
                      phone={selectedCustomer.phone}
                      showIcon={false}
                      className="text-sm text-gray-900 dark:text-white"
                    />
                  ) : (
                    t("common.emptyDash")
                  )}
                </div>
              </div>

              <div className="space-y-1 rtl:text-right">
                <div className="text-xs text-muted-foreground flex items-center gap-2 rtl:flex-row-reverse rtl:justify-end">
                  {t("customers.drawer.emailLabel")}
                </div>
                <div className="text-sm text-gray-900 dark:text-white rtl:text-right">
                  {selectedCustomer?.email || t("common.emptyDash")}
                </div>
              </div>

              <div className="space-y-1 rtl:text-right">
                <div className="text-xs text-muted-foreground flex items-center gap-2 rtl:flex-row-reverse rtl:justify-end">
                  {t("customers.drawer.activeBookingsLabel")}
                </div>
                <div className="text-sm text-gray-900 dark:text-white rtl:text-right">
                  {t("customers.drawer.activeBookingsValue", {
                    count: selectedCustomer?.activeBookingsCount ?? 0,
                  })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="appointments" className="space-y-4">
              <div dir={dir} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder={t("customers.drawer.searchPlaceholder")}
                    value={appointmentsQueryText}
                    onChange={(e) => setAppointmentsQueryText(e.target.value)}
                    className="text-start"
                  />
                </div>

                <div className="shrink-0">
                  <Select
                    value={String(appointmentsPageSize)}
                    onValueChange={(v) =>
                      setAppointmentsPageSize(Number(v) || 10)
                    }
                  >
                    <SelectTrigger size="sm" className="w-[128px] text-start">
                      <SelectValue placeholder={t("customers.table.rows")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">
                        {t("customers.table.rowsCount", { count: 5 })}
                      </SelectItem>
                      <SelectItem value="10">
                        {t("customers.table.rowsCount", { count: 10 })}
                      </SelectItem>
                      <SelectItem value="25">
                        {t("customers.table.rowsCount", { count: 25 })}
                      </SelectItem>
                      <SelectItem value="50">
                        {t("customers.table.rowsCount", { count: 50 })}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {appointmentsQuery.isPending ? (
                <CenteredSpinner size="sm" className="py-6" />
              ) : appointmentsQuery.isError ? (
                <div className="text-sm text-red-600 dark:text-red-400">
                  {(appointmentsQuery.error as any)?.message ||
                    t("errors.failedToLoad")}
                </div>
              ) : (
                <DataTable
                  rows={sortedAppointments}
                  getRowId={(row) => row.id}
                  sortConfig={appointmentsSortConfig}
                  onSort={(key) => {
                    setAppointmentsSortConfig((prev) => {
                      if (!prev || prev.key !== key)
                        return { key, direction: "asc" };
                      return {
                        key,
                        direction: prev.direction === "asc" ? "desc" : "asc",
                      };
                    });
                  }}
                  emptyMessage={t("customers.drawer.emptyAppointments")}
                  columns={appointmentColumns}
                  pagination={
                    appointmentsPagination
                      ? {
                        page: appointmentsPagination.page,
                        totalPages: appointmentsPagination.totalPages,
                        onPageChange: (nextPage) =>
                          setAppointmentsPage(
                            Math.max(
                              1,
                              Math.min(
                                appointmentsPagination.totalPages,
                                nextPage,
                              ),
                            ),
                          ),
                      }
                      : undefined
                  }
                  paginationLabels={
                    appointmentsPagination
                      ? {
                        summary: (page, totalPages) =>
                          t("customers.drawer.appointmentsPagination", {
                            page,
                            total: totalPages,
                          }),
                        previous: t("customers.drawer.newer"),
                        next: t("customers.drawer.older"),
                      }
                      : undefined
                  }
                />
              )}
            </TabsContent>

            <TabsContent value="message" className="space-y-4">
              <div className="space-y-2 flex flex-col items-start rtl:items-end rtl:text-right">
                <Label className="text-start rtl:text-right">
                  {t("customers.message.channelLabel")}
                </Label>
                <Select
                  value={messageChannel}
                  onValueChange={(v) =>
                    setMessageChannel(v as "WHATSAPP" | "SMS" | "EMAIL")
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("customers.message.channelLabel")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WHATSAPP">
                      {t("customers.message.channelWhatsapp")}
                    </SelectItem>
                    <SelectItem value="SMS">
                      {t("customers.message.channelSms")}
                    </SelectItem>
                    <SelectItem value="EMAIL">
                      {t("customers.message.channelEmail")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 flex flex-col items-start rtl:items-end rtl:text-right">
                <Label className="text-start rtl:text-right">
                  {t("customers.details.sendMessageTitle")}
                </Label>
                <Textarea
                  placeholder={t("customers.details.messagePlaceholder")}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={5}
                  className="text-start rtl:text-right"
                />
              </div>

              <Button
                type="button"
                className="rounded-xl w-full"
                disabled={
                  messageSending || !messageText.trim() || !selectedCustomer
                }
                onClick={async () => {
                  if (!selectedCustomer) return;
                  setMessageSending(true);
                  try {
                    const subject = t("customers.message.defaultSubject", {
                      name:
                        selectedCustomer.fullName ||
                        t("customers.table.noName"),
                    });
                    const res = await fetch(
                      `/api/customers/${encodeURIComponent(
                        selectedCustomer._id,
                      )}/message`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          subject,
                          message: messageText.trim(),
                          channel: messageChannel,
                        }),
                      },
                    );
                    const json = await res.json().catch(() => null);
                    if (!res.ok) {
                      throw new Error(
                        json?.error ||
                        t("errors.requestFailed", { status: res.status }),
                      );
                    }
                    toast.success(t("customers.message.toastSent"));
                    setMessageText("");
                  } catch (e: any) {
                    toast.error(e?.message || t("errors.failedToSave"));
                  } finally {
                    setMessageSending(false);
                  }
                }}
              >
                {messageSending
                  ? t("customers.details.sendingMessage")
                  : t("customers.details.sendMessage")}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </SidePanel>
    </div>
  );
}
