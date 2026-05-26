/// <reference types="vitest/config" />
import { execSync } from "node:child_process";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function gitShortSha(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/Matematiks/" : "/",
  define: {
    __APP_VERSION__: JSON.stringify(gitShortSha()),
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
  },
}));
