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
  Trash2,
  Edit,
  ArrowUpDown,
  Users,
  Send,
} from "lucide-react";
import ClientDialog from "@/components/ClientDialog";
import { Client } from "@/types";
import { resendInviteAction } from "@/app/actions/client-management";
import { toast } from "sonner";

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

  const handleResendInvite = async (email: string) => {
    try {
      toast.loading("Resending invite...");
      await resendInviteAction(email);
      toast.dismiss();
      toast.success("Invite resent successfully");
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message);
    }
  };

  const handleCloseDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingClient(null);
  };

  const statusConfig: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
    PENDING:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
    pending:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
    inactive: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  };

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
        /* ================= TABLE VIEW ================= */
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
                <th
                  className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort("subscription")}
                >
                  <div className="flex items-center gap-2">
                    Plan
                    <ArrowUpDown className="w-4 h-4" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort("gender")}
                >
                  <div className="flex items-center gap-2">
                    Gender
                    <ArrowUpDown className="w-4 h-4" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {sortedClients.map((client: Client) => (
                <tr
                  key={client.id}
                  className="border-t hover:bg-gray-50 dark:hover:bg-gray-700/40"
                >
                  {/* CLIENT COLUMN */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate">
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
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center justify-center w-20 h-7 px-3 rounded-md text-xs font-medium capitalize ${
                        statusConfig[client.status || "active"]
                      }`}
                    >
                      {client.status || "active"}
                    </span>
                  </td>

                  <td className="px-4 py-3 capitalize">
                    {client.goal?.replace("_", " ") || "-"}
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {client.activityLevel || "-"}
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {client.subscription || "-"}
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {client.gender || "-"}
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
                      {(client.status === "PENDING" ||
                        client.status === "pending") &&
                        client.email && (
                        <button
                          onClick={() => handleResendInvite(client.email!)}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg"
                          title="Resend Invite"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
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
              ))}
            </tbody>
          </table>
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
