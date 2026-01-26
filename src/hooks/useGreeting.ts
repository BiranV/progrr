import React from "react";

import { useI18n } from "@/i18n/useI18n";
import { getHebrewGreetingKeyByTime } from "@/lib/greeting";

export function useGreeting(): string {
    const { t, language } = useI18n();
    const [greeting, setGreeting] = React.useState("");

    React.useEffect(() => {
        // if (language !== "he") {
        //     setGreeting("");
        //     return;
        // }

        const key = getHebrewGreetingKeyByTime(new Date());
        setGreeting(t(key));
    }, [language, t]);

    return greeting;
}
