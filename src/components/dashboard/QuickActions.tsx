"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Users, Calendar, BarChart3, Zap } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

import CreateBoardModal from "@/components/boards/CreateBoardModal";
import InviteTeamModal from "./InviteTeamModal";
import CalendarModal from "./CalendarModal";

interface QuickActionsProps {
  onCreateBoard?: (boardData: any) => Promise<void>;
}

export default function QuickActions({ onCreateBoard }: QuickActionsProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  const handleCreateBoard = async (boardData: any) => {
    if (onCreateBoard) {
      await onCreateBoard(boardData);
    }
    setShowCreateModal(false);
  };

  const actions = [
    {
      title: "Create Board",
      description: "Start new project",
      icon: Plus,
      gradient: "from-blue-500 to-cyan-500",
      hoverGradient: "hover:from-blue-600 hover:to-cyan-600",
      onClick: () => setShowCreateModal(true),
    },
    {
      title: "Invite Team",
      description: "Add collaborators",
      icon: Users,
      gradient: "from-green-500 to-emerald-500",
      hoverGradient: "hover:from-green-600 hover:to-emerald-600",
      onClick: () => setShowInviteModal(true),
    },
    {
      title: "Calendar",
      description: "View deadlines",
      icon: Calendar,
      gradient: "from-amber-500 to-orange-500",
      hoverGradient: "hover:from-amber-600 hover:to-orange-600",
      onClick: () => setShowCalendarModal(true),
    },
    {
      title: "Analytics",
      description: "View insights",
      icon: BarChart3,
      gradient: "from-purple-500 to-pink-500",
      hoverGradient: "hover:from-purple-600 hover:to-pink-600",
      link: "/analytics",
    },
  ];

  return (
    <>
      <Card className="border-0 shadow-lg bg-gradient-to-br from-white via-white to-purple-50/30 backdrop-blur-sm dark:from-gray-800 dark:via-gray-800 dark:to-purple-900/20">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-[#323338] dark:text-gray-100">
                Quick Actions
              </CardTitle>
              <p className="text-sm text-[#676879] dark:text-gray-400">
                Get things done faster
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {actions.map((action, index) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="group"
            >
              {action.link ? (
                <Link href={action.link}>
                  <div
                    className={`flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r ${action.gradient} ${action.hoverGradient} transition-all duration-200 cursor-pointer shadow-md hover:shadow-lg text-white`}
                  >
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/20">
                      <action.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white">{action.title}</p>
                      <p className="text-sm text-white/80">
                        {action.description}
                      </p>
                    </div>
                  </div>
                </Link>
              ) : (
                <div
                  className={`flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r ${action.gradient} ${action.hoverGradient} transition-all duration-200 cursor-pointer shadow-md hover:shadow-lg text-white`}
                  onClick={action.onClick}
                >
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/20">
                    <action.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">{action.title}</p>
                    <p className="text-sm text-white/80">
                      {action.description}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </CardContent>
      </Card>

      {/* Modals */}
      <CreateBoardModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateBoard}
      />

      <InviteTeamModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />

      <CalendarModal
        isOpen={showCalendarModal}
        onClose={() => setShowCalendarModal(false)}
      />
    </>
  );
}
