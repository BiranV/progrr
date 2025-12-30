"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Folder, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Board, Item } from "@/types";

interface StatsOverviewProps {
  boards: Board[];
  items: Item[];
  isLoading: boolean;
}

export default function StatsOverview({
  boards,
  items,
  isLoading,
}: StatsOverviewProps) {
  const completedItems = items.filter(
    (item) => item.status === "Done" || item.status === "done"
  ).length;
  const pendingItems = items.filter(
    (item) => !item.status || (item.status !== "Done" && item.status !== "done")
  ).length;
  const completionRate =
    items.length > 0 ? Math.round((completedItems / items.length) * 100) : 0;

  const stats = [
    {
      title: "Total Boards",
      value: boards.length,
      icon: Folder,
      gradient: "from-blue-500 to-blue-600",
      bgGradient: "from-blue-50 to-blue-100",
      textColor: "text-white",
      cardBg: "bg-gradient-to-br from-blue-500 to-blue-600",
      hoverColor: "hover:from-blue-600 hover:to-blue-700",
    },
    {
      title: "Completed Tasks",
      value: completedItems,
      icon: CheckCircle2,
      gradient: "from-green-500 to-green-600",
      bgGradient: "from-green-50 to-green-100",
      textColor: "text-white",
      cardBg: "bg-gradient-to-br from-green-500 to-green-600",
      hoverColor: "hover:from-green-600 hover:to-green-700",
    },
    {
      title: "Pending Tasks",
      value: pendingItems,
      icon: Clock,
      gradient: "from-amber-500 to-orange-500",
      bgGradient: "from-amber-50 to-orange-100",
      textColor: "text-white",
      cardBg: "bg-gradient-to-br from-amber-500 to-orange-500",
      hoverColor: "hover:from-amber-600 hover:to-orange-600",
    },
    {
      title: "Completion Rate",
      value: `${completionRate}%`,
      icon: TrendingUp,
      gradient: "from-purple-500 to-purple-600",
      bgGradient: "from-purple-50 to-purple-100",
      textColor: "text-white",
      cardBg: "bg-gradient-to-br from-purple-500 to-purple-600",
      hoverColor: "hover:from-purple-600 hover:to-purple-700",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{
            y: -12,
            scale: 1.05,
            rotateY: 5,
            rotateX: 5,
          }}
          className="group perspective-1000"
        >
          <Card
            className={`border-0 shadow-lg hover:shadow-2xl transition-all duration-500 ${stat.cardBg} ${stat.hoverColor} overflow-hidden relative cursor-pointer transform-gpu`}
          >
            <CardContent className="p-4 relative">
              {/* Enhanced decorative elements */}
              <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full transform translate-x-4 -translate-y-4 group-hover:scale-150 transition-transform duration-500"></div>
              <div className="absolute bottom-0 left-0 w-12 h-12 bg-white/5 rounded-full transform -translate-x-2 translate-y-2 group-hover:scale-150 transition-transform duration-500"></div>

              {/* Floating particles effect on hover */}
              <motion.div
                className="absolute inset-0 opacity-0 group-hover:opacity-100"
                initial={false}
                animate={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1 h-1 bg-white/40 rounded-full"
                    style={{
                      left: `${20 + i * 15}%`,
                      top: `${20 + i * 10}%`,
                    }}
                    animate={{
                      y: [0, -10, 0],
                      opacity: [0, 1, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </motion.div>

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <motion.div
                    className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center shadow-lg border border-white/20 group-hover:bg-white/30 transition-all duration-300"
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                  >
                    <stat.icon className="w-5 h-5 text-white" />
                  </motion.div>
                  <motion.div
                    className="w-6 h-6 bg-white/10 rounded-full group-hover:bg-white/20 transition-colors duration-300"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-white/80 group-hover:text-white transition-colors duration-300">
                    {stat.title}
                  </p>
                  {isLoading ? (
                    <Skeleton className="h-6 w-12 bg-white/20" />
                  ) : (
                    <motion.p
                      className="text-2xl font-bold text-white"
                      whileHover={{ scale: 1.1 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      {stat.value}
                    </motion.p>
                  )}
                </div>
              </div>

              {/* Enhanced animated glow effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100"
                animate={{
                  x: ["-100%", "100%"],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  repeatDelay: 3,
                  ease: "easeInOut",
                }}
              />

              {/* Pulsing border effect */}
              <motion.div
                className="absolute inset-0 rounded-xl border-2 border-white/30 opacity-0 group-hover:opacity-100"
                animate={{
                  scale: [1, 1.02, 1],
                  opacity: [0, 0.5, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
