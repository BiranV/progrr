"use client";

import React from "react";

export type Language = "he" | "en";

type LocaleContextValue = {
    language: Language;
    locale: "he-IL" | "en-US";
    dir: "rtl" | "ltr";
    updateUserLanguage: (lang: Language) => void;
    isLocaleReady: boolean;
};

const DEFAULT_LANGUAGE: Language = "he";
const LOCALE_STORAGE = "progrr_lang";

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
}: {
    children: React.ReactNode;
}) {
    const [language, setLanguageState] = React.useState<Language>(DEFAULT_LANGUAGE);
    const [mounted, setMounted] = React.useState(false);

    const updateUserLanguage = React.useCallback((next: Language) => {
        setLanguageState(next);
        if (typeof window !== "undefined") {
            try {
                window.localStorage.setItem(LOCALE_STORAGE, next);
            } catch {
                // ignore
            }
        }
    }, []);

    React.useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const stored = window.localStorage.getItem(LOCALE_STORAGE);
            const resolved = resolveLanguage(stored);
            setLanguageState(resolved);
        } catch {
            // ignore
        }
        setMounted(true);
    }, []);

    React.useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem(LOCALE_STORAGE, language);
        } catch {
            // ignore
        }
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
            isLocaleReady: mounted,
        };
    }, [language, mounted, updateUserLanguage]);

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
            isLocaleReady: false,
        } as LocaleContextValue;
    }
    return ctx;
}
