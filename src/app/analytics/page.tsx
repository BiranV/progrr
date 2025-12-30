"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/db";
import { Board, Item, Column } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  TrendingUp,
  Target,
  Clock,
  Folder,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { subDays, isAfter, isBefore } from "date-fns";
import { motion } from "framer-motion";

export default function AnalyticsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedBoard, setSelectedBoard] = useState("all");
  const [selectedTimeRange, setSelectedTimeRange] = useState("30");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [boardsData, itemsData] = await Promise.all([
        db.entities.Board.list("-updated_date"),
        db.entities.Item.list("-updated_date"),
      ]);
      setBoards(boardsData);
      setItems(itemsData);
    } catch (error) {
      console.error("Error loading analytics data:", error);
    }
    setIsLoading(false);
  };

  // Filter data based on selections
  const filteredItems = items.filter((item) => {
    // Filter by board
    if (selectedBoard !== "all" && item.board_id !== selectedBoard) {
      return false;
    }

    // Filter by time range
    const daysAgo = parseInt(selectedTimeRange);
    const cutoffDate = subDays(new Date(), daysAgo);
    return isAfter(new Date(item.updated_date || new Date()), cutoffDate);
  });

  const filteredBoards =
    selectedBoard === "all"
      ? boards
      : boards.filter((b) => b.id === selectedBoard);

  // Calculate analytics
  const totalTasks = filteredItems.length;
  const completedTasks = filteredItems.filter((item) => {
    // Try to find status from item property or column mapping
    const board = boards.find((b) => b.id === item.board_id);
    const statusColumn = board?.columns?.find((col) => col.type === "status");
    const status =
      item.status || (statusColumn ? item[statusColumn.id] : undefined);
    return status === "Done" || status === "done";
  }).length;

  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Overdue tasks
  const overdueTasks = filteredItems.filter((item) => {
    const board = boards.find((b) => b.id === item.board_id);
    const dueDateColumn = board?.columns?.find((col) => col.type === "date");
    const statusColumn = board?.columns?.find((col) => col.type === "status");

    const dueDate =
      item.due_date || (dueDateColumn ? item[dueDateColumn.id] : undefined);
    const status =
      item.status || (statusColumn ? item[statusColumn.id] : undefined);

    if (!dueDate || status === "Done" || status === "done") return false;
    return isBefore(new Date(dueDate), new Date());
  }).length;

  // Board performance
  const boardStats = filteredBoards.map((board) => {
    const boardItems = filteredItems.filter(
      (item) => item.board_id === board.id
    );
    const statusColumn = board.columns?.find((col) => col.type === "status");
    const completed = boardItems.filter((item) => {
      const status =
        item.status || (statusColumn ? item[statusColumn.id] : undefined);
      return status === "Done" || status === "done";
    }).length;
    const total = boardItems.length;

    return {
      ...board,
      totalTasks: total,
      completedTasks: completed,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

  // Status distribution
  const statusDistribution: Record<string, number> = {};
  filteredItems.forEach((item) => {
    const board = boards.find((b) => b.id === item.board_id);
    const statusColumn = board?.columns?.find((col) => col.type === "status");
    const status =
      item.status ||
      (statusColumn ? item[statusColumn.id] : undefined) ||
      "Not Started";
    statusDistribution[status] = (statusDistribution[status] || 0) + 1;
  });

  // Priority distribution
  const priorityDistribution: Record<string, number> = {};
  filteredItems.forEach((item) => {
    const board = boards.find((b) => b.id === item.board_id);
    const priorityColumn = board?.columns?.find(
      (col) => col.type === "priority"
    );
    const priority =
      item.priority ||
      (priorityColumn ? item[priorityColumn.id] : undefined) ||
      "Medium";
    priorityDistribution[priority] = (priorityDistribution[priority] || 0) + 1;
  });

  if (isLoading) {
    return (
      <div className="p-6 bg-[#F5F6F8] dark:bg-gray-900 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array(4)
                .fill(0)
                .map((_, i) => (
                  <div
                    key={i}
                    className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl"
                  ></div>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#F5F6F8] dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#323338] dark:text-white">
              Analytics Dashboard
            </h1>
            <p className="text-[#676879] dark:text-gray-400 mt-2">
              Insights and metrics across your boards and tasks
            </p>
          </div>

          <div className="flex gap-3">
            <Select value={selectedBoard} onValueChange={setSelectedBoard}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select board" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Boards</SelectItem>
                {boards.map((board) => (
                  <SelectItem key={board.id} value={board.id}>
                    {board.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedTimeRange}
              onValueChange={setSelectedTimeRange}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Total Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalTasks}</div>
                <p className="text-blue-100 text-sm">Active tasks tracked</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white border-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Completion Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{completionRate}%</div>
                <Progress
                  value={completionRate}
                  className="mt-2 bg-green-300"
                />
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white border-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Overdue Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{overdueTasks}</div>
                <p className="text-red-100 text-sm">Need attention</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white border-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Folder className="w-5 h-5" />
                  Active Boards
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {filteredBoards.length}
                </div>
                <p className="text-purple-100 text-sm">Boards in use</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Charts and detailed analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                Task Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(statusDistribution).map(([status, count]) => {
                  const percentage =
                    totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
                  const color = getStatusColor(status);

                  return (
                    <div
                      key={status}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-sm font-medium">{status}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all duration-500"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-400 w-12">
                          {count}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Priority Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                Priority Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(priorityDistribution).map(
                  ([priority, count]) => {
                    const percentage =
                      totalTasks > 0
                        ? Math.round((count / totalTasks) * 100)
                        : 0;
                    const color = getPriorityColor(priority);

                    return (
                      <div
                        key={priority}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-sm font-medium">
                            {priority}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full transition-all duration-500"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 dark:text-gray-400 w-12">
                            {count}
                          </span>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Board Performance */}
        {selectedBoard === "all" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-green-500" />
                Board Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {boardStats.map((board, index) => (
                  <motion.div
                    key={board.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-lg"
                        style={{ backgroundColor: board.color || "#0073EA" }}
                      />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {board.title}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {board.completedTasks} of {board.totalTasks} tasks
                          completed
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 transition-all duration-500"
                          style={{ width: `${board.completionRate}%` }}
                        />
                      </div>
                      <Badge
                        variant="outline"
                        className="min-w-[3rem] justify-center"
                      >
                        {board.completionRate}%
                      </Badge>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status.toLowerCase()) {
    case "done":
    case "completed":
      return "#00C875";
    case "working on it":
    case "working":
    case "in progress":
      return "#FFCB00";
    case "stuck":
      return "#E2445C";
    default:
      return "#C4C4C4";
  }
}

function getPriorityColor(priority: string) {
  switch (priority.toLowerCase()) {
    case "critical":
      return "#E2445C";
    case "high":
      return "#FDAB3D";
    case "medium":
      return "#FFCB00";
    case "low":
      return "#787D80";
    default:
      return "#C4C4C4";
  }
}
