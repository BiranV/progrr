"use client";

import * as React from "react";

export function useEntityPanelState(options?: { defaultEditing?: boolean }) {
    const [isEditing, setIsEditing] = React.useState(
        Boolean(options?.defaultEditing)
    );
    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

    const startEdit = React.useCallback(() => {
        setIsEditing(true);
        setShowDeleteConfirm(false);
    }, []);

    const cancelEdit = React.useCallback(() => {
        setIsEditing(false);
        setShowDeleteConfirm(false);
    }, []);

    const requestDelete = React.useCallback(() => {
        setShowDeleteConfirm(true);
    }, []);

    const cancelDelete = React.useCallback(() => {
        setShowDeleteConfirm(false);
    }, []);

    return React.useMemo(
        () => ({
            isEditing,
            startEdit,
            cancelEdit,
            showDeleteConfirm,
            requestDelete,
            cancelDelete,
        }),
        [
            isEditing,
            startEdit,
            cancelEdit,
            showDeleteConfirm,
            requestDelete,
            cancelDelete,
        ]
    );
}
