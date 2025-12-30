"use client";

import React from "react";
import { db } from "@/lib/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  const filteredClients = clients.filter(
    (client: Client) =>
      client.name.toLowerCase().includes(search.toLowerCase()) ||
      client.email?.toLowerCase().includes(search.toLowerCase())
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

  const clientStatusConfig: Record<string, { label: string; classes: string }> =
    {
      active: {
        label: "Active",
        classes:
          "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
      },
      pending: {
        label: "Pending",
        classes:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
      },
      inactive: {
        label: "Inactive",
        classes:
          "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400", // same as No Show colors
      },
    };

  return (
    <div className="p-8 bg-[#F5F6F8] dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Clients
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your client roster
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="min-w-[180px] bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Client
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients"
            className="pl-10"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          Loading clients...
        </div>
      ) : filteredClients.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-gray-500 dark:text-gray-400">No clients found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client: Client) => (
            <Card
              key={client.id}
              className="h-[240px] hover:shadow-lg transition-shadow dark:bg-gray-800 dark:border-gray-700"
            >
              <CardContent className="px-5 flex flex-col h-full">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold truncate">
                      {client.name}
                    </h3>
                    {(() => {
                      const status = client.status || "active";
                      const cfg =
                        clientStatusConfig[status] || clientStatusConfig.active;

                      return (
                        <span
                          className={`inline-flex items-center h-7 px-3 mt-2 rounded-md text-xs font-medium ${cfg.classes}`}
                        >
                          {cfg.label}
                        </span>
                      );
                    })()}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(client)}
                      className="p-2 text-gray-600 dark:text-gray-400
               hover:text-indigo-600
               hover:bg-indigo-50 dark:hover:bg-indigo-900
               rounded-lg"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(client.id)}
                      className="p-2 text-gray-600 dark:text-gray-400
               hover:text-red-600
               hover:bg-red-50 dark:hover:bg-red-900
               rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 flex-1">
                  {client.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-4 h-4 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2 truncate">
                      <Phone className="w-4 h-4 shrink-0" />
                      <span className="truncate">{client.phone}</span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">Goal</p>
                    <p className="font-medium truncate">
                      {client.goal?.replace("_", " ") || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Plan</p>
                    <p className="font-medium truncate">
                      {client.subscription || "-"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
