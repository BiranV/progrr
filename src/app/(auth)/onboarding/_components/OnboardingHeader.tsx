"use client";

import { useAuth } from "@/context/AuthContext";
import ClientAvatar from "@/components/ClientAvatar";
import { ArrowLeft } from "lucide-react";

export default function OnboardingHeader({
  title,
  onBack,
  showBack,
}: {
  title: string;
  onBack: () => void;
  showBack: boolean;
}) {
  const { user } = useAuth();

  return (
    <div className="relative mb-2 w-[120%] -ml-[10%]">
      {/* Curved Background */}
      <div
        className="absolute inset-x-0 top-0 h-[220px] bg-emerald-500 shadow-md -z-10"
        style={{
          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
          borderBottomLeftRadius: "50% 30%",
          borderBottomRightRadius: "50% 30%",
        }}
      />

      <div className="pt-8 px-6 pb-12 relative z-10 flex flex-col items-center text-center">
        <div className="w-full flex items-center justify-between mb-4 px-4">
          {showBack ? (
            <button
              onClick={onBack}
              className="p-2 text-white/90 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          ) : (
            <div className="w-10" />
          )}

          <h1 className="text-lg font-medium text-white/90">{title}</h1>
          <div className="w-10" />
        </div>

        <div className="flex flex-col items-center">
          <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-full mb-3">
            <div className="p-1 bg-white rounded-full shadow-xl">
              <ClientAvatar
                name={user?.full_name || user?.email || "User"}
                src={user?.image}
                className="w-24 h-24 text-3xl font-bold bg-gray-100 text-emerald-600"
              />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide">
            {user?.full_name || user?.email?.split("@")[0] || "Welcome"}
          </h2>
        </div>
      </div>
    </div>
  );
}
