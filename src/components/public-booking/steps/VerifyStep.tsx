"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import OtpInput from "@/components/OtpInput";

type ConflictAppointment = {
    id?: string;
    serviceName?: string;
    date?: string;
    startTime?: string;
};

type ActiveConflict = {
    code: "ACTIVE_APPOINTMENT_EXISTS" | "SAME_SERVICE_SAME_DAY_EXISTS";
    existingAppointment?: ConflictAppointment;
    existingAppointments?: ConflictAppointment[];
};

export default function VerifyStep({
    formError,
    activeConflict,
    cancellingConflictId,
    submitting,
    otpCode,
    onOtpChange,
    onResend,
    onConfirm,
    resendDisabled,
    confirmDisabled,
    onCancelConflictAppointment,
    onKeyDown,
    t,
}: {
    formError?: string | null;
    activeConflict?: ActiveConflict | null;
    cancellingConflictId?: string | null;
    submitting: boolean;
    otpCode: string;
    onOtpChange: (value: string) => void;
    onResend: () => void;
    onConfirm: () => void;
    resendDisabled: boolean;
    confirmDisabled: boolean;
    onCancelConflictAppointment: (appointmentId: string) => void;
    onKeyDown?: (event: React.KeyboardEvent) => void;
    t: (key: string, params?: Record<string, any>) => string;
}) {
    return (
        <div className="space-y-4" onKeyDown={onKeyDown}>
            {formError ? (
                <div className="text-sm text-red-600 dark:text-red-400">
                    {formError}
                </div>
            ) : null}

            {activeConflict ? (
                <div className="rounded-2xl border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 p-4">
                    <div className="font-semibold text-amber-900 dark:text-amber-200">
                        {activeConflict.code === "SAME_SERVICE_SAME_DAY_EXISTS"
                            ? t("publicBooking.conflict.sameServiceTitle")
                            : t("publicBooking.conflict.upcomingTitle")}
                    </div>
                    <div className="text-sm text-amber-800/90 dark:text-amber-200/80 mt-1">
                        {activeConflict.code === "SAME_SERVICE_SAME_DAY_EXISTS"
                            ? t("publicBooking.conflict.sameServiceDescription")
                            : t("publicBooking.conflict.upcomingDescription")}
                    </div>

                    <div className="mt-2 space-y-2">
                        {(Array.isArray(activeConflict.existingAppointments)
                            ? activeConflict.existingAppointments
                            : activeConflict.existingAppointment
                                ? [activeConflict.existingAppointment]
                                : []
                        )
                            .filter((x: any) => String(x?.id ?? "").trim())
                            .map((appt: any) => {
                                const apptId = String(appt?.id ?? "").trim();
                                const label = `${appt?.serviceName ? `${appt.serviceName} • ` : ""}${appt?.date || ""}${appt?.startTime ? ` • ${appt.startTime}` : ""}`;

                                return (
                                    <div
                                        key={apptId}
                                        className="rounded-xl border border-amber-200/70 dark:border-amber-900/40 bg-white/60 dark:bg-black/10 p-3"
                                    >
                                        <div className="text-sm text-amber-900/90 dark:text-amber-200/90">
                                            {label}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="rounded-2xl w-full mt-2"
                                            disabled={submitting || cancellingConflictId === apptId}
                                            onClick={() => onCancelConflictAppointment(apptId)}
                                        >
                                            {cancellingConflictId === apptId
                                                ? t("publicBooking.actions.cancelling")
                                                : t("publicBooking.actions.cancelAppointment")}
                                        </Button>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            ) : null}

            <div className="flex justify-center">
                <OtpInput
                    id="booking-otp"
                    name="code"
                    length={6}
                    value={otpCode}
                    onChange={onOtpChange}
                    disabled={submitting}
                />
            </div>

            <div className="flex gap-2">
                <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={onResend}
                    disabled={resendDisabled}
                >
                    {t("publicBooking.verify.resend")}
                </Button>

                <Button
                    className="rounded-2xl flex-1"
                    onClick={onConfirm}
                    disabled={confirmDisabled}
                >
                    {submitting
                        ? t("publicBooking.actions.confirming")
                        : t("publicBooking.verify.confirmBooking")}
                </Button>
            </div>
        </div>
    );
}
