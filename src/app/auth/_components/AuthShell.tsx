"use client";

import React from "react";
import { useTheme } from "@/context/ThemeContext";
import { Moon, Sun } from "lucide-react";

export default function AuthShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Animated Background Shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 dark:bg-purple-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-indigo-300 dark:bg-indigo-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 dark:bg-pink-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Dark Mode Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={toggleDarkMode}
          className="p-3 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg hover:bg-white dark:hover:bg-gray-700 transition-all border border-gray-200 dark:border-gray-700"
          aria-label="Toggle dark mode"
        >
          {darkMode ? (
            <Sun className="w-5 h-5 text-gray-300" />
          ) : (
            <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          )}
        </button>
      </div>

      <div className="relative min-h-screen flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-6 sm:gap-10 lg:gap-12 items-center">
          {/* Left Side - Branding */}
          <div className="flex flex-col items-center justify-center text-center space-y-0">
            <div className="relative">
              <img
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
                Transform your coaching business with intelligent client
                management
              </p>
              <div className="flex flex-nowrap sm:flex-wrap justify-center gap-1 sm:gap-3 lg:gap-4 pt-2 sm:pt-3 lg:pt-4">
                <div className="px-2 py-0.5 sm:px-4 sm:py-2 bg-white dark:bg-gray-800 rounded-full shadow-md">
                  <span className="text-[11px] sm:text-sm font-semibold leading-none text-purple-600 dark:text-purple-400 whitespace-nowrap">
                    📊 Track Progress
                  </span>
                </div>
                <div className="px-2 py-0.5 sm:px-4 sm:py-2 bg-white dark:bg-gray-800 rounded-full shadow-md">
                  <span className="text-[11px] sm:text-sm font-semibold leading-none text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                    💪 Build Plans
                  </span>
                </div>
                <div className="px-2 py-0.5 sm:px-4 sm:py-2 bg-white dark:bg-gray-800 rounded-full shadow-md">
                  <span className="text-[11px] sm:text-sm font-semibold leading-none text-purple-600 dark:text-purple-400 whitespace-nowrap">
                    🎯 Achieve Goals
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Slot */}
          <div className="w-full max-w-[360px] sm:max-w-md mx-auto">
            {children}
            {footer ? (
              footer
            ) : (
              <p className="text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-4 sm:mt-6">
                By continuing, you agree to our Terms & Privacy Policy
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
