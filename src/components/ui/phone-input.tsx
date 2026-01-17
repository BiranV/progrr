"use client";

import * as React from "react";
import PhoneInputBase, {
    Country,
    getCountries,
    getCountryCallingCode,
    isValidPhoneNumber,
    parsePhoneNumber,
} from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import labelsEn from "react-phone-number-input/locale/en";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronDown } from "lucide-react";

export type PhoneInputDetails = {
    e164: string;
    country?: Country;
    countryCallingCode?: string;
    nationalNumber?: string;
    type?: string;
};

function detectDefaultCountry(fallback: Country = "IL"): Country {
    if (typeof navigator === "undefined") return fallback;

    const locale =
        (Array.isArray((navigator as any).languages)
            ? (navigator as any).languages[0]
            : navigator.language) ?? "";

    const raw = String(locale).trim();
    const match = raw.match(/-([A-Za-z]{2})\b/);
    const region = match?.[1]?.toUpperCase();
    if (!region) return fallback;

    const supported = getCountries();
    if (supported.includes(region as Country)) return region as Country;
    return fallback;
}

function isValidMobileE164(value: string): boolean {
    try {
        const phone = parsePhoneNumber(value);
        if (!phone) return false;
        const t = (phone as any).getType?.() as string | undefined;
        return t === "MOBILE" || t === "FIXED_LINE_OR_MOBILE";
    } catch {
        return false;
    }
}

type CountrySelectProps = {
    value?: Country;
    onChange: (value?: Country) => void;
    options: Array<{ value: Country; label: string }>;
    labels?: Record<string, string>;
    disabled?: boolean;
};

function CountrySelect({
    value,
    onChange,
    options,
    labels,
    disabled,
}: CountrySelectProps) {
    const safeLabels = labels ?? {};
    const [open, setOpen] = React.useState(false);
    const [q, setQ] = React.useState("");
    const [activeIndex, setActiveIndex] = React.useState(0);
    const searchRef = React.useRef<HTMLInputElement | null>(null);

    const items = React.useMemo(() => {
        const query = q.trim().toLowerCase();
        const normalized = options.map((o) => {
            const country = (o as any)?.value as Country | undefined;
            const label = String((o as any)?.label ?? "");

            // react-phone-number-input can include a special "International" option
            // where country/value is undefined.
            const name = (country ? safeLabels[country] : undefined) || label;
            const calling = country ? `+${getCountryCallingCode(country)}` : "+";

            return { ...o, value: country as any, label, name, calling };
        });

        if (!query) return normalized;

        return normalized.filter((o) => {
            return (
                String(o.value ?? "").toLowerCase().includes(query) ||
                o.name.toLowerCase().includes(query) ||
                o.calling.replace("+", "").includes(query.replace("+", ""))
            );
        });
    }, [options, q, safeLabels]);

    React.useEffect(() => {
        if (!open) return;
        setQ("");
        setActiveIndex(0);
        window.setTimeout(() => searchRef.current?.focus(), 0);
    }, [open]);

    const selected = React.useMemo(() => {
        if (!value) return undefined;
        const label = safeLabels[value] ?? value;
        return {
            value,
            label,
            calling: `+${getCountryCallingCode(value)}`,
        };
    }, [safeLabels, value]);

    const Flag = value ? (flags as any)[value] : null;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className="h-9 px-2 gap-2"
                    aria-label="Select country"
                >
                    {Flag ? <Flag className="h-4 w-5 rounded-sm" /> : null}
                    <span className="text-sm tabular-nums">
                        {selected?.calling ?? "+"}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-2 w-[340px]" align="start">
                <div className="space-y-2">
                    <Input
                        ref={searchRef}
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search country"
                        aria-label="Search country"
                    />

                    <div
                        className="max-h-72 overflow-auto rounded-md border"
                        role="listbox"
                        aria-label="Countries"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === "ArrowDown") {
                                e.preventDefault();
                                setActiveIndex((i) => Math.min(i + 1, items.length - 1));
                            }
                            if (e.key === "ArrowUp") {
                                e.preventDefault();
                                setActiveIndex((i) => Math.max(i - 1, 0));
                            }
                            if (e.key === "Enter") {
                                e.preventDefault();
                                const item = items[activeIndex];
                                if (!item) return;
                                onChange(item.value);
                                setOpen(false);
                            }
                        }}
                    >
                        {items.map((o, idx) => {
                            const isSelected = o.value === value;
                            const FlagItem = (flags as any)[o.value];
                            const isActive = idx === activeIndex;

                            return (
                                <button
                                    key={o.value}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    className={cn(
                                        "w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm",
                                        "hover:bg-accent hover:text-accent-foreground",
                                        isActive ? "bg-accent text-accent-foreground" : "",
                                        isSelected ? "font-medium" : ""
                                    )}
                                    onMouseEnter={() => setActiveIndex(idx)}
                                    onClick={() => {
                                        onChange(o.value);
                                        setOpen(false);
                                    }}
                                >
                                    <span className="flex items-center gap-2 min-w-0">
                                        {FlagItem ? <FlagItem className="h-4 w-5 rounded-sm" /> : null}
                                        <span className="truncate">{o.name}</span>
                                    </span>
                                    <span className="flex items-center gap-2 shrink-0">
                                        <span className="text-muted-foreground tabular-nums">
                                            {o.calling}
                                        </span>
                                        {isSelected ? <Check className="h-4 w-4" /> : null}
                                    </span>
                                </button>
                            );
                        })}

                        {!items.length ? (
                            <div className="p-3 text-sm text-muted-foreground">
                                No countries found.
                            </div>
                        ) : null}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

