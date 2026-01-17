"use client";

import React from "react";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";

type Point = { date: string; revenue: number; completedCount?: number };

function formatDayLabel(ymd: string): string {
    // YYYY-MM-DD -> MM/DD (small, readable)
    const m = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(String(ymd));
    if (!m) return String(ymd);
    return `${m[2]}/${m[3]}`;
}

export function RevenueLineChart(props: {
    points: Point[];
    currencySymbol?: string;
}) {
    const { points, currencySymbol } = props;

    const data = React.useMemo(
        () =>
            (Array.isArray(points) ? points : []).map((p) => ({
                ...p,
                label: formatDayLabel(p.date),
            })),
        [points]
    );

    return (
        <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                        width={40}
                        tickFormatter={(v) => {
                            const n = Number(v);
                            if (!Number.isFinite(n)) return "";
                            if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)}k`;
                            return String(Math.round(n));
                        }}
                    />
                    <Tooltip
                        formatter={(value: any, name: any) => {
                            if (name !== "revenue") return [value, name];
                            const n = Number(value);
                            const pretty = Number.isFinite(n)
                                ? `${currencySymbol || ""}${n.toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                })}`
                                : String(value);
                            return [pretty, "Revenue"];
                        }}
                        labelFormatter={(_, payload) => {
                            const ymd = payload?.[0]?.payload?.date;
                            return ymd ? `Date: ${ymd}` : "";
                        }}
                    />
                    <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
