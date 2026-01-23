import en from "./en";
import he from "./he";
import type { Language } from "@/context/LocaleContext";

export const dictionaries = { en, he } as const;

export type Dictionary = typeof en;
export type TranslationKey = keyof typeof en | string;

export function getDictionary(lang: Language): Dictionary {
    return dictionaries[lang] ?? dictionaries.he;
}

function resolvePath(obj: any, path: string): string | undefined {
    const parts = path.split(".");
    let node = obj;
    for (const part of parts) {
        if (!node || typeof node !== "object") return undefined;
        node = node[part];
    }
    return typeof node === "string" ? node : undefined;
}

export function formatMessage(
    template: string,
    params?: Record<string, string | number>
): string {
    if (!params) return template;
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
        params[key] !== undefined ? String(params[key]) : ""
    );
}

export function createTranslator(dict: Dictionary) {
    return (key: string, params?: Record<string, string | number>) => {
        const template = resolvePath(dict, key) ?? key;
        return formatMessage(template, params);
    };
}
