"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

export function EntityToolbar({
    search,
    onSearchChange,
    searchPlaceholder = "Search",
    pageSize,
    onPageSizeChange,
    pageSizeOptions = [5, 10, 25, 50, 100],
}: {
    search: string;
    onSearchChange: (next: string) => void;
    searchPlaceholder?: string;
    pageSize: number;
    onPageSizeChange: (next: number) => void;
    pageSizeOptions?: readonly number[];
}) {
    return (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="max-w-md relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="pl-10"
                />
            </div>

            <div className="w-[180px]">
                <Select
                    value={String(pageSize)}
                    onValueChange={(v) => {
                        const next = Number(v);
                        if (!Number.isFinite(next)) return;
                        onPageSizeChange(next);
                    }}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Rows per page" />
                    </SelectTrigger>
                    <SelectContent>
                        {pageSizeOptions.map((n) => (
                            <SelectItem key={n} value={String(n)}>
                                {n} rows
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
