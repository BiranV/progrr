"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/db";
import { Board, Item, Group, Column } from "@/types";
import BoardHeader from "@/components/board/BoardHeader";
import BoardToolbar from "@/components/board/BoardToolbar";
import FilterPanel, { FilterState } from "@/components/board/FilterPanel";
import SortMenu from "@/components/board/SortMenu";
import HideMenu from "@/components/board/HideMenu";
import PersonFilter from "@/components/board/PersonFilter";
import GroupByMenu from "@/components/board/GroupByMenu";
import NewColumnModal from "@/components/board/NewColumnModal";
import NewGroupModal from "@/components/board/NewGroupModal";
import NewTaskModal from "@/components/board/NewTaskModal";
import TaskEditModal from "@/components/board/TaskEditModal";
import GroupSection from "@/components/board/GroupSection";
import KanbanView from "@/components/board/views/KanbanView";
import CalendarView from "@/components/board/views/CalendarView";
import TimelineView from "@/components/board/views/TimelineView";
import AnalyticsPanel from "@/components/board/analytics/AnalyticsPanel";
import AutomationsPanel from "@/components/board/automations/AutomationsPanel";
import IntegrationsPanel from "@/components/board/integrations/IntegrationsPanel";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Plus, GripVertical } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { AnimatePresence } from "framer-motion";

