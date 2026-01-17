"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { CenteredSpinner } from "@/components/CenteredSpinner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DataTable,
  type DataTableSortConfig,
  type DataTableColumn,
} from "@/components/ui/table/DataTable";

type Customer = {
  _id: string;
  fullName: string;
  phone: string;
  email?: string;
  status?: "ACTIVE" | "BLOCKED";
  activeBookingsCount: number;
  lastAppointmentAt?: string;
};

export default function CustomersPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [customers, setCustomers] = React.useState<Customer[]>([]);

  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(5);
  const [sortConfig, setSortConfig] = React.useState<DataTableSortConfig>({
    key: "client",
    direction: "asc",
  });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/customers");
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(json?.error || `Request failed (${res.status})`);
        }

        const list = Array.isArray(json?.customers) ? json.customers : [];
        setCustomers(list);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Failed to load customers");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const columns = React.useMemo(() => {
    const cols: Array<DataTableColumn<Customer>> = [
      {
        key: "client",
        header: "Client",
        sortable: true,
        renderCell: (c) => (
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 dark:text-white truncate">
              {c.fullName || "(No name)"}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300 leading-tight">
              <div className="truncate">{c.phone}</div>
              {c.email ? <div className="truncate">{c.email}</div> : null}
            </div>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        cellClassName: "w-[1%] whitespace-nowrap",
        renderCell: (c) => (
          <Badge
            variant={"secondary"}
            className={
              "shrink-0 rounded-full px-2 py-0.5 text-xs " +
              (String(c.status ?? "ACTIVE") === "BLOCKED"
                ? "bg-rose-600 text-white"
                : "bg-emerald-600 text-white")
            }
          >
            {String(c.status ?? "ACTIVE")}
          </Badge>
        ),
      },
    ];
    return cols;
  }, []);

  const onSort = React.useCallback((key: string) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      return {
        key,
        direction: prev.direction === "asc" ? "desc" : "asc",
      };
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Customers
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Customers from public bookings.
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
                No customers yet
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Customers will appear here once bookings start.
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:max-w-sm">
              <Input
                placeholder="Search clients"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <Select
                value={String(pageSize)}
                onValueChange={(v) => setPageSize(Number(v) || 5)}
              >
                <SelectTrigger size="sm" className="w-[104px]">
                  <SelectValue placeholder="Rows" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 rows</SelectItem>
                  <SelectItem value="10">10 rows</SelectItem>
                  <SelectItem value="25">25 rows</SelectItem>
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
            onRowClick={(row) =>
              router.push(`/customers/${encodeURIComponent(row._id)}`)
            }
            pagination={{
              page: safePage,
              totalPages,
              onPageChange: setPage,
            }}
            emptyMessage={
              <div className="text-sm text-muted-foreground">No results.</div>
            }
          />
        </div>
      )}
    </div>
  );
}
