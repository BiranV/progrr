"use client";

import React from "react";
import { db } from "@/lib/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  Search,
  Mail,
  Phone,
  Mars,
  Venus,
  Trash2,
  Edit,
  ArrowUpDown,
  Users,
} from "lucide-react";
import ClientDialog from "@/components/ClientDialog";
import { Client } from "@/types";

export default function ClientsPage() {
  const [search, setSearch] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingClient, setEditingClient] = React.useState<Client | null>(null);
  const [sortConfig, setSortConfig] = React.useState<{
    key: keyof Client;
    direction: "asc" | "desc";
  } | null>(null);
  const queryClient = useQueryClient();

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

  const deleteClientMutation = useMutation({
    mutationFn: (id: string) => db.entities.Client.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });

  const filteredClients = clients.filter(
    (c: Client) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.toLowerCase().includes(search.toLowerCase())
  );

  const sortedClients = React.useMemo(() => {
    if (!sortConfig) return filteredClients;

    return [...filteredClients].sort((a, b) => {
      const aValue = a[sortConfig.key] || "";
      const bValue = b[sortConfig.key] || "";

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
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

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this client?")) {
      await deleteClientMutation.mutateAsync(id);
    }
  };

  const handleCloseDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingClient(null);
  };

  const normalizeStatus = (value: unknown) => {
    const v = String(value ?? "")
      .trim()
      .toUpperCase();
    return v === "ACTIVE" || v === "PENDING" || v === "INACTIVE" ? v : "";
  };

  const statusConfig: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
    PENDING:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
    INACTIVE: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  };

  const inactiveClients = sortedClients.filter(
    (c: Client) => normalizeStatus(c.status) === "INACTIVE"
  );
  const primaryClients = sortedClients.filter(
    (c: Client) => normalizeStatus(c.status) !== "INACTIVE"
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

  const renderClientsTable = (rows: Client[]) => (
    <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border">
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
            <th className="px-4 py-3 text-left font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((client: Client) => {
            const status = normalizeStatus(client.status) || "ACTIVE";
            const gender = String(client.gender ?? "")
              .trim()
              .toLowerCase();

            const assignedPlanId = String(
              (client as any).assignedPlanId ?? ""
            ).trim();
            const assignedMealPlanId = String(
              (client as any).assignedMealPlanId ?? ""
            ).trim();

            const assignedPlanName =
              assignedPlanId && assignedPlanId !== "none"
                ? workoutPlanNameById.get(assignedPlanId) || "-"
                : "-";
            const assignedMealName =
              assignedMealPlanId && assignedMealPlanId !== "none"
                ? mealPlanNameById.get(assignedMealPlanId) || "-"
                : "-";

            return (
              <tr
                key={client.id}
                className="border-t hover:bg-gray-50 dark:hover:bg-gray-700/40"
              >
                {/* CLIENT COLUMN */}
                <td className="px-4 py-3">
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {gender === "female" ? (
                        <Venus className="w-4 h-4 text-pink-500 shrink-0" />
                      ) : gender === "male" ? (
                        <Mars className="w-4 h-4 text-blue-500 shrink-0" />
                      ) : null}
                      <span className="font-medium truncate">
                        {client.name}
                      </span>
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
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center justify-center w-20 h-7 px-3 rounded-md text-xs font-medium ${statusConfig[status]}`}
                  >
                    {status}
                  </span>
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

                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleEdit(client)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900 rounded-lg"
                      title="Edit Client"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(client.id)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg"
                      title="Delete Client"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
            onClick={() => setDialogOpen(true)}
            className="min-w-[120px] bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="w-5 h-5 mr-2" />
            Client
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients"
          className="pl-10"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-500">Loading…</div>
      ) : sortedClients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
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
            ? renderClientsTable(primaryClients)
            : null}

          {inactiveClients.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                Inactive Clients
              </div>
              {renderClientsTable(inactiveClients)}
            </div>
          ) : null}
        </div>
      )}

      <ClientDialog
        client={editingClient}
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
      />
    </div>
  );
}
