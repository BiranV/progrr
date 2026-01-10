"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
    DataTable,
    type DataTableColumn,
    type DataTablePagination,
    type DataTableSortConfig,
} from "@/components/ui/table/DataTable";
import { EntityEmptyState } from "@/components/ui/entity/EntityEmptyState";

export function EntityTableSection<Row>({
    title,
    variant = "default",
    totalCount,
    emptyState,
    rows,
    columns,
    getRowId,
    sortConfig,
    onSort,
    pagination,
    onRowClick,
}: {
    title?: string;
    variant?: "default" | "archived";
    totalCount: number;
    emptyState: {
        icon: LucideIcon;
        title: string;
        description?: string;
    };
    rows: Row[];
    columns: Array<DataTableColumn<Row>>;
    getRowId: (row: Row) => string;
    sortConfig?: DataTableSortConfig;
    onSort?: (key: string) => void;
    pagination: DataTablePagination;
    onRowClick?: (row: Row) => void;
}) {
    const isArchived = variant === "archived";

    if (totalCount === 0) {
        return (
            <div className={title ? "space-y-3" : undefined}>
                {title ? (
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {title}
                    </div>
                ) : null}
                <EntityEmptyState
                    icon={emptyState.icon}
                    title={emptyState.title}
                    description={emptyState.description}
                />
            </div>
        );
    }

    return (
        <DataTable
            title={title}
            rows={rows}
            columns={columns}
            getRowId={getRowId}
            onRowClick={onRowClick}
            sortConfig={sortConfig}
            onSort={onSort}
            pagination={pagination}
            containerClassName={
                isArchived
                    ? "border-red-100 dark:border-red-900/30 overflow-hidden"
                    : undefined
            }
            headClassName={
                isArchived
                    ? "bg-red-50/50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/30"
                    : undefined
            }
            rowClassName={
                isArchived
                    ? "border-red-100/60 dark:border-red-900/20 hover:bg-red-50/40 dark:hover:bg-red-900/10"
                    : undefined
            }
            footerClassName={
                isArchived
                    ? "border-red-100 dark:border-red-900/30 bg-red-50/40 dark:bg-red-900/10"
                    : undefined
            }
        />
    );
}
