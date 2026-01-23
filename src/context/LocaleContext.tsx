"use client";

import React from "react";
import { getCookie, setCookie } from "@/lib/client-cookies";

type Language = "he" | "en";

type LocaleContextValue = {
    language: Language;
    locale: "he-IL" | "en-US";
    dir: "rtl" | "ltr";
    setLanguage: (lang: Language) => void;
};

const DEFAULT_LANGUAGE: Language = "he";
const LOCALE_COOKIE = "progrr_lang";

const LANG_META: Record<Language, { locale: "he-IL" | "en-US"; dir: "rtl" | "ltr" }> = {
    he: { locale: "he-IL", dir: "rtl" },
    en: { locale: "en-US", dir: "ltr" },
};

function resolveLanguage(raw?: string | null): Language {
    return raw === "en" ? "en" : DEFAULT_LANGUAGE;
}

const LocaleContext = React.createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = React.useState<Language>(() =>
        resolveLanguage(getCookie(LOCALE_COOKIE))
    );

    const setLanguage = React.useCallback((next: Language) => {
        setLanguageState(next);
        setCookie(LOCALE_COOKIE, next, { maxAgeSeconds: 60 * 60 * 24 * 365 });
    }, []);

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
            setLanguage,
        };
    }, [language, setLanguage]);

    return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
    const ctx = React.useContext(LocaleContext);
    if (!ctx) {
        return {
            language: DEFAULT_LANGUAGE,
            locale: LANG_META[DEFAULT_LANGUAGE].locale,
            dir: LANG_META[DEFAULT_LANGUAGE].dir,
            setLanguage: () => undefined,
        } as LocaleContextValue;
    }
    return ctx;
}
