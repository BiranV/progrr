import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  // Project-wide rule tuning: keep Next.js defaults, but don't fail lint for
  // patterns that are currently used widely across the codebase.
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",

      // These are valuable, but currently too noisy; keep as warnings.
      "react-hooks/exhaustive-deps": "warn",
      "react/no-unescaped-entities": "warn",

      // This rule is very strict and flags `Date.now()` usage in renders.
      // If you want to enforce it later, we can turn it back on and fix cases.
      "react-hooks/purity": "off",
    },
  },

  // Allow common config patterns.
  {
    files: [
      "tailwind.config.ts",
      "postcss.config.*",
      "next.config.*",
      "scripts/**/*.{js,mjs,ts}",
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
