"use client";

import * as React from "react";
import SidePanel from "@/components/ui/side-panel";

type PanelMeta = {
    title: string;
    description?: string;
    footer?: React.ReactNode;
};

type GenericDetailsPanelContextValue = {
    open: boolean;
    close: () => void;
    setTitle: (title: string) => void;
    setDescription: (description?: string) => void;
    setFooter: (footer?: React.ReactNode) => void;
};

const GenericDetailsPanelContext = React.createContext<
    GenericDetailsPanelContextValue | undefined
>(undefined);

export function useGenericDetailsPanel() {
    const ctx = React.useContext(GenericDetailsPanelContext);
    if (!ctx) {
        throw new Error(
            "useGenericDetailsPanel must be used within <GenericDetailsPanel>"
        );
    }
    return ctx;
}

export function GenericDetailsPanel({
    open,
    onOpenChange,
    defaultTitle = "Details",
    defaultDescription,
    widthClassName,
    children,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultTitle?: string;
    defaultDescription?: string;
    widthClassName?: string;
    children: React.ReactNode;
}) {
    const [meta, setMeta] = React.useState<PanelMeta>({
        title: defaultTitle,
        description: defaultDescription,
        footer: <div className="flex justify-start" />,
    });

    React.useEffect(() => {
        if (open) return;
        setMeta({
            title: defaultTitle,
            description: defaultDescription,
            footer: <div className="flex justify-start" />,
        });
    }, [open, defaultTitle, defaultDescription]);

    const ctx = React.useMemo<GenericDetailsPanelContextValue>(
        () => ({
            open,
            close: () => onOpenChange(false),
            setTitle: (title) => setMeta((m) => ({ ...m, title })),
            setDescription: (description) => setMeta((m) => ({ ...m, description })),
            setFooter: (footer) =>
                setMeta((m) => ({ ...m, footer: footer ?? <div className="flex justify-start" /> })),
        }),
        [open, onOpenChange]
    );

    return (
        <GenericDetailsPanelContext.Provider value={ctx}>
            <SidePanel
                open={open}
                onOpenChange={onOpenChange}
                title={meta.title}
                description={meta.description}
                widthClassName={widthClassName}
                footer={meta.footer}
            >
                {children}
            </SidePanel>
        </GenericDetailsPanelContext.Provider>
    );
}
