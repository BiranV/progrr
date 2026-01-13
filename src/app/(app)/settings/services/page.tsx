"use client";

import React from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CenteredSpinner } from "@/components/CenteredSpinner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { useBusiness } from "@/hooks/useBusiness";
import { ONBOARDING_QUERY_KEY, useOnboardingSettings } from "@/hooks/useOnboardingSettings";

type Service = {
    id: string;
    name: string;
    durationMinutes: number;
    price: number;
    description: string;
    isActive: boolean;
};

const CURRENCIES: Array<{ code: string; symbol: string; label: string }> = [
    { code: "ILS", symbol: "₪", label: "ILS (₪)" },
    { code: "USD", symbol: "$", label: "USD ($)" },
    { code: "EUR", symbol: "€", label: "EUR (€)" },
    { code: "GBP", symbol: "£", label: "GBP (£)" },
    { code: "AUD", symbol: "$", label: "AUD ($)" },
    { code: "CAD", symbol: "$", label: "CAD ($)" },
    { code: "CHF", symbol: "CHF", label: "CHF" },
];

const ALLOWED_CURRENCY_CODES = new Set(CURRENCIES.map((c) => c.code).concat(["NIS"]));

function normalizeCurrency(v: unknown): string {
    const code = String(v ?? "")
        .trim()
        .toUpperCase();
    if (!ALLOWED_CURRENCY_CODES.has(code)) return "ILS";
    if (code === "NIS") return "ILS";
    return code;
}

function currencySymbol(code: string): string {
    const normalized = normalizeCurrency(code);
    return CURRENCIES.find((c) => c.code === normalized)?.symbol ?? "₪";
}

function newId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function asNumber(v: unknown): number | null {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return null;
    return n;
}

function normalizeServices(raw: unknown): Service[] {
    if (!Array.isArray(raw)) return [];

    return raw.map((s: any) => {
        const id = typeof s?.id === "string" && s.id.trim() ? s.id.trim() : newId();
        const name = typeof s?.name === "string" ? s.name : "";
        const duration = asNumber(s?.durationMinutes);
        const price = asNumber(s?.price);
        const description = typeof s?.description === "string" ? s.description : "";
        const isActive = typeof s?.isActive === "boolean" ? s.isActive : true;

        return {
            id,
            name,
            durationMinutes: duration && duration > 0 ? Math.round(duration) : 30,
            price: price !== null && price >= 0 ? price : 0,
            description,
            isActive,
        };
    });
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
        throw new Error(message);
    }

    return (await res.json()) as T;
}

