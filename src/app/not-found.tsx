"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Home, AlertCircle } from "lucide-react";

export default function NotFound() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const pageName = pathname?.substring(1) || "unknown";

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full">
        <div className="text-center space-y-6">
          {/* 404 Error Code */}
          <div className="space-y-2">
            <h1 className="text-7xl font-light text-slate-300">404</h1>
            <div className="h-0.5 w-16 bg-slate-200 mx-auto"></div>
          </div>

          {/* Main Message */}
          <div className="space-y-3">
            <h2 className="text-2xl font-medium text-slate-800">
              Page Not Found
            </h2>
            <p className="text-slate-600 leading-relaxed">
              The page{" "}
              <span className="font-medium text-slate-700">"{pageName}"</span>{" "}
              could not be found in this application.
            </p>
          </div>

          {/* Admin Note */}
          {isAuthenticated && user?.role === "admin" && (
            <div className="mt-8 p-4 bg-slate-100 rounded-lg border border-slate-200">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                </div>
                <div className="text-left space-y-1">
                  <p className="text-sm font-medium text-slate-700">
                    Admin Note
                  </p>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    This could mean that the AI hasn't implemented this page
                    yet. Ask it to implement it in the chat.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-6">
            <Link href="/dashboard">
              <button className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500">
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