export default function BoardPage() {
  const params = useParams();
  const boardId = params.id as string;

  const [board, setBoard] = useState<Board | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    status: [],
    priority: [],
    people: [],
  });
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showHideMenu, setShowHideMenu] = useState(false);
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [showGroupByMenu, setShowGroupByMenu] = useState(false);
  const [showPersonFilter, setShowPersonFilter] = useState(false);
  const [showNewColumnModal, setShowNewColumnModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [currentView, setCurrentView] = useState("table");
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showAutomations, setShowAutomations] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);

  useEffect(() => {
    if (boardId) {
      loadBoardAndItems();
    }
  }, [boardId]);

  const loadBoardAndItems = async () => {
    setIsLoading(true);
    try {
      const boardData = await db.entities.Board.filter({ id: boardId });
      const itemsData = await db.entities.Item.filter({ board_id: boardId });

      if (boardData.length > 0) {
        const currentBoard = boardData[0];
        setBoard(currentBoard);
        // Initialize groups if not present
        if (currentBoard.groups && currentBoard.groups.length > 0) {
          setGroups(currentBoard.groups);
        } else {
          // Create default group if none exists
          const defaultGroup: Group = {
            id: "group-default",
            title: "Main Table",
            color: "#0073EA",
            board_id: boardId,
            order_index: 0,
          };
          setGroups([defaultGroup]);
          // Update board with default group
          await db.entities.Board.update(boardId, {
            groups: [defaultGroup],
          });
        }
      } else {
        setBoard(null);
      }
      setItems(itemsData);
    } catch (error) {
      console.error("Error loading board and items:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId, type } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    if (type === "group") {
      const newGroups = Array.from(groups);
      const [removed] = newGroups.splice(source.index, 1);
      newGroups.splice(destination.index, 0, removed);

      setGroups(newGroups);

      // Update order_index for all groups
      const updatedGroups = newGroups.map((g, index) => ({
        ...g,
        order_index: index,
      }));

      // Optimistic update
      setGroups(updatedGroups);

      // Persist
      if (board) {
        await db.entities.Board.update(board.id, { groups: updatedGroups });
      }
      return;
    }

    if (type === "item") {
      const sourceGroupId = source.droppableId;
      const destGroupId = destination.droppableId;

      const sourceGroupItems = items
        .filter((item) => item.group_id === sourceGroupId)
        .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

      const destGroupItems =
        sourceGroupId === destGroupId
          ? sourceGroupItems
          : items
              .filter((item) => item.group_id === destGroupId)
              .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

      // Find the moved item
      const movedItem = items.find((item) => item.id === draggableId);
      if (!movedItem) return;

      // Remove from source
      sourceGroupItems.splice(source.index, 1);

      // Add to destination
      if (sourceGroupId === destGroupId) {
        sourceGroupItems.splice(destination.index, 0, movedItem);
      } else {
        destGroupItems.splice(destination.index, 0, {
          ...movedItem,
          group_id: destGroupId,
        });
      }

      // Calculate new items array
      const newItems = items.filter(
        (item) =>
          item.group_id !== sourceGroupId && item.group_id !== destGroupId
      );

      // Update order_index for source group
      const updatedSourceItems = sourceGroupItems.map((item, index) => ({
        ...item,
        order_index: index,
      }));

      // Update order_index for dest group (if different)
      let updatedDestItems: Item[] = [];
      if (sourceGroupId !== destGroupId) {
        updatedDestItems = destGroupItems.map((item, index) => ({
          ...item,
          order_index: index,
          group_id: destGroupId, // Ensure group_id is updated
        }));
      }

      const finalItems = [
        ...newItems,
        ...updatedSourceItems,
        ...(sourceGroupId !== destGroupId ? updatedDestItems : []),
      ];

      setItems(finalItems);

      // Persist changes
      // We need to update the moved item and potentially reorder others
      // For simplicity in this mock, we'll update the moved item and all items in affected groups

      // Update moved item first
      await db.entities.Item.update(movedItem.id, {
        group_id: destGroupId,
        order_index: destination.index,
      });

      // Update other items order if needed (batch update would be better but we iterate)
      // In a real app, we might send the whole order list or use a smarter ranking system
      const itemsToUpdate =
        sourceGroupId === destGroupId
          ? updatedSourceItems
          : [...updatedSourceItems, ...updatedDestItems];

      for (const item of itemsToUpdate) {
        if (item.id !== movedItem.id) {
          // movedItem already updated
          await db.entities.Item.update(item.id, {
            order_index: item.order_index,
          });
        }
      }
    }
  };

  const handleAddItem = async (groupId: string, title: string) => {
    if (!board) return;

    const newItem: Item = {
      id: uuidv4(),
      board_id: board.id,
      group_id: groupId,
      name: title,
      status: "Not Started",
      priority: "Medium",
      order_index: items.filter((i) => i.group_id === groupId).length,
      created_at: new Date().toISOString(),
    };

    // Optimistic update
    setItems([...items, newItem]);

    // Persist
    await db.entities.Item.create(newItem);
  };

  const handleUpdateItem = async (itemId: string, data: any) => {
    // Optimistic update
    setItems(
      items.map((item) => (item.id === itemId ? { ...item, ...data } : item))
    );

    // Persist
    await db.entities.Item.update(itemId, data);
  };

  const handleDeleteItem = async (itemId: string) => {
    // Optimistic update
    setItems(items.filter((item) => item.id !== itemId));

    // Persist
    await db.entities.Item.delete(itemId);
  };

  const handleCreateGroup = async (data: { title: string; color: string }) => {
    if (!board) return;

    const newGroup: Group = {
      id: uuidv4(),
      title: data.title,
      color: data.color,
      board_id: board.id,
      order_index: groups.length,
    };

    const newGroups = [...groups, newGroup];
    setGroups(newGroups);

    await db.entities.Board.update(board.id, { groups: newGroups });
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!board) return;

    const newGroups = groups.filter((g) => g.id !== groupId);
    setGroups(newGroups);

    // Also delete items in this group
    const itemsKeeping = items.filter((i) => i.group_id !== groupId);
    setItems(itemsKeeping);

    await db.entities.Board.update(board.id, { groups: newGroups });

    // Delete items from DB
    const itemsToDelete = items.filter((i) => i.group_id === groupId);
    for (const item of itemsToDelete) {
      await db.entities.Item.delete(item.id);
    }
  };

  const handleUpdateColumn = async (columnId: string, data: any) => {
    if (!board || !board.columns) return;

    const newColumns = board.columns.map((col) =>
      col.id === columnId ? { ...col, ...data } : col
    );

    const newBoard = { ...board, columns: newColumns };
    setBoard(newBoard);

    await db.entities.Board.update(board.id, { columns: newColumns });
  };

  const handleAddColumn = async (columnData?: any) => {
    if (!board) return;

    if (columnData && columnData.title) {
      // Called from modal
      const newColumn: Column = {
        id: uuidv4(),
        title: columnData.title,
        type: columnData.type,
        width: 150,
        options: columnData.options,
      };

      const newColumns = [...(board.columns || []), newColumn];
      const newBoard = { ...board, columns: newColumns };
      setBoard(newBoard);

      await db.entities.Board.update(board.id, { columns: newColumns });
      setShowNewColumnModal(false);
    } else {
      // Called from UI button, show modal
      setShowNewColumnModal(true);
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!board || !board.columns) return;

    const newColumns = board.columns.filter((c) => c.id !== columnId);
    const newBoard = { ...board, columns: newColumns };
    setBoard(newBoard);

    await db.entities.Board.update(board.id, { columns: newColumns });
  };

  const handleSearch = (query: string) => {
    console.log("Search:", query);
  };

  const handleFilterClick = () => {
    setShowFilterPanel(!showFilterPanel);
  };

  const handleSortClick = () => {
    setShowSortMenu(!showSortMenu);
  };

  const handleHideClick = () => {
    setShowHideMenu(!showHideMenu);
  };

  const handleGroupByClick = () => {
    setShowGroupByMenu(!showGroupByMenu);
  };

  const handlePersonFilterClick = () => {
    setShowPersonFilter(!showPersonFilter);
  };

  const handleNewItemClick = () => {
    setShowNewTaskModal(true);
  };

  const filteredItems = items.filter((item) => {
    if (
      filters.status.length > 0 &&
      !filters.status.includes(item.status || "")
    )
      return false;
    if (
      filters.priority.length > 0 &&
      !filters.priority.includes(item.priority || "")
    )
      return false;
    if (filters.people.length > 0 && !filters.people.includes(item.owner || ""))
      return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading...
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex items-center justify-center h-screen">
        Board not found
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      <BoardHeader
        board={board}
        items={items}
        itemsCount={items.length}
        selectedCount={0}
        currentView={currentView}
        onViewChange={setCurrentView}
        onShowAnalytics={() => setShowAnalytics(true)}
        onShowIntegrations={() => setShowIntegrations(true)}
        onShowAutomations={() => setShowAutomations(true)}
      />

      <div className="relative z-20">
        <BoardToolbar
          onSearch={handleSearch}
          onFilterClick={handleFilterClick}
          onSortClick={handleSortClick}
          onHideClick={handleHideClick}
          onGroupByClick={handleGroupByClick}
          onPersonFilterClick={handlePersonFilterClick}
          onNewItem={handleNewItemClick}
        />
        <AnimatePresence>
          {showFilterPanel && (
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              onClose={() => setShowFilterPanel(false)}
              board={board}
            />
          )}
          {showSortMenu && (
            <SortMenu
              sortBy={sortBy}
              sortDirection={sortDirection}
              columns={board?.columns || []}
              onChange={(field, direction) => {
                setSortBy(field);
                setSortDirection(direction);
              }}
              onClose={() => setShowSortMenu(false)}
            />
          )}
          {showHideMenu && (
            <HideMenu
              columns={board?.columns || []}
              hiddenColumns={hiddenColumns}
              onChange={setHiddenColumns}
              onClose={() => setShowHideMenu(false)}
            />
          )}
          {showGroupByMenu && (
            <GroupByMenu
              groupBy={groupBy}
              columns={board?.columns || []}
              onChange={setGroupBy}
              onClose={() => setShowGroupByMenu(false)}
            />
          )}
          {showPersonFilter && (
            <PersonFilter
              items={items}
              selectedPeople={filters.people}
              onChange={(people) => setFilters({ ...filters, people })}
              onClose={() => setShowPersonFilter(false)}
            />
          )}
          <NewColumnModal
            isOpen={showNewColumnModal}
            onClose={() => setShowNewColumnModal(false)}
            onSubmit={handleAddColumn}
          />
          <NewGroupModal
            isOpen={showNewGroupModal}
            onClose={() => setShowNewGroupModal(false)}
            onSubmit={handleCreateGroup}
          />
          <NewTaskModal
            isOpen={showNewTaskModal}
            onClose={() => setShowNewTaskModal(false)}
            board={board}
            onSubmit={handleAddItem}
          />
          <TaskEditModal
            isOpen={!!editingItem}
            onClose={() => setEditingItem(null)}
            task={editingItem}
            board={board}
            onUpdate={handleUpdateItem}
            onDelete={handleDeleteItem}
          />
          {showAnalytics && (
            <AnalyticsPanel
              board={board}
              items={items}
              onClose={() => setShowAnalytics(false)}
            />
          )}
          {showAutomations && (
            <AutomationsPanel
              board={board}
              onClose={() => setShowAutomations(false)}
            />
          )}
          {showIntegrations && (
            <IntegrationsPanel
              board={board}
              onClose={() => setShowIntegrations(false)}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {currentView === "table" ? (
          <>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="all-groups" type="group">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-8"
                  >
                    {groups.map((group, index) => (
                      <Draggable
                        key={group.id}
                        draggableId={group.id}
                        index={index}
                      >
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className="relative group/board-group"
                          >
                            {/* Drag Handle for Group */}
                            <div
                              {...provided.dragHandleProps}
                              className="absolute -left-6 top-3 p-1 opacity-0 group-hover/board-group:opacity-100 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>

                            <GroupSection
                              group={group}
                              items={filteredItems
                                .filter((item) => item.group_id === group.id)
                                .sort((a, b) => {
                                  if (sortBy) {
                                    const valA = a[sortBy];
                                    const valB = b[sortBy];
                                    if (valA < valB)
                                      return sortDirection === "asc" ? -1 : 1;
                                    if (valA > valB)
                                      return sortDirection === "asc" ? 1 : -1;
                                  }
                                  return (
                                    (a.order_index || 0) - (b.order_index || 0)
                                  );
                                })}
                              columns={(board.columns || []).filter(
                                (col) => !hiddenColumns.has(col.id)
                              )}
                              onAddItem={handleAddItem}
                              onUpdateItem={handleUpdateItem}
                              onDeleteItem={handleDeleteItem}
                              onEditItem={setEditingItem}
                              onReorderItems={() => {}} // Handled by DragDropContext
                              onUpdateColumn={handleUpdateColumn}
                              onDeleteColumn={handleDeleteColumn}
                              onAddColumn={handleAddColumn}
                              onDeleteGroup={handleDeleteGroup}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            <div className="mt-8">
              <Button
                variant="outline"
                onClick={() => setShowNewGroupModal(true)}
                className="flex items-center gap-2 text-primary border-primary/20 hover:bg-primary/5"
              >
                <Plus className="w-4 h-4" />
                Add New Group
              </Button>
            </div>
          </>
        ) : currentView === "kanban" ? (
          <KanbanView
            board={board}
            items={filteredItems}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            onEditItem={setEditingItem}
          />
        ) : currentView === "calendar" ? (
          <CalendarView
            board={board}
            items={filteredItems}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            onEditItem={setEditingItem}
          />
        ) : currentView === "timeline" ? (
          <TimelineView board={board} items={filteredItems} />
        ) : null}
      </div>
    </div>
  );
}