export type PhoneInputProps = {
    id?: string;
    name?: string;
    value: string;
    onChange: (value: string) => void;
    onChangeDetails?: (details: PhoneInputDetails | null) => void;
    onValidityChange?: (isValid: boolean) => void;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    requireMobile?: boolean;
    defaultCountry?: Country;
    className?: string;
    inputClassName?: string;
    onBlur?: React.FocusEventHandler<HTMLInputElement>;
    onFocus?: React.FocusEventHandler<HTMLInputElement>;
    "aria-invalid"?: boolean;
};

export function PhoneInput({
    id,
    name,
    value,
    onChange,
    onChangeDetails,
    onValidityChange,
    placeholder,
    required,
    disabled,
    requireMobile,
    defaultCountry,
    className,
    inputClassName,
    onBlur,
    onFocus,
    "aria-invalid": ariaInvalid,
}: PhoneInputProps) {
    const detectedDefault = React.useMemo<Country>(() => {
        return defaultCountry ?? detectDefaultCountry("IL");
    }, [defaultCountry]);

    const currentE164 = value?.trim() || undefined;

    const valid = React.useMemo(() => {
        if (!currentE164) return !required;
        if (!isValidPhoneNumber(currentE164)) return false;
        if (requireMobile) return isValidMobileE164(currentE164);
        return true;
    }, [currentE164, requireMobile, required]);

    React.useEffect(() => {
        onValidityChange?.(valid);
    }, [onValidityChange, valid]);

    React.useEffect(() => {
        if (!currentE164) {
            onChangeDetails?.(null);
            return;
        }

        try {
            const p = parsePhoneNumber(currentE164);
            if (!p) {
                onChangeDetails?.(null);
                return;
            }

            onChangeDetails?.({
                e164: p.number,
                country: p.country as any,
                countryCallingCode: (p as any).countryCallingCode,
                nationalNumber: (p as any).nationalNumber,
                type: (p as any).getType?.(),
            });
        } catch {
            onChangeDetails?.(null);
        }
    }, [currentE164, onChangeDetails]);

    return (
        <PhoneInputBase
            international
            defaultCountry={detectedDefault}
            value={currentE164 as any}
            onChange={(v) => onChange(String(v ?? ""))}
            disabled={disabled}
            countrySelectComponent={CountrySelect as any}
            labels={labelsEn as any}
            inputComponent={Input as any}
            className={cn("flex items-center gap-2 w-full", className)}
            numberInputProps={{
                id,
                name,
                placeholder,
                required,
                disabled,
                onBlur,
                onFocus,
                className: cn("flex-1", inputClassName),
                "aria-invalid": ariaInvalid ? true : undefined,
            }}
        />
    );
}
