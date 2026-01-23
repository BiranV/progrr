"use client";

import { useLocale } from "@/context/LocaleContext";
import { createTranslator, getDictionary } from "@/i18n";

export function useI18n() {
    const { language } = useLocale();
    const dict = getDictionary(language);
    const t = createTranslator(dict);
    return { t, language };
}
