"use client";

import * as React from "react";

export type EntitySortConfig<Key extends string> = {
    key: Key;
    direction: "asc" | "desc";
} | null;

type Paging<T> = {
    pagedRows: T[];
    totalPages: number;
    page: number;
    totalCount: number;
};

type SectionState<T> = {
    rows: T[];
    paging: Paging<T>;
    page: number;
    setPage: (next: number) => void;
};

function normalizeStatus(value: unknown) {
    const s = String(value ?? "").trim().toUpperCase();
    if (s === "ARCHIVED" || s === "DELETED") return s as "ARCHIVED" | "DELETED";
    return "ACTIVE" as const;
}

export function useEntityTableState<T extends Record<string, any>, StatusKey extends keyof T & string>({
    rows,
    statusKey,
    pageSize,
}: {
    rows: T[];
    statusKey: StatusKey;
    pageSize: number;
}) {
    const [activePage, setActivePage] = React.useState(1);
    const [archivedPage, setArchivedPage] = React.useState(1);
    const [sortConfig, setSortConfig] = React.useState<EntitySortConfig<string>>(null);

    const visibleRows = React.useMemo(() => {
        return (rows ?? []).filter((r) => normalizeStatus((r as any)?.[statusKey]) !== "DELETED");
    }, [rows, statusKey]);

    const activeRows = React.useMemo(() => {
        return visibleRows.filter((r) => normalizeStatus((r as any)?.[statusKey]) === "ACTIVE");
    }, [visibleRows, statusKey]);

    const archivedRows = React.useMemo(() => {
        return visibleRows.filter((r) => normalizeStatus((r as any)?.[statusKey]) === "ARCHIVED");
    }, [visibleRows, statusKey]);

    const sorted = React.useCallback(
        (input: T[]) => {
            if (!sortConfig) return input;

            const collator = new Intl.Collator(["he", "en"], {
                sensitivity: "base",
                numeric: true,
            });

            return [...input].sort((a, b) => {
                const direction = sortConfig.direction === "asc" ? 1 : -1;
                const aValue = String((a as any)?.[sortConfig.key] ?? "").trim();
                const bValue = String((b as any)?.[sortConfig.key] ?? "").trim();

                const aEmpty = aValue.length === 0;
                const bEmpty = bValue.length === 0;
                if (aEmpty && !bEmpty) return 1;
                if (!aEmpty && bEmpty) return -1;

                const cmp = collator.compare(aValue, bValue);
                if (cmp !== 0) return cmp * direction;

                const aId = String((a as any)?.id ?? "");
                const bId = String((b as any)?.id ?? "");
                return aId.localeCompare(bId);
            });
        },
        [sortConfig]
    );

    const sortedActive = React.useMemo(() => sorted(activeRows), [activeRows, sorted]);
    const sortedArchived = React.useMemo(() => sorted(archivedRows), [archivedRows, sorted]);

    React.useEffect(() => {
        setActivePage(1);
        setArchivedPage(1);
    }, [pageSize, sortConfig?.key, sortConfig?.direction, visibleRows.length]);

    const paginate = React.useCallback(
        (input: T[], currentPage: number): Paging<T> => {
            const totalPages = Math.max(1, Math.ceil(input.length / pageSize));
            const safePage = Math.min(Math.max(1, currentPage), totalPages);
            const start = (safePage - 1) * pageSize;
            const pagedRows = input.slice(start, start + pageSize);
            return {
                pagedRows,
                totalPages,
                page: safePage,
                totalCount: input.length,
            };
        },
        [pageSize]
    );

    const activePaging = React.useMemo(
        () => paginate(sortedActive, activePage),
        [paginate, sortedActive, activePage]
    );

    const archivedPaging = React.useMemo(
        () => paginate(sortedArchived, archivedPage),
        [paginate, sortedArchived, archivedPage]
    );

    const onSort = React.useCallback((key: string) => {
        setSortConfig((current) => {
            if (current?.key === key) {
                return {
                    key,
                    direction: current.direction === "asc" ? "desc" : "asc",
                };
            }
            return { key, direction: "asc" };
        });
    }, []);

    const active: SectionState<T> = React.useMemo(
        () => ({
            rows: sortedActive,
            paging: activePaging,
            page: activePage,
            setPage: setActivePage,
        }),
        [sortedActive, activePaging, activePage]
    );

    const archived: SectionState<T> = React.useMemo(
        () => ({
            rows: sortedArchived,
            paging: archivedPaging,
            page: archivedPage,
            setPage: setArchivedPage,
        }),
        [sortedArchived, archivedPaging, archivedPage]
    );

    return {
        visibleRows,
        sortConfig,
        setSortConfig,
        onSort,
        active,
        archived,
    };
}
