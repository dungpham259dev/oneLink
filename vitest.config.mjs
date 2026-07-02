import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    exclude: ["node_modules", "e2e", ".next"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      exclude: ["lib/**/__tests__/**", "lib/db.ts", "lib/redis.ts", "lib/stripe.ts"],
    },
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
