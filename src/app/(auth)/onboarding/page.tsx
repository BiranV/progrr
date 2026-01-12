"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch as UISwitch } from "@/components/ui/switch";

import AuthBanner from "../auth/_components/AuthBanner";

type OnboardingData = {
    businessTypes?: string[];
    business?: { name?: string; phone?: string; address?: string };
    currency?: string;
    customCurrency?: { name?: string; symbol?: string };
    services?: Array<{ id: string; name: string; durationMinutes: number; price?: number }>;
    availability?: {
        timezone?: string;
        weekStartsOn?: 0 | 1;
        days?: Array<{ day: number; enabled: boolean; start?: string; end?: string }>;
    };
};

const OTHER_CURRENCY_CODE = "OTHER";

const CURRENCIES: Array<{ code: string; label: string; symbol: string }> = [
    { code: "NIS", label: "NIS (₪)", symbol: "₪" },
    { code: "USD", label: "USD ($)", symbol: "$" },
    { code: "EUR", label: "EUR (€)", symbol: "€" },
    { code: "GBP", label: "GBP (£)", symbol: "£" },
    { code: "AUD", label: "AUD ($)", symbol: "$" },
    { code: "CAD", label: "CAD ($)", symbol: "$" },
    { code: "CHF", label: "CHF (CHF)", symbol: "CHF" },
    { code: OTHER_CURRENCY_CODE, label: "Other", symbol: "" },
];

const ALLOWED_CURRENCY_CODES = new Set(CURRENCIES.map((c) => c.code));

function normalizeCurrency(v: unknown): string {
    const code = String(v ?? "").trim().toUpperCase();
    return ALLOWED_CURRENCY_CODES.has(code) ? code : "NIS";
}

function currencySymbol(code: string): string {
    return CURRENCIES.find((c) => c.code === code)?.symbol ?? "₪";
}

function effectiveCurrencySymbol(data: OnboardingData): string {
    const code = normalizeCurrency(data.currency);
    if (code === OTHER_CURRENCY_CODE) {
        const s = String(data.customCurrency?.symbol ?? "").trim();
        return s || "¤";
    }
    return currencySymbol(code);
}

function currencyLabel(data: OnboardingData): string {
    const code = normalizeCurrency(data.currency);
    if (code === OTHER_CURRENCY_CODE) {
        const name = String(data.customCurrency?.name ?? "").trim();
        const symbol = String(data.customCurrency?.symbol ?? "").trim();
        const left = name || "Other";
        return symbol ? `${left} (${symbol})` : left;
    }
    return CURRENCIES.find((c) => c.code === code)?.label ?? code;
}

const BUSINESS_TYPE_OPTIONS: Array<{
    value: string;
    label: string;
    description: string;
}> = [
        { value: "salon", label: "Salon", description: "Hair, beauty, nails" },
        { value: "barbershop", label: "Barbershop", description: "Cuts, shaves, grooming" },
        { value: "fitness", label: "Fitness", description: "Training, coaching" },
        { value: "therapy", label: "Therapy", description: "Counseling, wellness" },
        { value: "consulting", label: "Consulting", description: "Advisory services" },
        { value: "other", label: "Other", description: "Anything else" },
    ];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function defaultDays() {
    return DAY_LABELS.map((_, day) => ({
        day,
        enabled: day >= 1 && day <= 5,
        start: "09:00",
        end: "17:00",
    }));
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(path, {
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
        ...init,
    });

    if (!res.ok) {
        let message = `Request failed (${res.status})`;
        try {
            const body = await res.json();
            if (body?.error) message = body.error;
        } catch {
            // ignore
        }
        const err: any = new Error(message);
        err.status = res.status;
        throw err;
    }

    return (await res.json()) as T;
}

