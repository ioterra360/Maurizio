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
      // lib/i18n reads the device locale from react-native and persists the
      // preference in AsyncStorage; neither loads in Node. Stubs keep the
      // pure-TS tests pure (see test/stubs/).
      "react-native": path.resolve(__dirname, "test/stubs/react-native.ts"),
      "@react-native-async-storage/async-storage": path.resolve(__dirname, "test/stubs/async-storage.ts"),
    },
  },
});
