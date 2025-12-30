"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Folder, Lock, Globe, ArrowRight, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import CreateBoardModal from "@/components/boards/CreateBoardModal";
import { Board } from "@/types";

interface RecentBoardsProps {
  boards: Board[];
  isLoading: boolean;
  onCreateBoard?: (boardData: any) => Promise<void>;
}

export default function RecentBoards({
  boards,
  isLoading,
  onCreateBoard,
}: RecentBoardsProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleCreateBoard = async (boardData: any) => {
    if (onCreateBoard) {
      await onCreateBoard(boardData);
    }
    setShowCreateModal(false);
  };

  return (
    <>
      <Card className="border-0 shadow-lg bg-gradient-to-br from-white via-white to-indigo-50/30 backdrop-blur-sm dark:from-gray-800 dark:via-gray-800 dark:to-indigo-900/20">
        <CardHeader className="pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Folder className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-[#323338] dark:text-gray-100">
                  Recent Boards
                </CardTitle>
                <p className="text-sm text-[#676879] dark:text-gray-400 mt-1">
                  Your latest project boards
                </p>
              </div>
            </div>
            <Link href="/boards">
              <Button
                variant="ghost"
                className="text-[#0073EA] hover:bg-[#0073EA]/10 rounded-xl font-medium"
              >
                View All
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="space-y-4">
              {Array(4)
                .fill(0)
                .map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 p-4 rounded-xl bg-gray-50/50 dark:bg-gray-700/50"
                  >
                    <Skeleton className="w-12 h-12 rounded-xl" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-48 mb-2" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                ))}
            </div>
          ) : boards.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Folder className="w-8 h-8 text-gray-400 dark:text-gray-300" />
              </div>
              <h3 className="text-lg font-semibold text-[#323338] dark:text-gray-200 mb-2">
                No boards yet
              </h3>
              <p className="text-[#676879] dark:text-gray-400 mb-6">
                Create your first board to get started
              </p>
              <Button
                className="bg-gradient-to-r from-[#0073EA] to-[#0056B3] hover:from-[#0056B3] hover:to-[#004499] text-white rounded-xl shadow-lg"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Board
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {boards.slice(0, 6).map((board, index) => (
                <motion.div
                  key={board.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ x: 4, scale: 1.01 }}
                  className="group"
                >
                  <Link href={`/board/${board.id}`}>
                    <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-gradient-to-r hover:from-blue-50/80 hover:to-purple-50/80 dark:hover:from-blue-900/30 dark:hover:to-purple-900/30 transition-all duration-200 group-hover:shadow-md border border-transparent hover:border-blue-100 dark:hover:border-blue-800">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-200"
                        style={{ backgroundColor: board.color || "#0073EA" }}
                      >
                        <Folder className="w-6 h-6 text-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-[#323338] dark:text-gray-200 group-hover:text-[#0073EA] transition-colors truncate">
                          {board.title}
                        </h4>
                        <p className="text-sm text-[#676879] dark:text-gray-400 mt-1">
                          Updated{" "}
                          {format(
                            new Date(board.updated_date || new Date()),
                            "MMM d, yyyy"
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge
                          variant="secondary"
                          className={`border-0 text-xs px-3 py-1 rounded-full shadow-sm ${
                            board.visibility === "private"
                              ? "bg-gradient-to-r from-orange-100 to-red-100 text-orange-700 dark:from-orange-900/30 dark:to-red-900/30 dark:text-orange-300"
                              : "bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 dark:from-green-900/30 dark:to-emerald-900/30 dark:text-green-300"
                          }`}
                        >
                          {board.visibility === "private" ? (
                            <Lock className="w-3 h-3 mr-1" />
                          ) : (
                            <Globe className="w-3 h-3 mr-1" />
                          )}
                          {board.visibility}
                        </Badge>

                        <motion.div
                          whileHover={{ x: 4 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 10,
                          }}
                        >
                          <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#0073EA] transition-colors" />
                        </motion.div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Board Modal */}
      <CreateBoardModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateBoard}
      />
    </>
  );
}
