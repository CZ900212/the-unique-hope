import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "next/server": fileURLToPath(new URL("./node_modules/next/server.js", import.meta.url)),
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    exclude: [
      "backend/**",
      "frontend/**",
      "node_modules/**",
      ".next/**",
      "output/**",
      "qa/**",
    ],
    include: ["src/**/*.test.ts"],
  },
});
