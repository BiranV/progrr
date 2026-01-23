import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "flatpickr/dist/flatpickr.min.css";
import "./globals.css";
import { Providers } from "./providers";
import PWARegister from "@/components/PWARegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Progrr",
  description: "Professional Growth & Resource Repository",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Progrr",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
      // Keep a larger icon for higher-DPI contexts.
      { url: "/logo.png", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon-32.png", type: "image/png", sizes: "32x32" }],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const langCookie = cookieStore.get("progrr_lang")?.value;
  const lang = langCookie === "en" ? "en" : "he";
  const dir = lang === "he" ? "rtl" : "ltr";

  return (
    <html lang={lang} dir={dir}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers initialLanguage={lang}>
          <PWARegister />
          {children}
        </Providers>
      </body>
    </html>
  );
}
