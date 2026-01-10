"use client";

import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

type EntityToolbarProps = (
    | {
        showSearch?: true;
        search: string;
        onSearchChange: (next: string) => void;
        searchPlaceholder?: string;
    }
    | {
        showSearch: false;
        search?: never;
        onSearchChange?: never;
        searchPlaceholder?: never;
    }
) &
    (
        | {
            showPageSize?: true;
            pageSize: number;
            onPageSizeChange: (next: number) => void;
            pageSizeOptions?: readonly number[];
        }
        | {
            showPageSize: false;
            pageSize?: never;
            onPageSizeChange?: never;
            pageSizeOptions?: never;
        }
    );

export function EntityToolbar(props: EntityToolbarProps) {
    const showSearch = props.showSearch !== false;
    const showPageSize = props.showPageSize !== false;

    if (!showSearch && !showPageSize) {
        return <div className="mb-6" />;
    }

    return (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end gap-3">
            {showSearch ? (
                <div className="max-w-md relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                        value={props.search}
                        onChange={(e) => props.onSearchChange(e.target.value)}
                        placeholder={props.searchPlaceholder ?? "Search"}
                        className="pl-10"
                    />
                </div>
            ) : null}

            {showPageSize ? (
                <div className="w-[180px]">
                    <Select
                        value={String(props.pageSize)}
                        onValueChange={(v) => {
                            const next = Number(v);
                            if (!Number.isFinite(next)) return;
                            props.onPageSizeChange(next);
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Rows per page" />
                        </SelectTrigger>
                        <SelectContent>
                            {(props.pageSizeOptions ?? [5, 10, 25, 50, 100]).map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                    {n} rows
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            ) : null}
        </div>
    );
}
