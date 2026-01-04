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

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => db.entities.Client.list(),
  });

  const { data: allMessages = [] } = useQuery({
    queryKey: ["messages"],
    queryFn: () => db.entities.Message.list("-created_date"),
  });

  // Group messages by client
  const messagesByClient = React.useMemo(() => {
    const grouped: Record<
      string,
      { client: Client; messages: Message[]; unread: number }
    > = {};
    clients.forEach((client: Client) => {
      grouped[client.id] = {
        client,
        messages: allMessages.filter((m: Message) => m.clientId === client.id),
        unread: allMessages.filter(
          (m: Message) =>
            m.clientId === client.id &&
            m.senderRole === "client" &&
            !m.readByAdmin
        ).length,
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Messages
          </h1>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Client List */}
          <div className="w-80 border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
            {clients.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                No clients yet
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {clients.map((client: Client) => {
                  const threadData = messagesByClient[client.id];
                  return (
                    <button
                      key={client.id}
                      onClick={() => setSelectedClientId(client.id)}
                      className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                        selectedClientId === client.id
                          ? "bg-indigo-50 dark:bg-indigo-900/20"
                          : ""
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                            {client.name}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {client.email}
                          </p>
                        </div>
                        {threadData?.unread > 0 && (
                          <span className="ml-2 px-2 py-1 bg-indigo-600 text-white text-xs rounded-full">
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
    </div>
  );
}

function ClientMessages({ user }: { user: any }) {
  const { data: clients = [] } = useQuery({
    queryKey: ["myClient"],
    queryFn: async () => {
      const allClients = await db.entities.Client.list();
      return allClients.filter((c: Client) => c.userId === user.id);
    },
  });

  const myClient = clients[0];

  const { data: messages = [] } = useQuery({
    queryKey: ["myMessages", myClient?.id],
    queryFn: () => db.entities.Message.filter({ clientId: myClient.id }),
    enabled: !!myClient,
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
          return m.senderRole === "client" && !m.readByAdmin;
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
    if (newMessage.trim()) {
      sendMutation.mutate(newMessage.trim());
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {sortedMessages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-12">
            No messages yet. Start the conversation!
          </div>
        ) : (
          sortedMessages.map((message) => {
            const isMe = message.senderRole === currentUserRole;
            return (
              <div
                key={message.id}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-md px-4 py-2 rounded-lg ${
                    isMe
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  <p
                    className={`text-xs mt-1 ${
                      isMe
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
          />
          <Button
            type="submit"
            disabled={!newMessage.trim() || sendMutation.isPending}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
