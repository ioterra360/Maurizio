import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    // Only pick up pure-TS feature tests. Anything React/Native lives in
    // app/ and components/ — out of scope for Vitest by design.
    include: ["features/**/*.test.ts", "lib/**/*.test.ts"],
    reporters: "default",
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: ["features/**/*.ts", "lib/**/*.ts"],
      exclude: ["**/*.test.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
