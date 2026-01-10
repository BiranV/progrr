"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Archive } from "lucide-react";
import {
    DataTable,
    type DataTableColumn,
    type DataTablePagination,
    type DataTableSortConfig,
} from "@/components/ui/table/DataTable";
import { EntityEmptyState } from "@/components/ui/entity/EntityEmptyState";

export function EntityTableSection<Row>({
    ...props
}: (
        | {
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

            children?: never;
        }
        | {
            title?: string;
            variant?: "default" | "archived";
            totalCount: number;
            emptyState: {
                icon: LucideIcon;
                title: string;
                description?: string;
            };

            children: React.ReactNode;

            rows?: never;
            columns?: never;
            getRowId?: never;
            sortConfig?: never;
            onSort?: never;
            pagination?: never;
            onRowClick?: never;
        }
    )) {
    const {
        title,
        variant = "default",
        totalCount,
        emptyState,
    } = props;
    const isArchived = variant === "archived";

    const titleWithIcon = title && isArchived ? (
        <span className="inline-flex items-center gap-2">
            <Archive className="h-4 w-4 text-red-600/80 dark:text-red-300/80" />
            <span>{title}</span>
        </span>
    ) : (
        title
    );

    if (totalCount === 0) {
        return (
            <div className={title ? "space-y-3" : undefined}>
                {title ? (
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {titleWithIcon}
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

    if ("children" in props) {
        return (
            <div className={title ? "space-y-3" : undefined}>
                {title ? (
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {titleWithIcon}
                    </div>
                ) : null}
                {props.children}
            </div>
        );
    }

    return (
        <DataTable
            title={titleWithIcon}
            rows={props.rows}
            columns={props.columns}
            getRowId={props.getRowId}
            onRowClick={props.onRowClick}
            sortConfig={props.sortConfig}
            onSort={props.onSort}
            pagination={props.pagination}
            containerClassName={
                isArchived
                    ? "border-red-200 dark:border-red-900/30"
                    : undefined
            }
        />
    );
}
