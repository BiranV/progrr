"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, MessageCircle, Calendar, Star } from "lucide-react";
import { useI18n } from "@/i18n/useI18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const slides = [
    {
        image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=500&h=600&fit=crop",
        titleKey: "onboardingIntro.slides.smartScheduling.title",
        descriptionKey: "onboardingIntro.slides.smartScheduling.description",
        icon: Calendar,
    },
    {
        image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&h=600&fit=crop",
        titleKey: "onboardingIntro.slides.insights.title",
        descriptionKey: "onboardingIntro.slides.insights.description",
        icon: Star,
    },
    {
        image: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=500&h=600&fit=crop",
        titleKey: "onboardingIntro.slides.bookingLink.title",
        descriptionKey: "onboardingIntro.slides.bookingLink.description",
        icon: MessageCircle,
    },
];

export default function OnboardingIntroPage() {
    const router = useRouter();
    const { t, language } = useI18n();
    const isRtl = language === "he";
    const [currentSlide, setCurrentSlide] = useState(0);



    const nextSlide = () => {
        if (currentSlide < slides.length - 1) {
            setCurrentSlide((prev) => prev + 1);
        }
    };

    const prevSlide = () => {
        if (currentSlide > 0) {
            setCurrentSlide((prev) => prev - 1);
        }
    };

    const slide = slides[currentSlide];
    const Icon = slide.icon;

    const handleExit = () => {
        router.push("/auth");
    };

    return (
        <div className="min-h-screen bg-white flex flex-col" dir={isRtl ? "rtl" : "ltr"}>
            <div className="fixed top-4 left-1/2 z-40 -translate-x-1/2">
                <LanguageSwitcher variant="light" />
            </div>
            <div className={`p-4 flex justify-between items-center ${isRtl ? "flex-row-reverse" : ""}`}>
                <span className="text-gray-400 text-sm">
                    {t("onboardingIntro.step", {
                        current: currentSlide + 1,
                        total: slides.length,
                    })}
                </span>
                <button
                    type="button"
                    onClick={handleExit}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                    {t("onboardingIntro.skip")}
                </button>
            </div>

            <div className="flex-1 flex flex-col">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentSlide}
                        initial={{ opacity: 0, x: isRtl ? -50 : 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: isRtl ? 50 : -50 }}
                        transition={{ duration: 0.3 }}
                        className="flex-1 flex flex-col"
                    >
                        <div className="px-8 pt-4">
                            <div className="relative aspect-[4/5] max-w-sm mx-auto rounded-3xl overflow-hidden shadow-2xl">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={slide.image}
                                    alt={t(slide.titleKey)}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

                                <motion.div
                                    className={`absolute bottom-6 ${isRtl ? "right-6" : "left-6"} w-14 h-14 bg-teal-500 rounded-2xl flex items-center justify-center shadow-lg`}
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.3, type: "spring" }}
                                >
                                    <Icon className="w-7 h-7 text-white" />
                                </motion.div>
                            </div>
                        </div>

                        <div className="text-center mt-8 px-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-3">
                                {t(slide.titleKey)}
                            </h2>
                            <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">
                                {t(slide.descriptionKey)}
                            </p>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            <div className="p-6 pb-10">
                <div className="flex justify-center gap-2 mb-6">
                    {slides.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentSlide(index)}
                            className={`h-2 rounded-full transition-all duration-300 ${index === currentSlide ? "w-8 bg-teal-500" : "w-2 bg-gray-200"
                                }`}
                            aria-label={t("onboardingIntro.dotAria", { index: index + 1 })}
                        />
                    ))}
                </div>

                <div className="flex gap-3">
                    {currentSlide > 0 && (
                        <Button
                            variant="outline"
                            onClick={prevSlide}
                            className="flex-1 h-14 rounded-xl text-lg font-medium border-2 border-teal-500 text-teal-500 hover:bg-teal-50"
                        >
                            {isRtl ? (
                                <>
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                    {t("onboardingIntro.previous")}
                                </>
                            ) : (
                                <>
                                    <ArrowLeft className="w-5 h-5 mr-2" />
                                    {t("onboardingIntro.previous")}
                                </>
                            )}
                        </Button>
                    )}

                    {currentSlide < slides.length - 1 ? (
                        <Button
                            onClick={nextSlide}
                            className="flex-1 h-14 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-lg font-medium shadow-lg shadow-teal-500/30"
                        >
                            {isRtl ? (
                                <>
                                    {t("onboardingIntro.next")}
                                    <ArrowLeft className="w-5 h-5 mr-2" />
                                </>
                            ) : (
                                <>
                                    {t("onboardingIntro.next")}
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </>
                            )}
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            onClick={handleExit}
                            className="w-full flex-1 h-14 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-lg font-medium shadow-lg shadow-teal-500/30"
                        >
                            {isRtl ? (
                                <>
                                    {t("onboardingIntro.start")}
                                    <ArrowLeft className="w-5 h-5 mr-2" />
                                </>
                            ) : (
                                <>
                                    {t("onboardingIntro.start")}
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
