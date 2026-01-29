"use client";

import React from "react";
import Splash from "@/components/Splash";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/context/LocaleContext";

type AppBootstrapContextValue = {
    isAppReady: boolean;
};

const AppBootstrapContext = React.createContext<AppBootstrapContextValue | null>(
    null,
);

export function AppBootstrapProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const USE_SPLASH_MIN_DELAY = true;
    const { isLoadingAuth } = useAuth();
    const { isLocaleReady, dir } = useLocale();
    const [minDelayDone, setMinDelayDone] = React.useState(false);
    const [isAppReady, setIsAppReady] = React.useState(false);
    const readyRef = React.useRef(false);

    React.useEffect(() => {
        if (!USE_SPLASH_MIN_DELAY) {
            setMinDelayDone(true);
            return;
        }
        const id = window.setTimeout(() => {
            setMinDelayDone(true);
        }, 3000);
        return () => window.clearTimeout(id);
    }, []);

    React.useEffect(() => {
        if (readyRef.current) return;
        if (isLoadingAuth) return;
        if (!isLocaleReady) return;
        if (!minDelayDone) return;
        readyRef.current = true;
        setIsAppReady(true);
    }, [isLoadingAuth, isLocaleReady, minDelayDone]);

    return (
        <AppBootstrapContext.Provider value={{ isAppReady }}>
            <Splash visible={!isAppReady} dir={dir} />
            {children}
        </AppBootstrapContext.Provider>
    );
}

export function useAppBootstrap() {
    const ctx = React.useContext(AppBootstrapContext);
    if (!ctx) {
        return { isAppReady: false };
    }
    return ctx;
}
