"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";

type Appointment = {
    serviceName: string;
    date: string;
    startTime: string;
    endTime: string;
    customer: { fullName: string };
    notes?: string;
};

type SameDayAppointment = {
    id: string;
    serviceName: string;
    date: string;
    startTime: string;
    endTime: string;
};

type BookingResult = {
    appointment: Appointment;
    sameDayAppointments?: SameDayAppointment[];
};

export default function SuccessStep({
    result,
    cancelError,
    cancelling,
    cancellingSameDayId,
    limitCustomerToOneUpcomingAppointment,
    onCancelSameDay,
    onBookAnother,
    onAddToGoogle,
    onCancelBooking,
    identified,
    onDisconnect,
    t,
}: {
    result: BookingResult;
    cancelError?: string | null;
    cancelling: boolean;
    cancellingSameDayId?: string | null;
    limitCustomerToOneUpcomingAppointment: boolean;
    onCancelSameDay: (appointmentId: string) => void;
    onBookAnother: () => void;
    onAddToGoogle: () => void;
    onCancelBooking: () => void;
    identified: boolean;
    onDisconnect: () => void;
    t: (key: string, params?: Record<string, any>) => string;
}) {
    return (
        <div className="space-y-4">
            {cancelError ? (
                <div className="text-sm text-red-600 dark:text-red-400">
                    {cancelError}
                </div>
            ) : null}

            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/20 p-4 shadow-sm">
                <div className="font-semibold text-gray-900 dark:text-white">
                    {result.appointment.serviceName}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                    {result.appointment.customer.fullName}
                </div>
                {result.appointment.notes ? (
                    <div className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                        {result.appointment.notes}
                    </div>
                ) : null}
            </div>

            {Array.isArray(result.sameDayAppointments) &&
                result.sameDayAppointments.length > 1 ? (
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/20 p-4 shadow-sm">
                    <div className="font-semibold text-gray-900 dark:text-white">
                        {t("publicBooking.success.appointmentsOn", {
                            date: result.appointment.date,
                        })}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {t("publicBooking.success.canCancelBelow")}
                    </div>

                    <div className="mt-3 space-y-2">
                        {result.sameDayAppointments.map((a) => (
                            <div
                                key={a.id}
                                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-950/10 p-3"
                            >
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                    {a.startTime}–{a.endTime}
                                </div>
                                <div className="text-sm text-gray-700 dark:text-gray-200">
                                    {a.serviceName}
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-2xl w-full mt-2"
                                    disabled={cancellingSameDayId === a.id || cancelling}
                                    onClick={() => onCancelSameDay(a.id)}
                                >
                                    {cancellingSameDayId === a.id
                                        ? t("publicBooking.actions.cancelling")
                                        : t("publicBooking.actions.cancelAppointment")}
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="space-y-2">
                <div className="flex flex-wrap gap-3">
                    {!limitCustomerToOneUpcomingAppointment ? (
                        <Button className="rounded-2xl" onClick={onBookAnother}>
                            {t("publicBooking.success.bookAnother")}
                        </Button>
                    ) : null}

                    <Button
                        variant="outline"
                        className="rounded-2xl"
                        onClick={onAddToGoogle}
                    >
                        {t("publicBooking.success.addToGoogle")}
                    </Button>

                    <Button
                        variant="outline"
                        className="rounded-2xl"
                        onClick={onCancelBooking}
                        disabled={cancelling}
                    >
                        {cancelling
                            ? t("publicBooking.actions.cancelling")
                            : t("publicBooking.success.cancelBooking")}
                    </Button>
                </div>

                {identified ? (
                    <div className="flex justify-center">
                        <Button
                            variant="ghost"
                            className="rounded-2xl"
                            onClick={onDisconnect}
                            disabled={cancelling}
                        >
                            {cancelling
                                ? t("publicBooking.success.disconnecting")
                                : t("publicBooking.success.notYouDisconnect")}
                        </Button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
