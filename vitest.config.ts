import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globals: false,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["packages/*/src/**/*.ts"]
    }
  },
  resolve: {
    alias: {
      "@dstack/shared": new URL("./packages/shared/src/index.ts", import.meta.url).pathname,
      "@dstack/core": new URL("./packages/core/src/index.ts", import.meta.url).pathname
    }
  }
});
