import util from "node:util";

// Monkey patch node:util styleText to prevent Node 21.7.3 crashes with Rolldown
if (typeof (util as any).styleText === "function") {
  const originalStyleText = (util as any).styleText;
  (util as any).styleText = function (format: any, text: any) {
    try {
      if (Array.isArray(format)) {
        // Fallback to formatting with the first style, or simple fallback
        return originalStyleText(format[0] || "reset", text);
      }
      return originalStyleText(format, text);
    } catch (e) {
      return text;
    }
  };
}

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    exclude: ["**/node_modules/**", "**/dist/**", "**/tests/e2e/**"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
