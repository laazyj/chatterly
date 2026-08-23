import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/**", "coverage/**", ".data/**", "docs/**"] },

  js.configs.recommended,

  {
    files: ["**/*.ts"],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // An agent loop is almost entirely async. An unawaited interceptor or tool
      // call is the bug that will actually happen, so these stay errors.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",

      // ChatEvent, Message and ContentBlock are discriminated unions. This turns
      // "add a variant" into a compile-time to-do list across the codebase.
      "@typescript-eslint/switch-exhaustiveness-check": "error",

      // Type-only imports must stay erasable under Node's type stripping.
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],

      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  {
    // Seam contracts stay explicit without annotating every internal helper.
    files: ["src/**/types/*.ts"],
    rules: { "@typescript-eslint/explicit-module-boundary-types": "error" },
  },

  {
    files: ["tests/**/*.ts", "evals/**/*.ts", "*.config.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
    },
  },

  prettier,
);
