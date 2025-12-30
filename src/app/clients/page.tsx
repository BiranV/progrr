"use client";

import React from "react";
import { db } from "@/lib/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Mail, Phone, Trash2, Edit } from "lucide-react";
import ClientDialog from "@/components/ClientDialog";
import { Client } from "@/types";

export default function ClientsPage() {
  const [search, setSearch] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingClient, setEditingClient] = React.useState<Client | null>(null);
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

  const statusConfig: Record<string, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
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
          <p className="text-gray-600 dark:text-gray-400">
            Manage your client roster
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setDialogOpen(true)}
            className="min-w-[180px] bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Client
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
      ) : (
        /* ================= TABLE VIEW ================= */
        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Goal</th>
                <th className="px-4 py-3 text-left">Activity</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Gender</th>
                {/* <th className="px-4 py-3 text-left">Actions</th> */}
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client: Client) => (
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

                  <td className="px-4 py-3">
                    {client.goal?.replace("_", " ") || "-"}
                  </td>
                  <td className="px-4 py-3">{client.activityLevel || "-"}</td>
                  <td className="px-4 py-3">{client.subscription || "-"}</td>
                  <td className="px-4 py-3">{client.gender || "-"}</td>

                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(client)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(client.id)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg"
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
