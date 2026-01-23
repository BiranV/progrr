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
import { useLocale } from "@/context/LocaleContext";
import { useI18n } from "@/i18n/useI18n";

type Point = { date: string; revenue: number; completedCount?: number };

function formatDayLabel(ymd: string, mode: "md" | "day", locale: string): string {
    const m = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(String(ymd));
    if (!m) return String(ymd);
    const date = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
    try {
        if (mode === "day") {
            return new Intl.DateTimeFormat(locale, { day: "numeric" }).format(date);
        }
        return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(date);
    } catch {
        if (mode === "day") return String(Number(m[3]));
        return `${m[2]}/${m[3]}`;
    }
}

export function RevenueLineChart(props: {
    points: Point[];
    currencySymbol?: string;
    xAxisMode?: "md" | "day";
}) {
    const { points, currencySymbol, xAxisMode = "md" } = props;
    const { locale } = useLocale();
    const { t } = useI18n();

    const data = React.useMemo(
        () =>
            (Array.isArray(points) ? points : []).map((p) => ({
                ...p,
                label: formatDayLabel(p.date, xAxisMode, locale),
            })),
        [points, xAxisMode, locale]
    );

    return (
        <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                        interval="preserveStartEnd"
                        minTickGap={12}
                    />
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
                                ? `${currencySymbol || ""}${n.toLocaleString(locale, {
                                    maximumFractionDigits: 2,
                                })}`
                                : String(value);
                            return [pretty, t("dashboard.revenue")];
                        }}
                        labelFormatter={(_, payload) => {
                            const ymd = payload?.[0]?.payload?.date;
                            if (!ymd) return "";
                            const pretty = formatDayLabel(ymd, "md", locale);
                            return `${t("dashboard.date")}: ${pretty}`;
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
