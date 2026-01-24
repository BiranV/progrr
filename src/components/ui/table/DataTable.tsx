"use client";

import * as React from "react";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DataTableSortConfig = {
    key: string;
    direction: "asc" | "desc";
} | null;

export type DataTableColumn<Row> = {
    key: string;
    header: React.ReactNode;
    sortable?: boolean;
    headerClassName?: string;
    cellClassName?: string;
    renderCell?: (row: Row) => React.ReactNode;
};

export type DataTablePagination = {
    page: number;
    totalPages: number;
    onPageChange: (nextPage: number) => void;
};

export type DataTablePaginationLabels = {
    summary?: (page: number, totalPages: number) => React.ReactNode;
    previous?: React.ReactNode;
    next?: React.ReactNode;
};

export function DataTable<Row>({
    title,
    rows,
    columns,
    getRowId,
    onRowClick,
    sortConfig,
    onSort,
    pagination,
    paginationLabels,
    containerClassName,
    headClassName,
    rowClassName,
    footerClassName,
    emptyMessage,
}: {
    title?: React.ReactNode;
    rows: Row[];
    columns: Array<DataTableColumn<Row>>;
    getRowId: (row: Row) => string;
    onRowClick?: (row: Row) => void;
    sortConfig?: DataTableSortConfig;
    onSort?: (key: string) => void;
    pagination?: DataTablePagination;
    paginationLabels?: DataTablePaginationLabels;
    containerClassName?: string;
    headClassName?: string;
    rowClassName?: string;
    footerClassName?: string;
    emptyMessage?: React.ReactNode;
}) {
    return (
        <div
            className={cn(
                "bg-white dark:bg-gray-800 rounded-lg border overflow-hidden",
                containerClassName
            )}
        >
            {title ? (
                <div className="px-4 pt-4">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {title}
                    </div>
                </div>
            ) : null}

            <div className={cn("overflow-x-auto", title ? "pt-3" : undefined)}>
                <table className="w-full text-sm">
                    <thead className={cn("bg-gray-50 dark:bg-gray-700", headClassName)}>
                        <tr>
                            {columns.map((col) => {
                                const isSortable = Boolean(col.sortable && onSort);
                                return (
                                    <th
                                        key={col.key}
                                        className={cn(
                                            "px-4 py-3 text-start font-medium",
                                            isSortable
                                                ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                                                : undefined,
                                            col.headerClassName
                                        )}
                                        onClick={isSortable ? () => onSort?.(col.key) : undefined}
                                    >
                                        <div className="flex items-center gap-2">
                                            {col.header}
                                            {isSortable ? (
                                                <ArrowUpDown
                                                    className={cn(
                                                        "w-4 h-4",
                                                        sortConfig?.key === col.key
                                                            ? "opacity-100"
                                                            : "opacity-70"
                                                    )}
                                                />
                                            ) : null}
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && emptyMessage ? (
                            <tr>
                                <td
                                    className="px-4 py-6 text-sm text-gray-500"
                                    colSpan={columns.length}
                                >
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : null}

                        {rows.map((row) => {
                            const id = getRowId(row);
                            return (
                                <tr
                                    key={id}
                                    className={cn(
                                        "border-t hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors",
                                        onRowClick ? "cursor-pointer" : undefined,
                                        rowClassName
                                    )}
                                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                                >
                                    {columns.map((col) => (
                                        <td
                                            key={col.key}
                                            className={cn("px-4 py-3", col.cellClassName)}
                                        >
                                            {col.renderCell ? col.renderCell(row) : (row as any)?.[col.key]}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {pagination ? (
                <div
                    className={cn(
                        "flex items-center justify-between gap-3 px-4 py-3 border-t bg-gray-50/60 dark:bg-gray-700/40",
                        footerClassName
                    )}
                >
                    <div className="text-xs text-gray-600 dark:text-gray-300">
                        {paginationLabels?.summary
                            ? paginationLabels.summary(
                                pagination.page,
                                pagination.totalPages
                            )
                            : `Page ${pagination.page} of ${pagination.totalPages}`}
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pagination.page <= 1}
                            onClick={() =>
                                pagination.onPageChange(Math.max(1, pagination.page - 1))
                            }
                        >
                            {paginationLabels?.previous ?? "Previous"}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pagination.page >= pagination.totalPages}
                            onClick={() =>
                                pagination.onPageChange(
                                    Math.min(pagination.totalPages, pagination.page + 1)
                                )
                            }
                        >
                            {paginationLabels?.next ?? "Next"}
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
