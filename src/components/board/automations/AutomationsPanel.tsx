"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Plus,
  Bell,
  CheckCircle,
  AlertTriangle,
  Clock,
  Users,
  Settings,
  X,
} from "lucide-react";
import { Board } from "@/types";

const automationTemplates = [
  {
    id: "status-change-notify",
    name: "Notify on Status Change",
    icon: Bell,
    description:
      'When a task status changes to "Done", notify the project manager.',
    category: "Notifications",
    color: "bg-blue-500",
  },
  {
    id: "due-date-reminder",
    name: "Due Date Reminder",
    icon: Clock,
    description:
      "24 hours before a task is due, send a reminder to the assignee.",
    category: "Reminders",
    color: "bg-yellow-500",
  },
  {
    id: "item-created-assign",
    name: "Assign New Item",
    icon: Users,
    description: "When a new item is created, assign it to the team lead.",
    category: "Assignments",
    color: "bg-green-500",
  },
  {
    id: "priority-escalation",
    name: "Priority Escalation",
    icon: AlertTriangle,
    description:
      'If a "High Priority" task is overdue by 2 days, change its status to "Critical".',
    category: "Workflow",
    color: "bg-red-500",
  },
  {
    id: "subitem-completion",
    name: "Subitem Completion Update",
    icon: CheckCircle,
    description:
      'When all subitems of a task are "Done", update parent task status to "Review".',
    category: "Workflow",
    color: "bg-purple-500",
  },
];

interface AutomationRecipeCardProps {
  recipe: any;
  isActive: boolean;
  onToggle: (checked: boolean) => void;
}

const AutomationRecipeCard = ({
  recipe,
  isActive,
  onToggle,
}: AutomationRecipeCardProps) => {
  const Icon = recipe.icon;
  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 border-[#E1E5F3] dark:border-gray-700 bg-white dark:bg-gray-800">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${recipe.color}`}
            >
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-[#323338] dark:text-gray-200">
                {recipe.name}
              </CardTitle>
              <Badge variant="outline" className="text-xs mt-1">
                {recipe.category}
              </Badge>
            </div>
          </div>
          <Switch
            checked={isActive}
            onCheckedChange={onToggle}
            className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-200 dark:data-[state=unchecked]:bg-gray-600"
          />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-[#676879] dark:text-gray-400 mb-3">
          {recipe.description}
        </p>
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-[#0073EA] hover:bg-[#0073EA]/10"
          >
            <Settings className="w-3 h-3 mr-1" />
            Customize
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

interface AutomationsPanelProps {
  board: Board | null;
  onClose: () => void;
}

export default function AutomationsPanel({
  board,
  onClose,
}: AutomationsPanelProps) {
  const [activeAutomations, setActiveAutomations] = useState<
    Record<string, boolean>
  >({});

  const toggleAutomation = (automationId: string) => {
    setActiveAutomations((prev) => ({
      ...prev,
      [automationId]: !prev[automationId],
    }));
    // In a real app, this would save the automation state for the board
    console.log(`Toggled automation ${automationId} for board ${board?.id}`);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Board Automations</h2>
              <p className="text-purple-100 text-sm">
                Automate repetitive tasks for {board?.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-xl font-bold w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-[#323338] dark:text-gray-200">
              Recommended Recipes
            </h3>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create Custom Automation
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {automationTemplates.map((recipe) => (
              <AutomationRecipeCard
                key={recipe.id}
                recipe={recipe}
                isActive={!!activeAutomations[recipe.id]}
                onToggle={() => toggleAutomation(recipe.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
