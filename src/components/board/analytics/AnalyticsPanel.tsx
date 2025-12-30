"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  Users,
  Calendar,
  Target,
  Clock,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { Board, Item, Column } from "@/types";

interface AnalyticsPanelProps {
  board: Board | null;
  items: Item[];
  onClose: () => void;
}

export default function AnalyticsPanel({
  board,
  items,
  onClose,
}: AnalyticsPanelProps) {
  // Calculate analytics data
  const statusColumn = board?.columns?.find((col) => col.type === "status");
  const priorityColumn = board?.columns?.find((col) => col.type === "priority");
  const peopleColumn = board?.columns?.find((col) => col.type === "people");
  const dueDateColumn = board?.columns?.find((col) => col.type === "date");

  // Status distribution
  const statusStats: Record<string, number> = {};
  if ((statusColumn as any)?.options?.choices) {
    (statusColumn as any).options.choices.forEach((choice: any) => {
      statusStats[choice.label] = items.filter(
        (item) => item[statusColumn!.id] === choice.label
      ).length;
    });
  }

  // Priority distribution
  const priorityStats: Record<string, number> = {};
  if ((priorityColumn as any)?.options?.choices) {
    (priorityColumn as any).options.choices.forEach((choice: any) => {
      priorityStats[choice.label] = items.filter(
        (item) => item[priorityColumn!.id] === choice.value
      ).length;
    });
  }

  // People workload
  const peopleStats: Record<string, number> = {};
  if (peopleColumn) {
    items.forEach((item) => {
      const person = item[peopleColumn.id];
      if (person) {
        peopleStats[person] = (peopleStats[person] || 0) + 1;
      }
    });
  }

  // Overdue tasks
  const overdueTasks = items.filter((item) => {
    const dueDate = dueDateColumn ? item[dueDateColumn.id] : undefined;
    if (!dueDate) return false;
    const status = statusColumn ? item[statusColumn.id] : undefined;
    return new Date(dueDate) < new Date() && status !== "Done";
  });

  // Completion rate
  const completedTasks = items.filter((item) => {
    const status = statusColumn ? item[statusColumn.id] : undefined;
    return status === "Done";
  }).length;
  const completionRate =
    items.length > 0 ? Math.round((completedTasks / items.length) * 100) : 0;

  // Recent activity (mock data based on updated_date)
  // Assuming item has updated_at or similar. Item interface has [key: string]: any, but let's check.
  // In page.tsx, handleUpdateItem updates item.
  // We can use created_at if updated_at is missing.
  const recentActivity = items
    .sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at || 0);
      const dateB = new Date(b.updated_at || b.created_at || 0);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 5);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Board Analytics
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Insights and statistics for {board?.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Overview Cards */}
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5" />
                Total Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{items.length}</div>
              <p className="text-blue-100">Active items in board</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white border-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Completion Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{completionRate}%</div>
              <Progress
                value={completionRate}
                className="h-2 mt-2 bg-green-800/30"
              />
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white border-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Overdue Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{overdueTasks.length}</div>
              <p className="text-red-100">Tasks past due date</p>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card className="col-span-1 md:col-span-2 lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-gray-500" />
                Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(statusStats).map(([status, count]) => {
                const percentage =
                  items.length > 0
                    ? Math.round((count / items.length) * 100)
                    : 0;
                const color =
                  (statusColumn as any)?.options?.choices?.find(
                    (c: any) => c.label === status
                  )?.color || "#ccc";
                return (
                  <div key={status} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{status}</span>
                      <span className="text-gray-500">
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Priority Breakdown */}
          <Card className="col-span-1 md:col-span-2 lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-gray-500" />
                Priority Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(priorityStats).map(([priority, count]) => {
                const percentage =
                  items.length > 0
                    ? Math.round((count / items.length) * 100)
                    : 0;
                const color =
                  (priorityColumn as any)?.options?.choices?.find(
                    (c: any) => c.label === priority
                  )?.color || "#ccc";
                return (
                  <div key={priority} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{priority}</span>
                      <span className="text-gray-500">
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Team Workload */}
          <Card className="col-span-1 md:col-span-2 lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-500" />
                Team Workload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(peopleStats).map(([person, count]) => (
                <div key={person} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                      {person.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="font-medium text-sm">{person}</span>
                  </div>
                  <Badge variant="secondary">{count} tasks</Badge>
                </div>
              ))}
              {Object.keys(peopleStats).length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  No tasks assigned yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
