"use client";

import React from "react";
import { db } from "@/lib/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Send, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { Client, Message } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRefetchOnVisible } from "@/hooks/use-refetch-on-visible";

export default function MessagesPage() {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="p-8 bg-[#F5F6F8] dark:bg-gray-900 min-h-screen flex justify-center">
        <div className="text-center text-gray-600 dark:text-gray-400">
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Or redirect
  }

  if (user.role === "admin") {
    return <AdminMessages user={user} />;
  }

  return <ClientMessages user={user} />;
}

function AdminMessages({ user }: { user: any }) {
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = React.useState<string | null>(
    null
  );

  const [broadcastOpen, setBroadcastOpen] = React.useState(false);
  const [broadcastText, setBroadcastText] = React.useState("");
  const [broadcastAll, setBroadcastAll] = React.useState(true);
  const [broadcastSelectedIds, setBroadcastSelectedIds] = React.useState<
    Set<string>
  >(() => new Set());

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => db.entities.Client.list(),
  });

  const { data: allMessages = [] } = useQuery({
    queryKey: ["messages"],
    queryFn: () => db.entities.Message.list("-created_date"),
  });

  useRefetchOnVisible(() => {
    queryClient.invalidateQueries({ queryKey: ["messages"] });
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  });

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const text = broadcastText.trim();
      if (!text) return;

      const targets = broadcastAll
        ? clients
        : clients.filter((c: Client) => broadcastSelectedIds.has(c.id));

      const allowedTargets = targets.filter(
        (c: Client) => !(c as any)?.isDeleted
      );

      await Promise.all(
        allowedTargets.map((c: Client) =>
          db.entities.Message.create({
            clientId: c.id,
            text,
            senderRole: "admin",
            readByAdmin: true,
            readByClient: false,
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      setBroadcastText("");
      setBroadcastAll(true);
      setBroadcastSelectedIds(new Set());
      setBroadcastOpen(false);
    },
  });

  const visibleClients = clients;

  // Group messages by client
  const messagesByClient = React.useMemo(() => {
    const grouped: Record<
      string,
      { client: Client; messages: Message[]; unread: number }
    > = {};
    clients.forEach((client: Client) => {
      const unread = allMessages.filter((m: Message) => {
        const isSystem = Boolean((m as any)?.isSystemMessage);
        return (
          m.clientId === client.id &&
          !m.readByAdmin &&
          (m.senderRole === "client" || isSystem)
        );
      }).length;

      grouped[client.id] = {
        client,
        messages: allMessages.filter((m: Message) => m.clientId === client.id),
        unread,
      };
    });
    return grouped;
  }, [clients, allMessages]);

  const selectedThread = selectedClientId
    ? messagesByClient[selectedClientId]
    : null;

  return (
    <div className="p-8 bg-[#F5F6F8] dark:bg-gray-900 min-h-screen">
      <div className="h-[calc(100vh-8rem)] flex flex-col bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Messages
            </h1>
            <Button type="button" onClick={() => setBroadcastOpen(true)}>
              Broadcast
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Client List */}
          <div className="w-80 border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
            {visibleClients.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                No clients yet
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {visibleClients.map((client: Client) => {
                  const threadData = messagesByClient[client.id];

                  return (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => setSelectedClientId(client.id)}
                      className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                        selectedClientId === client.id
                          ? "bg-indigo-50 dark:bg-indigo-900/20"
                          : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                            {client.name}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {client.email}
                          </p>
                        </div>

                        {threadData?.unread > 0 && (
                          <span className="px-2 py-1 bg-indigo-600 text-white text-xs rounded-full">
                            {threadData.unread}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Message Thread */}
          <div className="flex-1 flex flex-col">
            {selectedThread ? (
              <MessageThread
                client={selectedThread.client}
                messages={selectedThread.messages}
                currentUserRole="admin"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-indigo-500 dark:text-indigo-400" />
                  <p>Select a client to view messages</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Broadcast message</DialogTitle>
            <DialogDescription>
              Send one message to all clients, or select specific clients.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={broadcastAll}
                onChange={(e) => setBroadcastAll(e.target.checked)}
              />
              Send to all clients
            </label>

            {!broadcastAll ? (
              <div className="max-h-56 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-800">
                {clients.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500 dark:text-gray-400">
                    No clients
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-800">
                    {clients.map((c: Client) => {
                      const checked = broadcastSelectedIds.has(c.id);
                      return (
                        <label
                          key={c.id}
                          className="flex items-center gap-3 p-3 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setBroadcastSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(c.id);
                                else next.delete(c.id);
                                return next;
                              });
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium text-gray-900 dark:text-gray-100 truncate">
                              {c.name}
                            </span>
                            <span className="block text-gray-500 dark:text-gray-400 truncate">
                              {c.email}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Message
              </div>
              <textarea
                className="w-full min-h-24 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 text-sm"
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="Type your message..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBroadcastOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                broadcastMutation.mutate();
              }}
              disabled={
                broadcastMutation.isPending ||
                !broadcastText.trim() ||
                (!broadcastAll && broadcastSelectedIds.size === 0)
              }
            >
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientMessages({ user }: { user: any }) {
  const queryClient = useQueryClient();
  const { data: clients = [] } = useQuery({
    queryKey: ["myClient", String(user?.adminId ?? "")],
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

  const { data: messages = [] } = useQuery({
    queryKey: ["myMessages", myClient?.id],
    queryFn: () => db.entities.Message.filter({ clientId: myClient.id }),
    enabled: !!myClient,
  });

  useRefetchOnVisible(() => {
    const adminId = String(user?.adminId ?? "").trim();
    if (adminId) {
      queryClient.invalidateQueries({ queryKey: ["myClient", adminId] });
    }

    const clientId = String(myClient?.id ?? "").trim();
    if (clientId) {
      queryClient.invalidateQueries({ queryKey: ["myMessages", clientId] });
    }
  });

  if (!myClient) {
    return (
      <div className="p-8 bg-[#F5F6F8] dark:bg-gray-900 min-h-screen">
        <Card>
          <CardContent className="py-12 text-center text-gray-500 dark:text-gray-400">
            No client profile found
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 bg-[#F5F6F8] dark:bg-gray-900 min-h-screen">
      <div className="h-[calc(100vh-8rem)] flex flex-col bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Messages
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Chat with your coach
          </p>
        </div>

        <div className="flex-1 overflow-hidden">
          <MessageThread
            client={myClient}
            messages={messages}
            currentUserRole="client"
          />
        </div>
      </div>
    </div>
  );
}

function MessageThread({
  client,
  messages,
  currentUserRole,
}: {
  client: Client;
  messages: Message[];
  currentUserRole: "admin" | "client";
}) {
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = React.useState("");
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const replyDisabled = Boolean((client as any)?.isDeleted);

  const sortedMessages = [...messages].sort(
    (a, b) =>
      new Date(a.created_date || 0).getTime() -
      new Date(b.created_date || 0).getTime()
  );

  const sendMutation = useMutation({
    mutationFn: (text: string) =>
      db.entities.Message.create({
        clientId: client.id,
        text,
        senderRole: currentUserRole,
        readByAdmin: currentUserRole === "admin",
        readByClient: currentUserRole === "client",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["myMessages"] });
      setNewMessage("");
    },
  });

  // Mark messages as read
  React.useEffect(() => {
    const markAsRead = async () => {
      const unreadMessages = messages.filter((m) => {
        if (currentUserRole === "admin") {
          const isSystem = Boolean((m as any)?.isSystemMessage);
          return !m.readByAdmin && (m.senderRole === "client" || isSystem);
        } else {
          return m.senderRole === "admin" && !m.readByClient;
        }
      });

      for (const msg of unreadMessages) {
        const update =
          currentUserRole === "admin"
            ? { readByAdmin: true }
            : { readByClient: true };
        await db.entities.Message.update(msg.id, update);
      }

      if (unreadMessages.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["messages"] });
      }
    };

    if (messages.length > 0) {
      markAsRead();
    }
  }, [messages, currentUserRole, queryClient]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sortedMessages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (replyDisabled) return;
    if (newMessage.trim()) {
      sendMutation.mutate(newMessage.trim());
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {replyDisabled ? (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
            This conversation is read-only. The client has deleted their account
            and cannot receive replies.
          </div>
        ) : null}
        {sortedMessages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-12">
            No messages yet. Start the conversation!
          </div>
        ) : (
          sortedMessages.map((message) => {
            const isSystem = Boolean((message as any)?.isSystemMessage);
            const isMe = !isSystem && message.senderRole === currentUserRole;
            return (
              <div
                key={message.id}
                className={`flex w-full items-end ${
                  isMe ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-md px-4 py-2 rounded-lg ${
                    isSystem
                      ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      : isMe
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  {isSystem ? (
                    <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                      This message is system-generated and cannot be replied to.
                    </p>
                  ) : null}
                  <p
                    className={`text-xs mt-1 ${
                      isSystem
                        ? "text-gray-500 dark:text-gray-400"
                        : isMe
                        ? "text-indigo-200"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {format(new Date(message.created_date || new Date()), "p")}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
      >
        <div className="flex gap-3">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
            disabled={replyDisabled}
          />
          <Button
            type="submit"
            disabled={
              replyDisabled || !newMessage.trim() || sendMutation.isPending
            }
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
