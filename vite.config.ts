import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    cors: {
      origin: true, // Allow any origin
      credentials: true,
    },
  },
});
