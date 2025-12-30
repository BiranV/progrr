"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle2, AlertCircle, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Item } from "@/types";

interface ActivityFeedProps {
  items: Item[];
  isLoading: boolean;
}

export default function ActivityFeed({ items, isLoading }: ActivityFeedProps) {
  const getStatusIcon = (status: string | undefined) => {
    switch (status?.toLowerCase()) {
      case "done":
        return CheckCircle2;
      case "working on it":
      case "in progress":
        return Clock;
      case "stuck":
        return AlertCircle;
      default:
        return Clock;
    }
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status?.toLowerCase()) {
      case "done":
        return "text-white bg-gradient-to-r from-green-500 to-emerald-500";
      case "working on it":
      case "in progress":
        return "text-white bg-gradient-to-r from-amber-500 to-orange-500";
      case "stuck":
        return "text-white bg-gradient-to-r from-red-500 to-pink-500";
      default:
        return "text-white bg-gradient-to-r from-gray-500 to-slate-500";
    }
  };

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-white via-white to-green-50/30 backdrop-blur-sm dark:from-gray-800 dark:via-gray-800 dark:to-green-900/20">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold text-[#323338] dark:text-gray-100">
              Recent Activity
            </CardTitle>
            <p className="text-sm text-[#676879] dark:text-gray-400">
              Latest updates
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {Array(4)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-3 w-full mb-2" />
                    <Skeleton className="h-2 w-20" />
                  </div>
                </div>
              ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Activity className="w-6 h-6 text-gray-400 dark:text-gray-300" />
            </div>
            <p className="text-[#676879] dark:text-gray-400 text-sm">
              No recent activity
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.slice(0, 5).map((item, index) => {
              const StatusIcon = getStatusIcon(item.status);
              const statusColor = getStatusColor(item.status);

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-green-50/50 dark:hover:from-blue-900/30 dark:hover:to-green-900/30 transition-all duration-200 cursor-pointer"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${statusColor}`}
                  >
                    <StatusIcon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#323338] dark:text-gray-200 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-[#676879] dark:text-gray-400">
                      {format(
                        new Date(item.created_at || new Date()),
                        "MMM d, h:mm a"
                      )}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
