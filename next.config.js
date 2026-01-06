/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    root: __dirname,
  },

  // Dev-only: hide the floating Next.js dev indicator (Route / Bundler / Preferences).
  // (Next.js v16+ uses `devIndicators: false`; `devIndicators.buildActivity` was removed.)
  ...(process.env.NODE_ENV === "development" ? { devIndicators: false } : {}),
};

module.exports = nextConfig;
