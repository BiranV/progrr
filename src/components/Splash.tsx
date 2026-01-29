"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Splash({
    visible,
    dir,
}: {
    visible: boolean;
    dir: "rtl" | "ltr";
}) {
    return (
        <AnimatePresence>
            {visible ? (
                <motion.div
                    key="splash"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className="fixed inset-0 z-[9999] min-h-screen bg-gradient-to-b from-teal-400 to-teal-500 flex items-center justify-center"
                    dir={dir}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.1 }}
                        transition={{ duration: 0.5 }}
                        className="flex flex-col items-center gap-6"
                    >
                        <motion.div
                            initial={{ y: 20 }}
                            animate={{ y: 0 }}
                            transition={{
                                duration: 0.8,
                                repeat: Infinity,
                                repeatType: "reverse",
                                ease: "easeInOut",
                            }}
                            className="relative"
                        >
                            <div className="relative w-28 h-28">
                                <svg viewBox="0 0 100 100" className="w-full h-full">
                                    <motion.circle
                                        cx="50"
                                        cy="50"
                                        r="45"
                                        fill="white"
                                        initial={{ scale: 0.9, opacity: 0.9 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
                                    />
                                    <g transform="translate(30, 25)">
                                        <rect x="0" y="0" width="40" height="8" rx="2" fill="#14b8a6" />
                                        {[0, 1, 2].map((row) =>
                                            [0, 1, 2].map((col) => (
                                                <motion.circle
                                                    key={`${row}-${col}`}
                                                    cx={7 + col * 13}
                                                    cy={16 + row * 13}
                                                    r="3"
                                                    fill="#14b8a6"
                                                    initial={{ opacity: 0.4 }}
                                                    animate={{ opacity: [0.4, 1, 0.4] }}
                                                    transition={{
                                                        duration: 2,
                                                        repeat: Infinity,
                                                        delay: (row * 3 + col) * 0.1,
                                                    }}
                                                />
                                            )),
                                        )}
                                        <motion.path
                                            d="M 14 27 L 18 31 L 26 21"
                                            stroke="#0d9488"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            fill="none"
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: 1 }}
                                            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
                                        />
                                    </g>
                                </svg>
                            </div>

                            <motion.div
                                className="absolute -top-2 -right-2 w-4 h-4 bg-white/40 rounded-full"
                                animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.8, 0.4] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                            <motion.div
                                className="absolute -bottom-1 -left-3 w-3 h-3 bg-white/30 rounded-full"
                                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.7, 0.3] }}
                                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                            />
                            <motion.div
                                className="absolute top-1/2 -right-4 w-2 h-2 bg-white/30 rounded-full"
                                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.6, 0.3] }}
                                transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                            />
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3, duration: 0.5 }}
                        >
                            <h1 className="text-4xl font-bold text-white tracking-wider">
                                PROGRR
                            </h1>
                        </motion.div>

                        <motion.div
                            className="flex gap-2 mt-8"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                        >
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    className="w-2 h-2 bg-white rounded-full"
                                    animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }}
                                    transition={{
                                        duration: 1,
                                        repeat: Infinity,
                                        delay: i * 0.2,
                                    }}
                                />
                            ))}
                        </motion.div>
                    </motion.div>
                </motion.div>
            ) : null}
        </AnimatePresence>
    );
}
