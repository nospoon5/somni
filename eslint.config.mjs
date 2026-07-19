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
  {
    files: ["tests/e2e/**/*.ts"],
    rules: {
      // Playwright names its fixture continuation callback `use`; it is not a React Hook.
      "react-hooks/rules-of-hooks": "off",
    },
  },
]);

export default eslintConfig;
