"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, Calendar, Moon, Store, Users, Sun } from "lucide-react";

import { useTheme } from "@/context/ThemeContext";

export default function AuthGroupLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const pathname = usePathname();
    const isOnboarding = pathname.startsWith("/onboarding");
    const { darkMode, toggleDarkMode } = useTheme();

    return (
        <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                    className={
                        "absolute top-20 left-10 w-72 h-72 bg-purple-300 dark:bg-purple-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-20 animate-blob" +
                        (isOnboarding ? " opacity-10" : "")
                    }
                />
                <div
                    className={
                        "absolute top-40 right-10 w-72 h-72 bg-indigo-300 dark:bg-indigo-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-20 animate-blob animation-delay-2000" +
                        (isOnboarding ? " opacity-10" : "")
                    }
                />
                <div
                    className={
                        "absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 dark:bg-pink-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-20 animate-blob animation-delay-4000" +
                        (isOnboarding ? " opacity-10" : "")
                    }
                />
            </div>

            <div className="absolute top-4 right-4 z-50">
                <button
                    onClick={toggleDarkMode}
                    className="p-3 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg hover:bg-white dark:hover:bg-gray-700 transition-all border border-gray-200 dark:border-gray-700"
                    aria-label="Toggle dark mode"
                    type="button"
                >
                    {darkMode ? (
                        <Sun className="w-5 h-5 text-gray-300" />
                    ) : (
                        <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    )}
                </button>
            </div>

            <motion.div
                layout
                className="relative min-h-screen flex items-center justify-center px-4 py-8 sm:py-12"
                transition={{ duration: 0.35, ease: "easeInOut" }}
            >
                <motion.div
                    layout
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className={
                        isOnboarding
                            ? "w-full max-w-2xl"
                            : "w-full max-w-6xl grid lg:grid-cols-2 gap-6 sm:gap-10 lg:gap-12 items-center"
                    }
                >
                    <AnimatePresence initial={false} mode="popLayout">
                        {!isOnboarding ? (
                            <motion.div
                                key="auth-brand"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                transition={{ duration: 0.25, ease: "easeOut" }}
                                className="flex flex-col items-center justify-center text-center space-y-0"
                            >
                                <div className="relative">
                                    <motion.img
                                        layoutId="progrr-logo"
                                        src="/logo.png"
                                        alt="Progrr Logo"
                                        className="relative w-24 h-24 sm:w-44 sm:h-44 lg:w-64 lg:h-64 object-contain drop-shadow-2xl"
                                    />
                                </div>
                                <div className="space-y-3 -mt-2 sm:space-y-4 sm:-mt-5 lg:-mt-8">
                                    <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent pb-1 lg:pb-2">
                                        progrr
                                    </h1>
                                    <p className="text-sm sm:text-lg lg:text-xl text-gray-600 dark:text-gray-300 max-w-md">
                                        Run your service business with clarity.
                                    </p>
                                    <div className="pt-2 sm:pt-3 lg:pt-4 w-full max-w-md mx-auto">
                                        <div className="space-y-3 text-left">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 shadow-sm">
                                                    <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                                                </div>
                                                <div>
                                                    <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                                                        Schedule and appointments
                                                    </div>
                                                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                                                        Control availability, working hours, and bookings.
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 shadow-sm">
                                                    <Users className="h-4 w-4 text-purple-600 dark:text-purple-300" />
                                                </div>
                                                <div>
                                                    <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                                                        Clients in one place
                                                    </div>
                                                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                                                        Keep client details and history organized.
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 shadow-sm">
                                                    <BriefcaseBusiness className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                                                </div>
                                                <div>
                                                    <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                                                        Services
                                                    </div>
                                                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                                                        Define what you offer with clear durations and rates.
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 shadow-sm">
                                                    <Store className="h-4 w-4 text-purple-600 dark:text-purple-300" />
                                                </div>
                                                <div>
                                                    <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                                                        Business profile
                                                    </div>
                                                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                                                        Set up your public-facing details and basics.
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ) : null}
                    </AnimatePresence>

                    <motion.div
                        layout
                        transition={{ duration: 0.35, ease: "easeInOut" }}
                        className={
                            isOnboarding
                                ? "w-full"
                                : "w-full max-w-[360px] sm:max-w-md mx-auto"
                        }
                    >
                        <AnimatePresence initial={false} mode="popLayout">
                            {isOnboarding ? (
                                <motion.div
                                    key="onboarding-logo"
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.22, ease: "easeOut" }}
                                    className="flex justify-center mb-6"
                                >
                                    <motion.img
                                        layoutId="progrr-logo"
                                        src="/logo.png"
                                        alt="Progrr"
                                        className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-xl"
                                    />
                                </motion.div>
                            ) : null}
                        </AnimatePresence>

                        <motion.div
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                        >
                            {children}
                        </motion.div>

                        {!isOnboarding ? (
                            <p className="text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-4 sm:mt-6">
                                By continuing, you agree to our Terms & Privacy Policy
                            </p>
                        ) : null}
                    </motion.div>
                </motion.div>
            </motion.div>
        </div>
    );
}
