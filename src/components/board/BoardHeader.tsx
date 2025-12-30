"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  ArrowLeft,
  Star,
  Activity,
  Table2,
  ChevronDown,
  TrendingUp,
  Edit3,
  Save,
  UserPlus,
  Mail,
  MessageSquare,
  Zap,
  UserMinus,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Board, Item } from "@/types";

interface BoardHeaderProps {
  board: Board | null;
  items: Item[];
  itemsCount: number;
  selectedCount: number;
  currentView: string;
  onViewChange: (view: string) => void;
  onShowAnalytics: () => void;
  onShowIntegrations: () => void;
  onShowAutomations: () => void;
}

export default function BoardHeader({
  board,
  items,
  itemsCount,
  selectedCount,
  currentView,
  onViewChange,
  onShowAnalytics,
  onShowIntegrations,
  onShowAutomations,
}: BoardHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(board?.title || "");
  const [lastSaved, setLastSaved] = useState(new Date());
  const [collaborators, setCollaborators] = useState([
    { id: 1, name: "John Doe", avatar: "JD", online: true, role: "Owner" },
    { id: 2, name: "Jane Smith", avatar: "JS", online: true, role: "Editor" },
    {
      id: 3,
      name: "Mike Johnson",
      avatar: "MJ",
      online: false,
      role: "Viewer",
    },
    { id: 4, name: "Sarah Wilson", avatar: "SW", online: true, role: "Editor" },
  ]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setLastSaved(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (board?.title) {
      setEditedTitle(board.title);
    }
  }, [board?.title]);

  const boardColor = board?.color || "#0073EA";

  const handleSaveTitle = () => {
    setIsEditing(false);
    console.log("Saving title:", editedTitle);
  };

  const handleToggleFavorite = () => {
    setIsFavorited(!isFavorited);
  };

  return (
    <TooltipProvider>
      <div className="bg-white dark:bg-gray-800 sticky top-0 z-40 shadow-sm border-b border-[#E1E5F3] dark:border-gray-700">
        <motion.div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: boardColor, originX: 0 }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: isScrolled ? 1 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        />

        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/boards">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-[#E1E5F3] dark:hover:bg-gray-700 rounded-lg h-9 w-9 transition-all duration-200 hover:scale-105"
                    >
                      <ArrowLeft className="w-4 h-4 dark:text-gray-300" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>Back to Boards</TooltipContent>
              </Tooltip>

              <div className="flex items-center gap-3">
                <motion.div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg relative overflow-hidden"
                  style={{ backgroundColor: boardColor }}
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Table2 className="w-5 h-5 text-white" />
                  <motion.div
                    className="absolute inset-0 bg-white/20"
                    initial={{ x: "-100%" }}
                    whileHover={{ x: "100%" }}
                    transition={{ duration: 0.6 }}
                  />
                </motion.div>

                <div className="space-y-1">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveTitle();
                          if (e.key === "Escape") setIsEditing(false);
                        }}
                        className="text-xl font-bold h-8 w-64"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={handleSaveTitle}
                        className="h-8"
                      >
                        <Save className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <motion.h1
                      className="text-xl font-bold text-[#323338] dark:text-white cursor-pointer hover:text-[#0073EA] transition-colors flex items-center gap-2 group"
                      onClick={() => setIsEditing(true)}
                      whileHover={{ scale: 1.02 }}
                    >
                      {board?.title}
                      <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.h1>
                  )}

                  <div className="flex items-center gap-3 text-xs">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-[#676879] dark:text-gray-400 hover:bg-[#E1E5F3] dark:hover:bg-gray-700 rounded-md"
                        >
                          <Table2 className="w-3 h-3 mr-1" />
                          {currentView === "table"
                            ? "Main table"
                            : currentView === "kanban"
                            ? "Kanban"
                            : currentView === "calendar"
                            ? "Calendar"
                            : currentView === "timeline"
                            ? "Timeline"
                            : currentView === "unassigned"
                            ? "Unassigned Tasks"
                            : "Main table"}
                          <ChevronDown className="w-3 h-3 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => onViewChange("table")}>
                          <Table2 className="w-4 h-4 mr-2" />
                          Main Table
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onViewChange("kanban")}
                        >
                          <Table2 className="w-4 h-4 mr-2" />
                          Kanban Board
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onViewChange("calendar")}
                        >
                          <Table2 className="w-4 h-4 mr-2" />
                          Calendar View
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onViewChange("timeline")}
                        >
                          <Table2 className="w-4 h-4 mr-2" />
                          Timeline
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onViewChange("unassigned")}
                        >
                          <UserMinus className="w-4 h-4 mr-2" />
                          Unassigned Tasks
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <span className="text-[#A0A0A0]">|</span>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-6 px-2 text-xs transition-all duration-200 ${
                            isFavorited
                              ? "text-yellow-500 hover:text-yellow-600"
                              : "text-[#676879] dark:text-gray-400 hover:text-yellow-500"
                          }`}
                          onClick={handleToggleFavorite}
                        >
                          <motion.div
                            whileHover={{ scale: 1.2, rotate: 10 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Star
                              className={`w-3 h-3 mr-1 ${
                                isFavorited ? "fill-current" : ""
                              }`}
                            />
                          </motion.div>
                          {isFavorited ? "Favorited" : "Add to favorites"}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isFavorited
                          ? "Remove from favorites"
                          : "Add to favorites"}
                      </TooltipContent>
                    </Tooltip>

                    <span className="text-[#A0A0A0]">|</span>

                    <div className="flex items-center gap-2">
                      <span className="text-[#A0A0A0]">{itemsCount} items</span>
                      <span className="text-[#A0A0A0]">▪</span>
                      <span className="text-[#A0A0A0]">
                        Saved {lastSaved.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs border-[#E1E5F3] dark:border-gray-700 hover:border-green-500 hover:text-green-600 dark:text-gray-300"
                onClick={onShowAnalytics}
              >
                <TrendingUp className="w-3 h-3 mr-1" />
                Analytics
              </Button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs border-[#E1E5F3] dark:border-gray-700 hover:border-blue-500 dark:text-gray-300"
                    onClick={onShowIntegrations}
                  >
                    <Activity className="w-3 h-3 mr-1" />
                    Integrate
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Connect external tools</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs border-[#E1E5F3] dark:border-gray-700 hover:border-purple-500 relative dark:text-gray-300"
                    onClick={onShowAutomations}
                  >
                    <Zap className="w-3 h-3 mr-1" />
                    Automate
                    <motion.div
                      className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Manage automations</TooltipContent>
              </Tooltip>

              <Popover>
                <PopoverTrigger asChild>
                  <div className="flex items-center -space-x-2 cursor-pointer">
                    {collaborators.slice(0, 3).map((user, index) => (
                      <Tooltip key={user.id}>
                        <TooltipTrigger asChild>
                          <motion.div
                            className={`w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-xs font-medium relative ${
                              index === 0
                                ? "bg-blue-500"
                                : index === 1
                                ? "bg-green-500"
                                : "bg-purple-500"
                            }`}
                            whileHover={{ scale: 1.1, zIndex: 10 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {user.avatar}
                            {user.online && (
                              <motion.div
                                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border border-white dark:border-gray-800"
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                              />
                            )}
                          </motion.div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {user.name} ({user.role})
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    {collaborators.length > 3 && (
                      <div className="w-8 h-8 rounded-full bg-gray-400 border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-xs">
                        +{collaborators.length - 3}
                      </div>
                    )}
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">
                        Team ({collaborators.length})
                      </h4>
                      <Button size="sm" variant="outline">
                        <UserPlus className="w-3 h-3 mr-1" />
                        Invite
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {collaborators.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs relative ${
                                user.id % 3 === 0
                                  ? "bg-blue-500"
                                  : user.id % 3 === 1
                                  ? "bg-green-500"
                                  : "bg-purple-500"
                              }`}
                            >
                              {user.avatar}
                              {user.online && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full border border-white dark:border-gray-800" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{user.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {user.role}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                            >
                              <Mail className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                            >
                              <MessageSquare className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
