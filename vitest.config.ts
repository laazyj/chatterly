import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Only the seams with real logic. Covering a null implementation proves nothing.
      include: ["src/core/**", "src/tools/**", "src/adapters/memory/jsonl-session-store.ts"],
      exclude: ["**/types/**"],
      // A floor, not a target: an alarm if a spike guts the loop, not a number to chase.
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
        "src/core/**": { lines: 80, functions: 70, branches: 60, statements: 80 },
        "src/tools/protocols/**": { lines: 80, functions: 70, branches: 60, statements: 80 },
      },
    },
  },
});
