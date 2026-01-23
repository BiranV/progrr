"use client";

import React from "react";
import { getCookie, setCookie } from "@/lib/client-cookies";

export type Language = "he" | "en";

type LocaleContextValue = {
    language: Language;
    locale: "he-IL" | "en-US";
    dir: "rtl" | "ltr";
    updateUserLanguage: (lang: Language) => void;
};

const DEFAULT_LANGUAGE: Language = "en";
const LOCALE_COOKIE = "progrr_lang";
const LOCALE_STORAGE = "languageCode";

const LANG_META: Record<Language, { locale: "he-IL" | "en-US"; dir: "rtl" | "ltr" }> = {
    he: { locale: "he-IL", dir: "rtl" },
    en: { locale: "en-US", dir: "ltr" },
};

function resolveLanguage(raw?: string | null): Language {
    return raw === "he" || raw === "en" ? raw : DEFAULT_LANGUAGE;
}

function detectBrowserLanguage(): Language {
    if (typeof navigator === "undefined") return DEFAULT_LANGUAGE;
    const raw = String(navigator.language || "").toLowerCase();
    return raw.startsWith("he") ? "he" : "en";
}

function getInitialLanguage(): Language {
    const cookieRaw = getCookie(LOCALE_COOKIE);
    if (cookieRaw) return resolveLanguage(cookieRaw);
    return DEFAULT_LANGUAGE;
}

const LocaleContext = React.createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = React.useState<Language>(() =>
        getInitialLanguage()
    );

    const updateUserLanguage = React.useCallback((next: Language) => {
        setLanguageState(next);
        setCookie(LOCALE_COOKIE, next, { maxAgeSeconds: 60 * 60 * 24 * 365 });
        if (typeof window !== "undefined") {
            try {
                window.localStorage.setItem(LOCALE_STORAGE, next);
            } catch {
                // ignore
            }
        }
    }, []);

    React.useEffect(() => {
        if (typeof window !== "undefined") {
            try {
                const stored = window.localStorage.getItem(LOCALE_STORAGE);
                if (stored) {
                    const next = resolveLanguage(stored || undefined);
                    if (next !== language) updateUserLanguage(next);
                    return;
                }
            } catch {
                // ignore
            }

            const next = detectBrowserLanguage();
            if (next !== language) updateUserLanguage(next);
        }
    }, [language, updateUserLanguage]);

    React.useEffect(() => {
        const meta = LANG_META[language];
        if (typeof document !== "undefined") {
            document.documentElement.lang = language;
            document.documentElement.dir = meta.dir;
        }
    }, [language]);

    const value = React.useMemo<LocaleContextValue>(() => {
        const meta = LANG_META[language];
        return {
            language,
            locale: meta.locale,
            dir: meta.dir,
            updateUserLanguage,
        };
    }, [language, updateUserLanguage]);

    return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
    const ctx = React.useContext(LocaleContext);
    if (!ctx) {
        return {
            language: DEFAULT_LANGUAGE,
            locale: LANG_META[DEFAULT_LANGUAGE].locale,
            dir: LANG_META[DEFAULT_LANGUAGE].dir,
            updateUserLanguage: () => undefined,
        } as LocaleContextValue;
    }
    return ctx;
}
