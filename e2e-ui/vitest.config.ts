import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/tests/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    globalSetup: ["src/setup/global-setup.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    reporters: ["default"],
    sequence: {
      sequential: true,
    },
  },
});
