"use client";

import React from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useI18n } from "@/i18n/useI18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function WelcomePage() {
    const router = useRouter();
    const { t, language } = useI18n();
    const isRtl = language === "he";

    const images = [
        "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1512486130939-2c4f79935e4f?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=200&h=200&fit=crop",
    ];

    const handleContinue = () => {
        router.push("/onboarding-intro");
    };

    return (
        <div className="min-h-screen bg-white flex flex-col" dir={isRtl ? "rtl" : "ltr"}>
            <div className="fixed top-4 left-1/2 z-40 -translate-x-1/2">
                <LanguageSwitcher variant="light" />
            </div>
            {/* <div className="p-4 flex justify-between items-center">
                <span className="text-gray-400 text-sm">
                    {t("welcomeScreen.step", { current: 3, total: 3 })}
                </span>
            </div> */}

            <div className="flex-1 px-6 py-6">
                <motion.div
                    className="grid grid-cols-3 gap-3 max-w-sm mx-auto"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                >
                    {images.map((img, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1, duration: 0.4 }}
                            className={`aspect-square rounded-2xl overflow-hidden ${index === 4 ? "ring-4 ring-teal-400 ring-offset-2" : ""
                                }`}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={img}
                                alt={t("welcomeScreen.imageAlt", { index: index + 1 })}
                                className="w-full h-full object-cover"
                            />
                        </motion.div>
                    ))}
                </motion.div>

                <motion.div
                    className="text-center mt-10 px-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8, duration: 0.5 }}
                >
                    <h1 className="text-2xl font-bold text-gray-900 mb-3">
                        {t("welcomeScreen.title")}
                    </h1>
                    <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">
                        {t("welcomeScreen.subtitle")}
                    </p>
                </motion.div>
            </div>

            <motion.div
                className="p-6 pb-10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 0.5 }}
            >
                <Button
                    type="button"
                    onClick={handleContinue}
                    className="w-full h-14 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-lg font-medium shadow-lg shadow-teal-500/30"
                >
                    {t("welcomeScreen.cta")}
                    {isRtl ? (
                        <ArrowLeft className="w-5 h-5 mr-2" />
                    ) : (
                        <ArrowRight className="w-5 h-5 ml-2" />
                    )}
                </Button>
            </motion.div>
        </div>
    );
}