export default function ServicesSettingsPage() {
    const [isSaving, setIsSaving] = React.useState(false);
    const queryClient = useQueryClient();

    const {
        data: business,
        isPending: isPendingBusiness,
        dataUpdatedAt: businessUpdatedAt,
        refetch: refetchBusiness,
        isError: isBusinessError,
        error: businessError,
    } = useBusiness();

    const {
        data: onboardingRes,
        isPending: isPendingOnboarding,
        dataUpdatedAt: onboardingUpdatedAt,
        refetch: refetchOnboarding,
        isError: isOnboardingError,
        error: onboardingError,
    } = useOnboardingSettings();

    const [services, setServices] = React.useState<Service[]>([]);
    const initialRef = React.useRef<string | null>(null);
    const initialCurrencyRef = React.useRef<string>("ILS");

    const [currencyCode, setCurrencyCode] = React.useState<string>("ILS");

    const [globalError, setGlobalError] = React.useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

    const stableStringifyServices = React.useCallback((list: Service[]) => {
        return (list || []).map((s) => ({
            id: String(s.id ?? ""),
            name: String(s.name ?? "").trim(),
            durationMinutes: Number(s.durationMinutes),
            price: Number(s.price),
            description: String(s.description ?? "").trim(),
            isActive: Boolean(s.isActive),
        }));
    }, []);

    const stableStringifyState = React.useCallback(
        (list: Service[], currency: string) => {
            return JSON.stringify({
                currency: normalizeCurrency(currency),
                services: stableStringifyServices(list),
            });
        },
        [stableStringifyServices]
    );

    const isFirstLoad =
        (!initialRef.current && (isPendingBusiness || isPendingOnboarding) && !business && !onboardingRes);

    const isDirty = React.useMemo(() => {
        if (!initialRef.current) return false;
        return stableStringifyState(services, currencyCode) !== initialRef.current;
    }, [services, currencyCode, stableStringifyState]);

    React.useEffect(() => {
        if (isBusinessError) {
            toast.error((businessError as any)?.message || "Failed to load business");
        }
    }, [isBusinessError, businessError]);

    React.useEffect(() => {
        if (isOnboardingError) {
            toast.error((onboardingError as any)?.message || "Failed to load services");
        }
    }, [isOnboardingError, onboardingError]);

    React.useEffect(() => {
        if (!onboardingRes) return;

        const nextServices = normalizeServices((onboardingRes as any)?.onboarding?.services);

        // First hydrate, and background refresh only when user isn't editing.
        const nextCurrency = normalizeCurrency((business as any)?.currency ?? "ILS");
        if (!initialRef.current) {
            setServices(nextServices);
            initialCurrencyRef.current = nextCurrency;
            setCurrencyCode(nextCurrency);
            initialRef.current = stableStringifyState(nextServices, nextCurrency);
            return;
        }

        if (!isDirty && !isSaving) {
            setServices(nextServices);
            initialCurrencyRef.current = nextCurrency;
            setCurrencyCode(nextCurrency);
            initialRef.current = stableStringifyState(nextServices, nextCurrency);
        }
    }, [onboardingRes, business, isDirty, isSaving, stableStringifyState]);

    React.useEffect(() => {
        if (!business) return;
        if (Date.now() - businessUpdatedAt < 2 * 60 * 1000) return;
        refetchBusiness();
    }, [business, businessUpdatedAt, refetchBusiness]);

    React.useEffect(() => {
        if (!onboardingRes) return;
        if (Date.now() - onboardingUpdatedAt < 2 * 60 * 1000) return;
        refetchOnboarding();
    }, [onboardingRes, onboardingUpdatedAt, refetchOnboarding]);

    const activeServices = React.useMemo(() => services.filter((s) => s.isActive !== false), [services]);
    const inactiveServices = React.useMemo(() => services.filter((s) => s.isActive === false), [services]);

    const hasAnyActiveService = activeServices.length > 0;
    const currencyChanged =
        normalizeCurrency(currencyCode) !== normalizeCurrency(initialCurrencyRef.current);

    const persistServices = async (nextServices: Service[]) => {
        const payload = {
            services: nextServices.map((s) => ({
                id: s.id,
                name: String(s.name ?? "").trim(),
                durationMinutes: Number(s.durationMinutes),
                price: Number(s.price),
                description: String(s.description ?? "").trim(),
                isActive: Boolean(s.isActive),
            })),
        };

        await apiFetch("/api/onboarding", {
            method: "PATCH",
            body: JSON.stringify(payload),
        });
    };

    const persistCurrency = async (nextCurrency: string) => {
        await apiFetch("/api/business", {
            method: "PATCH",
            body: JSON.stringify({ currency: normalizeCurrency(nextCurrency) }),
        });
    };

    const validateAll = (nextServices: Service[]) => {
        const nextFieldErrors: Record<string, string> = {};
        const nextActive = nextServices.filter((s) => s.isActive !== false);

        if (nextActive.length === 0) {
            setGlobalError("At least one service is required");
            setFieldErrors({});
            return false;
        }

        for (const s of nextActive) {
            const name = String(s.name ?? "").trim();
            if (!name) nextFieldErrors[`serviceName_${s.id}`] = "Service name is required";

            const duration = Number(s.durationMinutes);
            if (!Number.isFinite(duration) || duration <= 0)
                nextFieldErrors[`serviceDuration_${s.id}`] = "Duration must be greater than 0";

            const price = Number(s.price);
            if (!Number.isFinite(price) || price < 0)
                nextFieldErrors[`servicePrice_${s.id}`] = "Price must be 0 or more";
        }

        setGlobalError(null);
        setFieldErrors(nextFieldErrors);
        return Object.keys(nextFieldErrors).length === 0;
    };

    const updateService = (id: string, patch: Partial<Service>) => {
        setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
        setGlobalError(null);
    };

    const addService = () => {
        setServices((prev) => [
            ...prev,
            {
                id: newId(),
                name: "",
                durationMinutes: 30,
                price: 0,
                description: "",
                isActive: true,
            },
        ]);
        setGlobalError(null);
    };

    const deactivateService = (id: string) => {
        updateService(id, { isActive: false });
    };

    const restoreService = (id: string) => {
        updateService(id, { isActive: true });
    };

    const deleteServicePermanently = (id: string) => {
        setServices((prev) => prev.filter((s) => s.id !== id));
        setGlobalError(null);
        setFieldErrors((prev) => {
            const next: Record<string, string> = {};
            for (const [k, v] of Object.entries(prev)) {
                if (!k.endsWith(`_${id}`)) next[k] = v;
            }
            return next;
        });
    };

    const onSave = async () => {
        const next = [...services];
        if (!validateAll(next)) return;

        setIsSaving(true);
        try {
            if (currencyChanged) {
                await persistCurrency(currencyCode);
            }
            await persistServices(next);

            setServices(next);
            initialCurrencyRef.current = normalizeCurrency(currencyCode);
            initialRef.current = stableStringifyState(next, currencyCode);

            // Keep React Query caches in sync so other settings pages render instantly.
            queryClient.setQueryData(["business"], (prev: any) => ({
                ...(prev || {}),
                currency: normalizeCurrency(currencyCode),
            }));
            queryClient.setQueryData(ONBOARDING_QUERY_KEY, (prev: any) => ({
                ...(prev || {}),
                onboarding: {
                    ...((prev as any)?.onboarding || {}),
                    services: next.map((s) => ({
                        id: s.id,
                        name: String(s.name ?? "").trim(),
                        durationMinutes: Number(s.durationMinutes),
                        price: Number(s.price),
                        description: String(s.description ?? "").trim(),
                        isActive: Boolean(s.isActive),
                    })),
                },
            }));

            toast.success("Changes saved");
        } catch (e: any) {
            toast.error(e?.message || "Failed to save changes");
        } finally {
            setIsSaving(false);
        }
    };

    if (isFirstLoad) {
        return <CenteredSpinner fullPage />;
    }

    return (
        <div className="w-full max-w-md mx-auto space-y-4">
            <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Services
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    Manage your services, duration and pricing.
                </p>
            </div>

            {globalError ? (
                <div className="text-sm text-rose-600 dark:text-rose-400">
                    {globalError}
                </div>
            ) : null}

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select
                        value={normalizeCurrency(currencyCode)}
                        onValueChange={(v) => {
                            setCurrencyCode(v);
                        }}
                        disabled={isFirstLoad || isSaving}
                    >
                        <SelectTrigger>
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
                    <div className="text-xs text-gray-600 dark:text-gray-300">
                        Prices are displayed in this currency. Changing currency will not convert existing
                        numeric prices.
                    </div>
                </div>

                {currencyChanged && hasAnyActiveService ? (
                    <div className="text-sm text-amber-700 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2">
                        Changing currency will not convert existing service prices (numbers stay the
                        same, symbol changes only).
                    </div>
                ) : null}

                <div className="flex items-center gap-2 px-1">
                    <Label className="flex-1">Service name *</Label>
                    <Label className="w-[70px] shrink-0 text-center">Time</Label>
                    <Label className="w-[70px] shrink-0 text-center">
                        Price ({currencySymbol(currencyCode)})
                    </Label>
                    <div className="w-8 shrink-0"></div>
                </div>

                <div className="space-y-3">
                    {activeServices.length === 0 ? (
                        <div className="text-sm text-gray-600 dark:text-gray-300 px-1">
                            No active services.
                        </div>
                    ) : null}

                    {activeServices.map((s) => (
                        <div key={s.id}>
                            <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <Input
                                        className={
                                            fieldErrors[`serviceName_${s.id}`]
                                                ? "border-rose-500 focus-visible:ring-rose-500"
                                                : ""
                                        }
                                        value={s.name}
                                        onChange={(e) => {
                                            const nextName = e.target.value;
                                            setServices((prev) =>
                                                prev.map((x) =>
                                                    x.id === s.id ? { ...x, name: nextName } : x
                                                )
                                            );
                                            setGlobalError(null);
                                        }}
                                        placeholder="Service"
                                        disabled={isSaving}
                                    />
                                </div>

                                <div className="w-[70px] shrink-0">
                                    <Input
                                        type="number"
                                        min={5}
                                        className={`px-2 text-center ${fieldErrors[`serviceDuration_${s.id}`]
                                            ? "border-rose-500 focus-visible:ring-rose-500"
                                            : ""
                                            }`}
                                        value={s.durationMinutes}
                                        onChange={(e) => {
                                            const nextDuration = Number(e.target.value || 0);
                                            setServices((prev) =>
                                                prev.map((x) =>
                                                    x.id === s.id
                                                        ? { ...x, durationMinutes: nextDuration }
                                                        : x
                                                )
                                            );
                                            setGlobalError(null);
                                        }}
                                        disabled={isSaving}
                                    />
                                </div>

                                <div className="w-[70px] shrink-0">
                                    <Input
                                        className={`px-2 text-center ${fieldErrors[`servicePrice_${s.id}`]
                                            ? "border-rose-500 focus-visible:ring-rose-500"
                                            : ""
                                            }`}
                                        type="number"
                                        min={0}
                                        value={typeof s.price === "number" ? s.price : ""}
                                        onChange={(e) => {
                                            const nextPrice = e.target.value === "" ? 0 : Number(e.target.value);
                                            setServices((prev) =>
                                                prev.map((x) =>
                                                    x.id === s.id ? { ...x, price: nextPrice } : x
                                                )
                                            );
                                            setGlobalError(null);
                                        }}
                                        placeholder={currencySymbol(currencyCode)}
                                        disabled={isSaving}
                                    />
                                </div>

                                <div className="w-8 shrink-0 flex pt-1 justify-center">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="h-8 w-8 text-gray-400"
                                        disabled={isSaving || activeServices.length <= 1}
                                        aria-label="Remove service"
                                        onClick={() => deactivateService(s.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {(fieldErrors[`serviceName_${s.id}`] ||
                                fieldErrors[`serviceDuration_${s.id}`] ||
                                fieldErrors[`servicePrice_${s.id}`]) && (
                                    <div className="text-xs text-rose-500 mt-1 px-1">
                                        {fieldErrors[`serviceName_${s.id}`] ||
                                            fieldErrors[`serviceDuration_${s.id}`] ||
                                            fieldErrors[`servicePrice_${s.id}`]}
                                    </div>
                                )}
                        </div>
                    ))}
                </div>

                <div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={addService}
                        disabled={isFirstLoad || isSaving}
                    >
                        Add service
                    </Button>
                </div>

                {inactiveServices.length ? (
                    <div className="space-y-2">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            Inactive services
                        </div>
                        <div className="space-y-2">
                            {inactiveServices.map((s) => (
                                <div
                                    key={s.id}
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
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => restoreService(s.id)}
                                                disabled={isSaving}
                                            >
                                                Restore
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => deleteServicePermanently(s.id)}
                                                disabled={isSaving}
                                                aria-label="Delete service permanently"
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                <div className="pt-2">
                    <Button
                        type="button"
                        className="w-full"
                        onClick={onSave}
                        disabled={!isDirty || isFirstLoad || isSaving || !initialRef.current}
                    >
                        {isSaving ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            "Save changes"
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
