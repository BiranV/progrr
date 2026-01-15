"use client";

import React from "react";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Customer = {
  _id: string;
  fullName: string;
  phone: string;
  email?: string;
  appointmentsCount: number;
  lastAppointmentAt?: string;
};

export default function CustomersPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [customers, setCustomers] = React.useState<Customer[]>([]);

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
        <Card>
          <CardContent className="p-6">
            <div className="min-h-[30vh] flex items-center justify-center text-sm text-muted-foreground">
              Loading customers…
            </div>
          </CardContent>
        </Card>
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
          {customers.map((c) => (
            <Card key={c._id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-white truncate">
                      {c.fullName || "(No name)"}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 truncate">
                      {c.phone}
                      {c.email ? ` • ${c.email}` : ""}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 shrink-0">
                    {c.appointmentsCount} booking
                    {c.appointmentsCount === 1 ? "" : "s"}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