export default function OnboardingPage() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [step, setStep] = useState(0);
    const totalSteps = 5;

    const [data, setData] = useState<OnboardingData>({
        businessTypes: [],
        business: { name: "", phone: "", address: "" },
        currency: "NIS",
        services: [{ id: crypto.randomUUID(), name: "", durationMinutes: 30, price: undefined }],
        availability: {
            weekStartsOn: 0,
            days: defaultDays(),
        },
    });

    const progress = useMemo(
        () => Math.round(((step + 1) / totalSteps) * 100),
        [step]
    );

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await apiFetch<{ onboardingCompleted: boolean; onboarding: OnboardingData }>(
                    "/api/onboarding",
                    { method: "GET" }
                );

                if (cancelled) return;

                if (res.onboardingCompleted) {
                    router.replace("/dashboard");
                    return;
                }

                setData((prev) => {
                    const merged: OnboardingData = {
                        ...prev,
                        ...(res.onboarding || {}),
                        business: { ...prev.business, ...(res.onboarding?.business || {}) },
                        availability: {
                            ...prev.availability,
                            ...(res.onboarding?.availability || {}),
                            days:
                                res.onboarding?.availability?.days && res.onboarding.availability.days.length
                                    ? res.onboarding.availability.days
                                    : prev.availability?.days,
                        },
                        services:
                            res.onboarding?.services && res.onboarding.services.length
                                ? res.onboarding.services
                                : prev.services,
                    };

                    if (!merged.availability?.days || !merged.availability.days.length) {
                        merged.availability = {
                            ...(merged.availability || {}),
                            days: defaultDays(),
                        };
                    }

                    if ((merged.availability as any)?.weekStartsOn !== 0 && (merged.availability as any)?.weekStartsOn !== 1) {
                        merged.availability = {
                            ...(merged.availability || {}),
                            weekStartsOn: 0,
                        };
                    }

                    if (!merged.services || !merged.services.length) {
                        merged.services = [{ id: crypto.randomUUID(), name: "", durationMinutes: 30 }];
                    }

                    if (!merged.businessTypes) {
                        merged.businessTypes = [];
                    }

                    merged.currency = normalizeCurrency((merged as any).currency);

                    return merged;
                });
            } catch (e: any) {
                if (!cancelled) setError(e?.message || "Failed to load onboarding");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [router]);

    const savePartial = async (partial: Partial<OnboardingData>) => {
        setSaving(true);
        setError(null);
        try {
            const res = await apiFetch<{ onboardingCompleted: boolean; onboarding: OnboardingData }>(
                "/api/onboarding",
                { method: "PATCH", body: JSON.stringify(partial) }
            );
            setData((prev) => ({
                ...prev,
                ...(res.onboarding || {}),
                business: { ...prev.business, ...(res.onboarding?.business || {}) },
                availability: { ...prev.availability, ...(res.onboarding?.availability || {}) },
                services: res.onboarding?.services ?? prev.services,
            }));
        } finally {
            setSaving(false);
        }
    };

    const businessDetailsMissing = React.useMemo(() => {
        const name = String(data.business?.name ?? "").trim();
        const phone = String(data.business?.phone ?? "").trim();
        const address = String(data.business?.address ?? "").trim();

        const missing: string[] = [];
        if (!name) missing.push("Name");
        if (!phone) missing.push("Phone");
        if (!address) missing.push("Address");
        return missing;
    }, [data.business?.address, data.business?.name, data.business?.phone]);

    const businessDetailsValid = businessDetailsMissing.length === 0;

    const servicesFirstError = React.useMemo(() => {
        const currency = normalizeCurrency(data.currency);
        if (!currency) return "Currency is required";
        if (currency === OTHER_CURRENCY_CODE) {
            if (!String(data.customCurrency?.name ?? "").trim()) return "Currency name is required";
            if (!String(data.customCurrency?.symbol ?? "").trim()) return "Currency symbol is required";
        }

        const services = data.services || [];
        if (services.length === 0) return "Service is required";

        const multi = services.length > 1;
        for (let i = 0; i < services.length; i++) {
            const s = services[i];
            const prefix = multi ? `Service ${i + 1} ` : "Service ";

            if (!String(s?.name ?? "").trim()) return `${prefix}name is required`;
            if (!Number.isFinite(s?.durationMinutes) || Number(s.durationMinutes) <= 0) {
                return `${prefix}duration is required`;
            }
            if (!Number.isFinite(s?.price)) return `${prefix}price is required`;
        }

        return null;
    }, [data.services]);

    const next = async () => {
        try {
            if (step === 0) {
                await savePartial({ businessTypes: data.businessTypes });
            }
            if (step === 1) {
                if (!businessDetailsValid) {
                    setError(`${businessDetailsMissing[0]} is required`);
                    return;
                }
                await savePartial({ business: data.business });
            }
            if (step === 2) {
                if (servicesFirstError) {
                    setError(servicesFirstError);
                    return;
                }
                await savePartial({
                    services: data.services,
                    currency: normalizeCurrency(data.currency),
                    customCurrency:
                        normalizeCurrency(data.currency) === OTHER_CURRENCY_CODE
                            ? {
                                name: String(data.customCurrency?.name ?? "").trim(),
                                symbol: String(data.customCurrency?.symbol ?? "").trim(),
                            }
                            : undefined,
                });
            }
            if (step === 3) {
                await savePartial({ availability: data.availability });
            }

            setStep((s) => Math.min(s + 1, totalSteps - 1));
        } catch (e: any) {
            setError(e?.message || "Failed to save");
        }
    };

    const back = () => setStep((s) => Math.max(0, s - 1));

    const complete = async () => {
        setSaving(true);
        setError(null);
        try {
            await apiFetch<{ ok: true }>("/api/onboarding/complete", { method: "POST" });
            router.replace("/dashboard");
        } catch (e: any) {
            setError(e?.message || "Failed to finish onboarding");
        } finally {
            setSaving(false);
        }
    };

    const content = () => {
        switch (step) {
            case 0:
                return (
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                Business type
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                Choose what best describes you.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Select one or more *</Label>
                            <div className="-m-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {BUSINESS_TYPE_OPTIONS.map((opt) => {
                                    const selected = (data.businessTypes || []).includes(opt.value);
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => {
                                                setData((d) => {
                                                    const current = d.businessTypes || [];
                                                    const next = current.includes(opt.value)
                                                        ? current.filter((x) => x !== opt.value)
                                                        : [...current, opt.value];
                                                    return { ...d, businessTypes: next };
                                                });
                                            }}
                                            className={
                                                "m-1 text-left rounded-xl border p-4 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-950 " +
                                                (selected
                                                    ? "border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/30 shadow-sm"
                                                    : "border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-950/30 hover:border-indigo-300 dark:hover:border-indigo-700")
                                            }
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="font-medium text-gray-900 dark:text-white">
                                                        {opt.label}
                                                    </div>
                                                    <div className="text-sm text-gray-600 dark:text-gray-300">
                                                        {opt.description}
                                                    </div>
                                                </div>
                                                <div
                                                    className={
                                                        "h-5 w-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 " +
                                                        (selected
                                                            ? "border-indigo-500 bg-indigo-500 text-white"
                                                            : "border-gray-300 dark:border-gray-700")
                                                    }
                                                    aria-hidden="true"
                                                >
                                                    {selected ? <Check className="h-3.5 w-3.5" /> : null}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );

            case 1:
                return (
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                Business details
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                Basic info your clients will see.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Name *</Label>
                                <Input
                                    value={data.business?.name || ""}
                                    onChange={(e) =>
                                        setData((d) => ({
                                            ...d,
                                            business: { ...(d.business || {}), name: e.target.value },
                                        }))
                                    }
                                    placeholder="Acme Studio"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Phone *</Label>
                                <Input
                                    value={data.business?.phone || ""}
                                    onChange={(e) =>
                                        setData((d) => ({
                                            ...d,
                                            business: { ...(d.business || {}), phone: e.target.value },
                                        }))
                                    }
                                    placeholder="+1 (555) 123-4567"
                                />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <Label>Address *</Label>
                                <Input
                                    value={data.business?.address || ""}
                                    onChange={(e) =>
                                        setData((d) => ({
                                            ...d,
                                            business: { ...(d.business || {}), address: e.target.value },
                                        }))
                                    }
                                    placeholder="123 Main St, City"
                                />
                            </div>
                        </div>

                    </div>
                );

            case 2:
                return (
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                Services
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                Add at least one service.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Currency *</Label>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                <div className="sm:flex-1">
                                    <Select
                                        value={normalizeCurrency(data.currency)}
                                        onValueChange={(v) =>
                                            setData((d) => {
                                                const code = normalizeCurrency(v);
                                                return {
                                                    ...d,
                                                    currency: code,
                                                    customCurrency:
                                                        code === OTHER_CURRENCY_CODE
                                                            ? {
                                                                name: d.customCurrency?.name ?? "",
                                                                symbol: d.customCurrency?.symbol ?? "",
                                                            }
                                                            : undefined,
                                                };
                                            })
                                        }
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select currency" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CURRENCIES.map((c) => (
                                                <SelectItem key={c.code} value={c.code}>
                                                    {c.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {normalizeCurrency(data.currency) === OTHER_CURRENCY_CODE ? (
                                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end sm:ml-auto">
                                        <div className="space-y-2 sm:w-48">
                                            <Label>Currency name *</Label>
                                            <Input
                                                value={String(data.customCurrency?.name ?? "")}
                                                onChange={(e) =>
                                                    setData((d) => ({
                                                        ...d,
                                                        customCurrency: {
                                                            ...(d.customCurrency || {}),
                                                            name: e.target.value,
                                                        },
                                                    }))
                                                }
                                                placeholder="e.g. Shekel"
                                            />
                                        </div>
                                        <div className="space-y-2 sm:w-28">
                                            <Label>Symbol *</Label>
                                            <Input
                                                value={String(data.customCurrency?.symbol ?? "")}
                                                onChange={(e) =>
                                                    setData((d) => ({
                                                        ...d,
                                                        customCurrency: {
                                                            ...(d.customCurrency || {}),
                                                            symbol: e.target.value,
                                                        },
                                                    }))
                                                }
                                                placeholder="e.g. ₪"
                                            />
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div className="space-y-4">
                            {(data.services || []).map((s) => (
                                <div key={s.id} className="grid grid-cols-1 sm:grid-cols-[1fr_140px_140px_44px] gap-3">
                                    <div className="space-y-2">
                                        <Label>Service name *</Label>
                                        <Input
                                            value={s.name}
                                            onChange={(e) =>
                                                setData((d) => ({
                                                    ...d,
                                                    services: (d.services || []).map((x) =>
                                                        x.id === s.id ? { ...x, name: e.target.value } : x
                                                    ),
                                                }))
                                            }
                                            placeholder="Consultation"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Duration (min) *</Label>
                                        <Input
                                            type="number"
                                            min={5}
                                            value={s.durationMinutes}
                                            onChange={(e) =>
                                                setData((d) => ({
                                                    ...d,
                                                    services: (d.services || []).map((x) =>
                                                        x.id === s.id
                                                            ? { ...x, durationMinutes: Number(e.target.value || 0) }
                                                            : x
                                                    ),
                                                }))
                                            }
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Price *</Label>
                                        <div className="relative">
                                            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-600 dark:text-gray-300">
                                                {effectiveCurrencySymbol(data)}
                                            </div>
                                            <Input
                                                className="pl-10"
                                                type="number"
                                                min={0}
                                                value={typeof s.price === "number" ? s.price : ""}
                                                onChange={(e) =>
                                                    setData((d) => ({
                                                        ...d,
                                                        services: (d.services || []).map((x) =>
                                                            x.id === s.id
                                                                ? { ...x, price: e.target.value === "" ? undefined : Number(e.target.value) }
                                                                : x
                                                        ),
                                                    }))
                                                }
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-end justify-end sm:pb-0.5">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            disabled={(data.services || []).length <= 1}
                                            aria-label="Remove service"
                                            onClick={() =>
                                                setData((d) => ({
                                                    ...d,
                                                    services: (d.services || []).filter((x) => x.id !== s.id),
                                                }))
                                            }
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            <div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        setData((d) => ({
                                            ...d,
                                            services: [
                                                ...(d.services || []),
                                                { id: crypto.randomUUID(), name: "", durationMinutes: 30 },
                                            ],
                                        }))
                                    }
                                >
                                    Add service
                                </Button>
                            </div>
                        </div>
                    </div>
                );

            case 3:
                return (
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                Availability
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                Set your weekly hours.
                            </p>
                        </div>

                        <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-950/30 px-3 py-3">
                            <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                    Week starts on
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-300">
                                    {(data.availability?.weekStartsOn ?? 0) === 1 ? "Monday" : "Sunday"}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-600 dark:text-gray-300 select-none">Sun</span>
                                <UISwitch
                                    checked={(data.availability?.weekStartsOn ?? 0) === 1}
                                    onCheckedChange={(checked) =>
                                        setData((prev) => ({
                                            ...prev,
                                            availability: {
                                                ...(prev.availability || {}),
                                                weekStartsOn: checked ? 1 : 0,
                                            },
                                        }))
                                    }
                                    aria-label="Toggle week start between Sunday and Monday"
                                />
                                <span className="text-xs text-gray-600 dark:text-gray-300 select-none">Mon</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {(() => {
                                const weekStartsOn = (data.availability?.weekStartsOn ?? 0) === 1 ? 1 : 0;
                                const days = data.availability?.days || [];
                                const byDay = new Map(days.map((d) => [d.day, d] as const));
                                const ordered = Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7)
                                    .map((day) => byDay.get(day))
                                    .filter(Boolean) as Array<{ day: number; enabled: boolean; start?: string; end?: string }>;

                                return ordered.map((d) => (
                                    <div
                                        key={d.day}
                                        className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
                                    >
                                        <div className="flex items-center gap-2">
                                            <UISwitch
                                                checked={d.enabled}
                                                onCheckedChange={(checked) =>
                                                    setData((prev) => ({
                                                        ...prev,
                                                        availability: {
                                                            ...(prev.availability || {}),
                                                            days: (prev.availability?.days || []).map((x) =>
                                                                x.day === d.day ? { ...x, enabled: checked } : x
                                                            ),
                                                        },
                                                    }))
                                                }
                                                aria-label={`Toggle ${DAY_LABELS[d.day]}`}
                                            />
                                            <span className="text-sm font-medium text-gray-900 dark:text-white select-none">
                                                {DAY_LABELS[d.day]}
                                            </span>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-xs">Start</Label>
                                            <Input
                                                type="time"
                                                disabled={!d.enabled}
                                                value={d.start || ""}
                                                onChange={(e) =>
                                                    setData((prev) => ({
                                                        ...prev,
                                                        availability: {
                                                            ...(prev.availability || {}),
                                                            days: (prev.availability?.days || []).map((x) =>
                                                                x.day === d.day ? { ...x, start: e.target.value } : x
                                                            ),
                                                        },
                                                    }))
                                                }
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-xs">End</Label>
                                            <Input
                                                type="time"
                                                disabled={!d.enabled}
                                                value={d.end || ""}
                                                onChange={(e) =>
                                                    setData((prev) => ({
                                                        ...prev,
                                                        availability: {
                                                            ...(prev.availability || {}),
                                                            days: (prev.availability?.days || []).map((x) =>
                                                                x.day === d.day ? { ...x, end: e.target.value } : x
                                                            ),
                                                        },
                                                    }))
                                                }
                                            />
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>
                );

            case 4:
                return (
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                Finish
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                Review and complete onboarding.
                            </p>
                        </div>

                        <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-5">
                            <div className="space-y-2">
                                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                    Business type
                                </div>
                                <div className="text-sm text-gray-700 dark:text-gray-200">
                                    {data.businessTypes && data.businessTypes.length > 0
                                        ? data.businessTypes
                                            .map(
                                                (v) =>
                                                    BUSINESS_TYPE_OPTIONS.find((o) => o.value === v)
                                                        ?.label ?? v
                                            )
                                            .join(", ")
                                        : "—"}
                                </div>
                            </div>

                            <div className="h-px bg-gray-200 dark:bg-gray-800" />

                            <div className="space-y-2">
                                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                    Business details
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-200">
                                    <div>
                                        <span className="font-medium">Name:</span> {data.business?.name || "—"}
                                    </div>
                                    <div>
                                        <span className="font-medium">Phone:</span> {data.business?.phone || "—"}
                                    </div>
                                    <div className="sm:col-span-2">
                                        <span className="font-medium">Address:</span> {data.business?.address || "—"}
                                    </div>
                                </div>
                            </div>

                            <div className="h-px bg-gray-200 dark:bg-gray-800" />

                            <div className="space-y-2">
                                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                    Services
                                </div>

                                <div className="text-sm text-gray-700 dark:text-gray-200">
                                    <span className="font-medium">Currency:</span> {currencyLabel(data)}
                                </div>

                                <div className="space-y-2">
                                    {(data.services || []).length ? (
                                        (data.services || []).map((s, idx) => (
                                            <div
                                                key={s.id || idx}
                                                className="rounded-md border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-950/20 px-3 py-2"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                            {String(s.name || "").trim() || "—"}
                                                        </div>
                                                        <div className="text-xs text-gray-600 dark:text-gray-300">
                                                            Duration: {Number.isFinite(s.durationMinutes) ? s.durationMinutes : "—"} min
                                                        </div>
                                                    </div>
                                                    <div className="text-sm font-semibold text-gray-900 dark:text-white shrink-0">
                                                        {Number.isFinite(s.price)
                                                            ? `${effectiveCurrencySymbol(data)}${s.price}`
                                                            : "—"}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-sm text-gray-700 dark:text-gray-200">—</div>
                                    )}
                                </div>
                            </div>

                            <div className="h-px bg-gray-200 dark:bg-gray-800" />

                            <div className="space-y-2">
                                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                    Availability
                                </div>
                                <div className="text-sm text-gray-700 dark:text-gray-200">
                                    <span className="font-medium">Week starts:</span>{" "}
                                    {(data.availability?.weekStartsOn ?? 0) === 1 ? "Monday" : "Sunday"}
                                </div>

                                <div className="space-y-2">
                                    {(() => {
                                        const weekStartsOn = (data.availability?.weekStartsOn ?? 0) === 1 ? 1 : 0;
                                        const days = data.availability?.days || [];
                                        const byDay = new Map(days.map((d) => [d.day, d] as const));
                                        const ordered = Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7)
                                            .map((day) => byDay.get(day))
                                            .filter(Boolean) as Array<{ day: number; enabled: boolean; start?: string; end?: string }>;

                                        return ordered.map((d) => (
                                            <div
                                                key={d.day}
                                                className="flex items-center justify-between gap-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-950/20 px-3 py-2"
                                            >
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {DAY_LABELS[d.day]}
                                                </div>
                                                <div className="text-sm text-gray-700 dark:text-gray-200">
                                                    {d.enabled
                                                        ? `${d.start || "—"} – ${d.end || "—"}`
                                                        : "Closed"}
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    const card = (
        <Card className="relative w-full border-0 overflow-hidden shadow-2xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-600 to-indigo-600" />
            <CardHeader className="space-y-2">
                <CardTitle className="text-2xl">Onboarding</CardTitle>
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                        <span>
                            Step {step + 1} of {totalSteps}
                        </span>
                        <span>{progress}%</span>
                    </div>
                    <Progress value={progress} />
                </div>
            </CardHeader>

            <CardContent className="space-y-6">
                <AuthBanner banner={error ? { type: "error", text: error } : null} />

                <motion.div layout className="relative overflow-hidden">
                    <AnimatePresence mode="wait" initial={false}>
                        {loading ? (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.18, ease: "easeOut" }}
                            >
                                <div className="py-10 text-center text-sm text-gray-600 dark:text-gray-300">
                                    Loading onboarding…
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key={`step-${step}`}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.22, ease: "easeOut" }}
                            >
                                {content()}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                <div className="flex items-center justify-between pt-2">
                    {step > 0 ? (
                        <Button type="button" variant="ghost" onClick={back} disabled={saving}>
                            Back
                        </Button>
                    ) : (
                        <div />
                    )}

                    {step < totalSteps - 1 ? (
                        <Button
                            type="button"
                            onClick={next}
                            disabled={
                                saving ||
                                loading ||
                                (step === 0 && (data.businessTypes || []).length === 0)
                            }
                        >
                            {saving ? "Saving…" : "Next"}
                        </Button>
                    ) : (
                        <Button type="button" onClick={complete} disabled={saving || loading}>
                            {saving ? "Finishing…" : "Finish"}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );

    return card;
}
