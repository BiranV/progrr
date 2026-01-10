"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

export function EntityEditFooter({
    isNew,
    isLoading,
    formId,
    onCancel,
    createLabel = "Create",
    creatingLabel = "Creating...",
    editLabel = "Save Changes",
    savingLabel = "Saving...",
}: {
    isNew: boolean;
    isLoading: boolean;
    formId: string;
    onCancel: () => void;
    createLabel?: string;
    creatingLabel?: string;
    editLabel?: string;
    savingLabel?: string;
}) {
    const submitLabel = isLoading
        ? isNew
            ? creatingLabel
            : savingLabel
        : isNew
            ? createLabel
            : editLabel;

    return (
        <div className="flex gap-3 justify-end">
            <Button
                variant="outline"
                type="button"
                onClick={onCancel}
                disabled={isLoading}
            >
                Cancel
            </Button>
            <Button
                type="submit"
                form={formId}
                disabled={isLoading}
            >
                {submitLabel}
            </Button>
        </div>
    );
}
