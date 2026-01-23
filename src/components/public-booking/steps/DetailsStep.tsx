"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";

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

export default function DetailsStep({
    formError,
    activeConflict,
    cancellingConflictId,
    submitting,
    onCancelConflictAppointment,
    canSkipCustomerDetailsForm,
    selectedServiceName,
    durationLabel,
    priceLabel,
    date,
    startTime,
    endTime,
    customerFullName,
    customerEmail,
    customerPhone,
    customerPhoneValid,
    customerPhoneTouched,
    onCustomerFullNameChange,
    onCustomerEmailChange,
    onCustomerPhoneChange,
    onCustomerPhoneValidityChange,
    onCustomerPhoneBlur,
    notes,
    onNotesChange,
    onConfirm,
    confirmDisabled,
    confirmLabel,
    submittingLabel,
    onKeyDown,
    t,
}: {
    formError?: string | null;
    activeConflict?: ActiveConflict | null;
    cancellingConflictId?: string | null;
    submitting: boolean;
    onCancelConflictAppointment: (appointmentId: string) => void;
    canSkipCustomerDetailsForm: boolean;
    selectedServiceName?: string;
    durationLabel?: string;
    priceLabel?: string;
    date: string;
    startTime: string;
    endTime?: string;
    customerFullName: string;
    customerEmail: string;
    customerPhone: string;
    customerPhoneValid: boolean;
    customerPhoneTouched: boolean;
    onCustomerFullNameChange: (value: string) => void;
    onCustomerEmailChange: (value: string) => void;
    onCustomerPhoneChange: (value: string) => void;
    onCustomerPhoneValidityChange: (valid: boolean) => void;
    onCustomerPhoneBlur: () => void;
    notes: string;
    onNotesChange: (value: string) => void;
    onConfirm: () => void;
    confirmDisabled: boolean;
    confirmLabel: string;
    submittingLabel: string;
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

            {canSkipCustomerDetailsForm ? (
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-950/10 p-4">
                    <div className="font-semibold text-gray-900 dark:text-white">
                        {t("publicBooking.details.confirmBookingTitle")}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {selectedServiceName
                            ? selectedServiceName
                            : t("publicBooking.details.appointmentFallback")}
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-200 mt-1">
                        {date}
                        {startTime ? ` • ${startTime}` : ""}
                        {endTime ? `–${endTime}` : ""}
                    </div>
                    {durationLabel && priceLabel ? (
                        <div className="text-sm text-muted-foreground mt-1">
                            {durationLabel} • {priceLabel}
                        </div>
                    ) : null}
                </div>
            ) : (
                <div className="rounded-2xl border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/10 p-4">
                    <div className="font-semibold text-amber-900 dark:text-amber-200">
                        {t("publicBooking.details.completeDetailsTitle")}
                    </div>
                    <div className="text-sm text-amber-800/90 dark:text-amber-200/80 mt-1">
                        {t("publicBooking.details.completeDetailsDescription")}
                    </div>
                </div>
            )}

            {!canSkipCustomerDetailsForm ? (
                <>
                    <div className="space-y-2">
                        <Label htmlFor="fullName">
                            {t("publicBooking.details.fullNameLabel")}
                        </Label>
                        <Input
                            id="fullName"
                            className="rounded-2xl"
                            value={customerFullName}
                            onChange={(e) => onCustomerFullNameChange(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">{t("publicBooking.details.emailLabel")}</Label>
                        <Input
                            id="email"
                            className="rounded-2xl"
                            value={customerEmail}
                            onChange={(e) => onCustomerEmailChange(e.target.value)}
                            placeholder={t("publicBooking.details.emailPlaceholder")}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="phone">{t("publicBooking.details.phoneLabel")}</Label>
                        <PhoneInput
                            id="phone"
                            className="rounded-2xl"
                            inputClassName="rounded-2xl"
                            value={customerPhone}
                            onChange={(v) => onCustomerPhoneChange(v)}
                            onValidityChange={onCustomerPhoneValidityChange}
                            onBlur={onCustomerPhoneBlur}
                            aria-invalid={customerPhoneTouched && !customerPhoneValid}
                            placeholder={t("publicBooking.details.phonePlaceholder")}
                        />
                        {customerPhoneTouched && customerPhone.trim() && !customerPhoneValid ? (
                            <div className="text-xs text-red-600 dark:text-red-400">
                                {t("publicBooking.details.invalidPhone")}
                            </div>
                        ) : null}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">{t("publicBooking.details.notesLabel")}</Label>
                        <Textarea
                            id="notes"
                            className="rounded-2xl"
                            value={notes}
                            onChange={(e) => onNotesChange(e.target.value)}
                        />
                    </div>
                </>
            ) : null}

            <Button
                onClick={onConfirm}
                disabled={confirmDisabled}
                className="rounded-2xl w-full"
            >
                {submitting ? submittingLabel : confirmLabel}
            </Button>
        </div>
    );
}
