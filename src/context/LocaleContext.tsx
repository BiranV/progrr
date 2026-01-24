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

const LANG_META: Record<Language, { locale: "he-IL" | "en-US"; dir: "rtl" | "ltr" }> = {
    he: { locale: "he-IL", dir: "rtl" },
    en: { locale: "en-US", dir: "ltr" },
};

function resolveLanguage(raw?: string | null): Language {
    return raw === "he" || raw === "en" ? raw : DEFAULT_LANGUAGE;
}

const LocaleContext = React.createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
    children,
    initialLanguage = DEFAULT_LANGUAGE,
}: {
    children: React.ReactNode;
    initialLanguage?: Language;
}) {
    const [language, setLanguageState] = React.useState<Language>(
        resolveLanguage(initialLanguage)
    );

    const updateUserLanguage = React.useCallback((next: Language) => {
        setLanguageState(next);
        setCookie(LOCALE_COOKIE, next, { maxAgeSeconds: 60 * 60 * 24 * 365 });
    }, []);

    React.useEffect(() => {
        setCookie(LOCALE_COOKIE, language, { maxAgeSeconds: 60 * 60 * 24 * 365 });
    }, [language]);

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
