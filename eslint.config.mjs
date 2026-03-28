import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/** Empty or local-only scratch files under tmp/ (not part of the Next app). */
const scratchGlobs = ["tmp/**"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ...scratchGlobs,
  ]),
  {
    files: ["src/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    rules: {
      // Many rows come from dynamic Supabase selects; tighten gradually instead of blocking CI.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
