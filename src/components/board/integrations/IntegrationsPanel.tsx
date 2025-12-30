"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Settings,
  MessageSquare,
  Briefcase,
  Code,
  ShoppingCart,
  Layers,
  Users,
  X,
} from "lucide-react";
import { Board } from "@/types";

const popularIntegrations = [
  {
    id: "slack",
    name: "Slack",
    icon: MessageSquare,
    category: "Communication",
    description:
      "Get real-time updates and notifications in your Slack channels.",
    color: "#4A154B",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    icon: Briefcase,
    category: "File Management",
    description: "Attach files from Google Drive directly to your tasks.",
    color: "#4285F4",
  },
  {
    id: "github",
    name: "GitHub",
    icon: Code,
    category: "Development",
    description:
      "Link pull requests and issues to tasks for seamless tracking.",
    color: "#181717",
  },
  {
    id: "figma",
    name: "Figma",
    icon: Layers,
    category: "Design",
    description: "Embed Figma files and prototypes within your board.",
    color: "#F24E1E",
  },
  {
    id: "zoom",
    name: "Zoom",
    icon: MessageSquare,
    category: "Communication",
    description: "Schedule and join Zoom meetings directly from tasks.",
    color: "#2D8CFF",
  },
  {
    id: "jira",
    name: "Jira",
    icon: Briefcase,
    category: "Development",
    description:
      "Sync issues between Jira and your board for unified project management.",
    color: "#0052CC",
  },
  {
    id: "shopify",
    name: "Shopify",
    icon: ShoppingCart,
    category: "E-commerce",
    description: "Track orders and customer data from your Shopify store.",
    color: "#7AB55C",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    icon: Users,
    category: "CRM",
    description: "Sync contacts and deals between HubSpot and your board.",
    color: "#FF7A59",
  },
];

interface IntegrationCardProps {
  integration: any;
  isConnected: boolean;
  onToggle: (checked: boolean) => void;
}

const IntegrationCard = ({
  integration,
  isConnected,
  onToggle,
}: IntegrationCardProps) => {
  const Icon = integration.icon;
  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 border-[#E1E5F3] dark:border-gray-700 bg-white dark:bg-gray-800">
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: integration.color }}
          >
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-[#323338] dark:text-gray-200">
              {integration.name}
            </CardTitle>
            <Badge variant="outline" className="text-xs mt-1">
              {integration.category}
            </Badge>
          </div>
        </div>
        <Switch
          checked={isConnected}
          onCheckedChange={onToggle}
          className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-200 dark:data-[state=unchecked]:bg-gray-600"
        />
      </CardHeader>
      <CardContent>
        <p className="text-sm text-[#676879] dark:text-gray-400 mb-3">
          {integration.description}
        </p>
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-[#0073EA] hover:bg-[#0073EA]/10"
          >
            <Settings className="w-3 h-3 mr-1" />
            Configure
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

interface IntegrationsPanelProps {
  board: Board | null;
  onClose: () => void;
}

export default function IntegrationsPanel({
  board,
  onClose,
}: IntegrationsPanelProps) {
  const [connectedIntegrations, setConnectedIntegrations] = useState<
    Record<string, boolean>
  >({});

  const toggleIntegration = (integrationId: string) => {
    setConnectedIntegrations((prev) => ({
      ...prev,
      [integrationId]: !prev[integrationId],
    }));
    // In a real app, this would trigger API calls to connect/disconnect
    console.log(`Toggled integration ${integrationId} for board ${board?.id}`);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Integrations Center
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Connect your favorite tools to {board?.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-3">
            <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="font-semibold text-blue-800 dark:text-blue-300">
                Supercharge Your Workflow
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-400">
                Integrate with other apps to automate tasks, sync data, and
                streamline your processes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {popularIntegrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                isConnected={!!connectedIntegrations[integration.id]}
                onToggle={() => toggleIntegration(integration.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
